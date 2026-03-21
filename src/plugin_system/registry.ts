import type { SpotlightMode } from "@/spotlight/types";
import type {
  PluginContextMenuItem,
  PluginSettingsSection,
  PluginTrayMenuItem,
} from "./types";

type HookEntry = {
  pluginId: string;
  handler: (payload: unknown) => Promise<unknown>;
};

type Listener = () => void;

class PluginRegistry {
  contextMenuItems = new Map<string, PluginContextMenuItem[]>();
  settingsSections = new Map<string, PluginSettingsSection[]>();
  trayMenuItems = new Map<string, PluginTrayMenuItem[]>();
  spotlightModes = new Map<string, SpotlightMode[]>();
  hooks = new Map<string, HookEntry[]>();

  private listeners: Set<Listener> = new Set();

  registerMode(pluginId: string, mode: SpotlightMode) {
    const list = this.spotlightModes.get(pluginId) ?? [];
    list.push(mode);
    this.spotlightModes.set(pluginId, list);
    this.notify();
  }

  registerContextMenu(pluginId: string, item: PluginContextMenuItem) {
    const list = this.contextMenuItems.get(pluginId) ?? [];
    list.push(item);
    this.contextMenuItems.set(pluginId, list);
    this.notify();
  }

  registerSettingsSection(pluginId: string, section: PluginSettingsSection) {
    const list = this.settingsSections.get(pluginId) ?? [];
    list.push(section);
    this.settingsSections.set(pluginId, list);
    this.notify();
  }

  registerTrayMenuItem(pluginId: string, item: PluginTrayMenuItem) {
    const list = this.trayMenuItems.get(pluginId) ?? [];
    list.push(item);
    this.trayMenuItems.set(pluginId, list);
    this.notify();
  }

  registerHook(
    pluginId: string,
    event: string,
    handler: (payload: unknown) => Promise<unknown>
  ): () => void {
    const list = this.hooks.get(event) ?? [];
    const entry: HookEntry = { pluginId, handler };
    list.push(entry);
    this.hooks.set(event, list);
    return () => {
      const entries = this.hooks.get(event);
      if (entries) {
        const idx = entries.indexOf(entry);
        if (idx >= 0) entries.splice(idx, 1);
      }
    };
  }

  getAllModes(): SpotlightMode[] {
    const result: SpotlightMode[] = [];
    for (const modes of this.spotlightModes.values()) {
      result.push(...modes);
    }
    return result;
  }

  getAllContextMenuItems(): PluginContextMenuItem[] {
    const result: PluginContextMenuItem[] = [];
    for (const items of this.contextMenuItems.values()) {
      result.push(...items);
    }
    return result;
  }

  getAllSettingsSections(): PluginSettingsSection[] {
    const result: PluginSettingsSection[] = [];
    for (const sections of this.settingsSections.values()) {
      result.push(...sections);
    }
    return result;
  }

  getAllTrayMenuItems(): PluginTrayMenuItem[] {
    const result: PluginTrayMenuItem[] = [];
    for (const items of this.trayMenuItems.values()) {
      result.push(...items);
    }
    return result;
  }

  async dispatchHook(
    event: string,
    payload: unknown
  ): Promise<{ cancelled: boolean; responses: unknown[] }> {
    const entries = this.hooks.get(event) ?? [];
    const responses: unknown[] = [];
    let cancelled = false;

    for (const entry of entries) {
      try {
        const result = await entry.handler(payload);
        responses.push(result);
        if (result === false) {
          cancelled = true;
          break;
        }
      } catch (err) {
        console.error(
          `Plugin hook error [${entry.pluginId}/${event}]:`,
          err
        );
      }
    }

    return { cancelled, responses };
  }

  unregisterPlugin(pluginId: string) {
    this.contextMenuItems.delete(pluginId);
    this.settingsSections.delete(pluginId);
    this.trayMenuItems.delete(pluginId);
    this.spotlightModes.delete(pluginId);

    for (const [event, entries] of this.hooks) {
      const filtered = entries.filter((e) => e.pluginId !== pluginId);
      if (filtered.length > 0) {
        this.hooks.set(event, filtered);
      } else {
        this.hooks.delete(event);
      }
    }

    this.notify();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch {
        // ignore listener errors
      }
    }
  }
}

export const pluginRegistry = new PluginRegistry();
