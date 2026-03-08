import { create } from "zustand";
import { getSetting, updateSetting } from "@/services/settingsService";

const SETTING_KEY = "ask_ai_enabled_services";

interface AskAiState {
  enabledServiceIds: string[];
  isLoading: boolean;

  loadEnabledServices: () => Promise<void>;
  toggleService: (serviceId: string) => Promise<void>;
  isServiceEnabled: (serviceId: string) => boolean;
}

export const useAskAiStore = create<AskAiState>((set, get) => ({
  enabledServiceIds: [],
  isLoading: false,

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
}));
