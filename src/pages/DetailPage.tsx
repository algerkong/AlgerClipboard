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
  Eye,
  PanelLeft,
  Columns2,
  PanelRight,
  Code,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { usePreviewCloseShortcut } from "@/hooks/usePreviewCloseShortcut";
import { CloseConfirmDialog } from "@/components/CloseConfirmDialog";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import {
  getEntry,
  pasteEntry,
  updateEntryText,
} from "@/services/clipboardService";
import { aiSummarize, updateAiSummary } from "@/services/aiService";
import { openSettingsWindow } from "@/services/settingsWindowService";
import { useTranslateStore } from "@/stores/translateStore";
import { useCapabilityStore } from "@/stores/capabilityStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { openUrl } from "@/services/settingsService";
import { SourceBadge } from "@/components/SourceBadge";
import { StyledSelect, type SelectOption } from "@/components/ui/styled-select";
import type { ClipboardEntry } from "@/types";
import { sanitizeDetailHtml, type RichTextDetailMode } from "@/lib/richText";
import { CodeEditor } from "@/components/editor/CodeEditor";
import { RichEditor } from "@/components/editor/RichEditor";
import { MarkdownPreview } from "@/components/editor/MarkdownPreview";
import { SplitView } from "@/components/editor/SplitView";
import {
  detectContentMode,
  mapLanguageToCodemirror,
  type ContentMode,
} from "@/lib/contentDetect";
import { transformGroups } from "@/services/textTransformService";

const searchParams = new URLSearchParams(window.location.search);
const entryId = searchParams.get("id") || "";
const initialTab =
  (searchParams.get("tab") as "view" | "translate" | "ai") || "view";

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
      className={cn("group relative p-1 rounded transition-colors", className)}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

