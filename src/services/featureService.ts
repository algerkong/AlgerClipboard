import { invoke } from "@tauri-apps/api/core";

export interface FeatureAvailability {
  has_translate_engine: boolean;
  has_ai: boolean;
  can_translate: boolean;
  translate_uses_ai_by_default: boolean;
}

export function getFeatureAvailability(): Promise<FeatureAvailability> {
  return invoke("get_feature_availability");
}
