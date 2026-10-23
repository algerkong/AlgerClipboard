import { invoke } from "@tauri-apps/api/core";
import type { HttpApiConfig, HttpApiStatus } from "@/types";

export async function getHttpApiStatus(): Promise<HttpApiStatus> {
  return invoke("get_http_api_status");
}

export async function applyHttpApiConfig(
  config: HttpApiConfig
): Promise<HttpApiStatus> {
  return invoke("apply_http_api_config", { config });
}

export async function regenerateHttpApiKey(): Promise<HttpApiStatus> {
  return invoke("regenerate_http_api_key");
}
