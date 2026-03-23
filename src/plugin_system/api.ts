import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { listen, emit as tauriEmit } from "@tauri-apps/api/event";
import { pluginRegistry } from "./registry";
import {
  invokePluginCommand,
  getPluginSetting,
  setPluginSetting,
} from "@/services/pluginService";
import { useSettingsStore } from "@/stores/settingsStore";
import type { AlgerPluginAPI } from "./types";

const pluginCleanups = new Map<string, Array<() => void>>();

export function createPluginAPI(
  pluginId: string,
  pluginDirPath: string
): AlgerPluginAPI {
  const cleanups: Array<() => void> = [];
  pluginCleanups.set(pluginId, cleanups);

  return {
    registerMode(mode) {
      pluginRegistry.registerMode(pluginId, mode);
    },

    onHook(event, handler) {
      const unsub = pluginRegistry.registerHook(pluginId, event, handler);
      cleanups.push(unsub);
      return unsub;
    },

    registerContextMenu(item) {
      pluginRegistry.registerContextMenu(pluginId, item);
    },

    registerSettingsSection(section) {
      pluginRegistry.registerSettingsSection(pluginId, section);
    },

    registerTrayMenuItem(item) {
      pluginRegistry.registerTrayMenuItem(pluginId, item);
    },

    async invokeBackend(command, args) {
      return invokePluginCommand(pluginId, command, args);
    },

    async invokeHost(command, args) {
      return invoke(command, args as Record<string, unknown>);
    },

    on(event, handler) {
      const eventName = `plugin:${pluginId}:${event}`;
      const promise = listen(eventName, (e) => {
        handler(e.payload);
      });
      const unsub = () => {
        promise.then((fn) => fn());
      };
      cleanups.push(unsub);
      return unsub;
    },

    emit(event, payload) {
      const eventName = `plugin:${pluginId}:${event}`;
      tauriEmit(eventName, payload);
    },

    async getSetting(key) {
      return getPluginSetting(pluginId, key);
    },

    async setSetting(key, value) {
      return setPluginSetting(pluginId, key, value);
    },

    onSettingChanged(key, handler) {
      const eventName = `plugin:${pluginId}:setting-changed`;
      const promise = listen(eventName, (e) => {
        const payload = e.payload as {
          key: string;
          value: unknown;
          oldValue: unknown;
        };
        if (key === "*") {
          handler(payload.key, payload.value, payload.oldValue);
        } else if (payload.key === key) {
          handler(payload.value, payload.oldValue);
        }
      });
      const unsub = () => {
        promise.then((fn) => fn());
      };
      cleanups.push(unsub);
      return unsub;
    },

    getAssetPath(relativePath) {
      const fullPath = `${pluginDirPath}/${relativePath}`;
      return convertFileSrc(fullPath);
    },

    getEnv() {
      const state = useSettingsStore.getState();
      return {
        theme: state.theme,
        locale: state.locale,
        platform: navigator.platform,
      };
    },
  };
}

declare global {
  interface Window {
    AlgerPlugin?: {
      create: (pluginId: string, pluginDirPath?: string) => AlgerPluginAPI;
    };
  }
}

export function initGlobalPluginAPI() {
  window.AlgerPlugin = {
    create(pluginId: string, pluginDirPath?: string) {
      return createPluginAPI(pluginId, pluginDirPath ?? "");
    },
  };
}

export function cleanupPluginAPI(pluginId: string) {
  const cleanups = pluginCleanups.get(pluginId);
  if (cleanups) {
    for (const fn of cleanups) {
      try {
        fn();
      } catch {
        // ignore cleanup errors
      }
    }
    pluginCleanups.delete(pluginId);
  }
  pluginRegistry.unregisterPlugin(pluginId);
}
