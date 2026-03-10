import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import i18n from "@/i18n";
import { getManagedWindowDecorations } from "@/services/windowOptions";
import { getSavedWindowSize } from "@/lib/windowSize";

export const SETTINGS_SIZE_KEY = "settings-window-size";

let windowCounter = 0;

export async function openSettingsWindow(tab?: string) {
  windowCounter++;
  const label = `settings-${windowCounter}`;
  const url = tab
    ? `index.html?window=settings&tab=${tab}`
    : `index.html?window=settings`;

  const size = getSavedWindowSize(SETTINGS_SIZE_KEY, { width: 680, height: 560 });

  const win = new WebviewWindow(label, {
    url,
    title: i18n.t("settings.title"),
    width: size.width,
    height: size.height,
    minWidth: 560,
    minHeight: 460,
    ...getManagedWindowDecorations(),
    alwaysOnTop: false,
    center: true,
    shadow: true,
    resizable: true,
  });

  win.once("tauri://error", (e) => {
    console.error("Failed to create settings window:", e);
  });
}
