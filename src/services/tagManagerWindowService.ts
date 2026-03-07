import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import i18n from "@/i18n";
import { getManagedWindowDecorations } from "@/services/windowOptions";

let windowCounter = 0;

export async function openTagManagerWindow() {
  windowCounter++;
  const label = `tag-manager-${windowCounter}`;

  const win = new WebviewWindow(label, {
    url: "index.html?window=tag-manager",
    title: i18n.t("tags.title"),
    width: 620,
    height: 520,
    minWidth: 520,
    minHeight: 420,
    ...getManagedWindowDecorations(),
    alwaysOnTop: true,
    center: true,
    shadow: true,
    resizable: true,
  });

  win.once("tauri://error", (e) => {
    console.error("Failed to create tag manager window:", e);
  });
}
