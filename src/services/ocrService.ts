import { invoke } from "@tauri-apps/api/core";
import type { OcrResult } from "@/types";

export interface OcrEngineConfig {
  engine_type: string;
  enabled: boolean;
  api_key: string;
  api_secret: string;
  endpoint: string;
  model: string;
  command: string;
  extra: string;
}

export interface OcrEngineInfo {
  engine_type: string;
  label: string;
  enabled: boolean;
}

export async function ocrRecognize(relativePath: string, engine?: string): Promise<OcrResult> {
  return invoke("ocr_recognize", { relativePath, engine: engine ?? null });
}

export async function ocrRecognizeFile(path: string, engine?: string): Promise<OcrResult> {
  return invoke("ocr_recognize_file", { path, engine: engine ?? null });
}

export async function getOcrEngines(): Promise<OcrEngineConfig[]> {
  return invoke("get_ocr_engines");
}

export async function configureOcrEngine(config: OcrEngineConfig): Promise<void> {
  return invoke("configure_ocr_engine", { config });
}

export async function getDefaultOcrEngine(): Promise<string> {
  return invoke("get_default_ocr_engine");
}

export async function setDefaultOcrEngine(engineType: string): Promise<void> {
  return invoke("set_default_ocr_engine", { engineType });
}

export async function getEnabledOcrEngines(): Promise<OcrEngineInfo[]> {
  return invoke("get_enabled_ocr_engines");
}

export async function clearOcrCache(): Promise<void> {
  return invoke("clear_ocr_cache");
}
