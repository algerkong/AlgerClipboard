import { useEffect } from "react";
import { X, Loader2 } from "lucide-react";
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
        className="bg-background border border-border/50 rounded-lg shadow-xl w-[340px] max-h-[400px] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/30">
          <span className="text-xs font-medium">{t("translate.title")}</span>
          <button
            onClick={onClose}
            className="p-0.5 rounded text-muted-foreground/50 hover:text-foreground transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* Source text */}
          <div>
            <p className="text-[10px] text-muted-foreground/60 mb-1">{t("translate.from")}</p>
            <p className="text-[11px] text-foreground/80 bg-muted/20 rounded p-2 max-h-[80px] overflow-y-auto break-all leading-relaxed">
              {text.length > 300 ? text.substring(0, 300) + "\u2026" : text}
            </p>
          </div>

          {/* Language selectors */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="text-[10px] text-muted-foreground/60">{t("translate.from")}</label>
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
            <span className="text-muted-foreground/40 mt-3">&rarr;</span>
            <div className="flex-1">
              <label className="text-[10px] text-muted-foreground/60">{t("translate.to")}</label>
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
          </div>

          {/* Translate button */}
          <button
            onClick={handleTranslate}
            disabled={loading}
            className={cn(
              "w-full h-7 rounded-md text-[11px] font-medium transition-colors",
              loading
                ? "bg-muted/50 text-muted-foreground/50 cursor-not-allowed"
                : "bg-primary/15 text-primary hover:bg-primary/25"
            )}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                {t("translate.translating")}
              </span>
            ) : (
              t("translate.translate")
            )}
          </button>

          {/* Error */}
          {error && (
            <p className="text-[10px] text-red-400 bg-red-400/10 rounded p-2">
              {t("translate.error")}: {error}
            </p>
          )}

          {/* Result */}
          {result && (
            <div>
              <p className="text-[10px] text-muted-foreground/60 mb-1">
                {t("translate.result")}
                {result.engine && (
                  <span className="ml-1 text-primary/60">({result.engine})</span>
                )}
              </p>
              <p className="text-[11px] text-foreground bg-primary/5 rounded p-2 max-h-[100px] overflow-y-auto break-all leading-relaxed">
                {result.translated}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