export function DetailPage() {
  const { t, i18n } = useTranslation();
  const canTranslate = useCapabilityStore((s) => s.can_translate);
  const hasTranslateEngine = useCapabilityStore((s) => s.has_translate_engine);
  const hasAi = useCapabilityStore((s) => s.has_ai);
  const translateUsesAiByDefault = useCapabilityStore(
    (s) => s.translate_uses_ai_by_default,
  );
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

  useEffect(() => {
    if (!entryId) return;
    getEntry(entryId).then((e) => {
      if (e) {
        setEntry(e);
        setEditText(e.text_content || "");
      }
    });
  }, []);

  const { showConfirm, handleConfirmYes, handleConfirmNo, closeKey } = usePreviewCloseShortcut();

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

  const hasText =
    entry.content_type === "PlainText" || entry.content_type === "RichText";

  return (
    <div className="app-shell flex h-full flex-col overflow-hidden bg-background">
      {/* ── Top bar: tabs + actions ── */}
      <div className="shrink-0 px-2.5 py-1.5" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between gap-1.5">
          <div className="tab-scroll-area min-w-0 overflow-x-auto">
            <div className="flex w-max items-center gap-0.5">
              {(["view", "translate", "ai"] as const).map((t2) => (
                <button
                  key={t2}
                  onClick={() => setTab(t2)}
                  style={tabStyle}
                  data-active={tab === t2}
                  className={cn(
                    "filter-pill flex shrink-0 items-center whitespace-nowrap font-medium leading-none text-muted-foreground transition-all",
                    tab === t2
                      ? "text-foreground"
                      : "hover:border-primary/20 hover:bg-accent/50 hover:text-foreground",
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
          <div className="flex shrink-0 items-center gap-1">
            <SourceBadge
              sourceApp={entry.source_app}
              sourceUrl={entry.source_url}
              sourceIcon={entry.source_icon}
              className="meta-pill min-w-0 max-w-[180px] px-2 py-0.5"
              textClassName="text-2xs"
              iconClassName="!h-[16px] !w-[16px]"
            />
            {hasText && (
              <div className="detail-action-group">
                <HintIconButton
                  onClick={handleCopy}
                  label={copied ? t("detail.copied") : t("detail.copy")}
                  className={cn(
                    "filter-pill min-h-0 p-1 transition-colors text-muted-foreground hover:text-foreground",
                    copied && "text-green-400",
                  )}
                >
                  {copied ? (
                    <Check className="w-2.5 h-2.5" />
                  ) : (
                    <Copy className="w-2.5 h-2.5" />
                  )}
                </HintIconButton>
                <HintIconButton
                  onClick={handlePaste}
                  label={t("detail.paste")}
                  className="filter-pill min-h-0 p-1 transition-colors text-muted-foreground hover:text-foreground"
                >
                  <ClipboardPaste className="w-2.5 h-2.5" />
                </HintIconButton>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Content area ── */}
      <div className="flex-1 min-h-0 overflow-hidden px-2 pb-1.5 pt-1.5">
        <div className="surface-panel h-full overflow-hidden rounded-[1rem]">
          {tab === "view" && (
            <ViewTab
              key={`${entry.id}-${richTextDetailMode}`}
              entry={entry}
              isEditing={isEditing}
              editText={editText}
              saving={saving}
              defaultRenderMode={richTextDetailMode}
              onEditTextChange={setEditText}
              onStartEdit={() => {
                setIsEditing(true);
                setEditText(entry.text_content || "");
              }}
              onCancelEdit={() => {
                setIsEditing(false);
                setEditText(entry.text_content || "");
              }}
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

      {/* ── Status bar ── */}
      <div className="detail-status-bar shrink-0">
        <span className="detail-status-pill">{entry.content_type}</span>
        {entry.content_category && entry.content_category !== "General" && (
          <span className="detail-status-pill text-blue-400/80">
            {entry.content_category}
          </span>
        )}
        {entry.detected_language && (
          <span className="detail-status-pill text-emerald-400/80">
            {entry.detected_language}
          </span>
        )}
        {entry.text_content && (
          <span className="detail-status-pill">
            {entry.text_content.length} chars
          </span>
        )}
        <span className="detail-status-pill">
          {new Date(entry.created_at).toLocaleString()}
        </span>
      </div>

      {showConfirm && (
        <CloseConfirmDialog
          shortcutKey={closeKey}
          onConfirm={handleConfirmYes}
          onCancel={handleConfirmNo}
        />
      )}
    </div>
  );
}

/* ─── View Tab ─── */

type ViewLayout = "editor" | "split" | "preview";

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
  const hasText =
    entry.content_type === "PlainText" || entry.content_type === "RichText";
  const [renderMode, setRenderMode] =
    useState<RichTextDetailMode>(defaultRenderMode);
  const [layout, setLayout] = useState<ViewLayout>("preview");
  const [editHtml, setEditHtml] = useState(entry.html_content || "");
  const [transformMode, setTransformMode] = useState(false);
  const [activeGroupIndex, setActiveGroupIndex] = useState(0);
  const [activeTransformIndex, setActiveTransformIndex] = useState(-1);
  const [transformResult, setTransformResult] = useState<string | null>(null);

  const contentMode: ContentMode = useMemo(
    () =>
      detectContentMode(
        entry.content_type,
        entry.text_content,
        entry.html_content,
        entry.detected_language,
      ),
    [
      entry.content_type,
      entry.text_content,
      entry.html_content,
      entry.detected_language,
    ],
  );

  const cmLanguage = useMemo(
    () => mapLanguageToCodemirror(entry.detected_language),
    [entry.detected_language],
  );

  const sanitizedHtml = useMemo(() => {
    if (!entry.html_content) return "";
    return sanitizeDetailHtml(entry.html_content, renderMode);
  }, [entry.html_content, renderMode]);

  const handleSelectTransform = useCallback(
    (groupIndex: number, transformIndex: number) => {
      const sourceText = isEditing ? editText : entry.text_content;
      if (!sourceText) return;
      setActiveGroupIndex(groupIndex);
      setActiveTransformIndex(transformIndex);
      const fn = transformGroups[groupIndex].transforms[transformIndex].fn;
      setTransformResult(fn(sourceText));
    },
    [isEditing, editText, entry.text_content],
  );

  const exitTransformMode = useCallback(() => {
    setTransformMode(false);
    setActiveTransformIndex(-1);
    setTransformResult(null);
  }, []);

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

  /* ── Render helpers ── */

  const renderPreview = () => {
    if (contentMode === "richtext") {
      return (
        <div
          className={cn(
            "rich-text-content h-full overflow-y-auto p-3 text-sm2 leading-relaxed text-foreground",
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
              if (href && /^https?:\/\//i.test(href))
                openUrl(href).catch(() => {});
            }
          }}
        />
      );
    }
    if (contentMode === "markdown") {
      return (
        <div className="h-full overflow-y-auto p-3">
          <MarkdownPreview content={entry.text_content || ""} />
        </div>
      );
    }
    return (
      <CodeEditor
        value={entry.text_content || ""}
        language={cmLanguage}
        readOnly
        className="h-full"
      />
    );
  };

  const renderEditor = () => {
    if (contentMode === "richtext" || contentMode === "plaintext") {
      return (
        <RichEditor
          content={contentMode === "richtext" ? editHtml : editText}
          onChange={contentMode === "richtext" ? setEditHtml : onEditTextChange}
          onSave={onSave}
          className="h-full"
        />
      );
    }
    return (
      <CodeEditor
        value={editText}
        language={contentMode === "markdown" ? "markdown" : cmLanguage}
        onChange={onEditTextChange}
        onSave={onSave}
        className="h-full"
      />
    );
  };

  const renderEditingPreview = () => {
    if (contentMode === "richtext") {
      const html = sanitizeDetailHtml(editHtml, renderMode);
      return (
        <div
          className={cn(
            "rich-text-content h-full overflow-y-auto p-3 text-sm2 leading-relaxed text-foreground",
            renderMode === "full"
              ? "rich-text-content--detail-full"
              : "rich-text-content--detail-clean",
          )}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    }
    if (contentMode === "markdown") {
      return (
        <div className="h-full overflow-y-auto p-3">
          <MarkdownPreview content={editText} />
        </div>
      );
    }
    return (
      <CodeEditor
        value={editText}
        language={cmLanguage}
        readOnly
        className="h-full"
      />
    );
  };

  const renderContent = () => {
    if (!isEditing) return renderPreview();

    // Code mode always uses editor directly (no split/preview)
    if (contentMode === "code") return renderEditor();

    switch (layout) {
      case "editor":
        return renderEditor();
      case "split":
        return (
          <SplitView left={renderEditor()} right={renderEditingPreview()} />
        );
      case "preview":
        return renderEditingPreview();
    }
  };

  /* ── Layout ── */

  const contentModeLabel =
    contentMode === "richtext"
      ? "Rich Text"
      : contentMode === "markdown"
        ? "Markdown"
        : contentMode === "code"
          ? "Code"
          : "Text";

  const activeGroup = transformGroups[activeGroupIndex];

  return (
    <div className="flex flex-col h-full">
      {hasText && !transformMode && (
        <div className="detail-toolbar">
          <div className="flex items-center gap-1">
            <span className="detail-status-pill px-2 py-0.5 text-2xs">
              {contentModeLabel}
            </span>

            {/* Text transform toggle */}
            <button
              onClick={() => {
                setTransformMode(true);
                setActiveTransformIndex(-1);
                setTransformResult(null);
              }}
              title={t("contextMenu.textTransform")}
              className="filter-pill min-h-0 p-1 transition-colors text-muted-foreground hover:text-foreground hover:bg-accent/50"
            >
              <Code className="w-3 h-3" />
            </button>

            {/* RichText render mode toggle (clean/full) */}
            {contentMode === "richtext" &&
              !(isEditing && layout === "editor") && (
                <div className="detail-action-group">
                  {(["clean", "full"] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setRenderMode(mode)}
                      data-active={renderMode === mode}
                      className={cn(
                        "filter-pill min-h-0 px-2 py-0.5 text-2xs font-medium transition-colors",
                        renderMode === mode
                          ? "text-foreground"
                          : "hover:border-primary/20 hover:bg-accent/50 hover:text-foreground",
                      )}
                    >
                      {t(`settings.richText.detailModes.${mode}.label`)}
                    </button>
                  ))}
                </div>
              )}
          </div>

          <div className="flex items-center gap-1">
            {/* Layout toggle — only when editing non-code content */}
            {isEditing && contentMode !== "code" && (
              <div className="detail-action-group mr-0.5">
                {[
                  {
                    key: "editor" as ViewLayout,
                    icon: PanelLeft,
                    label: t("detail.editorOnly"),
                  },
                  {
                    key: "split" as ViewLayout,
                    icon: Columns2,
                    label: t("detail.splitView"),
                  },
                  {
                    key: "preview" as ViewLayout,
                    icon: PanelRight,
                    label: t("detail.previewOnly"),
                  },
                ].map(({ key, icon: Icon, label }) => (
                  <button
                    key={key}
                    onClick={() => setLayout(key)}
                    data-active={layout === key}
                    title={label}
                    className={cn(
                      "filter-pill min-h-0 p-1 transition-colors",
                      layout === key
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                    )}
                  >
                    <Icon className="w-3 h-3" />
                  </button>
                ))}
              </div>
            )}

            {isEditing ? (
              <>
                <button
                  onClick={onCancelEdit}
                  className="filter-pill flex items-center gap-1 px-2.5 text-2xs font-medium text-muted-foreground transition-colors hover:border-primary/20 hover:bg-accent/50 hover:text-foreground"
                >
                  <X className="w-2.5 h-2.5" />
                  {t("detail.cancel")}
                </button>
                <button
                  onClick={onSave}
                  disabled={saving}
                  className="filter-pill flex items-center gap-1 border-primary/60 bg-primary px-2.5 text-2xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                  ) : (
                    <Save className="w-2.5 h-2.5" />
                  )}
                  {t("detail.save")}
                </button>
              </>
            ) : (
              <button
                onClick={onStartEdit}
                className="filter-pill flex items-center gap-1 px-2.5 text-2xs font-medium text-muted-foreground transition-colors hover:border-primary/20 hover:bg-accent/50 hover:text-foreground"
              >
                <Pencil className="w-2.5 h-2.5" />
                {t("detail.edit")}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Transform mode ── */}
      {hasText && transformMode && (
        <div className="flex flex-col h-full animate-fade-in">
          {/* Transform toolbar: group tabs + close */}
          <div className="detail-toolbar">
            <div className="flex items-center gap-0.5 min-w-0 overflow-x-auto tab-scroll-area">
              {transformGroups.map((group, gi) => (
                <button
                  key={gi}
                  onClick={() => {
                    setActiveGroupIndex(gi);
                    setActiveTransformIndex(-1);
                    setTransformResult(null);
                  }}
                  data-active={activeGroupIndex === gi}
                  className={cn(
                    "filter-pill shrink-0 px-2 text-2xs font-medium transition-colors whitespace-nowrap",
                    activeGroupIndex === gi
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t(group.labelKey)}
                </button>
              ))}
            </div>
            <button
              onClick={exitTransformMode}
              className="filter-pill min-h-0 p-1 shrink-0 text-muted-foreground transition-colors hover:text-foreground hover:bg-accent/50"
              title={t("detail.cancel")}
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          {/* Transform items row */}
          <div className="flex items-center gap-1 px-2.5 py-1.5 overflow-x-auto tab-scroll-area shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
            {activeGroup.transforms.map((tr, ti) => (
              <button
                key={ti}
                onClick={() => handleSelectTransform(activeGroupIndex, ti)}
                className={cn(
                  "shrink-0 rounded-md px-2 py-1 text-2xs font-medium transition-all",
                  activeTransformIndex === ti
                    ? "bg-primary/15 text-primary shadow-sm"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
                style={activeTransformIndex === ti ? {
                  border: "1px solid color-mix(in oklab, var(--primary) 25%, transparent)",
                } : {
                  border: "1px solid transparent",
                }}
              >
                {t(tr.labelKey)}
              </button>
            ))}
          </div>

          {/* Preview area: original vs transformed */}
          {transformResult !== null ? (
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {/* Original text — compact */}
              <div className="shrink-0 px-3 pt-2.5 pb-1.5">
                <p className="text-2xs text-muted-foreground/50 uppercase tracking-wider mb-1">
                  {t("contextMenu.transformOriginal")}
                </p>
                <pre className="max-h-[72px] overflow-y-auto rounded-lg px-2.5 py-1.5 text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap break-all select-text" style={{ background: "color-mix(in oklab, var(--muted) 40%, transparent)" }}>
                  {(isEditing ? editText : entry.text_content) || ""}
                </pre>
              </div>

              {/* Transformed result — main area */}
              <div className="flex-1 min-h-0 flex flex-col px-3 pb-2">
                <p className="text-2xs text-primary/60 uppercase tracking-wider mb-1 shrink-0">
                  {t("contextMenu.transformResult")}
                </p>
                <pre className="flex-1 min-h-0 overflow-y-auto rounded-lg px-2.5 py-1.5 text-sm2 leading-relaxed text-foreground whitespace-pre-wrap break-all select-text" style={{ background: "color-mix(in oklab, var(--primary) 6%, transparent)", border: "1px solid color-mix(in oklab, var(--primary) 15%, transparent)" }}>
                  {transformResult}
                </pre>
              </div>

              {/* Action bar */}
              <div className="shrink-0 flex items-center justify-end gap-1 px-3 pb-2">
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(transformResult);
                    toast.success(t("contextMenu.transformCopied"));
                  }}
                  className="filter-pill flex items-center gap-1 px-2.5 text-2xs font-medium text-muted-foreground transition-colors hover:border-primary/20 hover:bg-accent/50 hover:text-foreground"
                >
                  <Copy className="w-2.5 h-2.5" />
                  {t("detail.copy")}
                </button>
                {isEditing && (
                  <button
                    onClick={() => {
                      onEditTextChange(transformResult);
                      exitTransformMode();
                      toast.success(t("contextMenu.transformApplied"));
                    }}
                    className="filter-pill flex items-center gap-1 border-primary/60 bg-primary px-2.5 text-2xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    <Check className="w-2.5 h-2.5" />
                    {t("contextMenu.transformApply")}
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* No transform selected yet — prompt */
            <div className="flex-1 flex items-center justify-center text-muted-foreground/40">
              <p className="text-xs2">{t("contextMenu.transformSelectHint")}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Normal content (hidden when transform mode) ── */}
      {!transformMode && (
        <div className="flex-1 min-h-0 overflow-hidden">
          {hasText ? (
            renderContent()
          ) : (
            <div className="flex items-center justify-center h-full p-3 text-sm2 text-muted-foreground">
              {entry.content_type === "Image"
                ? "Image content"
                : entry.content_type}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Translate Tab ─── */

const LANGUAGES: SelectOption[] = [
  { value: "auto", label: "Auto" },
  { value: "zh", label: "中文" },
  { value: "en", label: "English" },
  { value: "ja", label: "日本語" },
  { value: "ko", label: "한국어" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
  { value: "es", label: "Español" },
  { value: "ru", label: "Русский" },
];

const TARGET_LANGUAGES = LANGUAGES.filter((l) => l.value !== "auto");

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
    <div className="flex h-full items-center justify-center p-3">
      <div className="surface-panel w-full max-w-sm rounded-[1rem] px-4 py-5 text-center">
        <div className="space-y-1">
          <p className="text-sm2 font-medium text-foreground">{title}</p>
          <p className="text-xs2 leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
        <button
          onClick={onOpenSettings}
          className="filter-pill mt-3 px-3 text-xs2 font-medium text-primary transition-colors hover:bg-primary/25"
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

  // Localized source language options
  const sourceLanguages = useMemo<SelectOption[]>(() => {
    return LANGUAGES.map((l) =>
      l.value === "auto" ? { ...l, label: t("translate.auto") } : l,
    );
  }, [t]);

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
      {/* Language selector bar */}
      <div className="detail-toolbar">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <StyledSelect
            value={fromLang}
            onChange={setFromLang}
            options={sourceLanguages}
            className="flex-1 min-w-0"
          />

          <button
            onClick={handleSwapLangs}
            disabled={fromLang === "auto"}
            className={cn(
              "shrink-0 p-1 rounded transition-colors",
              fromLang === "auto"
                ? "text-muted-foreground/30 cursor-not-allowed"
                : "text-muted-foreground hover:text-primary hover:bg-primary/10",
            )}
          >
            <ArrowRightLeft className="w-3 h-3" />
          </button>

          <StyledSelect
            value={toLang}
            onChange={setToLang}
            options={TARGET_LANGUAGES}
            className="flex-1 min-w-0"
          />
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-1.5">
          <button
            onClick={handleTranslate}
            disabled={loading}
            className={cn(
              "filter-pill shrink-0 flex items-center gap-1 px-2.5 text-2xs font-medium transition-colors",
              loading
                ? "bg-muted/50 text-muted-foreground cursor-not-allowed"
                : "bg-primary/15 text-primary hover:bg-primary/25",
            )}
          >
            <RotateCcw className={cn("w-2.5 h-2.5", loading && "animate-spin")} />
          </button>

          {hasTranslateEngine && hasAi && (
            <button
              onClick={() => setUseAi(!useAi)}
              className={cn(
                "filter-pill shrink-0 flex items-center gap-1 px-2.5 text-2xs font-medium transition-colors",
                useAi
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/30 text-muted-foreground hover:bg-muted/50",
              )}
              title="AI"
            >
              <Brain className="w-2.5 h-2.5" />
              AI
            </button>
          )}
        </div>
      </div>

      {/* Source text */}
      <div className="px-3 pt-3 shrink-0">
        {translateUsesAiByDefault && (
          <span className="detail-status-pill mb-1.5 inline-flex text-primary">
            {t("translate.defaultAi")}
          </span>
        )}
        <p className="text-2xs text-muted-foreground/60 uppercase tracking-wider mb-0.5">
          {t("translate.sourceText")}
        </p>
        <p className="surface-panel max-h-[100px] overflow-y-auto rounded-[0.75rem] px-2.5 py-2 text-sm2 leading-relaxed break-words text-muted-foreground select-text">
          {text.length > 800 ? text.substring(0, 800) + "\u2026" : text}
        </p>
      </div>

      {/* Result area */}
      <div className="flex-1 min-h-0 px-3 pb-3 pt-2 flex flex-col overflow-y-auto">
        {loading && (
          <div className="surface-panel flex items-center justify-center gap-1.5 rounded-[0.75rem] py-6 text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span className="text-xs2">{t("translate.translating")}</span>
          </div>
        )}

        {error && (
          <div className="py-1.5">
            <p className="rounded-[0.75rem] border border-red-400/20 bg-red-400/10 px-2.5 py-2 text-xs2 text-red-400">
              {t("translate.error")}: {error}
            </p>
          </div>
        )}

        {result && (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="flex items-center justify-between mb-0.5">
              <p className="text-2xs text-muted-foreground/60 uppercase tracking-wider">
                {t("translate.result")}
                {result.engine && (
                  <span className="ml-1 normal-case tracking-normal text-primary/50">
                    ({result.engine})
                  </span>
                )}
              </p>
            </div>
            <p className="surface-panel flex-1 overflow-y-auto rounded-[0.75rem] border-primary/15 bg-primary/5 px-2.5 py-2 text-sm2 leading-relaxed break-words text-foreground select-text">
              {result.translated}
            </p>

            <div className="flex items-center gap-1 mt-1.5 shrink-0">
              <button
                onClick={handleCopyResult}
                className={cn(
                  "filter-pill flex items-center gap-1 px-2.5 text-2xs font-medium transition-all",
                  copied
                    ? "bg-green-500/15 text-green-400"
                    : "bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
              >
                {copied ? (
                  <Check className="w-2.5 h-2.5" />
                ) : (
                  <Copy className="w-2.5 h-2.5" />
                )}
                {copied ? t("translate.copied") : t("translate.copyResult")}
              </button>
              <button
                onClick={handleUseTranslation}
                className="filter-pill flex items-center gap-1 px-2.5 text-2xs font-medium bg-primary/15 text-primary transition-colors hover:bg-primary/25"
              >
                <ClipboardPaste className="w-2.5 h-2.5" />
                {t("translate.useTranslation")}
              </button>
            </div>
          </div>
        )}

        {!loading && !error && !result && (
          <div className="surface-panel flex items-center justify-center rounded-[0.75rem] py-6 text-muted-foreground/40">
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
    <div className="flex h-full flex-col gap-2 p-3">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs2 font-medium text-foreground">
            {t("detail.summary")}
          </span>
          <button
            onClick={onSummarize}
            disabled={summarizing || !entry.text_content}
            className={cn(
              "filter-pill flex items-center gap-1 px-2.5 text-2xs font-medium transition-colors",
              "bg-primary/15 text-primary hover:bg-primary/25",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            )}
          >
            {summarizing ? (
              <Loader2 className="w-2.5 h-2.5 animate-spin" />
            ) : (
              <Brain className="w-2.5 h-2.5" />
            )}
            {summarizing
              ? t("detail.generating")
              : entry.ai_summary
                ? t("detail.regenerateSummary")
                : t("detail.generateSummary")}
          </button>
        </div>

        {entry.ai_summary ? (
          <div className="surface-panel rounded-[0.75rem] border-primary/15 bg-primary/5 px-2.5 py-2 text-sm2 leading-relaxed text-foreground select-text">
            {entry.ai_summary}
          </div>
        ) : (
          <div className="surface-panel rounded-[0.75rem] px-2.5 py-2 text-sm2 italic text-muted-foreground/50">
            {t("detail.noSummary")}
          </div>
        )}
      </div>

      {entry.text_content && (
        <div className="flex-1 min-h-0 flex flex-col">
          <span className="text-2xs text-muted-foreground/60 uppercase tracking-wider mb-0.5 shrink-0">
            {t("translate.sourceText")}
          </span>
          <pre className="surface-panel flex-1 overflow-y-auto rounded-[0.75rem] px-2.5 py-2 text-sm2 leading-relaxed break-words whitespace-pre-wrap text-muted-foreground select-text">
            {entry.text_content}
          </pre>
        </div>
      )}
    </div>
  );
}
