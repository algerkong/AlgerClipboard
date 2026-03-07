import { create } from "zustand";
import {
  getAiProviders,
  getAiConfig,
  saveAiConfig,
  testAiConnection,
  type AiConfig,
  type ProviderPreset,
} from "@/services/aiService";

interface AiState {
  providers: ProviderPreset[];
  config: AiConfig;
  isLoading: boolean;
  isTesting: boolean;
  testResult: string | null;

  loadProviders: () => Promise<void>;
  loadConfig: () => Promise<void>;
  updateConfig: (config: Partial<AiConfig>) => Promise<void>;
  testConnection: () => Promise<void>;
}

const DEFAULT_CONFIG: AiConfig = {
  provider: "",
  api_key: "",
  model: "",
  base_url: "",
  enabled: false,
};

export const useAiStore = create<AiState>((set, get) => ({
  providers: [],
  config: { ...DEFAULT_CONFIG },
  isLoading: false,
  isTesting: false,
  testResult: null,

  loadProviders: async () => {
    try {
      const providers = await getAiProviders();
      set({ providers });
    } catch (e) {
      console.error("Failed to load AI providers:", e);
    }
  },

  loadConfig: async () => {
    set({ isLoading: true });
    try {
      const config = await getAiConfig();
      set({ config, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  updateConfig: async (partial) => {
    const current = get().config;
    const updated = { ...current, ...partial };
    set({ config: updated });
    try {
      await saveAiConfig(updated);
    } catch (e) {
      console.error("Failed to save AI config:", e);
      set({ config: current });
    }
  },

  testConnection: async () => {
    set({ isTesting: true, testResult: null });
    try {
      const result = await testAiConnection();
      set({ isTesting: false, testResult: result });
    } catch (e) {
      set({ isTesting: false, testResult: `Error: ${e}` });
    }
  },
}));
