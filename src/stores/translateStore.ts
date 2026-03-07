import { create } from "zustand";
import type { TranslateResult, TranslateEngineConfig } from "@/types";
import {
  translateText,
  getTranslateEngines,
  configureTranslateEngine,
} from "@/services/translateService";
import { aiTranslate } from "@/services/aiService";

interface TranslateState {
  result: TranslateResult | null;
  loading: boolean;
  error: string | null;
  fromLang: string;
  toLang: string;
  useAi: boolean;
  engines: TranslateEngineConfig[];

  translate: (text: string, engine?: string) => Promise<void>;
  setFromLang: (lang: string) => void;
  setToLang: (lang: string) => void;
  setUseAi: (v: boolean) => void;
  clearResult: () => void;
  loadEngines: () => Promise<void>;
  saveEngine: (
    engine: string,
    apiKey: string,
    apiSecret: string,
    enabled: boolean
  ) => Promise<void>;
}

export const useTranslateStore = create<TranslateState>((set, get) => ({
  result: null,
  loading: false,
  error: null,
  fromLang: "auto",
  toLang: "zh",
  useAi: false,
  engines: [],

  translate: async (text: string, engine?: string) => {
    set({ loading: true, error: null, result: null });
    try {
      const { fromLang, toLang, useAi } = get();
      if (useAi) {
        const translated = await aiTranslate(text, fromLang, toLang);
        set({
          result: { text, translated, from_lang: fromLang, to_lang: toLang, engine: "AI" },
          loading: false,
        });
        return;
      }
      const result = await translateText(text, fromLang, toLang, engine);
      set({ result, loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : String(err),
        loading: false,
      });
    }
  },

  setFromLang: (lang: string) => set({ fromLang: lang }),
  setToLang: (lang: string) => set({ toLang: lang }),
  setUseAi: (v: boolean) => set({ useAi: v }),
  clearResult: () => set({ result: null, error: null }),

  loadEngines: async () => {
    try {
      const engines = await getTranslateEngines();
      set({ engines });
    } catch (err) {
      console.error("Failed to load translate engines:", err);
    }
  },

  saveEngine: async (
    engine: string,
    apiKey: string,
    apiSecret: string,
    enabled: boolean
  ) => {
    try {
      await configureTranslateEngine(engine, apiKey, apiSecret, enabled);
      await get().loadEngines();
    } catch (err) {
      console.error("Failed to save translate engine:", err);
    }
  },
}));
