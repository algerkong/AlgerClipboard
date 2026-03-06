import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export interface UpdateInfo {
  version: string;
  body: string | undefined;
  update: Update;
}

export async function checkForUpdates(): Promise<UpdateInfo | null> {
  const update = await check();
  if (!update) {
    return null;
  }
  return {
    version: update.version,
    body: update.body,
    update,
  };
}

export async function downloadAndInstall(
  update: Update,
  onProgress?: (downloaded: number, total: number | undefined) => void,
): Promise<void> {
  let downloaded = 0;
  await update.downloadAndInstall((event) => {
    switch (event.event) {
      case "Started":
        onProgress?.(0, event.data.contentLength);
        break;
      case "Progress":
        downloaded += event.data.chunkLength;
        onProgress?.(downloaded, undefined);
        break;
      case "Finished":
        break;
    }
  });
  await relaunch();
}
