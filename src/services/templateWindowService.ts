import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { getManagedWindowDecorations } from "@/services/windowOptions";

const TEMPLATE_MANAGER_LABEL = "template-manager";

export async function openTemplateManager() {
  const existing = await WebviewWindow.getByLabel(TEMPLATE_MANAGER_LABEL);
  if (existing) {
    await existing.setFocus();
    return;
  }

  const win = new WebviewWindow(TEMPLATE_MANAGER_LABEL, {
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
