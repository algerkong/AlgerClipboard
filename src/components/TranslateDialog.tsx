import { useEffect, useRef } from "react";
import { X, Loader2, RefreshCw } from "lucide-react";
import { useTranslateStore } from "@/stores/translateStore";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

const LANGUAGES = [
  { value: "auto", labelKey: "translate.auto" },
  { value: "zh", label: "Chinese" },
  { value: "en", label: "English" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "es", label: "Spanish" },
  { value: "ru", label: "Russian" },
];

interface Props {
  text: string;
  onClose: () => void;
}

export function TranslateDialog({ text, onClose }: Props) {
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

  const autoTranslated = useRef(false);

  // Auto-translate on open
  useEffect(() => {
    if (!autoTranslated.current) {
      autoTranslated.current = true;
      translate(text);
    }
  }, [text, translate]);

  useEffect(() => {
    return () => clearResult();
  }, [clearResult]);

  const handleTranslate = () => {
    translate(text);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => { e.stopPropagation(); onClose(); }}
    >
      <div
        className="bg-background border border-border/50 rounded-lg shadow-xl w-[400px] max-h-[520px] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/30">
          <span className="text-xs font-medium">{t("translate.title")}</span>
          <button
            onClick={onClose}
            className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* Source text */}
          <div>
            <p className="text-[10px] text-muted-foreground mb-1">{t("translate.from")}</p>
            <p className="text-[11px] text-foreground bg-muted/20 rounded p-2 max-h-[100px] overflow-y-auto break-all leading-relaxed">
              {text.length > 500 ? text.substring(0, 500) + "\u2026" : text}
            </p>
          </div>

          {/* Result — shown directly when available */}
          {loading && (
            <div className="flex items-center justify-center gap-1.5 py-4 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-[11px]">{t("translate.translating")}</span>
            </div>
          )}

          {error && (
            <p className="text-[10px] text-red-400 bg-red-400/10 rounded p-2">
              {t("translate.error")}: {error}
            </p>
          )}

          {result && (
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">
                {t("translate.result")}
                {result.engine && (
                  <span className="ml-1 text-primary/60">({result.engine})</span>
                )}
              </p>
              <p className="text-[11px] text-foreground bg-primary/5 rounded p-2 max-h-[140px] overflow-y-auto break-all leading-relaxed select-text">
                {result.translated}
              </p>
            </div>
          )}

          {/* Language selectors + re-translate */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="text-[10px] text-muted-foreground">{t("translate.from")}</label>
              <select
                value={fromLang}
                onChange={(e) => setFromLang(e.target.value)}
                className="mt-0.5 w-full h-6 px-1 text-[11px] bg-muted/30 border border-border/50 rounded text-foreground focus:outline-none"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.labelKey ? t(l.labelKey) : l.label}
                  </option>
                ))}
              </select>
            </div>
            <span className="text-muted-foreground mt-3">&rarr;</span>
            <div className="flex-1">
              <label className="text-[10px] text-muted-foreground">{t("translate.to")}</label>
              <select
                value={toLang}
                onChange={(e) => setToLang(e.target.value)}
                className="mt-0.5 w-full h-6 px-1 text-[11px] bg-muted/30 border border-border/50 rounded text-foreground focus:outline-none"
              >
                {LANGUAGES.filter((l) => l.value !== "auto").map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleTranslate}
              disabled={loading}
              className={cn(
                "mt-4 shrink-0 flex items-center gap-1 h-6 px-2.5 rounded text-[11px] font-medium transition-colors",
                loading
                  ? "bg-muted/50 text-muted-foreground cursor-not-allowed"
                  : "bg-primary/15 text-primary hover:bg-primary/25"
              )}
              title={t("translate.translate")}
            >
              <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} />
              {t("translate.translate")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
