import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import {
  Copy,
  Check,
  Save,
  Pencil,
  X,
  Languages,
  Brain,
  Loader2,
  ArrowRightLeft,
  RotateCcw,
  ClipboardPaste,
  Code,
  Eye,
} from "lucide-react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useTranslation } from "react-i18next";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { getEntry, pasteEntry, updateEntryText } from "@/services/clipboardService";
import { aiSummarize, updateAiSummary } from "@/services/aiService";
import { openSettingsWindow } from "@/services/settingsWindowService";
import { useTranslateStore } from "@/stores/translateStore";
import { useCapabilityStore } from "@/stores/capabilityStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { openUrl } from "@/services/settingsService";
import { SourceBadge } from "@/components/SourceBadge";
import type { ClipboardEntry } from "@/types";
import { sanitizeDetailHtml, type RichTextDetailMode } from "@/lib/richText";

const searchParams = new URLSearchParams(window.location.search);
const entryId = searchParams.get("id") || "";
const initialTab = (searchParams.get("tab") as "view" | "translate" | "ai") || "view";

function applyTheme(theme: "light" | "dark" | "system") {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else if (theme === "light") {
    root.classList.remove("dark");
  } else {
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }
}

const LANGUAGES = [
  { value: "auto", labelKey: "translate.auto" },
  { value: "zh", label: "中文" },
  { value: "en", label: "English" },
  { value: "ja", label: "日本語" },
  { value: "ko", label: "한국어" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
  { value: "es", label: "Español" },
  { value: "ru", label: "Русский" },
];

function HintIconButton({
  label,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
}) {
  return (
    <button
      {...props}
      className={cn(
        "group relative p-1 rounded transition-colors",
        className,
      )}
      aria-label={label}
      title={label}
    >
      {children}
      <span className="pointer-events-none absolute right-0 top-full z-20 mt-1.5 hidden whitespace-nowrap rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-[11px] leading-none text-white shadow-lg group-hover:block group-focus-visible:block dark:border-zinc-300 dark:bg-zinc-50 dark:text-zinc-950">
        {label}
      </span>
    </button>
  );
}

export function DetailPage() {
  const { t, i18n } = useTranslation();
  const canTranslate = useCapabilityStore((s) => s.can_translate);
  const hasTranslateEngine = useCapabilityStore((s) => s.has_translate_engine);
  const hasAi = useCapabilityStore((s) => s.has_ai);
  const translateUsesAiByDefault = useCapabilityStore((s) => s.translate_uses_ai_by_default);
  const theme = useSettingsStore((s) => s.theme);
  const locale = useSettingsStore((s) => s.locale);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const richTextDetailMode = useSettingsStore((s) => s.richTextDetailMode);

  const [entry, setEntry] = useState<ClipboardEntry | null>(null);
  const [tab, setTab] = useState<"view" | "translate" | "ai">(initialTab);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const tabStyle = {
    gap: "var(--app-tab-gap)",
    paddingInline: "var(--app-tab-px)",
    paddingBlock: "var(--app-tab-py)",
    fontSize: "var(--app-tab-font-size)",
  } as const;
  const tabIconStyle = {
    width: "var(--app-tab-icon-size)",
    height: "var(--app-tab-icon-size)",
  } as const;

  // AI state
  const [summarizing, setSummarizing] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (locale && i18n.language !== locale) {
      i18n.changeLanguage(locale);
    }
  }, [locale, i18n]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Fetch entry
  useEffect(() => {
    if (!entryId) return;
    getEntry(entryId).then((e) => {
      if (e) {
        setEntry(e);
        setEditText(e.text_content || "");
      }
    });
  }, []);

  // Escape closes window
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isEditing) {
          setIsEditing(false);
          setEditText(entry?.text_content || "");
        } else {
          getCurrentWebviewWindow().close();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isEditing, entry]);

  const handleCopy = useCallback(async () => {
    if (!entry?.text_content) return;
    await navigator.clipboard.writeText(entry.text_content);
    setCopied(true);
    toast.success(t("detail.copied"));
    setTimeout(() => setCopied(false), 1500);
  }, [entry, t]);

  const handlePaste = useCallback(async () => {
    if (!entry) return;
    try {
      await pasteEntry(entry.id);
      toast.success(t("toast.pasted"));
    } catch {
      toast.error(t("toast.pasteFailed"));
    }
  }, [entry, t]);

  const handleSave = useCallback(async () => {
    if (!entry) return;
    setSaving(true);
    try {
      await updateEntryText(entry.id, editText);
      setEntry({ ...entry, text_content: editText });
      setIsEditing(false);
      toast.success(t("detail.saved"));
    } catch {
      toast.error(t("detail.saveFailed"));
    } finally {
      setSaving(false);
    }
  }, [entry, editText, t]);

  const handleSummarize = useCallback(async () => {
    if (!entry?.text_content) return;
    if (!hasAi) {
      toast.error(t("toast.summaryConfigRequired"));
      openSettingsWindow("ai");
      return;
    }
    setSummarizing(true);
    try {
      const summary = await aiSummarize(entry.text_content);
      await updateAiSummary(entry.id, summary);
      setEntry({ ...entry, ai_summary: summary });
      toast.success(t("toast.summarized"));
    } catch {
      toast.error(t("toast.summarizeFailed"));
    } finally {
      setSummarizing(false);
    }
  }, [entry, hasAi, t]);

  if (!entry) {
    return (
      <div className="flex items-center justify-center h-screen bg-background text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  const hasText = entry.content_type === "PlainText" || entry.content_type === "RichText";

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <div className="flex items-center gap-3 px-3 border-b border-border/30 shrink-0">
        <div className="tab-scroll-area min-w-0 flex-1 overflow-x-auto">
          <div className="flex w-max items-center gap-0">
            {(["view", "translate", "ai"] as const).map((t2) => (
              <button
                key={t2}
                onClick={() => setTab(t2)}
                style={tabStyle}
                className={cn(
                  "flex shrink-0 items-center whitespace-nowrap border-b-2 font-medium transition-colors leading-none",
                  tab === t2
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {t2 === "view" && <Eye style={tabIconStyle} />}
                {t2 === "translate" && <Languages style={tabIconStyle} />}
                {t2 === "ai" && <Brain style={tabIconStyle} />}
                {t(`detail.tab${t2.charAt(0).toUpperCase() + t2.slice(1)}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="min-w-0 max-w-[40%] flex-[0_1_10rem]">
          <SourceBadge
            sourceApp={entry.source_app}
            sourceUrl={entry.source_url}
            className="w-full"
            textClassName="text-2xs"
          />
        </div>
        {hasText && (
          <div className="flex items-center gap-1 shrink-0">
            <HintIconButton
              onClick={handleCopy}
              label={copied ? t("detail.copied") : t("detail.copy")}
              className={cn(
                copied ? "text-green-400" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </HintIconButton>
            <HintIconButton
              onClick={handlePaste}
              label={t("detail.paste")}
              className="text-muted-foreground hover:text-foreground"
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
            </HintIconButton>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === "view" && (
          <ViewTab
            entry={entry}
            isEditing={isEditing}
            editText={editText}
            saving={saving}
            defaultRenderMode={richTextDetailMode}
            onEditTextChange={setEditText}
            onStartEdit={() => { setIsEditing(true); setEditText(entry.text_content || ""); }}
            onCancelEdit={() => { setIsEditing(false); setEditText(entry.text_content || ""); }}
            onSave={handleSave}
          />
        )}
        {tab === "translate" && (
          <TranslateTab
            text={entry.text_content || ""}
            canTranslate={canTranslate}
            hasTranslateEngine={hasTranslateEngine}
            hasAi={hasAi}
            translateUsesAiByDefault={translateUsesAiByDefault}
            onOpenSettings={() => openSettingsWindow("translate")}
          />
        )}
        {tab === "ai" && (
          <AiTab
            entry={entry}
            summarizing={summarizing}
            hasAi={hasAi}
            onOpenSettings={() => openSettingsWindow("ai")}
            onSummarize={handleSummarize}
          />
        )}
      </div>
    </div>
  );
}

/* ─── View Tab ─── */

function ViewTab({
  entry,
  isEditing,
  editText,
  saving,
  defaultRenderMode,
  onEditTextChange,
  onStartEdit,
  onCancelEdit,
  onSave,
}: {
  entry: ClipboardEntry;
  isEditing: boolean;
  editText: string;
  saving: boolean;
  defaultRenderMode: RichTextDetailMode;
  onEditTextChange: (text: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
}) {
  const { t } = useTranslation();
  const hasText = entry.content_type === "PlainText" || entry.content_type === "RichText";
  const isRichText = entry.content_type === "RichText" && !!entry.html_content;
  const [viewMode, setViewMode] = useState<"rendered" | "source">(isRichText ? "rendered" : "source");
  const [renderMode, setRenderMode] = useState<RichTextDetailMode>(defaultRenderMode);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const sanitizedHtml = useMemo(() => {
    if (!entry.html_content) return "";
    return sanitizeDetailHtml(entry.html_content, renderMode);
  }, [entry.html_content, renderMode]);

  useEffect(() => {
    setRenderMode(defaultRenderMode);
  }, [defaultRenderMode, entry.id]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  // Ctrl+S to save when editing
  useEffect(() => {
    if (!isEditing) return;
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        onSave();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isEditing, onSave]);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      {hasText && (
        <div className="flex items-center justify-between px-3 py-1 border-b border-border/20 shrink-0">
        <div className="flex items-center gap-1">
            {isRichText && !isEditing && (
              <>
                <button
                  onClick={() => setViewMode(viewMode === "rendered" ? "source" : "rendered")}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-medium text-purple-400 bg-purple-400/10 hover:bg-purple-400/20 transition-colors"
                >
                  {viewMode === "rendered" ? <Code className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  {viewMode === "rendered" ? t("viewer.viewSource") : t("viewer.viewRendered")}
                </button>
                {viewMode === "rendered" && (
                  <div className="flex items-center gap-1 rounded-md border border-border/40 bg-muted/20 p-0.5">
                    {(["clean", "full"] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setRenderMode(mode)}
                        className={cn(
                          "rounded px-1.5 py-0.5 text-2xs font-medium transition-colors",
                          renderMode === mode
                            ? "bg-primary/15 text-primary"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {t(`settings.richText.detailModes.${mode}.label`)}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-1">
            {isEditing ? (
              <>
                <button
                  onClick={onCancelEdit}
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-3 h-3" />
                  {t("detail.cancel")}
                </button>
                <button
                  onClick={onSave}
                  disabled={saving}
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  {t("detail.save")}
                </button>
              </>
            ) : (
              <button
                onClick={onStartEdit}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-medium text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <Pencil className="w-3 h-3" />
                {t("detail.edit")}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 overflow-y-auto p-3">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={editText}
            onChange={(e) => onEditTextChange(e.target.value)}
            className="w-full h-full min-h-[200px] p-2 rounded-md border border-border/50 bg-muted/10 text-sm2 leading-relaxed text-foreground font-mono resize-none focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
        ) : hasText ? (
          isRichText && viewMode === "rendered" ? (
            <div
              className={cn(
                "rich-text-content text-sm2 leading-relaxed text-foreground",
                renderMode === "full"
                  ? "rich-text-content--detail-full"
                  : "rich-text-content--detail-clean",
              )}
              dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
              onClick={(e) => {
                const anchor = (e.target as HTMLElement).closest("a");
                if (anchor) {
                  e.preventDefault();
                  const href = anchor.getAttribute("href");
                  if (href && /^https?:\/\//i.test(href)) {
                    openUrl(href).catch(() => {});
                  }
                }
              }}
            />
          ) : (
            <pre className="text-sm2 leading-relaxed whitespace-pre-wrap break-all text-foreground">
              {entry.text_content}
            </pre>
          )
        ) : (
          <div className="text-sm2 text-muted-foreground">
            {entry.content_type === "Image" ? "Image content" : entry.content_type}
          </div>
        )}
      </div>

      {/* Meta info */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-t border-border/20 text-2xs text-muted-foreground/60 shrink-0">
        <span>{entry.content_type}</span>
        {entry.content_category && entry.content_category !== "General" && (
          <span className="text-blue-400">{entry.content_category}</span>
        )}
        {entry.detected_language && (
          <span className="text-emerald-400">{entry.detected_language}</span>
        )}
        {entry.text_content && (
          <span>{entry.text_content.length} chars</span>
        )}
        <span>{new Date(entry.created_at).toLocaleString()}</span>
      </div>
    </div>
  );
}

/* ─── Translate Tab ─── */

function SettingsHintPanel({
  title,
  description,
  buttonLabel,
  onOpenSettings,
}: {
  title: string;
  description: string;
  buttonLabel: string;
  onOpenSettings: () => void;
}) {
  return (
    <div className="flex h-full items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-xl border border-border/50 bg-muted/10 px-5 py-6 text-center">
        <div className="space-y-1.5">
          <p className="text-sm2 font-medium text-foreground">{title}</p>
          <p className="text-xs2 leading-relaxed text-muted-foreground">{description}</p>
        </div>
        <button
          onClick={onOpenSettings}
          className="mt-4 h-8 rounded-md bg-primary/15 px-3 text-xs2 font-medium text-primary transition-colors hover:bg-primary/25"
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}

function TranslateTab({
  text,
  canTranslate,
  hasTranslateEngine,
  hasAi,
  translateUsesAiByDefault,
  onOpenSettings,
}: {
  text: string;
  canTranslate: boolean;
  hasTranslateEngine: boolean;
  hasAi: boolean;
  translateUsesAiByDefault: boolean;
  onOpenSettings: () => void;
}) {
  const { t } = useTranslation();
  const result = useTranslateStore((s) => s.result);
  const loading = useTranslateStore((s) => s.loading);
  const error = useTranslateStore((s) => s.error);
  const fromLang = useTranslateStore((s) => s.fromLang);
  const toLang = useTranslateStore((s) => s.toLang);
  const translate = useTranslateStore((s) => s.translate);
  const setFromLang = useTranslateStore((s) => s.setFromLang);
  const setToLang = useTranslateStore((s) => s.setToLang);
  const clearResult = useTranslateStore((s) => s.clearResult);
  const useAi = useTranslateStore((s) => s.useAi);
  const setUseAi = useTranslateStore((s) => s.setUseAi);

  const autoTranslated = useRef(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!canTranslate || !text || autoTranslated.current) return;
    autoTranslated.current = true;
    translate(text);
  }, [canTranslate, text, translate]);

  useEffect(() => {
    if (translateUsesAiByDefault && !useAi) {
      autoTranslated.current = true;
      setUseAi(true);
    }
    if (!hasAi && useAi) {
      setUseAi(false);
    }
  }, [hasAi, setUseAi, translateUsesAiByDefault, useAi]);

  useEffect(() => {
    return () => clearResult();
  }, [clearResult]);

  const handleSwapLangs = () => {
    if (fromLang === "auto") return;
    const oldFrom = fromLang;
    setFromLang(toLang);
    setToLang(oldFrom);
  };

  const handleCopyResult = async () => {
    if (!result?.translated) return;
    try {
      await navigator.clipboard.writeText(result.translated);
      setCopied(true);
      toast.success(t("toast.copied"));
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(t("translate.copyFailed"));
    }
  };

  const handleUseTranslation = async () => {
    if (!result?.translated) return;
    try {
      await navigator.clipboard.writeText(result.translated);
      toast.success(t("translate.copiedToClipboard"));
    } catch {
      toast.error(t("translate.copyFailed"));
    }
  };

  const handleTranslate = () => {
    if (!canTranslate) {
      toast.error(t("toast.translateConfigRequired"));
      onOpenSettings();
      return;
    }
    translate(text);
  };

  if (!canTranslate) {
    return (
      <SettingsHintPanel
        title={t("translate.configureTranslateOrAi")}
        description={t("translate.configureTranslateOrAiHint")}
        buttonLabel={t("translate.openSettings")}
        onOpenSettings={onOpenSettings}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Language bar */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border/20 shrink-0">
        <select
          value={fromLang}
          onChange={(e) => setFromLang(e.target.value)}
          className="flex-1 h-6 px-1.5 text-xs2 bg-muted/30 border border-border/50 rounded text-foreground focus:outline-none focus:ring-1 focus:ring-ring/30"
        >
          {LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>
              {l.labelKey ? t(l.labelKey) : l.label}
            </option>
          ))}
        </select>

        <button
          onClick={handleSwapLangs}
          disabled={fromLang === "auto"}
          className={cn(
            "shrink-0 p-1 rounded transition-colors",
            fromLang === "auto"
              ? "text-muted-foreground/30 cursor-not-allowed"
              : "text-muted-foreground hover:text-primary hover:bg-primary/10"
          )}
        >
          <ArrowRightLeft className="w-3 h-3" />
        </button>

        <select
          value={toLang}
          onChange={(e) => setToLang(e.target.value)}
          className="flex-1 h-6 px-1.5 text-xs2 bg-muted/30 border border-border/50 rounded text-foreground focus:outline-none focus:ring-1 focus:ring-ring/30"
        >
          {LANGUAGES.filter((l) => l.value !== "auto").map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>

        <button
          onClick={handleTranslate}
          disabled={loading}
          className={cn(
            "shrink-0 flex items-center gap-1 h-6 px-2 rounded text-xs2 font-medium transition-colors",
            loading
              ? "bg-muted/50 text-muted-foreground cursor-not-allowed"
              : "bg-primary/15 text-primary hover:bg-primary/25"
          )}
        >
          <RotateCcw className={cn("w-2.5 h-2.5", loading && "animate-spin")} />
        </button>

        {hasTranslateEngine && hasAi && (
          <button
            onClick={() => setUseAi(!useAi)}
            className={cn(
              "shrink-0 flex items-center gap-1 h-6 px-2 rounded text-xs2 font-medium transition-colors",
              useAi
                ? "bg-primary text-primary-foreground"
                : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
            )}
            title="AI"
          >
            <Brain className="w-2.5 h-2.5" />
            AI
          </button>
        )}
      </div>

      {/* Source text */}
      <div className="px-3 pt-2.5 pb-2 shrink-0">
        {translateUsesAiByDefault && (
          <span className="mb-2 inline-flex rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-2xs font-medium text-primary">
            {t("translate.defaultAi")}
          </span>
        )}
        <p className="text-2xs text-muted-foreground/60 uppercase tracking-wider mb-1">
          {t("translate.sourceText")}
        </p>
        <p className="text-sm2 text-muted-foreground bg-muted/10 rounded-md px-2.5 py-2 max-h-[120px] overflow-y-auto break-words leading-relaxed select-text">
          {text.length > 800 ? text.substring(0, 800) + "\u2026" : text}
        </p>
      </div>

      <div className="mx-3 border-t border-border/20" />

      {/* Result area */}
      <div className="flex-1 min-h-0 px-3 pt-2 pb-3 flex flex-col overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center gap-1.5 py-8 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm2">{t("translate.translating")}</span>
          </div>
        )}

        {error && (
          <div className="py-2">
            <p className="text-xs2 text-red-400 bg-red-400/10 rounded-md px-2.5 py-2">
              {t("translate.error")}: {error}
            </p>
          </div>
        )}

        {result && (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="flex items-center justify-between mb-1">
              <p className="text-2xs text-muted-foreground/60 uppercase tracking-wider">
                {t("translate.result")}
                {result.engine && (
                  <span className="ml-1 normal-case tracking-normal text-primary/50">
                    ({result.engine})
                  </span>
                )}
              </p>
            </div>
            <p className="text-sm2 text-foreground bg-primary/5 border border-primary/10 rounded-md px-2.5 py-2 flex-1 overflow-y-auto break-words leading-relaxed select-text">
              {result.translated}
            </p>

            <div className="flex items-center gap-1.5 mt-2 shrink-0">
              <button
                onClick={handleCopyResult}
                className={cn(
                  "flex items-center gap-1 h-6 px-2.5 rounded text-xs2 font-medium transition-all",
                  copied
                    ? "bg-green-500/15 text-green-400"
                    : "bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                {copied ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
                {copied ? t("translate.copied") : t("translate.copyResult")}
              </button>
              <button
                onClick={handleUseTranslation}
                className="flex items-center gap-1 h-6 px-2.5 rounded text-xs2 font-medium bg-primary/15 text-primary hover:bg-primary/25 transition-colors"
              >
                <ClipboardPaste className="w-2.5 h-2.5" />
                {t("translate.useTranslation")}
              </button>
            </div>
          </div>
        )}

        {!loading && !error && !result && (
          <div className="flex items-center justify-center py-8 text-muted-foreground/40">
            <span className="text-xs2">{t("translate.noResult")}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── AI Tab ─── */

function AiTab({
  entry,
  summarizing,
  hasAi,
  onOpenSettings,
  onSummarize,
}: {
  entry: ClipboardEntry;
  summarizing: boolean;
  hasAi: boolean;
  onOpenSettings: () => void;
  onSummarize: () => void;
}) {
  const { t } = useTranslation();

  if (!hasAi) {
    return (
      <SettingsHintPanel
        title={t("detail.summaryConfigRequired")}
        description={t("detail.summaryConfigHint")}
        buttonLabel={t("detail.openAiSettings")}
        onOpenSettings={onOpenSettings}
      />
    );
  }

  return (
    <div className="flex flex-col h-full p-3 gap-3">
      {/* Summary section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-foreground">
            {t("detail.summary")}
          </span>
          <button
            onClick={onSummarize}
            disabled={summarizing || !entry.text_content}
            className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-medium transition-colors",
              "bg-primary/15 text-primary hover:bg-primary/25",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {summarizing ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Brain className="w-3 h-3" />
            )}
            {summarizing
              ? t("detail.generating")
              : entry.ai_summary
                ? t("detail.regenerateSummary")
                : t("detail.generateSummary")}
          </button>
        </div>

        {entry.ai_summary ? (
          <div className="text-sm2 text-foreground bg-primary/5 border border-primary/10 rounded-md px-3 py-2.5 leading-relaxed select-text">
            {entry.ai_summary}
          </div>
        ) : (
          <div className="text-sm2 text-muted-foreground/50 bg-muted/10 rounded-md px-3 py-2.5 italic">
            {t("detail.noSummary")}
          </div>
        )}
      </div>

      {/* Original text preview */}
      {entry.text_content && (
        <div className="flex-1 min-h-0 flex flex-col">
          <span className="text-2xs text-muted-foreground/60 uppercase tracking-wider mb-1 shrink-0">
            {t("translate.sourceText")}
          </span>
          <pre className="flex-1 text-sm2 text-muted-foreground bg-muted/10 rounded-md px-3 py-2 overflow-y-auto break-words whitespace-pre-wrap leading-relaxed select-text">
            {entry.text_content}
          </pre>
        </div>
      )}
    </div>
  );
}
