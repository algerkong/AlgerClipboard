import type { SpotlightMode, SpotlightResult } from "./types";
import { translateText } from "@/services/translateService";
import { getSetting } from "@/services/settingsService";

export const translateMode: SpotlightMode = {
  id: "translate",
  name: "spotlight.mode.translate",
  icon: "lucide:languages",
  placeholder: "spotlight.placeholder.translate",
  shortcutSettingKey: "spotlight_translate_shortcut",
  debounceMs: 500,

  onQuery: async (query: string): Promise<SpotlightResult[]> => {
    if (!query.trim()) {
      return [];
    }

    try {
      const toLang = (await getSetting("translate_target_lang")) ?? "en";

      const result = await translateText(query, "auto", toLang);

      return [
        {
          id: "translate-result",
          title: result.translated,
          subtitle: `${result.engine} · ${result.from_lang} → ${result.to_lang}`,
          icon: "lucide:languages",
          badge: `${result.from_lang}→${result.to_lang}`,
        },
      ];
    } catch (err) {
      return [
        {
          id: "translate-error",
          title: String(err),
          subtitle: undefined,
          icon: "lucide:alert",
        },
      ];
    }
  },

  onSelect: async (result: SpotlightResult): Promise<void> => {
    if (result.id === "translate-error") return;
    // Copy translated text to clipboard
    await navigator.clipboard.writeText(result.title);
  },
};
