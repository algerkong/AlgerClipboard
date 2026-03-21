import type { SpotlightMode, SpotlightResult, SpotlightAction } from "./types";
import { translateText, getTranslateEngines } from "@/services/translateService";
import { useSpotlightStore } from "@/stores/spotlightStore";

function detectTargetLang(text: string): string {
  const cjkRegex = /[\u4e00-\u9fff\u3400-\u4dbf]/g;
  const cjkCount = (text.match(cjkRegex) || []).length;
  const ratio = cjkCount / text.replace(/\s/g, "").length;
  return ratio > 0.3 ? "en" : "zh";
}

function detectSourceLang(text: string): string {
  const cjkRegex = /[\u4e00-\u9fff\u3400-\u4dbf]/g;
  const cjkCount = (text.match(cjkRegex) || []).length;
  const ratio = cjkCount / text.replace(/\s/g, "").length;
  return ratio > 0.3 ? "zh" : "en";
}

function getTtsUrl(text: string, lang: string, engine: string): string | null {
  const encoded = encodeURIComponent(text.slice(0, 200));
  let normalizedLang = lang;
  if (lang === "auto" || !lang) {
    normalizedLang = detectSourceLang(text);
  }

  switch (engine.toLowerCase()) {
    case "baidu": {
      const baiduLang = normalizedLang === "zh" ? "zh" : "en";
      return `https://fanyi.baidu.com/gettts?lan=${baiduLang}&text=${encoded}&spd=5&source=web`;
    }
    case "youdao": {
      const type = normalizedLang === "en" ? "1" : "2";
      return `https://dict.youdao.com/dictvoice?audio=${encoded}&type=${type}`;
    }
    case "google": {
      return `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${normalizedLang}&q=${encoded}`;
    }
    default:
      return null;
  }
}

function playTts(url: string): void {
  const audio = new Audio(url);
  audio.play().catch((err) => console.warn("TTS playback failed:", err));
}

function buildResultItem(
  query: string,
  result: { translated: string; from_lang: string; to_lang: string; engine: string },
  index: number,
): SpotlightResult {
  const actions: SpotlightAction[] = [];
  const srcLang = result.from_lang === "auto" ? detectSourceLang(query) : result.from_lang;

  const srcTtsUrl = getTtsUrl(query, srcLang, result.engine);
  if (srcTtsUrl) {
    actions.push({
      id: `tts-src-${index}`,
      label: "ph:speaker-high",
      handler: async () => playTts(srcTtsUrl),
    });
  }

  const dstTtsUrl = getTtsUrl(result.translated, result.to_lang, result.engine);
  if (dstTtsUrl) {
    actions.push({
      id: `tts-dst-${index}`,
      label: "ph:speaker-low",
      handler: async () => playTts(dstTtsUrl),
    });
  }

  return {
    id: `translate-${result.engine}-${index}`,
    title: result.translated,
    subtitle: `${result.engine} · ${srcLang} → ${result.to_lang}`,
    badge: result.engine,
    actions,
  };
}

// Track the latest query to discard stale results
let activeQuery = "";

export const translateMode: SpotlightMode = {
  id: "translate",
  name: "spotlight.mode.translate",
  icon: "ph:translate",
  placeholder: "spotlight.placeholder.translate",
  shortcutSettingKey: "spotlight_translate_shortcut",
  debounceMs: 800,

  onQuery: async (query: string): Promise<SpotlightResult[]> => {
    if (!query.trim()) {
      activeQuery = "";
      return [];
    }

    const thisQuery = query;
    activeQuery = thisQuery;

    useSpotlightStore.setState({ results: [], selectedIndex: 0 });

    const toLang = detectTargetLang(query);

    let engines: { engine: string; enabled: boolean }[] = [];
    try {
      engines = await getTranslateEngines();
    } catch {
      // fallback
    }

    const enabledEngines = engines
      .filter((e) => e.enabled)
      .map((e) => e.engine);

    if (enabledEngines.length === 0) {
      try {
        const result = await translateText(query, "auto", toLang);
        if (activeQuery !== thisQuery) return [];
        return [buildResultItem(query, result, 0)];
      } catch (err) {
        return [{ id: "translate-error", title: String(err) }];
      }
    }

    let resultIndex = 0;
    for (const engineName of enabledEngines) {
      const idx = resultIndex++;
      translateText(query, "auto", toLang, engineName)
        .then((result) => {
          if (activeQuery !== thisQuery) return;
          const store = useSpotlightStore.getState();
          const { activeMode, searchQuery } = store.checkPrefix(store.query);
          if (activeMode !== "translate" || searchQuery !== thisQuery) return;
          const item = buildResultItem(query, result, idx);
          const current = store.results;
          if (current.some((r) => r.id === item.id)) return;
          useSpotlightStore.setState({
            results: [...current, item],
            loading: false,
          });
        })
        .catch(() => {});
    }

    return [];
  },

  onSelect: async (result: SpotlightResult): Promise<void> => {
    if (result.id === "translate-error") return;
    await navigator.clipboard.writeText(result.title);
  },
};
