import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import i18n from "@/i18n";
import { getManagedWindowDecorations } from "@/services/windowOptions";
import { getSavedWindowSize } from "@/lib/windowSize";

export const SETTINGS_SIZE_KEY = "settings-window-size";

const SETTINGS_LABEL = "settings";

export async function openSettingsWindow(tab?: string) {
  // If settings window already exists, focus it instead of creating a new one
  const existing = await WebviewWindow.getByLabel(SETTINGS_LABEL);
  if (existing) {
    await existing.setFocus();
    return;
  }

  const url = tab
    ? `index.html?window=settings&tab=${tab}`
    : `index.html?window=settings`;

  const size = getSavedWindowSize(SETTINGS_SIZE_KEY, { width: 680, height: 560 });

  const win = new WebviewWindow(SETTINGS_LABEL, {
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
