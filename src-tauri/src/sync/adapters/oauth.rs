use std::io::{Read, Write};
use std::net::TcpListener;

pub struct OAuthResult {
    pub code: String,
    pub port: u16,
}

/// Open a URL in the default browser, handling special characters properly.
fn open_browser(url: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        // cmd.exe and explorer.exe both misinterpret '&' in URLs.
        // Use ShellExecuteW directly to avoid any shell parsing issues.
        use std::os::windows::ffi::OsStrExt;
        let url_w: Vec<u16> = std::ffi::OsStr::new(url)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        let open_w: Vec<u16> = std::ffi::OsStr::new("open")
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        unsafe {
            windows_sys::Win32::UI::Shell::ShellExecuteW(
                std::mem::zeroed(), // hwnd: null
                open_w.as_ptr(),
                url_w.as_ptr(),
                std::ptr::null(),
                std::ptr::null(),
                1, // SW_SHOWNORMAL
            );
        }
        return Ok(());
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open").arg(url).spawn()
            .map_err(|e| format!("Failed to open browser: {}", e))?;
        return Ok(());
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open").arg(url).spawn()
            .map_err(|e| format!("Failed to open browser: {}", e))?;
        return Ok(());
    }
    #[allow(unreachable_code)]
    Err("Unsupported platform".to_string())
}

pub fn oauth_localhost_flow(auth_url: &str) -> Result<OAuthResult, String> {
    let listener = TcpListener::bind("127.0.0.1:0")
        .map_err(|e| format!("Failed to bind: {}", e))?;
    let port = listener.local_addr()
        .map_err(|e| format!("Failed to get addr: {}", e))?.port();

    let full_url = auth_url.replace("{REDIRECT_PORT}", &port.to_string());

    open_browser(&full_url)?;

    // Wait for callback
    let (mut stream, _) = listener.accept()
        .map_err(|e| format!("Accept failed: {}", e))?;

    let mut buf = vec![0u8; 4096];
    let n = stream.read(&mut buf)
        .map_err(|e| format!("Read failed: {}", e))?;
    let request = String::from_utf8_lossy(&buf[..n]).to_string();

    let code = extract_code_from_request(&request)?;

    let response = "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<html><body><h2>Authorization successful!</h2><p>You can close this window.</p><script>setTimeout(()=>window.close(),2000)</script></body></html>";
    let _ = stream.write_all(response.as_bytes());

    Ok(OAuthResult { code, port })
}

fn extract_code_from_request(request: &str) -> Result<String, String> {
    // Parse "GET /callback?code=xxx&... HTTP/1.1"
    let first_line = request.lines().next().unwrap_or("");
    let path = first_line.split_whitespace().nth(1).unwrap_or("");
    if let Some(query) = path.split('?').nth(1) {
        for param in query.split('&') {
            if let Some(value) = param.strip_prefix("code=") {
                return Ok(urlencoding::decode(value)
                    .map_err(|e| format!("Decode error: {}", e))?
                    .to_string());
            }
        }
    }
    Err("No auth code found in callback".to_string())
}
