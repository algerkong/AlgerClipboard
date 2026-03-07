import { useEffect, useRef, useState } from "react";
import {
  X,
  Loader2,
  ArrowRightLeft,
  Copy,
  Check,
  ClipboardPaste,
  RotateCcw,
} from "lucide-react";
import { useTranslateStore } from "@/stores/translateStore";
import { useCapabilityStore } from "@/stores/capabilityStore";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { openSettingsWindow } from "@/services/settingsWindowService";
import { toast } from "sonner";

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

interface Props {
  text: string;
  onClose: () => void;
}

export function TranslateDialog({ text, onClose }: Props) {
  const { t } = useTranslation();
  const canTranslate = useCapabilityStore((s) => s.can_translate);
  const result = useTranslateStore((s) => s.result);
  const loading = useTranslateStore((s) => s.loading);
  const error = useTranslateStore((s) => s.error);
  const fromLang = useTranslateStore((s) => s.fromLang);
  const toLang = useTranslateStore((s) => s.toLang);
  const translate = useTranslateStore((s) => s.translate);
  const setFromLang = useTranslateStore((s) => s.setFromLang);
  const setToLang = useTranslateStore((s) => s.setToLang);
  const clearResult = useTranslateStore((s) => s.clearResult);

  const autoTranslated = useRef(false);
  const [copied, setCopied] = useState(false);

  // Auto-translate on open
  useEffect(() => {
    if (!canTranslate || autoTranslated.current) return;
    autoTranslated.current = true;
    translate(text);
  }, [canTranslate, text, translate]);

  useEffect(() => {
    return () => clearResult();
  }, [clearResult]);

  const handleTranslate = () => {
    if (!canTranslate) {
      toast.error(t("toast.translateConfigRequired"));
      openSettingsWindow("translate");
      return;
    }
    translate(text);
  };

  const handleSwapLangs = () => {
    if (fromLang === "auto") return;
    const oldFrom = fromLang;
    const oldTo = toLang;
    setFromLang(oldTo);
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
      onClose();
    } catch {
      toast.error(t("translate.copyFailed"));
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="bg-background border border-border/50 rounded-lg shadow-xl w-[400px] max-h-[560px] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with language controls */}
        <div className="px-3 py-2 border-b border-border/30 shrink-0 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">{t("translate.title")}</span>
            <button
              onClick={onClose}
              className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Language bar */}
          <div className="flex items-center gap-1.5">
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
              title={t("translate.swap")}
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
              <RotateCcw
                className={cn("w-2.5 h-2.5", loading && "animate-spin")}
              />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto flex flex-col min-h-0">
          {!canTranslate && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
              <div className="space-y-1">
                <p className="text-sm2 font-medium text-foreground">
                  {t("translate.configureTranslateOrAi")}
                </p>
                <p className="text-xs2 text-muted-foreground">
                  {t("translate.configureTranslateOrAiHint")}
                </p>
              </div>
              <button
                onClick={() => openSettingsWindow("translate")}
                className="h-7 px-3 rounded-md bg-primary/15 text-primary text-xs2 font-medium hover:bg-primary/25 transition-colors"
              >
                {t("translate.openSettings")}
              </button>
            </div>
          )}

          {canTranslate && (
            <>
              <div className="px-3 pt-2.5 pb-2">
                <p className="text-2xs text-muted-foreground/60 uppercase tracking-wider mb-1">
                  {t("translate.sourceText")}
                </p>
                <p className="text-sm2 text-muted-foreground bg-muted/10 rounded-md px-2.5 py-2 max-h-[100px] overflow-y-auto break-words leading-relaxed select-text">
                  {text.length > 500 ? text.substring(0, 500) + "\u2026" : text}
                </p>
              </div>

              <div className="mx-3 border-t border-border/20" />

              <div className="px-3 pt-2 pb-3 flex-1 min-h-0 flex flex-col">
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
                    <div className="relative group/result flex-1 min-h-0">
                      <p className="text-sm2 text-foreground bg-primary/5 border border-primary/10 rounded-md px-2.5 py-2 max-h-[180px] overflow-y-auto break-words leading-relaxed select-text">
                        {result.translated}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 mt-2">
                      <button
                        onClick={handleCopyResult}
                        className={cn(
                          "flex items-center gap-1 h-6 px-2.5 rounded text-xs2 font-medium transition-all",
                          copied
                            ? "bg-green-500/15 text-green-400"
                            : "bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
