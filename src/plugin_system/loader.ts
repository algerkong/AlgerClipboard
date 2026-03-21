import { convertFileSrc } from "@tauri-apps/api/core";
import { listPlugins, type PluginInfo } from "@/services/pluginService";
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

export function unloadPlugin(pluginId: string) {
  const script = loadedScripts.get(pluginId);
  if (script) {
    script.remove();
    loadedScripts.delete(pluginId);
  }
  cleanupPluginAPI(pluginId);
  syncPluginModesToStore();
}

export function syncPluginModesToStore() {
  const store = useSpotlightStore.getState();
  const modes = pluginRegistry.getAllModes();
  for (const mode of modes) {
    store.registerMode(mode);
  }

  // Register plugin-declared prefixes into the store
  const currentPrefixes = { ...store.prefixes };
  for (const plugin of loadedPluginInfos) {
    for (const sm of plugin.spotlight_modes) {
      if (sm.prefix) {
        currentPrefixes[sm.prefix] = sm.id;
      }
    }
  }
  useSpotlightStore.setState({ prefixes: currentPrefixes });
}
