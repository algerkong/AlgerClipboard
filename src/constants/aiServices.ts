export interface AiWebService {
  id: string;
  name: string;
  url: string;
  /** Direct favicon URL from the service itself */
  iconUrl: string;
  /** Reserved for Phase 2: script id for DOM injection */
  injectionScriptId?: string;
}

export const AI_WEB_SERVICES: AiWebService[] = [
  { id: "chatgpt", name: "ChatGPT", url: "https://chatgpt.com", iconUrl: "https://chatgpt.com/favicon.ico" },
  { id: "claude", name: "Claude", url: "https://claude.ai", iconUrl: "https://claude.ai/favicon.ico" },
  { id: "gemini", name: "Gemini", url: "https://gemini.google.com", iconUrl: "https://www.gstatic.com/lamda/images/gemini_favicon_f069958c85030456e93de685481c559f160ea06b.png" },
  { id: "deepseek", name: "DeepSeek", url: "https://chat.deepseek.com", iconUrl: "https://chat.deepseek.com/favicon.ico" },
  { id: "qwen", name: "Qwen", url: "https://tongyi.aliyun.com/qianwen", iconUrl: "https://img.alicdn.com/imgextra/i1/O1CN01AKUdEM1GReYhiaXAT_!!6000000000620-73-tps-512-512.ico" },
  { id: "doubao", name: "Doubao", url: "https://www.doubao.com/chat", iconUrl: "https://www.doubao.com/favicon.ico" },
];
