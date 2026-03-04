import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

let viewerCounter = 0;

export async function openImageViewer(blobPath: string) {
  viewerCounter++;
  const label = `image-viewer-${viewerCounter}`;

  const viewer = new WebviewWindow(label, {
    url: `index.html?window=image-viewer&blobPath=${encodeURIComponent(blobPath)}`,
    title: "Image Preview",
    width: 700,
    height: 500,
    minWidth: 400,
    minHeight: 300,
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
