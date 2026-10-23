import { create } from "zustand";
import { getSetting, updateSetting } from "@/services/settingsService";
import { AI_WEB_SERVICES } from "@/constants/aiServices";

import {
  type AskAiPreset,
  DEFAULT_ASK_AI_PRESETS,
} from "@/constants/askAiPresets";

const SETTING_KEY = "ask_ai_enabled_services";
const PRESETS_KEY = "ask_ai_presets";
const DEFAULT_SERVICE_KEY = "ask_ai_default_service";
const DEFAULT_SERVICE_ID = "deepseek";

interface AskAiState {
  enabledServiceIds: string[];
  defaultServiceId: string;
  isLoading: boolean;
  favicons: Record<string, string>;
  askAiEntryId: string | null;
  askAiAnchor: { x: number; y: number } | null;
  isSending: boolean;
  presets: AskAiPreset[];
  presetsLoaded: boolean;

  loadEnabledServices: () => Promise<void>;
  toggleService: (serviceId: string) => Promise<void>;
  isServiceEnabled: (serviceId: string) => boolean;
  loadDefaultService: () => Promise<void>;
  setDefaultService: (serviceId: string) => Promise<void>;
  loadFavicons: () => Promise<void>;
  getFavicon: (serviceId: string) => string | null;
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
  enabledServiceIds: [DEFAULT_SERVICE_ID],
  defaultServiceId: DEFAULT_SERVICE_ID,
  isLoading: false,
  favicons: {},
  askAiEntryId: null,
  askAiAnchor: null,
  isSending: false,
  presets: DEFAULT_ASK_AI_PRESETS,
  presetsLoaded: false,

  loadEnabledServices: async () => {
    set({ isLoading: true });
    try {
      const raw = await getSetting(SETTING_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      const ids = Array.isArray(parsed)
        ? parsed.filter(
            (id): id is string =>
              typeof id === "string" &&
              AI_WEB_SERVICES.some((service) => service.id === id),
          )
        : [DEFAULT_SERVICE_ID];

      // First run: DeepSeek is enabled by default.
      if (!raw) {
        await updateSetting(SETTING_KEY, JSON.stringify(ids));
      }

      set({ enabledServiceIds: ids, isLoading: false });
    } catch (e) {
      console.error("Failed to load ask-ai enabled services:", e);
      set({ enabledServiceIds: [DEFAULT_SERVICE_ID], isLoading: false });
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

  loadDefaultService: async () => {
    try {
      const raw = await getSetting(DEFAULT_SERVICE_KEY);
      const id =
        raw && AI_WEB_SERVICES.some((service) => service.id === raw)
          ? raw
          : DEFAULT_SERVICE_ID;
      set({ defaultServiceId: id });
    } catch (e) {
      console.error("Failed to load ask-ai default service:", e);
      set({ defaultServiceId: DEFAULT_SERVICE_ID });
    }
  },

  setDefaultService: async (serviceId: string) => {
    if (!AI_WEB_SERVICES.some((service) => service.id === serviceId)) return;

    const previous = get().defaultServiceId;
    set({ defaultServiceId: serviceId });

    try {
      await updateSetting(DEFAULT_SERVICE_KEY, serviceId);
    } catch (e) {
      console.error("Failed to persist ask-ai default service:", e);
      set({ defaultServiceId: previous });
      return;
    }

    // The default service must always be enabled.
    if (!get().enabledServiceIds.includes(serviceId)) {
      await get().toggleService(serviceId);
    }
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
          if (!def) {
            return p;
          }

          let next = p;
          if (def.labelKey && !p.labelKey) {
            next = { ...next, labelKey: def.labelKey, builtin: true };
          }
          if (
            def.promptTemplates &&
            !p.promptTemplates &&
            p.promptTemplate === def.promptTemplate
          ) {
            next = {
              ...next,
              promptTemplates: def.promptTemplates,
              builtin: true,
            };
          }
          return next;
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
    const next = get().presets.map((p) => {
      if (p.id !== id) {
        return p;
      }

      const updated = { ...p, ...updates };
      // Once the user edits the prompt, use their text for every language.
      if (updates.promptTemplate !== undefined) {
        delete updated.promptTemplates;
      }
      return updated;
    });
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
