import { invoke } from "@tauri-apps/api/core";
import type { TranslateResult, TranslateEngineConfig } from "@/types";

export async function translateAll(
  text: string,
  from: string,
  to: string
): Promise<TranslateResult[]> {
  return invoke("translate_all", { text, from, to });
}

export async function translateText(
  text: string,
  from: string,
  to: string,
  engine?: string
): Promise<TranslateResult> {
  return invoke("translate_text", { text, from, to, engine: engine ?? null });
}

export async function getTranslateEngines(): Promise<TranslateEngineConfig[]> {
  return invoke("get_translate_engines");
}

export async function configureTranslateEngine(
  engine: string,
  apiKey: string,
  apiSecret: string,
  enabled: boolean
): Promise<void> {
  return invoke("configure_translate_engine", {
    engine,
    apiKey,
    apiSecret,
    enabled,
  });
}
