import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

const VIEWER_SIZE_KEY = "image-viewer-size";

let viewerCounter = 0;

function getSavedSize(): { width: number; height: number } {
  try {
    const raw = localStorage.getItem(VIEWER_SIZE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.width > 0 && parsed.height > 0) return parsed;
    }
  } catch { /* ignore */ }
  return { width: 900, height: 650 };
}

export async function openImageViewer(blobPath: string) {
  viewerCounter++;
  const label = `image-viewer-${viewerCounter}`;
  const size = getSavedSize();

  const viewer = new WebviewWindow(label, {
    url: `index.html?window=image-viewer&blobPath=${encodeURIComponent(blobPath)}`,
    title: "Image Preview",
    width: size.width,
    height: size.height,
    minWidth: 500,
    minHeight: 400,
    decorations: false,
    alwaysOnTop: true,
    center: true,
    shadow: true,
    resizable: true,
  });

  viewer.once("tauri://error", (e) => {
    console.error("Failed to create image viewer window:", e);
  });
}
