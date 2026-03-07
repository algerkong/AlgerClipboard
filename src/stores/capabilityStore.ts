import { create } from "zustand";
import {
  getFeatureAvailability,
  type FeatureAvailability,
} from "@/services/featureService";

interface CapabilityState extends FeatureAvailability {
  loaded: boolean;
  loadAvailability: () => Promise<void>;
}

const DEFAULT_AVAILABILITY: FeatureAvailability = {
  has_translate_engine: false,
  has_ai: false,
  can_translate: false,
  translate_uses_ai_by_default: false,
};

export const useCapabilityStore = create<CapabilityState>((set) => ({
  ...DEFAULT_AVAILABILITY,
  loaded: false,

  loadAvailability: async () => {
    try {
      const availability = await getFeatureAvailability();
      set({ ...availability, loaded: true });
    } catch (error) {
      console.error("Failed to load feature availability:", error);
      set({ ...DEFAULT_AVAILABILITY, loaded: true });
    }
  },
}));
