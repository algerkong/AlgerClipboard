import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { getManagedWindowDecorations } from "@/services/windowOptions";
import { getSavedWindowSize } from "@/lib/windowSize";

const TEMPLATE_MANAGER_LABEL = "template-manager";

export async function openTemplateManager() {
  const existing = await WebviewWindow.getByLabel(TEMPLATE_MANAGER_LABEL);
  if (existing) {
    await existing.setFocus();
    return;
  }

  const size = await getSavedWindowSize(TEMPLATE_MANAGER_LABEL, { width: 480, height: 520 });

  const win = new WebviewWindow(TEMPLATE_MANAGER_LABEL, {
    url: `index.html?window=template-manager`,
    title: "Template Manager",
    width: size.width,
    height: size.height,
    minWidth: 360,
    minHeight: 400,
    ...getManagedWindowDecorations(),
    visible: false,
    alwaysOnTop: true,
    center: true,
    shadow: true,
    resizable: true,
  });

  win.once("tauri://error", (e) => {
    console.error("Failed to create template manager window:", e);
  });
}
