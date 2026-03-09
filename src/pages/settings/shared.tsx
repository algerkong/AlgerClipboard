import { cn } from "@/lib/utils";

export type Theme = "light" | "dark" | "system";

export const languages = [
  { value: "zh-CN", label: "\u4E2D\u6587" },
  { value: "en", label: "English" },
];

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export const ENGINE_LIST = [
  { id: "baidu", label: "Baidu", hasSecret: true },
  { id: "youdao", label: "Youdao", hasSecret: true },
  { id: "google", label: "Google", hasSecret: false },
] as const;

export const OCR_ENGINE_LIST = [
  { id: "native", label: "Native OCR", fields: [] as const },
  { id: "baidu", label: "Baidu OCR", fields: ["apiKey", "apiSecret"] as const },
  { id: "google", label: "Google Vision", fields: ["apiKey"] as const },
  { id: "tencent", label: "Tencent OCR", fields: ["apiKey", "apiSecret"] as const },
  { id: "local_model", label: "Local Model", fields: ["command"] as const },
  { id: "online_model", label: "Online Model", fields: ["endpoint", "apiKey"] as const },
  { id: "ai_vision", label: "AI Vision", fields: ["endpoint", "apiKey", "model"] as const },
] as const;

export const MODIFIER_KEYS = new Set(["Shift", "Control", "Meta", "Alt"]);

export function normalizeShortcutMainKey(event: KeyboardEvent): string | null {
  const { code, key } = event;

  if (/^Key[A-Z]$/.test(code)) {
    return code.slice(3);
  }

  if (/^Digit\d$/.test(code)) {
    return code.slice(5);
  }

  if (/^F([1-9]|1\d|2[0-4])$/.test(code)) {
    return code;
  }

  const byCode: Record<string, string> = {
    Space: "Space",
    Enter: "Enter",
    NumpadEnter: "Enter",
    Tab: "Tab",
    Backspace: "Backspace",
    Delete: "Delete",
    Insert: "Insert",
    Home: "Home",
    End: "End",
    PageUp: "PageUp",
    PageDown: "PageDown",
    ArrowUp: "Up",
    ArrowDown: "Down",
    ArrowLeft: "Left",
    ArrowRight: "Right",
    Escape: "Escape",
  };

  if (byCode[code]) {
    return byCode[code];
  }

  if (key.length === 1 && /[a-z0-9]/i.test(key)) {
    return key.toUpperCase();
  }

  return null;
}

export function buildShortcutFromKeyboardEvent(event: KeyboardEvent): string | null {
  if (MODIFIER_KEYS.has(event.key)) {
    return null;
  }

  const mainKey = normalizeShortcutMainKey(event);
  if (!mainKey) {
    return null;
  }

  const hasModifier =
    event.metaKey || event.ctrlKey || event.altKey || event.shiftKey;
  if (!hasModifier) {
    return null;
  }

  const parts: string[] = [];
  if (event.metaKey || event.ctrlKey) {
    parts.push("CmdOrCtrl");
  }
  if (event.altKey) {
    parts.push("Alt");
  }
  if (event.shiftKey) {
    parts.push("Shift");
  }
  parts.push(mainKey);

  return parts.join("+");
}

/* ─── Toggle switch helper ─── */
export function Toggle({
  value,
  onChange,
  size = "md",
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  size?: "sm" | "md";
}) {
  const w = size === "sm" ? "w-7 h-[16px]" : "w-8 h-[18px]";
  const dot = size === "sm" ? "w-[12px] h-[12px]" : "w-[14px] h-[14px]";
  const shift = size === "sm" ? "translate-x-[11px]" : "translate-x-[14px]";
  return (
    <button
      onClick={() => onChange(!value)}
      className={cn(
        "relative rounded-full transition-colors",
        w,
        value ? "bg-primary/80" : "bg-muted",
      )}
    >
      <span
        className={cn(
          "absolute top-[2px] left-[2px] rounded-full bg-white shadow transition-transform",
          dot,
          value && shift,
        )}
      />
    </button>
  );
}
