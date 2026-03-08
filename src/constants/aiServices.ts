export interface AiWebService {
  id: string;
  name: string;
  url: string;
  /** Reserved for Phase 2: script id for DOM injection */
  injectionScriptId?: string;
}

export const AI_WEB_SERVICES: AiWebService[] = [
  { id: "chatgpt", name: "ChatGPT", url: "https://chatgpt.com" },
  { id: "claude", name: "Claude", url: "https://claude.ai" },
  { id: "gemini", name: "Gemini", url: "https://gemini.google.com" },
  { id: "deepseek", name: "DeepSeek", url: "https://chat.deepseek.com" },
  { id: "qwen", name: "Qwen", url: "https://tongyi.aliyun.com/qianwen" },
  { id: "doubao", name: "Doubao", url: "https://www.doubao.com/chat" },
];
