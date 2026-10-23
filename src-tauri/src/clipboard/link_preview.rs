use crate::storage::blob::BlobStore;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::IpAddr;
use std::sync::OnceLock;
use std::time::Duration;
use tokio::sync::Semaphore;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinkPreview {
    pub url: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub image_path: Option<String>,
    pub favicon_url: Option<String>,
    pub fetched_at: String,
}

static URL_RE: OnceLock<regex::Regex> = OnceLock::new();
static META_RE: OnceLock<regex::Regex> = OnceLock::new();
static LINK_RE: OnceLock<regex::Regex> = OnceLock::new();
static ATTR_RE: OnceLock<regex::Regex> = OnceLock::new();
static TITLE_RE: OnceLock<regex::Regex> = OnceLock::new();
static SEMAPHORE: OnceLock<Semaphore> = OnceLock::new();

fn url_re() -> &'static regex::Regex {
    URL_RE.get_or_init(|| regex::Regex::new(r#"https?://[^\s<>"']+"#).unwrap())
}

fn meta_re() -> &'static regex::Regex {
    META_RE.get_or_init(|| regex::Regex::new(r"(?is)<meta\s+([^>]+?)/?>").unwrap())
}

fn link_re() -> &'static regex::Regex {
    LINK_RE.get_or_init(|| regex::Regex::new(r"(?is)<link\s+([^>]+?)/?>").unwrap())
}

fn attr_re() -> &'static regex::Regex {
    ATTR_RE.get_or_init(|| {
        regex::Regex::new(
            r#"(?is)([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))"#,
        )
        .unwrap()
    })
}

fn title_re() -> &'static regex::Regex {
    TITLE_RE.get_or_init(|| regex::Regex::new(r"(?is)<title[^>]*>(.*?)</title>").unwrap())
}

fn semaphore() -> &'static Semaphore {
    SEMAPHORE.get_or_init(|| Semaphore::new(3))
}

/// Find the first http(s) URL in a text entry, trimming trailing punctuation.
pub fn extract_first_url(text: &str) -> Option<String> {
    if text.len() > 16_384 {
        return None;
    }

    let matched = url_re().find(text)?.as_str();
    let trimmed = matched.trim_end_matches(|ch: char| {
        matches!(
            ch,
            ')' | ']'
                | '}'
                | '.'
                | ','
                | ';'
                | '!'
                | '?'
                | '。'
                | '，'
                | '！'
                | '？'
                | '；'
                | '：'
                | '"'
                | '\''
                | '>'
        )
    });

    if trimmed.len() < 8 {
        None
    } else {
        Some(trimmed.to_string())
    }
}

pub async fn fetch_link_preview(
    url: &str,
    blob_store: &BlobStore,
) -> Result<LinkPreview, String> {
    let parsed = reqwest::Url::parse(url).map_err(|e| format!("Invalid URL: {}", e))?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err("Only http/https URLs are supported".to_string());
    }
    if is_private_host(parsed.host_str().unwrap_or_default()) {
        return Err("Private hosts are not allowed".to_string());
    }

    let _permit = semaphore()
        .acquire()
        .await
        .map_err(|e| format!("Link preview concurrency error: {}", e))?;

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .user_agent("AlgerClipboard/1.10 (+https://github.com/algerkong/AlgerClipboard)")
        .redirect(reqwest::redirect::Policy::custom(|attempt| {
            if attempt.previous().len() >= 5
                || attempt
                    .url()
                    .host_str()
                    .map(is_private_host)
                    .unwrap_or(true)
            {
                attempt.stop()
            } else {
                attempt.follow()
            }
        }))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let response = client
        .get(parsed.clone())
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("HTTP {}", response.status()));
    }

    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default()
        .to_lowercase();
    if !content_type.contains("text/html") && !content_type.contains("application/xhtml") {
        return Err(format!("Unsupported content type: {}", content_type));
    }

    let body = read_limited(response, 128 * 1024).await?;
    let html = String::from_utf8_lossy(&body);

    let meta = parse_meta_tags(&html);
    let title = meta_value(&meta, &["og:title", "twitter:title"])
        .or_else(|| {
            title_re()
                .captures(&html)
                .map(|captures| captures[1].to_string())
        })
        .map(|value| clean_text(&value))
        .filter(|value| !value.is_empty());

    let description = meta_value(
        &meta,
        &["og:description", "twitter:description", "description"],
    )
    .map(|value| clean_text(&value))
    .filter(|value| !value.is_empty());

    let favicon_url = extract_icon_href(&html)
        .and_then(|href| parsed.join(&href).ok())
        .map(|url| url.to_string())
        .or_else(|| {
            parsed
                .host_str()
                .map(|host| format!("{}://{}/favicon.ico", parsed.scheme(), host))
        });

    let image_path = match meta_value(&meta, &["og:image", "twitter:image", "twitter:image:src"])
    {
        Some(image_url) => {
            let image_url = parsed
                .join(&image_url)
                .map(|url| url.to_string())
                .unwrap_or(image_url);
            fetch_and_save_image(&client, &image_url, &parsed, blob_store)
                .await
                .ok()
        }
        None => None,
    };

    Ok(LinkPreview {
        url: parsed.to_string(),
        title,
        description,
        image_path,
        favicon_url,
        fetched_at: chrono::Utc::now().to_rfc3339(),
    })
}

