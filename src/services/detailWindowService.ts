import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import i18n from "@/i18n";
import { getManagedWindowDecorations } from "@/services/windowOptions";

let windowCounter = 0;

export async function openDetailWindow(entryId: string, tab?: "view" | "translate" | "ai") {
  windowCounter++;
  const label = `detail-${windowCounter}`;
  let url = `index.html?window=detail&id=${encodeURIComponent(entryId)}`;
  if (tab) url += `&tab=${tab}`;

  const win = new WebviewWindow(label, {
    url,
    title: i18n.t("detail.title"),
    width: 680,
    height: 520,
    minWidth: 480,
    minHeight: 400,
    ...getManagedWindowDecorations(),
    alwaysOnTop: true,
    center: true,
    shadow: true,
    resizable: true,
  });

  win.once("tauri://error", (e) => {
    console.error("Failed to create detail window:", e);
  });
}
