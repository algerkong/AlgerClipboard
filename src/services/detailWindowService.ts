import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import i18n from "@/i18n";
import { getManagedWindowDecorations } from "@/services/windowOptions";
import { getSavedWindowSize } from "@/lib/windowSize";

export const DETAIL_SIZE_KEY = "detail";

let windowCounter = 0;

export async function openDetailWindow(entryId: string, tab?: "view" | "translate" | "ai") {
  windowCounter++;
  const label = `detail-${windowCounter}`;
  let url = `index.html?window=detail&id=${encodeURIComponent(entryId)}`;
  if (tab) url += `&tab=${tab}`;

  const size = await getSavedWindowSize(DETAIL_SIZE_KEY, { width: 780, height: 580 });

  const win = new WebviewWindow(label, {
    url,
    title: i18n.t("detail.title"),
    width: size.width,
    height: size.height,
    minWidth: 560,
    minHeight: 440,
    ...getManagedWindowDecorations(),
    visible: false,
    alwaysOnTop: true,
    center: true,
    shadow: true,
    resizable: true,
  });

  win.once("tauri://error", (e) => {
    console.error("Failed to create detail window:", e);
  });
}
