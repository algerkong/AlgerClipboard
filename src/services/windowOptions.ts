import { platform as getPlatform } from "@tauri-apps/plugin-os";

export function isMacOS() {
  return getPlatform() === "macos";
}

export function getManagedWindowDecorations() {
  if (isMacOS()) {
    return {
      decorations: true,
      titleBarStyle: "overlay" as const,
      hiddenTitle: true,
    };
  }

  return {
    decorations: false,
  };
}
