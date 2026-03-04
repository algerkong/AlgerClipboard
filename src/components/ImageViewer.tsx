import { useState, useCallback, useEffect } from "react";
import { X, ZoomIn, ZoomOut, RotateCcw, ScanText, Copy, Languages, Loader2 } from "lucide-react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { getThumbnailBase64, extractTextFromImage } from "@/services/clipboardService";
import { TranslateDialog } from "@/components/TranslateDialog";
import { toast } from "sonner";
import { Toaster } from "sonner";

/**
 * Standalone image viewer page — rendered in its own Tauri window.
 * Receives `blobPath` from URL search params.
 */
export function ImageViewerPage() {
  const { t } = useTranslation();
  const params = new URLSearchParams(window.location.search);
  const blobPath = params.get("blobPath") ?? "";

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [ocrText, setOcrText] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [showTranslate, setShowTranslate] = useState(false);

  // Load image on mount
  useEffect(() => {
    if (!blobPath) return;
    getThumbnailBase64(blobPath)
      .then(setImageSrc)
      .catch(() => {});
  }, [blobPath]);

  // Apply dark theme
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  const handleClose = useCallback(() => {
    getCurrentWebviewWindow().close();
  }, []);

  const handleZoomIn = useCallback(() => setZoom((z) => Math.min(z + 0.25, 5)), []);
  const handleZoomOut = useCallback(() => setZoom((z) => Math.max(z - 0.25, 0.25)), []);
  const handleResetZoom = useCallback(() => setZoom(1), []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.deltaY < 0) {
      setZoom((z) => Math.min(z + 0.1, 5));
    } else {
      setZoom((z) => Math.max(z - 0.1, 0.25));
    }
  }, []);

  const handleExtractText = useCallback(async () => {
    setOcrLoading(true);
    setOcrError(null);
    try {
      const text = await extractTextFromImage(blobPath);
      if (text.trim()) {
        setOcrText(text.trim());
      } else {
        setOcrText("");
        setOcrError(t("imageViewer.noText"));
      }
    } catch (err) {
      setOcrError(String(err));
    } finally {
      setOcrLoading(false);
    }
  }, [blobPath, t]);

  const handleCopyText = useCallback(async () => {
    if (ocrText) {
      await navigator.clipboard.writeText(ocrText);
      toast.success(t("toast.copied"));
    }
  }, [ocrText, t]);

  // Escape key to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleClose]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Title bar (draggable) */}
      <div
        data-tauri-drag-region
        className="flex items-center justify-between h-8 px-3 bg-card/80 backdrop-blur-sm border-b border-border/50 select-none shrink-0"
      >
        <div data-tauri-drag-region className="flex items-center gap-2">
          <span data-tauri-drag-region className="text-[11px] font-medium text-muted-foreground">
            {t("imageViewer.title")}
          </span>
          {/* Zoom controls */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={handleZoomOut}
              className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
              title={t("imageViewer.zoomOut")}
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <span className="text-[10px] text-muted-foreground min-w-[32px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
              title={t("imageViewer.zoomIn")}
            >
              <ZoomIn className="w-3 h-3" />
            </button>
            <button
              onClick={handleResetZoom}
              className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
              title={t("imageViewer.resetZoom")}
            >
              <RotateCcw className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-0.5 -mr-1">
          {/* OCR button */}
          <button
            onClick={handleExtractText}
            disabled={ocrLoading}
            className={cn(
              "flex items-center gap-1 px-1.5 h-5 rounded text-[10px] font-medium transition-colors",
              ocrLoading
                ? "text-muted-foreground cursor-not-allowed"
                : "text-blue-400 hover:bg-blue-400/10"
            )}
            title={t("imageViewer.extractText")}
          >
            {ocrLoading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <ScanText className="w-3 h-3" />
            )}
            {t("imageViewer.extractText")}
          </button>

          {/* Close */}
          <button
            onClick={handleClose}
            className="flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Image area */}
      <div
        className="flex-1 overflow-auto flex items-center justify-center min-h-0"
        onWheel={handleWheel}
      >
        {imageSrc ? (
          <img
            src={imageSrc}
            alt=""
            className="max-w-full max-h-full object-contain transition-transform"
            style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
            draggable={false}
          />
        ) : (
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* OCR result panel */}
      {(ocrText !== null || ocrError) && (
        <div className="border-t border-border/30 px-3 py-2 shrink-0 max-h-[40%] flex flex-col">
          <div className="flex items-center justify-between mb-1 shrink-0">
            <span className="text-[10px] text-muted-foreground font-medium">
              {t("imageViewer.ocrResult")}
            </span>
            {ocrText && (
              <div className="flex items-center gap-1">
                <button
                  onClick={handleCopyText}
                  className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                  title={t("imageViewer.copyText")}
                >
                  <Copy className="w-2.5 h-2.5" />
                  {t("imageViewer.copyText")}
                </button>
                <button
                  onClick={() => setShowTranslate(true)}
                  className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] text-blue-400 hover:bg-blue-400/10 transition-colors"
                  title={t("imageViewer.translateText")}
                >
                  <Languages className="w-2.5 h-2.5" />
                  {t("imageViewer.translateText")}
                </button>
              </div>
            )}
          </div>
          {ocrError && !ocrText && (
            <p className="text-[10px] text-red-400 bg-red-400/10 rounded p-2">{ocrError}</p>
          )}
          {ocrText && (
            <p className="text-[11px] text-foreground bg-muted/20 rounded p-2 overflow-y-auto break-all leading-relaxed select-text">
              {ocrText}
            </p>
          )}
        </div>
      )}

      {/* Translate dialog (modal within this window) */}
      {showTranslate && ocrText && (
        <TranslateDialog
          text={ocrText}
          onClose={() => setShowTranslate(false)}
        />
      )}

      <Toaster position="bottom-center" richColors duration={2000} toastOptions={{ style: { fontSize: "12px", padding: "8px 12px" } }} />
    </div>
  );
}
