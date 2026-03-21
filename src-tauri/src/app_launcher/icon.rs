use std::path::PathBuf;

pub struct IconExtractor {
    cache_dir: PathBuf,
}

impl IconExtractor {
    pub fn new(cache_dir: PathBuf) -> Self {
        std::fs::create_dir_all(&cache_dir).ok();
        Self { cache_dir }
    }

    /// Extract app icon and return as base64-encoded PNG.
    pub fn extract_icon(&self, app_path: &str) -> Option<String> {
        let hash = Self::path_hash(app_path);
        let cache_path = self.cache_dir.join(format!("{}.png", hash));

        // Check cache first
        if cache_path.exists() {
            if let Ok(data) = std::fs::read(&cache_path) {
                use base64::Engine;
                return Some(base64::engine::general_purpose::STANDARD.encode(&data));
            }
        }

        // Platform-specific extraction
        let png_data = self.extract_platform(app_path)?;
        std::fs::write(&cache_path, &png_data).ok();
        use base64::Engine;
        Some(base64::engine::general_purpose::STANDARD.encode(&png_data))
    }

    fn path_hash(path: &str) -> String {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        let mut hasher = DefaultHasher::new();
        path.hash(&mut hasher);
        format!("{:x}", hasher.finish())
    }

    #[cfg(target_os = "windows")]
    fn extract_platform(&self, app_path: &str) -> Option<Vec<u8>> {
        use std::ffi::c_void;
        use windows_sys::Win32::Graphics::Gdi::*;
        use windows_sys::Win32::UI::Shell::ExtractIconExW;
        use windows_sys::Win32::UI::WindowsAndMessaging::DestroyIcon;

        // Convert path to wide string
        let wide_path: Vec<u16> = app_path.encode_utf16().chain(std::iter::once(0)).collect();

        unsafe {
            let mut large_icon: *mut c_void = std::ptr::null_mut();
            let count = ExtractIconExW(
                wide_path.as_ptr(),
                0,
                &mut large_icon,
                std::ptr::null_mut(),
                1,
            );

            if count == 0 || large_icon.is_null() {
                return None;
            }

            let result = hicon_to_png(large_icon);
            DestroyIcon(large_icon);
            result
        }
    }

    #[cfg(target_os = "macos")]
    fn extract_platform(&self, _app_path: &str) -> Option<Vec<u8>> {
        None
    }

    #[cfg(target_os = "linux")]
    fn extract_platform(&self, _app_path: &str) -> Option<Vec<u8>> {
        None
    }
}

#[cfg(target_os = "windows")]
unsafe fn hicon_to_png(hicon: *mut std::ffi::c_void) -> Option<Vec<u8>> {
    use windows_sys::Win32::Graphics::Gdi::*;
    use windows_sys::Win32::UI::WindowsAndMessaging::{GetIconInfo, ICONINFO};

    let mut icon_info: ICONINFO = std::mem::zeroed();
    if GetIconInfo(hicon, &mut icon_info) == 0 {
        return None;
    }

    // Get bitmap dimensions
    let mut bmp: BITMAP = std::mem::zeroed();
    if GetObjectW(
        icon_info.hbmColor as *mut std::ffi::c_void,
        std::mem::size_of::<BITMAP>() as i32,
        &mut bmp as *mut _ as *mut std::ffi::c_void,
    ) == 0
    {
        DeleteObject(icon_info.hbmColor as _);
        DeleteObject(icon_info.hbmMask as _);
        return None;
    }

    let width = bmp.bmWidth as u32;
    let height = bmp.bmHeight as u32;
    if width == 0 || height == 0 {
        DeleteObject(icon_info.hbmColor as _);
        DeleteObject(icon_info.hbmMask as _);
        return None;
    }

    let hdc_screen = GetDC(std::ptr::null_mut());
    let hdc = CreateCompatibleDC(hdc_screen);

    let mut bi = BITMAPINFO {
        bmiHeader: BITMAPINFOHEADER {
            biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
            biWidth: width as i32,
            biHeight: -(height as i32), // top-down
            biPlanes: 1,
            biBitCount: 32,
            biCompression: BI_RGB,
            biSizeImage: 0,
            biXPelsPerMeter: 0,
            biYPelsPerMeter: 0,
            biClrUsed: 0,
            biClrImportant: 0,
        },
        bmiColors: [std::mem::zeroed()],
    };

    let buf_size = (width * height * 4) as usize;
    let mut buffer: Vec<u8> = vec![0u8; buf_size];

    let old = SelectObject(hdc, icon_info.hbmColor as _);
    GetDIBits(
        hdc,
        icon_info.hbmColor,
        0,
        height,
        buffer.as_mut_ptr() as *mut std::ffi::c_void,
        &mut bi,
        DIB_RGB_COLORS,
    );
    SelectObject(hdc, old);

    DeleteDC(hdc);
    ReleaseDC(std::ptr::null_mut(), hdc_screen);
    DeleteObject(icon_info.hbmColor as _);
    DeleteObject(icon_info.hbmMask as _);

    // Convert BGRA to RGBA
    for chunk in buffer.chunks_exact_mut(4) {
        chunk.swap(0, 2);
    }

    // Encode as PNG
    let img = image::RgbaImage::from_raw(width, height, buffer)?;
    let mut png_data = Vec::new();
    let encoder = image::codecs::png::PngEncoder::new(std::io::Cursor::new(&mut png_data));
    image::ImageEncoder::write_image(
        encoder,
        img.as_raw(),
        width,
        height,
        image::ExtendedColorType::Rgba8,
    )
    .ok()?;

    Some(png_data)
}
