import { invoke } from "@tauri-apps/api/core";
import i18n from "@/i18n";
import { useSettingsStore } from "@/stores/settingsStore";

type NotificationKind = "success" | "error" | "info";

interface NotifyOptions {
  title?: string;
}

let permissionRequest: Promise<boolean> | null = null;

async function sendNativeNotification(title: string, body: string): Promise<boolean> {
  try {
    await invoke("show_system_notification", { title, body });
    return true;
  } catch (error) {
    console.error("Failed to send native system notification:", error);
    return false;
  }
}

function getDefaultTitle(kind: NotificationKind): string {
  switch (kind) {
    case "error":
      return i18n.t("notifications.errorTitle");
    case "info":
      return i18n.t("notifications.infoTitle");
    default:
      return i18n.t("notifications.successTitle");
  }
}

async function ensureNotificationPermission(): Promise<boolean> {
  try {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (window.Notification.permission === "granted") {
        return true;
      }

      if (window.Notification.permission === "default") {
        permissionRequest ??= window.Notification.requestPermission()
          .then((permission) => permission === "granted")
          .catch(() => false)
          .finally(() => {
            permissionRequest = null;
          });

        if (await permissionRequest) {
          return true;
        }
      }
    }
  } catch {
    // Fall through to the Web Notification API fallback.
  }

  if (typeof window === "undefined" || !("Notification" in window)) {
    return false;
  }

  if (window.Notification.permission === "granted") {
    return true;
  }

  if (window.Notification.permission === "denied") {
    return false;
  }

  try {
    return (await window.Notification.requestPermission()) === "granted";
  } catch {
    return false;
  }
}

function sendBrowserNotification(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return;
  }

  if (window.Notification.permission !== "granted") {
    return;
  }

  try {
    new window.Notification(title, { body });
  } catch (error) {
    console.error("Failed to send browser notification:", error);
  }
}

async function dispatchNotification(
  kind: NotificationKind,
  message: string,
  options?: NotifyOptions,
) {
  if (!useSettingsStore.getState().systemNotificationsEnabled) {
    return;
  }

  const title = options?.title ?? getDefaultTitle(kind);

  if (await sendNativeNotification(title, message)) {
    return;
  }

  const allowed = await ensureNotificationPermission();
  if (!allowed) {
    return;
  }

  sendBrowserNotification(title, message);
}

export const notify = {
  success(message: string, options?: NotifyOptions) {
    void dispatchNotification("success", message, options);
  },
  error(message: string, options?: NotifyOptions) {
    void dispatchNotification("error", message, options);
  },
  info(message: string, options?: NotifyOptions) {
    void dispatchNotification("info", message, options);
  },
};
