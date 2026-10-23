import { create } from "zustand";
import type { SmartPasteConfig, SmartPasteRule } from "@/types";
import {
  getSmartPasteConfig,
  resetSmartPasteConfig,
  saveSmartPasteConfig,
} from "@/services/smartPasteService";

interface SmartPasteState {
  config: SmartPasteConfig;
  loading: boolean;
  loaded: boolean;
  load: () => Promise<void>;
  save: (config: SmartPasteConfig) => Promise<void>;
  setEnabled: (enabled: boolean) => Promise<void>;
  upsertRule: (rule: SmartPasteRule) => Promise<void>;
  deleteRule: (id: string) => Promise<void>;
  reset: () => Promise<void>;
}

const DEFAULT_CONFIG: SmartPasteConfig = { enabled: true, rules: [] };

export const useSmartPasteStore = create<SmartPasteState>((set, get) => ({
  config: DEFAULT_CONFIG,
  loading: false,
  loaded: false,

  load: async () => {
    set({ loading: true });
    try {
      const config = await getSmartPasteConfig();
      set({ config, loaded: true });
    } finally {
      set({ loading: false });
    }
  },

  save: async (config) => {
    const previous = get().config;
    set({ config });
    try {
      await saveSmartPasteConfig(config);
    } catch (error) {
      set({ config: previous });
      throw error;
    }
  },

  setEnabled: async (enabled) => {
    await get().save({ ...get().config, enabled });
  },

  upsertRule: async (rule) => {
    const rules = [...get().config.rules];
    const index = rules.findIndex((item) => item.id === rule.id);
    if (index >= 0) {
      rules[index] = rule;
    } else {
      rules.push(rule);
    }
    await get().save({ ...get().config, rules });
  },

  deleteRule: async (id) => {
    await get().save({
      ...get().config,
      rules: get().config.rules.filter((rule) => rule.id !== id),
    });
  },

  reset: async () => {
    set({ loading: true });
    try {
      const config = await resetSmartPasteConfig();
      set({ config, loaded: true });
    } finally {
      set({ loading: false });
    }
  },
}));
