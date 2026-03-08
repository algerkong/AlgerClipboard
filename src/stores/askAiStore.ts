import { create } from "zustand";
import { getSetting, updateSetting } from "@/services/settingsService";
import { AI_WEB_SERVICES } from "@/constants/aiServices";
import { fetchServiceFavicon } from "@/services/askAiService";

const SETTING_KEY = "ask_ai_enabled_services";

interface AskAiState {
  enabledServiceIds: string[];
  isLoading: boolean;
  favicons: Record<string, string>;
  askAiEntryId: string | null;
  askAiAnchor: { x: number; y: number } | null;
  isSending: boolean;

  loadEnabledServices: () => Promise<void>;
  toggleService: (serviceId: string) => Promise<void>;
  isServiceEnabled: (serviceId: string) => boolean;
  loadFavicons: () => Promise<void>;
  getFavicon: (serviceId: string) => string | null;
  startAskAi: (entryId: string, anchor: { x: number; y: number }) => void;
  cancelAskAi: () => void;
  setIsSending: (v: boolean) => void;
}

export const useAskAiStore = create<AskAiState>((set, get) => ({
  enabledServiceIds: [],
  isLoading: false,
  favicons: {},
  askAiEntryId: null,
  askAiAnchor: null,
  isSending: false,

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
    const results = await Promise.allSettled(
      AI_WEB_SERVICES.map(async (service) => {
        const hostname = new URL(service.url).hostname;
        const url = await fetchServiceFavicon(service.id, hostname);
        return { serviceId: service.id, url };
      }),
    );

    const favicons: Record<string, string> = {};
    for (const result of results) {
      if (result.status === "fulfilled" && result.value.url) {
        favicons[result.value.serviceId] = result.value.url;
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
}));
