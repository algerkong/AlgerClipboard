import type { SpotlightMode } from "@/spotlight/types";
import type { ClipboardEntry } from "@/types";

export interface PluginContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  when?: (entry: ClipboardEntry) => boolean;
  handler: (entry: ClipboardEntry) => Promise<void>;
}

export interface PluginSettingsSection {
  id: string;
  label: string;
  icon?: string;
  render: (
    container: HTMLElement,
    helpers: SettingsHelpers
  ) => void | (() => void);
}

export interface SettingsHelpers {
  createToggle(opts: {
    label: string;
    value: boolean;
    onChange: (v: boolean) => void;
  }): HTMLElement;
  createInput(opts: {
    label: string;
    value: string;
    type?: string;
    onChange: (v: string) => void;
  }): HTMLElement;
  createSelect(opts: {
    label: string;
    value: string;
    options: { label: string; value: string }[];
    onChange: (v: string) => void;
  }): HTMLElement;
}

export interface PluginTrayMenuItem {
  id: string;
  label: string;
  handler: () => Promise<void>;
}

export interface AlgerPluginAPI {
  registerMode(mode: SpotlightMode): void;
  onHook(
    event: string,
    handler: (payload: unknown) => Promise<unknown>
  ): () => void;
  registerContextMenu(item: PluginContextMenuItem): void;
  registerSettingsSection(section: PluginSettingsSection): void;
  registerTrayMenuItem(item: PluginTrayMenuItem): void;
  invokeBackend(command: string, args?: unknown): Promise<unknown>;
  invokeHost(command: string, args?: unknown): Promise<unknown>;
  on(event: string, handler: (payload: unknown) => void): () => void;
  emit(event: string, payload?: unknown): void;
  getSetting(key: string): Promise<unknown>;
  setSetting(key: string, value: unknown): Promise<void>;
  onSettingChanged(
    key: string,
    handler: (...args: unknown[]) => void
  ): () => void;
  getAssetPath(relativePath: string): string;
  getEnv(): { theme: string; locale: string; platform: string };
}
