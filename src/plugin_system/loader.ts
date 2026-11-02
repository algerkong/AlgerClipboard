import { convertFileSrc } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  listPlugins,
  scanPlugins,
  getPluginSetting,
  type PluginInfo,
} from "@/services/pluginService";
import { useSpotlightStore } from "@/stores/spotlightStore";
import { pluginRegistry } from "./registry";
import { initGlobalPluginAPI, cleanupPluginAPI } from "./api";

let loadedPluginInfos: PluginInfo[] = [];

// pluginId -> in-flight/last load promise. Prevents StrictMode's double
// effect run (or concurrent reloads) from injecting the same script twice,
// which would duplicate event listeners and mode registrations.
const scriptPromises = new Map<string, Promise<void>>();
const loadedScripts = new Map<string, HTMLScriptElement>();
const settingListeners = new Map<string, UnlistenFn>();

// modeId -> prefix configured in the plugin's settings panel
const pluginPrefixOverrides = new Map<string, string>();

function loadScript(url: string, pluginId: string): Promise<void> {
  const existing = scriptPromises.get(pluginId);
  if (existing) return existing;

  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = url;
    script.dataset.pluginId = pluginId;
    script.onload = () => {
      loadedScripts.set(pluginId, script);
      resolve();
    };
    script.onerror = () => {
      // Allow a retry on the next load attempt
      scriptPromises.delete(pluginId);
      reject(new Error(`Failed to load plugin script: ${pluginId}`));
    };
    document.head.appendChild(script);
  });

  scriptPromises.set(pluginId, promise);
  return promise;
}

/** Read the per-plugin "prefix" setting so users can override the manifest prefix. */
async function refreshPluginPrefixOverrides() {
  const next = new Map<string, string>();
  for (const plugin of loadedPluginInfos) {
    for (const sm of plugin.spotlight_modes) {
      try {
        const val = await getPluginSetting(plugin.id, "prefix");
        if (typeof val === "string" && val.trim()) {
          next.set(sm.id, val.trim().toLowerCase());
        }
      } catch {
        // Settings are optional; fall back to the manifest prefix
      }
    }
  }
  pluginPrefixOverrides.clear();
  for (const [modeId, prefix] of next) {
    pluginPrefixOverrides.set(modeId, prefix);
  }
}

/** Re-apply prefixes when a plugin's prefix setting changes in the settings window. */
async function subscribePluginSettingChanges() {
  for (const plugin of loadedPluginInfos) {
    if (settingListeners.has(plugin.id)) continue;
    try {
      const unsub = await listen(`plugin:${plugin.id}:setting-changed`, (event) => {
        const payload = event.payload as { key?: string };
        if (payload?.key !== "prefix") return;
        void refreshPluginPrefixOverrides().then(() => syncPluginModesToStore());
      });
      settingListeners.set(plugin.id, unsub);
    } catch (err) {
      console.warn(`Failed to watch settings for plugin ${plugin.id}:`, err);
    }
  }
}

export async function loadAllPlugins() {
  initGlobalPluginAPI();

  let plugins;
  try {
    plugins = await listPlugins();
  } catch (err) {
    console.error("Failed to list plugins:", err);
    return;
  }

  loadedPluginInfos = plugins.filter((p) => p.enabled);

  for (const plugin of loadedPluginInfos) {
    if (!plugin.has_frontend) continue;
    if (loadedScripts.has(plugin.id)) continue;

    try {
      const scriptUrl = convertFileSrc(plugin.frontend_entry_path);
      await loadScript(scriptUrl, plugin.id);
    } catch (err) {
      console.error(`Failed to load plugin ${plugin.id}:`, err);
    }
  }

  await refreshPluginPrefixOverrides();
  await subscribePluginSettingChanges();
  syncPluginModesToStore();
}

export async function reloadAllPlugins() {
  // Use scanPlugins to force re-scan and get fresh data
  let plugins;
  try {
    plugins = await scanPlugins();
  } catch (err) {
    console.error("Failed to scan plugins:", err);
    return;
  }

  const enabledIds = new Set(plugins.filter((p) => p.enabled).map((p) => p.id));

  // Unload plugins that are no longer enabled
  for (const pluginId of loadedScripts.keys()) {
    if (!enabledIds.has(pluginId)) {
      unloadPlugin(pluginId);
    }
  }

  // Load newly enabled plugins (loadAllPlugins skips already-loaded)
  await loadAllPlugins();
}

export function unloadPlugin(pluginId: string) {
  const script = loadedScripts.get(pluginId);
  if (script) {
    script.remove();
    loadedScripts.delete(pluginId);
  }
  scriptPromises.delete(pluginId);

  const unsub = settingListeners.get(pluginId);
  if (unsub) {
    unsub();
    settingListeners.delete(pluginId);
  }

  cleanupPluginAPI(pluginId);
  syncPluginModesToStore();
}

// Track which modes and prefixes were added by plugins so we can remove them
let pluginModeIds = new Set<string>();
let pluginPrefixEntries = new Map<string, string>(); // prefix -> modeId

export function syncPluginModesToStore() {
  const store = useSpotlightStore.getState();
  const currentModes = pluginRegistry.getAllModes();
  const newModeIds = new Set(currentModes.map((m) => m.id));

  // Remove modes that were previously registered by plugins but are no longer present
  for (const oldId of pluginModeIds) {
    if (!newModeIds.has(oldId)) {
      store.unregisterMode(oldId);
    }
  }

  // Build a lookup from manifest spotlight_modes config
  const manifestConfig = new Map<string, { global_search?: boolean; priority?: number }>();
  for (const plugin of loadedPluginInfos) {
    for (const sm of plugin.spotlight_modes) {
      manifestConfig.set(sm.id, {
        global_search: sm.global_search,
        priority: sm.priority,
      });
    }
  }

  // Register current plugin modes, merging manifest config
  for (const mode of currentModes) {
    const config = manifestConfig.get(mode.id);
    if (config) {
      if (config.global_search != null && mode.globalSearch == null) {
        mode.globalSearch = config.global_search;
      }
      if (config.priority != null && mode.priority == null) {
        mode.priority = config.priority;
      }
    }
    store.registerMode(mode);
  }
  pluginModeIds = newModeIds;

  // Rebuild prefixes: drop the ones we added last time (only if they still
  // point at that plugin mode), then re-add every enabled plugin's prefix.
  // Prefixes already owned by built-in modes or other plugins are never
  // overwritten — a plugin must not silently steal e.g. "cc" from clipboard.
  const prefixes = { ...store.prefixes };
  for (const [key, modeId] of pluginPrefixEntries) {
    if (prefixes[key] === modeId) {
      delete prefixes[key];
    }
  }

  const newEntries = new Map<string, string>();
  for (const plugin of loadedPluginInfos) {
    for (const sm of plugin.spotlight_modes) {
      const prefix = (pluginPrefixOverrides.get(sm.id) ?? sm.prefix ?? "")
        .trim()
        .toLowerCase();
      if (!prefix) continue;

      const owner = prefixes[prefix];
      if (owner && owner !== sm.id) {
        console.warn(
          `[plugins] Prefix "${prefix}" for mode "${sm.id}" is already used by "${owner}", skipping`
        );
        continue;
      }

      prefixes[prefix] = sm.id;
      newEntries.set(prefix, sm.id);
    }
  }
  pluginPrefixEntries = newEntries;

  useSpotlightStore.setState({ prefixes });
}
