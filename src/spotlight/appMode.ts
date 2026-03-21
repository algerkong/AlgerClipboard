import type { SpotlightMode, SpotlightResult } from "./types";
import {
  searchApplications,
  launchApplication,
} from "@/services/appLauncherService";
import type { AppEntry } from "@/services/appLauncherService";

function appToResult(app: AppEntry): SpotlightResult {
  return {
    id: app.id,
    title: app.name,
    subtitle: app.path,
    icon: app.icon_base64
      ? `data:image/png;base64,${app.icon_base64}`
      : undefined,
    badge: app.source === "Custom" ? "Custom" : undefined,
  };
}

export const appMode: SpotlightMode = {
  id: "app",
  name: "spotlight.mode.app",
  icon: "lucide:layout-grid",
  placeholder: "spotlight.placeholder.app",
  shortcutSettingKey: "spotlight_app_shortcut",
  debounceMs: 200,

  onQuery: async (query: string): Promise<SpotlightResult[]> => {
    if (!query.trim()) {
      return [];
    }
    const apps = await searchApplications(query);
    return apps.slice(0, 8).map(appToResult);
  },

  onSelect: async (result: SpotlightResult): Promise<void> => {
    // result.subtitle contains the app path
    await launchApplication(result.subtitle ?? "", result.id);
  },
};
