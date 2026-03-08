import { create } from "zustand";
import { getSetting, updateSetting } from "@/services/settingsService";
import { AI_WEB_SERVICES } from "@/constants/aiServices";

import {
  type AskAiPreset,
  DEFAULT_ASK_AI_PRESETS,
} from "@/constants/askAiPresets";

const SETTING_KEY = "ask_ai_enabled_services";
const PRESETS_KEY = "ask_ai_presets";

interface AskAiState {
  enabledServiceIds: string[];
  isLoading: boolean;
  favicons: Record<string, string>;
  askAiEntryId: string | null;
  askAiAnchor: { x: number; y: number } | null;
  isSending: boolean;
  presets: AskAiPreset[];
  presetsLoaded: boolean;
  activeServiceId: string | null;

  loadEnabledServices: () => Promise<void>;
  toggleService: (serviceId: string) => Promise<void>;
  isServiceEnabled: (serviceId: string) => boolean;
  loadFavicons: () => Promise<void>;
  getFavicon: (serviceId: string) => string | null;
  setActiveServiceId: (id: string | null) => void;
  startAskAi: (entryId: string, anchor: { x: number; y: number }) => void;
  cancelAskAi: () => void;
  setIsSending: (v: boolean) => void;
  loadPresets: () => Promise<void>;
  savePresets: (presets: AskAiPreset[]) => Promise<void>;
  addPreset: (preset: AskAiPreset) => Promise<void>;
  updatePreset: (id: string, updates: Partial<AskAiPreset>) => Promise<void>;
  removePreset: (id: string) => Promise<void>;
  reorderPresets: (presets: AskAiPreset[]) => Promise<void>;
  resetPresets: () => Promise<void>;
}

export const useAskAiStore = create<AskAiState>((set, get) => ({
  enabledServiceIds: [],
  isLoading: false,
  favicons: {},
  askAiEntryId: null,
  askAiAnchor: null,
  isSending: false,
  presets: DEFAULT_ASK_AI_PRESETS,
  presetsLoaded: false,
  activeServiceId: null,

  loadEnabledServices: async () => {
    set({ isLoading: true });
    try {
      const raw = await getSetting(SETTING_KEY);
      const ids: string[] = raw ? JSON.parse(raw) : [];
      set({ enabledServiceIds: ids, isLoading: false });
    } catch (e) {
      console.error("Failed to load ask-ai enabled services:", e);
      set({ isLoading: false });
    }
  },

  toggleService: async (serviceId: string) => {
    const prev = get().enabledServiceIds;
    const next = prev.includes(serviceId)
      ? prev.filter((id) => id !== serviceId)
      : [...prev, serviceId];

    // Optimistic update
    set({ enabledServiceIds: next });
    try {
      await updateSetting(SETTING_KEY, JSON.stringify(next));
    } catch (e) {
      console.error("Failed to persist ask-ai enabled services:", e);
      // Revert on error
      set({ enabledServiceIds: prev });
    }
  },

  isServiceEnabled: (serviceId: string) => {
    return get().enabledServiceIds.includes(serviceId);
  },

  loadFavicons: async () => {
    // Use direct iconUrl from service definitions (no Google API dependency)
    const favicons: Record<string, string> = {};
    for (const service of AI_WEB_SERVICES) {
      if (service.iconUrl) {
        favicons[service.id] = service.iconUrl;
      }
    }
    set({ favicons });
  },

  getFavicon: (serviceId: string) => {
    return get().favicons[serviceId] || null;
  },

  setActiveServiceId: (id: string | null) => {
    set({ activeServiceId: id });
  },

  startAskAi: (entryId: string, anchor: { x: number; y: number }) => {
    set({ askAiEntryId: entryId, askAiAnchor: anchor });
  },

  cancelAskAi: () => {
    set({ askAiEntryId: null, askAiAnchor: null });
  },

  setIsSending: (v: boolean) => {
    set({ isSending: v });
  },

  loadPresets: async () => {
    try {
      const raw = await getSetting(PRESETS_KEY);
      if (raw) {
        const parsed: AskAiPreset[] = JSON.parse(raw);
        // Restore labelKey for builtin presets (may be missing from older stored data)
        const defaultMap = new Map(
          DEFAULT_ASK_AI_PRESETS.map((p) => [p.id, p]),
        );
        const merged = parsed.map((p) => {
          const def = defaultMap.get(p.id);
          if (def?.labelKey && !p.labelKey) {
            return { ...p, labelKey: def.labelKey, builtin: true };
          }
          return p;
        });
        set({ presets: merged, presetsLoaded: true });
      } else {
        set({ presets: DEFAULT_ASK_AI_PRESETS, presetsLoaded: true });
      }
    } catch (e) {
      console.error("Failed to load ask-ai presets:", e);
      set({ presets: DEFAULT_ASK_AI_PRESETS, presetsLoaded: true });
    }
  },

  savePresets: async (presets: AskAiPreset[]) => {
    set({ presets });
    try {
      await updateSetting(PRESETS_KEY, JSON.stringify(presets));
    } catch (e) {
      console.error("Failed to save ask-ai presets:", e);
    }
  },

  addPreset: async (preset: AskAiPreset) => {
    const next = [...get().presets, preset];
    await get().savePresets(next);
  },

  updatePreset: async (id: string, updates: Partial<AskAiPreset>) => {
    const next = get().presets.map((p) =>
      p.id === id ? { ...p, ...updates } : p,
    );
    await get().savePresets(next);
  },

  removePreset: async (id: string) => {
    const next = get().presets.filter((p) => p.id !== id);
    await get().savePresets(next);
  },

  reorderPresets: async (presets: AskAiPreset[]) => {
    await get().savePresets(presets);
  },

  resetPresets: async () => {
    await get().savePresets(DEFAULT_ASK_AI_PRESETS);
  },
}));
