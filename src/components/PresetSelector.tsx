import { useState, useCallback, useEffect, useRef } from "react";
import {
  Languages,
  FileText,
  HelpCircle,
  PenLine,
  ArrowRight,
  MessageSquare,
  Loader2,
  Sparkles,
  Wand2,
  BookOpen,
  Code,
  ListChecks,
  Lightbulb,
  Search,
  Zap,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { useAskAiStore } from "@/stores/askAiStore";
import { useClipboardStore } from "@/stores/clipboardStore";
import type { AskAiPreset } from "@/constants/askAiPresets";
import { AI_WEB_SERVICES } from "@/constants/aiServices";
import { askAi } from "@/services/askAiService";
import { cn } from "@/lib/utils";
import { FaviconImg } from "@/pages/settings/AskAiTab";

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  Languages,
  FileText,
  HelpCircle,
  PenLine,
  ArrowRight,
  MessageSquare,
  Sparkles,
  Wand2,
  BookOpen,
  Code,
  ListChecks,
  Lightbulb,
  Search,
  Zap,
};

export { ICON_MAP };

export function PresetSelector() {
  const { t } = useTranslation();
  const askAiEntryId = useAskAiStore((s) => s.askAiEntryId);
  const askAiAnchor = useAskAiStore((s) => s.askAiAnchor);
  const cancelAskAi = useAskAiStore((s) => s.cancelAskAi);
  const isSending = useAskAiStore((s) => s.isSending);
  const setIsSending = useAskAiStore((s) => s.setIsSending);
  const enabledServiceIds = useAskAiStore((s) => s.enabledServiceIds);
  const getFavicon = useAskAiStore((s) => s.getFavicon);
  const loadEnabledServices = useAskAiStore((s) => s.loadEnabledServices);
  const loadFavicons = useAskAiStore((s) => s.loadFavicons);
  const presets = useAskAiStore((s) => s.presets);
  const loadPresets = useAskAiStore((s) => s.loadPresets);

  const entries = useClipboardStore((s) => s.entries);

  const [selectedPreset, setSelectedPreset] = useState<AskAiPreset | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);

  const popoverRef = useRef<HTMLDivElement>(null);

  // Auto-select service if only one is enabled
  useEffect(() => {
    if (enabledServiceIds.length === 1) {
      setSelectedServiceId(enabledServiceIds[0]);
    } else {
      setSelectedServiceId(null);
    }
  }, [enabledServiceIds]);

  // Load enabled services, favicons, and presets when popover opens
  useEffect(() => {
    if (askAiEntryId) {
      setSelectedPreset(null);
      setCustomPrompt("");
      void loadEnabledServices();
      void loadFavicons();
      void loadPresets();
    }
  }, [askAiEntryId, loadEnabledServices, loadFavicons, loadPresets]);

  // Close on Escape key
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

      // If service already selected (auto or manual), send immediately
      if (selectedServiceId) {
        void handleSend(preset, selectedServiceId);
        return;
      }

      // Otherwise select preset and wait for service selection
      setSelectedPreset(preset);
    },
    [selectedServiceId, handleSend],
  );

  const handleServiceClick = useCallback(
    (serviceId: string) => {
      setSelectedServiceId(serviceId);

      // If a non-custom preset is already selected, send now
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

  // Compute popover position (keep within viewport)
  const popoverStyle: React.CSSProperties = {
    position: "fixed",
    left: Math.min(askAiAnchor.x, window.innerWidth - 260),
    top: Math.min(askAiAnchor.y + 8, window.innerHeight - 400),
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
        ref={popoverRef}
        style={popoverStyle}
        className="w-56 rounded-2xl border border-border/50 bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {isSending ? (
          <div className="flex items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("askAi.sending")}
          </div>
        ) : enabledServices.length === 0 ? (
          <div className="p-3 text-xs text-muted-foreground">
            {t("askAi.noEnabledServices")}
          </div>
        ) : (
          <>
            {/* Preset list */}
            <div className="p-1">
              {presets.map((preset) => {
                const Icon = ICON_MAP[preset.iconName];
                const isActive = selectedPreset?.id === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => handlePresetClick(preset)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors",
                      isActive
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                    )}
                  >
                    {Icon && <Icon className="h-4 w-4 shrink-0" />}
                    <span>{preset.labelKey ? t(preset.labelKey) : preset.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Custom prompt input */}
            {selectedPreset?.id === "custom" && (
              <div className="border-t border-border/30 p-2">
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
                  className="w-full resize-none rounded-xl border border-border/60 bg-background/80 p-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/20"
                  rows={3}
                />
                <button
                  onClick={handleCustomSend}
                  disabled={!customPrompt.trim() || !selectedServiceId}
                  className="mt-1 w-full rounded-xl bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/25 disabled:opacity-40"
                >
                  {t("askAi.send")}
                </button>
              </div>
            )}

            {/* Service selector -- hidden if only one enabled */}
            {enabledServices.length > 1 && (
              <div className="border-t border-border/30 p-2">
                <p className="mb-1.5 px-1 text-2xs text-muted-foreground">
                  {t("askAi.selectService")}
                </p>
                <div className="flex flex-wrap gap-1">
                  {enabledServices.map((service) => {
                    const favicon = getFavicon(service.id);
                    const isActive = selectedServiceId === service.id;
                    return (
                      <button
                        key={service.id}
                        onClick={() => handleServiceClick(service.id)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs transition-colors",
                          isActive
                            ? "bg-primary/15 text-primary"
                            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                        )}
                        title={service.name}
                      >
                        <FaviconImg url={favicon} name={service.name} size="h-3.5 w-3.5" />
                        <span>{service.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
