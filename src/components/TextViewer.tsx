import { useState, useMemo } from "react";
import { X, Copy, Languages, Code, Eye } from "lucide-react";
import DOMPurify from "dompurify";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { TranslateDialog } from "@/components/TranslateDialog";
import { openUrl } from "@/services/settingsService";
import { toast } from "sonner";

interface Props {
  text: string;
  htmlContent?: string | null;
  onClose: () => void;
}

/** Simple heuristic to detect if text looks like code */
function looksLikeCode(text: string): boolean {
  const codePatterns = [
    /^(import|export|const|let|var|function|class|interface|type|enum|def|fn|pub|use|package|#include)\s/m,
    /[{}\[\]];?\s*$/m,
    /=>\s*{/,
    /\(\)\s*{/,
    /^\s*(if|else|for|while|switch|case|return|try|catch)\s*[\({]/m,
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

/** Check if text is natural-language non-Chinese (skip URLs, paths, code, etc.) */
function isNonChinese(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 8) return false;
  if (/^https?:\/\//i.test(trimmed)) return false;
  if (/^[A-Z]:\\|^\/[\w.]/i.test(trimmed)) return false;
  if (/\w+:\/\/\S+/.test(trimmed) && trimmed.split(/\s+/).length <= 3) return false;
  if (/^\S+@\S+\.\S+$/.test(trimmed)) return false;
  const specialChars = (trimmed.match(/[{}()\[\];=<>\/\\|&^%$#@!~`]/g) || []).length;
  if (specialChars / trimmed.length > 0.15) return false;
  if (/^\s*[{\[]/.test(trimmed) && /[}\]]\s*$/.test(trimmed)) return false;
  const cleaned = trimmed.replace(/[\s\d\p{P}\p{S}]/gu, "");
  if (cleaned.length < 4) return false;
  const chineseChars = (cleaned.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  const latinChars = (cleaned.match(/[a-zA-Z]/g) || []).length;
  if (latinChars / cleaned.length < 0.5) return false;
  return chineseChars / cleaned.length < 0.3;
}

export function TextViewer({ text, htmlContent, onClose }: Props) {
  const { t } = useTranslation();
  const isCode = looksLikeCode(text);
  const showTranslateHint = isNonChinese(text);
  const [showTranslate, setShowTranslate] = useState(false);
  const hasHtml = !!htmlContent;
  const [viewMode, setViewMode] = useState<"rendered" | "source">(hasHtml ? "rendered" : "source");

  const sanitizedHtml = useMemo(() => {
    if (!htmlContent) return "";
    return DOMPurify.sanitize(htmlContent);
  }, [htmlContent]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    toast.success(t("toast.copied"));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => { e.stopPropagation(); onClose(); }}
    >
      <div
        className="bg-background border border-border/50 rounded-lg shadow-xl w-[380px] max-h-[480px] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/30 shrink-0">
          <span className="text-xs font-medium">
            {isCode ? t("viewer.codePreview") : t("viewer.fullText")}
          </span>
          <div className="flex items-center gap-1">
            {hasHtml && (
              <button
                onClick={() => setViewMode(viewMode === "rendered" ? "source" : "rendered")}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs2 font-medium text-purple-400 bg-purple-400/10 hover:bg-purple-400/20 transition-colors"
                title={viewMode === "rendered" ? t("viewer.viewSource") : t("viewer.viewRendered")}
              >
                {viewMode === "rendered" ? <Code className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                {viewMode === "rendered" ? t("viewer.viewSource") : t("viewer.viewRendered")}
              </button>
            )}
            {showTranslateHint && (
              <button
                onClick={() => setShowTranslate(true)}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs2 font-medium text-blue-400 bg-blue-400/10 hover:bg-blue-400/20 transition-colors"
              >
                <Languages className="w-3 h-3" />
                {t("viewer.translateHint")}
              </button>
            )}
            <button
              onClick={handleCopy}
              className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
              title={t("viewer.copy")}
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-3">
          {hasHtml && viewMode === "rendered" ? (
            <div
              className="text-sm2 leading-relaxed text-foreground rich-text-preview"
              dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
              onClick={(e) => {
                const anchor = (e.target as HTMLElement).closest("a");
                if (anchor) {
                  e.preventDefault();
                  e.stopPropagation();
                  const href = anchor.getAttribute("href");
                  if (href && /^https?:\/\//i.test(href)) {
                    openUrl(href).catch(() => toast.error(t("toast.openUrlFailed")));
                  }
                }
              }}
            />
          ) : (
            <pre
              className={cn(
                "text-sm2 leading-relaxed whitespace-pre-wrap break-all",
                isCode
                  ? "font-mono bg-muted/30 rounded-md p-3 text-foreground border border-border/20"
                  : "text-foreground"
              )}
            >
              {text}
            </pre>
          )}
        </div>
      </div>

      {showTranslate && (
        <TranslateDialog
          text={text}
          onClose={() => setShowTranslate(false)}
        />
      )}
    </div>
  );
}
