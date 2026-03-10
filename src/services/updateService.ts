import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { ask } from "@tauri-apps/plugin-dialog";
import { notify } from "@/services/notificationService";
import i18n from "@/i18n";

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

/**
 * Show system notification + confirmation dialog for an available update.
 * If user confirms, download and install. Returns true if update was initiated.
 */
export async function promptAndInstallUpdate(info: UpdateInfo): Promise<boolean> {
  const t = i18n.t.bind(i18n);

  // Send system notification
  notify.info(t("update.available", { version: info.version }), {
    title: "AlgerClipboard",
  });

  // Show confirmation dialog
  const confirmed = await ask(
    t("update.confirmMessage", { version: info.version }),
    {
      title: t("update.confirmTitle"),
      kind: "info",
      okLabel: t("update.confirmOk"),
      cancelLabel: t("update.confirmCancel"),
    },
  );

  if (confirmed) {
    await downloadAndInstall(info.update);
    return true;
  }

  return false;
}

// Periodic update check interval: 4 hours
const UPDATE_CHECK_INTERVAL = 4 * 60 * 60 * 1000;

let periodicTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Start periodic update checking. Checks on startup (after delay) and every 4 hours.
 */
export function startPeriodicUpdateCheck(opts: {
  autoDownloadUpdate: boolean;
  onStartupDelay?: number;
}) {
  stopPeriodicUpdateCheck();

  const doCheck = async () => {
    try {
      const info = await checkForUpdates();
      if (info) {
        if (opts.autoDownloadUpdate) {
          await downloadAndInstall(info.update);
        } else {
          await promptAndInstallUpdate(info);
        }
      }
    } catch {
      // silently ignore periodic update check failures
    }
  };

  // Initial check after delay
  const startupDelay = opts.onStartupDelay ?? 3000;
  setTimeout(doCheck, startupDelay);

  // Periodic check every 4 hours
  periodicTimer = setInterval(doCheck, UPDATE_CHECK_INTERVAL);
}

export function stopPeriodicUpdateCheck() {
  if (periodicTimer !== null) {
    clearInterval(periodicTimer);
    periodicTimer = null;
  }
}
