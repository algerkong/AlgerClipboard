import { useState, useCallback, useEffect } from "react";
import {
  Translate,
  FileText,
  Question,
  PenNib,
  ArrowRight,
  ChatCircle,
  SpinnerGap,
  Sparkle,
  MagicWand,
  BookOpen,
  Code,
  ListChecks,
  Lightbulb,
  MagnifyingGlass,
  Lightning,
  Check,
} from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";

import { useAskAiStore } from "@/stores/askAiStore";
import { useClipboardStore } from "@/stores/clipboardStore";
import type { AskAiPreset } from "@/constants/askAiPresets";
import { AI_WEB_SERVICES } from "@/constants/aiServices";
import { askAi } from "@/services/askAiService";
import { cn } from "@/lib/utils";
import { FaviconImg } from "@/pages/settings/AskAiTab";

const ICON_MAP: Record<string, React.FC<{ className?: string; size?: number }>> = {
  Languages: Translate,
  FileText,
  HelpCircle: Question,
  PenLine: PenNib,
  ArrowRight,
  MessageSquare: ChatCircle,
  Sparkles: Sparkle,
  Wand2: MagicWand,
  BookOpen,
  Code,
  ListChecks,
  Lightbulb,
  Search: MagnifyingGlass,
  Zap: Lightning,
};

export { ICON_MAP };

const POPOVER_WIDTH = 300;

