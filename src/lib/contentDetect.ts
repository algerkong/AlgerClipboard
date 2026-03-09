export type ContentMode = "code" | "markdown" | "plaintext" | "richtext";

/** Heuristic: does text look like code? */
export function looksLikeCode(text: string): boolean {
  const codePatterns = [
    /^(import|export|const|let|var|function|class|interface|type|enum|def|fn|pub|use|package|#include)\s/m,
    /[{}[\]];?\s*$/m,
    /=>\s*\{/,
    /\(\)\s*\{/,
    /^\s*(if|else|for|while|switch|case|return|try|catch)\s*[({]/m,
    /<\/?[a-zA-Z][a-zA-Z0-9]*[\s>]/,
    /^\s*\/\//m,
    /^\s*#\s*(define|ifdef|ifndef|include)/m,
    /\w+\.\w+\(.*\)/,
  ];
  let matches = 0;
  for (const p of codePatterns) {
    if (p.test(text)) matches++;
  }
  return matches >= 2;
}

/** Heuristic: does text contain markdown syntax? */
export function looksLikeMarkdown(text: string): boolean {
  const mdPatterns = [
    /^#{1,6}\s+\S/m,
    /\*\*[^*]+\*\*/,
    /\*[^*]+\*/,
    /^\s*[-*+]\s+\S/m,
    /^\s*\d+\.\s+\S/m,
    /```[\s\S]*?```/,
    /\[.+?\]\(.+?\)/,
    /!\[.*?\]\(.+?\)/,
    /^\s*>\s+\S/m,
    /^\s*\|.*\|.*\|/m,
    /^\s*---\s*$/m,
    /\$\$.+?\$\$/s,
    /\$.+?\$/,
  ];
  let matches = 0;
  for (const p of mdPatterns) {
    if (p.test(text)) matches++;
  }
  return matches >= 2;
}

/** Map detected_language string to a CodeMirror-friendly lang key */
export function mapLanguageToCodemirror(lang: string | null): string {
  if (!lang) return "plaintext";
  const lower = lang.toLowerCase();
  const map: Record<string, string> = {
    javascript: "javascript",
    typescript: "javascript",
    jsx: "javascript",
    tsx: "javascript",
    js: "javascript",
    ts: "javascript",
    python: "python",
    py: "python",
    rust: "rust",
    rs: "rust",
    html: "html",
    htm: "html",
    css: "css",
    scss: "css",
    less: "css",
    json: "json",
    sql: "sql",
    xml: "xml",
    svg: "xml",
    markdown: "markdown",
    md: "markdown",
    java: "java",
    cpp: "cpp",
    "c++": "cpp",
    c: "cpp",
    "c#": "cpp",
    csharp: "cpp",
    php: "php",
    shell: "plaintext",
    bash: "plaintext",
    yaml: "plaintext",
    toml: "plaintext",
  };
  return map[lower] || "plaintext";
}

/**
 * Detect the best content mode for a clipboard entry.
 */
export function detectContentMode(
  contentType: string,
  textContent: string | null,
  htmlContent: string | null,
  detectedLanguage: string | null,
): ContentMode {
  if (contentType === "RichText" && htmlContent) return "richtext";
  if (!textContent) return "plaintext";
  if (detectedLanguage && detectedLanguage !== "General") return "code";
  if (looksLikeCode(textContent)) return "code";
  if (looksLikeMarkdown(textContent)) return "markdown";
  return "plaintext";
}
