import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { getManagedWindowDecorations } from "@/services/windowOptions";
import { getSavedWindowSize } from "@/lib/windowSize";

export const IMAGE_VIEWER_SIZE_KEY = "image-viewer-size";

let viewerCounter = 0;

export async function openImageViewer(blobPath: string) {
  viewerCounter++;
  const label = `image-viewer-${viewerCounter}`;
  const size = getSavedWindowSize(IMAGE_VIEWER_SIZE_KEY, { width: 900, height: 650 });

  const viewer = new WebviewWindow(label, {
    url: `index.html?window=image-viewer&blobPath=${encodeURIComponent(blobPath)}`,
    title: "Image Preview",
    width: size.width,
    height: size.height,
    minWidth: 500,
    minHeight: 400,
    ...getManagedWindowDecorations(),
    alwaysOnTop: true,
    center: true,
    shadow: true,
    resizable: true,
  });

  viewer.once("tauri://error", (e) => {
    console.error("Failed to create image viewer window:", e);
  });
}
