import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import i18n from "@/i18n";
import { getManagedWindowDecorations } from "@/services/windowOptions";
import { getSavedWindowSize } from "@/lib/windowSize";

const TAG_MANAGER_LABEL = "tag-manager";

export async function openTagManagerWindow() {
  const existing = await WebviewWindow.getByLabel(TAG_MANAGER_LABEL);
  if (existing) {
    await existing.setFocus();
    return;
  }

  const size = await getSavedWindowSize(TAG_MANAGER_LABEL, { width: 620, height: 520 });

  const win = new WebviewWindow(TAG_MANAGER_LABEL, {
    url: "index.html?window=tag-manager",
    title: i18n.t("tags.title"),
    width: size.width,
    height: size.height,
    minWidth: 520,
    minHeight: 420,
    ...getManagedWindowDecorations(),
    visible: false,
    alwaysOnTop: true,
    center: true,
    shadow: true,
    resizable: true,
  });

  win.once("tauri://error", (e) => {
    console.error("Failed to create tag manager window:", e);
  });
}
