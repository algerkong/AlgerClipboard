import { invoke } from "@tauri-apps/api/core";

export interface ProviderPreset {
  id: string;
  name: string;
  adapter: string;
  base_url: string;
  default_model: string;
  category: string;
}

export interface ModelInfo {
  id: string;
  name: string | null;
}

export interface AiConfig {
  provider: string;
  api_key: string;
  model: string;
  base_url: string;
  enabled: boolean;
  auto_summary: boolean;
  summary_min_length: number;
  summary_max_length: number;
  summary_language: string;
}

export interface ChatMessage {
  role: string;
  content: string;
}

export interface ChatResponse {
  content: string;
  model: string;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

export function getAiProviders(): Promise<ProviderPreset[]> {
  return invoke("get_ai_providers");
}

export function getAiConfig(): Promise<AiConfig> {
  return invoke("get_ai_config");
}

export function saveAiConfig(config: AiConfig): Promise<void> {
  return invoke("save_ai_config", { config });
}

export function fetchAiModels(): Promise<ModelInfo[]> {
  return invoke("fetch_ai_models");
}

export function testAiConnection(): Promise<string> {
  return invoke("test_ai_connection");
}

export function aiChat(messages: ChatMessage[]): Promise<ChatResponse> {
  return invoke("ai_chat", { messages });
}

export function aiSummarize(text: string): Promise<string> {
  return invoke("ai_summarize", { text });
}

export function updateAiSummary(id: string, summary: string): Promise<void> {
  return invoke("update_ai_summary", { id, summary });
}

export function classifyText(text: string): Promise<string> {
  return invoke("classify_text", { text });
}

export function detectCodeLanguage(text: string): Promise<string> {
  return invoke("detect_code_language", { text });
}