export function PresetSelector() {
  const { t } = useTranslation();
  const askAiEntryId = useAskAiStore((s) => s.askAiEntryId);
  const askAiAnchor = useAskAiStore((s) => s.askAiAnchor);
  const cancelAskAi = useAskAiStore((s) => s.cancelAskAi);
  const isSending = useAskAiStore((s) => s.isSending);
  const setIsSending = useAskAiStore((s) => s.setIsSending);
  const enabledServiceIds = useAskAiStore((s) => s.enabledServiceIds);
  const defaultServiceId = useAskAiStore((s) => s.defaultServiceId);
  const getFavicon = useAskAiStore((s) => s.getFavicon);
  const loadEnabledServices = useAskAiStore((s) => s.loadEnabledServices);
  const loadDefaultService = useAskAiStore((s) => s.loadDefaultService);
  const loadFavicons = useAskAiStore((s) => s.loadFavicons);
  const presets = useAskAiStore((s) => s.presets);
  const loadPresets = useAskAiStore((s) => s.loadPresets);

  const entries = useClipboardStore((s) => s.entries);

  const [selectedPreset, setSelectedPreset] = useState<AskAiPreset | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);

  // Load data and reset transient state when the popover opens.
  useEffect(() => {
    if (!askAiEntryId) return;
    setSelectedPreset(null);
    setCustomPrompt("");
    void loadEnabledServices();
    void loadDefaultService();
    void loadFavicons();
    void loadPresets();
  }, [
    askAiEntryId,
    loadEnabledServices,
    loadDefaultService,
    loadFavicons,
    loadPresets,
  ]);

  // Preselect the configured default service (or the first enabled one).
  useEffect(() => {
    if (enabledServiceIds.length === 0) {
      setSelectedServiceId(null);
      return;
    }
    setSelectedServiceId(
      enabledServiceIds.includes(defaultServiceId)
        ? defaultServiceId
        : enabledServiceIds[0],
    );
  }, [enabledServiceIds, defaultServiceId]);

  // Close on Escape key.
  useEffect(() => {
    if (!askAiEntryId) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        cancelAskAi();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [askAiEntryId, cancelAskAi]);

  const handleSend = useCallback(
    async (preset: AskAiPreset, serviceId: string) => {
      if (!askAiEntryId) return;

      const entry = entries.find((e) => e.id === askAiEntryId);
      const textContent = entry?.text_content;
      if (!textContent) return;

      setIsSending(true);
      try {
        await askAi(
          serviceId,
          textContent,
          preset,
          preset.id === "custom" ? customPrompt : undefined,
        );
      } finally {
        setIsSending(false);
        cancelAskAi();
      }
    },
    [askAiEntryId, entries, customPrompt, setIsSending, cancelAskAi],
  );

  const handlePresetClick = useCallback(
    (preset: AskAiPreset) => {
      if (preset.id === "custom") {
        setSelectedPreset(preset);
        return;
      }

      if (selectedServiceId) {
        void handleSend(preset, selectedServiceId);
        return;
      }

      setSelectedPreset(preset);
    },
    [selectedServiceId, handleSend],
  );

  const handleServiceClick = useCallback(
    (serviceId: string) => {
      setSelectedServiceId(serviceId);

      if (selectedPreset && selectedPreset.id !== "custom") {
        void handleSend(selectedPreset, serviceId);
      }
    },
    [selectedPreset, handleSend],
  );

  const handleCustomSend = useCallback(() => {
    if (!selectedPreset || !selectedServiceId || !customPrompt.trim()) return;
    void handleSend(selectedPreset, selectedServiceId);
  }, [selectedPreset, selectedServiceId, customPrompt, handleSend]);

  if (!askAiEntryId || !askAiAnchor) return null;

  const enabledServices = AI_WEB_SERVICES.filter((s) =>
    enabledServiceIds.includes(s.id),
  );
  const activeService = enabledServices.find((s) => s.id === selectedServiceId);

  // Compute popover position (keep within viewport).
  const top = Math.max(
    8,
    Math.min(askAiAnchor.y + 8, window.innerHeight - 430),
  );
  const popoverStyle: React.CSSProperties = {
    position: "fixed",
    left: Math.max(
      8,
      Math.min(askAiAnchor.x, window.innerWidth - POPOVER_WIDTH - 12),
    ),
    top,
    maxHeight: Math.max(240, window.innerHeight - top - 8),
    zIndex: 51,
  };

  return (
    <div
      className="fixed inset-0 z-50"
      onClick={(e) => {
        e.stopPropagation();
        cancelAskAi();
      }}
    >
      <div
        style={popoverStyle}
        className="w-[300px] overflow-y-auto overflow-x-hidden rounded-2xl border border-border/60 bg-popover/95 shadow-2xl backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2.5 border-b border-border/40 px-3.5 py-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkle size={15} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold leading-tight">
              {t("askAi.askAi")}
            </div>
            <div className="truncate text-[11px] text-muted-foreground">
              {activeService?.name ?? t("askAi.selectService")}
            </div>
          </div>
          {isSending && (
            <SpinnerGap size={14} className="shrink-0 animate-spin text-primary" />
          )}
        </div>

        {isSending ? (
          <div className="flex items-center justify-center gap-2 px-4 py-9 text-xs text-muted-foreground">
            <SpinnerGap size={15} className="animate-spin" />
            {t("askAi.sending")}
          </div>
        ) : enabledServices.length === 0 ? (
          <div className="px-5 py-7 text-center text-xs leading-relaxed text-muted-foreground">
            {t("askAi.noEnabledServices")}
          </div>
        ) : (
          <>
            {/* Preset list */}
            <div className="p-1.5">
              <p className="px-2 pb-1 pt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
                {t("askAi.presetsTitle")}
              </p>
              {presets.map((preset) => {
                const Icon = ICON_MAP[preset.iconName];
                const isActive = selectedPreset?.id === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => handlePresetClick(preset)}
                    className={cn(
                      "group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors",
                      isActive
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition-colors",
                        isActive
                          ? "bg-primary/15 text-primary"
                          : "bg-muted/60 text-muted-foreground group-hover:text-foreground",
                      )}
                    >
                      {Icon ? <Icon size={14} /> : <Sparkle size={14} />}
                    </span>
                    <span className="flex-1 truncate text-[13px]">
                      {preset.labelKey ? t(preset.labelKey) : preset.label}
                    </span>
                    {isActive && <Check size={12} className="text-primary" />}
                  </button>
                );
              })}
            </div>

            {/* Custom prompt input */}
            {selectedPreset?.id === "custom" && (
              <div className="border-t border-border/40 p-2.5">
                <textarea
                  autoFocus
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleCustomSend();
                    }
                  }}
                  placeholder={t("askAi.customPromptPlaceholder")}
                  className="w-full resize-none rounded-xl border border-border/60 bg-background/80 p-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/20"
                  rows={3}
                />
                <button
                  onClick={handleCustomSend}
                  disabled={!customPrompt.trim() || !selectedServiceId}
                  className="mt-1.5 w-full rounded-xl bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/25 disabled:opacity-40"
                >
                  {t("askAi.send")}
                </button>
              </div>
            )}

            {/* Service selector -- always visible so the target AI is clear */}
            <div className="border-t border-border/40 p-2.5">
              <div className="mb-1.5 flex items-center justify-between px-1">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
                  {t("askAi.selectService")}
                </p>
                <span className="text-[10px] text-muted-foreground/50">
                  {t("askAi.opensInWindow")}
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {enabledServices.map((service) => {
                  const favicon = getFavicon(service.id);
                  const isActive = selectedServiceId === service.id;
                  const isDefault = defaultServiceId === service.id;
                  return (
                    <button
                      key={service.id}
                      onClick={() => handleServiceClick(service.id)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] transition-colors",
                        isActive
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-transparent text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                      )}
                      title={
                        isDefault
                          ? `${service.name} · ${t("settings.askAi.defaultBadge")}`
                          : service.name
                      }
                    >
                      <FaviconImg
                        url={favicon}
                        name={service.name}
                        size="h-3.5 w-3.5"
                      />
                      <span>{service.name}</span>
                      {isDefault && (
                        <span className="h-1 w-1 rounded-full bg-primary/70" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
