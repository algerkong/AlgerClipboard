import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { getManagedWindowDecorations } from "@/services/windowOptions";

let windowCounter = 0;

export async function openTemplateManager() {
  windowCounter++;
  const label = `template-manager-${windowCounter}`;

  const win = new WebviewWindow(label, {
    url: `index.html?window=template-manager`,
    title: "Template Manager",
    width: 480,
    height: 520,
    minWidth: 360,
    minHeight: 400,
    ...getManagedWindowDecorations(),
    alwaysOnTop: true,
    center: true,
    shadow: true,
    resizable: true,
  });

  win.once("tauri://error", (e) => {
    console.error("Failed to create template manager window:", e);
  });
}
