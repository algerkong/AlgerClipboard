import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import i18n from "@/i18n";
import { getManagedWindowDecorations } from "@/services/windowOptions";
import { getSavedWindowSize } from "@/lib/windowSize";

export const FILE_VIEWER_SIZE_KEY = "file-viewer-size";

let viewerCounter = 0;

export async function openFileViewer(entryId: string) {
  viewerCounter++;
  const label = `file-viewer-${viewerCounter}`;
  const size = getSavedWindowSize(FILE_VIEWER_SIZE_KEY, { width: 800, height: 600 });

  const viewer = new WebviewWindow(label, {
    url: `index.html?window=file-viewer&id=${encodeURIComponent(entryId)}`,
    title: i18n.t("fileViewer.title"),
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
    console.error("Failed to create file viewer window:", e);
  });
}
