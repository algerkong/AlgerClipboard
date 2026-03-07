import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

let windowCounter = 0;

export async function openDetailWindow(entryId: string, tab?: "view" | "translate" | "ai") {
  windowCounter++;
  const label = `detail-${windowCounter}`;
  let url = `index.html?window=detail&id=${encodeURIComponent(entryId)}`;
  if (tab) url += `&tab=${tab}`;

  const win = new WebviewWindow(label, {
    url,
    title: "Detail",
    width: 680,
    height: 520,
    minWidth: 480,
    minHeight: 400,
    decorations: false,
    alwaysOnTop: true,
    center: true,
    shadow: true,
    resizable: true,
  });

  win.once("tauri://error", (e) => {
    console.error("Failed to create detail window:", e);
  });
}
