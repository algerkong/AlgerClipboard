import { convertFileSrc } from "@tauri-apps/api/core";
import { listPlugins, scanPlugins, type PluginInfo } from "@/services/pluginService";
import { useSpotlightStore } from "@/stores/spotlightStore";
import { pluginRegistry } from "./registry";
import { initGlobalPluginAPI, cleanupPluginAPI } from "./api";

let loadedPluginInfos: PluginInfo[] = [];

const loadedScripts = new Map<string, HTMLScriptElement>();

function loadScript(url: string, pluginId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = url;
    script.dataset.pluginId = pluginId;
    script.onload = () => {
      loadedScripts.set(pluginId, script);
      resolve();
    };
    script.onerror = () => {
      reject(new Error(`Failed to load plugin script: ${pluginId}`));
    };
    document.head.appendChild(script);
  });
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
  cleanupPluginAPI(pluginId);
  syncPluginModesToStore();
}

// Track which modes and prefixes were added by plugins so we can remove them
let pluginModeIds = new Set<string>();
let pluginPrefixKeys = new Set<string>();

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

  // Register current plugin modes
  for (const mode of currentModes) {
    store.registerMode(mode);
  }
  pluginModeIds = newModeIds;

  // Rebuild prefixes: start from current, remove old plugin prefixes, add new ones
  const prefixes = { ...store.prefixes };
  for (const oldKey of pluginPrefixKeys) {
    delete prefixes[oldKey];
  }

  const newPrefixKeys = new Set<string>();
  for (const plugin of loadedPluginInfos) {
    for (const sm of plugin.spotlight_modes) {
      if (sm.prefix) {
        prefixes[sm.prefix] = sm.id;
        newPrefixKeys.add(sm.prefix);
      }
    }
  }
  pluginPrefixKeys = newPrefixKeys;

  useSpotlightStore.setState({ prefixes });
}