async fn fetch_and_save_image(
    client: &reqwest::Client,
    image_url: &str,
    page_url: &reqwest::Url,
    blob_store: &BlobStore,
) -> Result<String, String> {
    let parsed = reqwest::Url::parse(image_url).map_err(|e| e.to_string())?;
    if !matches!(parsed.scheme(), "http" | "https")
        || is_private_host(parsed.host_str().unwrap_or_default())
    {
        return Err("Unsupported image URL".to_string());
    }

    let response = client
        .get(parsed)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        return Err(format!("HTTP {}", response.status()));
    }

    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default()
        .to_lowercase();
    if !content_type.starts_with("image/") {
        return Err("Not an image response".to_string());
    }

    let bytes = read_limited(response, 600 * 1024).await?;
    if bytes.len() < 32 {
        return Err("Image too small".to_string());
    }

    let image =
        image::load_from_memory(&bytes).map_err(|e| format!("Invalid image data: {}", e))?;
    let thumbnail = image.thumbnail(480, 270);
    let mut png = Vec::new();
    thumbnail
        .write_to(
            &mut std::io::Cursor::new(&mut png),
            image::ImageFormat::Png,
        )
        .map_err(|e| format!("Failed to encode thumbnail: {}", e))?;

    let hash = crate::storage::database::compute_hash(page_url.as_str().as_bytes());
    let id = format!("link-{}", &hash[..16]);
    blob_store.save_thumbnail(&id, &png)
}

async fn read_limited(
    mut response: reqwest::Response,
    limit: usize,
) -> Result<Vec<u8>, String> {
    let mut body = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|e| e.to_string())? {
        body.extend_from_slice(&chunk);
        if body.len() >= limit {
            body.truncate(limit);
            break;
        }
    }
    Ok(body)
}

fn is_private_host(host: &str) -> bool {
    let host = host.trim_matches(['[', ']']).to_lowercase();
    if host.is_empty() || host == "localhost" || host.ends_with(".localhost") {
        return true;
    }

    match host.parse::<IpAddr>() {
        Ok(IpAddr::V4(ip)) => {
            ip.is_loopback() || ip.is_private() || ip.is_link_local() || ip.is_unspecified()
        }
        Ok(IpAddr::V6(ip)) => ip.is_loopback() || ip.is_unspecified(),
        Err(_) => false,
    }
}

fn parse_meta_tags(html: &str) -> Vec<HashMap<String, String>> {
    meta_re()
        .captures_iter(html)
        .map(|captures| parse_attributes(&captures[1]))
        .filter(|attributes| !attributes.is_empty())
        .collect()
}

fn parse_attributes(input: &str) -> HashMap<String, String> {
    attr_re()
        .captures_iter(input)
        .filter_map(|captures| {
            let name = captures.get(1)?.as_str().to_lowercase();
            let value = captures
                .get(2)
                .or_else(|| captures.get(3))
                .or_else(|| captures.get(4))?
                .as_str()
                .to_string();
            Some((name, value))
        })
        .collect()
}

fn meta_value(tags: &[HashMap<String, String>], keys: &[&str]) -> Option<String> {
    for tag in tags {
        let key = tag
            .get("property")
            .or_else(|| tag.get("name"))
            .map(|value| value.to_lowercase());
        if let Some(key) = key {
            if keys.iter().any(|candidate| *candidate == key) {
                if let Some(content) = tag.get("content").filter(|value| !value.trim().is_empty()) {
                    return Some(content.clone());
                }
            }
        }
    }
    None
}

fn extract_icon_href(html: &str) -> Option<String> {
    for captures in link_re().captures_iter(html) {
        let attributes = parse_attributes(&captures[1]);
        let rel = attributes
            .get("rel")
            .map(|value| value.to_lowercase())
            .unwrap_or_default();
        if rel.split_whitespace().any(|part| part.contains("icon")) {
            if let Some(href) = attributes.get("href") {
                return Some(href.clone());
            }
        }
    }
    None
}

fn clean_text(value: &str) -> String {
    decode_entities(value)
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn decode_entities(value: &str) -> String {
    let mut decoded = value
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&apos;", "'")
        .replace("&nbsp;", " ");

    let numeric = regex::Regex::new(r"&#(x?[0-9a-fA-F]+);").unwrap();
    decoded = numeric
        .replace_all(&decoded, |captures: &regex::Captures| {
            let value = &captures[1];
            let code = if let Some(hex) = value.strip_prefix('x') {
                u32::from_str_radix(hex, 16).ok()
            } else {
                value.parse::<u32>().ok()
            };
            code.and_then(char::from_u32)
                .map(|ch| ch.to_string())
                .unwrap_or_default()
        })
        .to_string();

    decoded
}
