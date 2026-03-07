import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import i18n from "@/i18n";
import { getManagedWindowDecorations } from "@/services/windowOptions";

let windowCounter = 0;

export async function openSettingsWindow(tab?: string) {
  windowCounter++;
  const label = `settings-${windowCounter}`;
  const url = tab
    ? `index.html?window=settings&tab=${tab}`
    : `index.html?window=settings`;

  const win = new WebviewWindow(label, {
    url,
    title: i18n.t("settings.title"),
    width: 680,
    height: 560,
    minWidth: 560,
    minHeight: 460,
    ...getManagedWindowDecorations(),
    alwaysOnTop: true,
    center: true,
    shadow: true,
    resizable: true,
  });

  win.once("tauri://error", (e) => {
    console.error("Failed to create settings window:", e);
  });
}
