use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ContentCategory {
    Code,
    Email,
    Url,
    PhoneNumber,
    FilePath,
    Json,
    Xml,
    Color,       // hex color like #ff0000, rgb(...)
    IpAddress,
    Markdown,
    CommandLine, // shell commands
    SqlQuery,
    General,
}

pub fn classify_content(text: &str) -> ContentCategory {
    // Check in order of specificity
    let trimmed = text.trim();
    if trimmed.is_empty() { return ContentCategory::General; }

    // JSON detection (starts with { or [, valid structure)
    if (trimmed.starts_with('{') && trimmed.ends_with('}')) ||
       (trimmed.starts_with('[') && trimmed.ends_with(']')) {
        if serde_json::from_str::<serde_json::Value>(trimmed).is_ok() {
            return ContentCategory::Json;
        }
    }

    // XML/HTML detection
    if trimmed.starts_with('<') && trimmed.contains('>') {
        if trimmed.contains("</") || trimmed.contains("/>") {
            return ContentCategory::Xml;
        }
    }

    // Email
    let email_re = regex::Regex::new(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$").unwrap();
    if email_re.is_match(trimmed) { return ContentCategory::Email; }

    // URL
    let url_re = regex::Regex::new(r"^https?://[^\s]+$").unwrap();
    if url_re.is_match(trimmed) { return ContentCategory::Url; }

    // File path (Windows or Unix)
    let path_re = regex::Regex::new(r"^([A-Za-z]:\\|/)[^\x00]+$").unwrap();
    if path_re.is_match(trimmed) && !trimmed.contains('\n') { return ContentCategory::FilePath; }

    // IP address
    let ip_re = regex::Regex::new(r"^(\d{1,3}\.){3}\d{1,3}(:\d+)?$").unwrap();
    if ip_re.is_match(trimmed) { return ContentCategory::IpAddress; }

    // Phone number (various formats)
    let phone_re = regex::Regex::new(r"^[+]?[\d\s\-().]{7,20}$").unwrap();
    if phone_re.is_match(trimmed) { return ContentCategory::PhoneNumber; }

    // Color values
    let color_re = regex::Regex::new(r"^(#[0-9a-fA-F]{3,8}|rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+|hsla?\(\s*\d+)").unwrap();
    if color_re.is_match(trimmed) { return ContentCategory::Color; }

    // SQL query
    let sql_re = regex::Regex::new(r"(?i)^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|WITH)\s").unwrap();
    if sql_re.is_match(trimmed) { return ContentCategory::SqlQuery; }

    // Command line (starts with common shell prefixes)
    let cmd_re = regex::Regex::new(r"^(\$|>|#|sudo |npm |pnpm |yarn |cargo |git |docker |pip |brew |apt |cd |ls |mkdir |rm |cp |mv |cat |echo |chmod |curl |wget )").unwrap();
    if cmd_re.is_match(trimmed) { return ContentCategory::CommandLine; }

    // Markdown (has markdown-specific syntax patterns)
    let md_indicators: &[&str] = &["# ", "## ", "### ", "```", "- [ ]", "- [x]", "**", "![", "]("];
    let md_count = md_indicators.iter().filter(|&&ind| trimmed.contains(ind)).count();
    if md_count >= 2 { return ContentCategory::Markdown; }

    // Code detection (multiple heuristic signals)
    let code_signals = [
        trimmed.contains("function ") || trimmed.contains("fn "),
        trimmed.contains("const ") || trimmed.contains("let ") || trimmed.contains("var "),
        trimmed.contains("import ") || trimmed.contains("require("),
        trimmed.contains("class ") || trimmed.contains("struct "),
        trimmed.contains("if (") || trimmed.contains("if let"),
        trimmed.contains("for (") || trimmed.contains("for ") && trimmed.contains(" in "),
        trimmed.contains("return ") || trimmed.contains("=> {"),
        trimmed.contains(";") && trimmed.lines().filter(|l| l.trim().ends_with(';')).count() > 1,
        trimmed.contains("def ") || trimmed.contains("print("),
        trimmed.contains("pub ") || trimmed.contains("impl "),
    ];
    let code_score: usize = code_signals.iter().filter(|&&s| s).count();
    if code_score >= 2 { return ContentCategory::Code; }

    ContentCategory::General
}
