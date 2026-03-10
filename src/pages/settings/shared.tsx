import { cn } from "@/lib/utils";
import type { Platform } from "@/contexts/PlatformContext";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from "react";

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

export const ALL_OCR_ENGINES = [
  { id: "native", label: "Native OCR", fields: [] as const },
  { id: "rapidocr", label: "RapidOCR", fields: [] as const },
  { id: "baidu", label: "Baidu OCR", fields: ["apiKey", "apiSecret"] as const },
  { id: "google", label: "Google Vision", fields: ["apiKey"] as const },
  { id: "tencent", label: "Tencent OCR", fields: ["apiKey", "apiSecret"] as const },
  { id: "local_model", label: "Local Model", fields: ["command"] as const },
  { id: "online_model", label: "Online Model", fields: ["endpoint", "apiKey"] as const },
  { id: "ai_vision", label: "AI Vision", fields: ["endpoint", "apiKey", "model"] as const },
] as const;

export function getOcrEngineList(platform: Platform) {
  return ALL_OCR_ENGINES.filter((engine) => {
    if (engine.id === "native") {
      return platform === "windows";
    }
    return true;
  });
}

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

export function SettingsHero({
  eyebrow,
  title,
  description,
  badge,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  badge?: string;
}) {
  return (
    <div className="settings-hero">
      <div className="space-y-2">
        {eyebrow ? (
          <div className="settings-eyebrow">{eyebrow}</div>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="settings-title">{title}</h1>
          {badge ? <span className="settings-badge">{badge}</span> : null}
        </div>
        <p className="settings-description max-w-3xl">{description}</p>
      </div>
    </div>
  );
}

export function SettingsSection({
  title,
  description,
  children,
  aside,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="settings-section">
      <div className="settings-section-heading">
        <div className="space-y-1">
          <h2 className="settings-section-title">{title}</h2>
          {description ? (
            <p className="settings-section-description">{description}</p>
          ) : null}
        </div>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </div>
      <div className="settings-card">{children}</div>
    </section>
  );
}

export function SettingsRow({
  title,
  description,
  control,
  stacked = false,
}: {
  title: string;
  description?: string;
  control: ReactNode;
  stacked?: boolean;
}) {
  return (
    <div
      className={cn(
        "settings-row",
        stacked && "settings-row--stacked",
      )}
    >
      <div className="min-w-0 space-y-1">
        <div className="settings-row-title">{title}</div>
        {description ? (
          <p className="settings-row-description">{description}</p>
        ) : null}
      </div>
      <div className="settings-row-control">{control}</div>
    </div>
  );
}

export function SettingsField({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("settings-field", className)}>
      {children}
    </div>
  );
}

export function SettingsSubsection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="settings-subsection">
      <div className="space-y-1">
        <h3 className="settings-subsection-title">{title}</h3>
        {description ? (
          <p className="settings-subsection-description">{description}</p>
        ) : null}
      </div>
      <div className="mt-3 space-y-1">{children}</div>
    </div>
  );
}

export function SettingsPillGroup({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("settings-pill-group", className)}>{children}</div>;
}

export function SettingsPillButton({
  active,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
}) {
  return (
    <button
      {...props}
      data-active={active ? "true" : "false"}
      className={cn("settings-pill-button", className)}
    >
      {children}
    </button>
  );
}

export function SettingsInput({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn("settings-input", className)} />;
}


export function SettingsButton({
  tone = "default",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "default" | "primary" | "danger" | "ghost";
}) {
  return (
    <button
      {...props}
      data-tone={tone}
      className={cn("settings-button", className)}
    >
      {children}
    </button>
  );
}
