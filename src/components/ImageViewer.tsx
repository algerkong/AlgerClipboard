import { useState, useCallback, useEffect, useRef } from "react";
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Languages,
  Loader2,
} from "lucide-react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { platform as getPlatform } from "@tauri-apps/plugin-os";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import {
  getThumbnailBase64,
  extractTextFromImage,
} from "@/services/clipboardService";
import { translateText } from "@/services/translateService";
import { toast } from "@/lib/toast";
import type { OcrResult, OcrTextLine } from "@/types";
import { trackWindowSize } from "@/lib/windowSize";
import { IMAGE_VIEWER_SIZE_KEY } from "@/services/imageViewerService";

export function ImageViewerPage() {
  const { t } = useTranslation();
  const isMacOS = getPlatform() === "macos";
  const params = new URLSearchParams(window.location.search);
  const blobPath = params.get("blobPath") ?? "";

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);

  const [translatedLines, setTranslatedLines] = useState<string[] | null>(null);
  const [translateLoading, setTranslateLoading] = useState(false);
  const [showTranslated, setShowTranslated] = useState(false);

  const imgRef = useRef<HTMLImageElement>(null);
  const [imgSize, setImgSize] = useState({ width: 0, height: 0 });

  // Save window size on resize (debounced), restored by imageViewerService on next open
  useEffect(() => trackWindowSize(IMAGE_VIEWER_SIZE_KEY), []);

  useEffect(() => {
    if (!blobPath) return;
    getThumbnailBase64(blobPath).then(setImageSrc).catch(() => {});
  }, [blobPath]);

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  // Auto-OCR
  const ocrTriggered = useRef(false);
  const handleImageLoad = useCallback(() => {
    if (imgRef.current) {
      setImgSize({ width: imgRef.current.clientWidth, height: imgRef.current.clientHeight });
    }
    if (!ocrTriggered.current && blobPath) {
      ocrTriggered.current = true;
      runOcr();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blobPath]);

  useEffect(() => {
    const update = () => {
      if (imgRef.current) {
        setImgSize({ width: imgRef.current.clientWidth, height: imgRef.current.clientHeight });
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [zoom, imageSrc]);

  const runOcr = useCallback(async () => {
    if (!blobPath) return;
    setOcrLoading(true);
    setOcrError(null);
    try {
      const result = await extractTextFromImage(blobPath);
      setOcrResult(result);
      if (result.lines.length === 0) {
        setOcrError(t("imageViewer.noText"));
      }
    } catch (err) {
      setOcrError(String(err));
    } finally {
      setOcrLoading(false);
    }
  }, [blobPath, t]);

  const handleClose = useCallback(() => { getCurrentWebviewWindow().close(); }, []);
  const handleZoomIn = useCallback(() => setZoom((z) => Math.min(z + 0.25, 5)), []);
  const handleZoomOut = useCallback(() => setZoom((z) => Math.max(z - 0.25, 0.25)), []);
  const handleResetZoom = useCallback(() => setZoom(1), []);
  const handleWheel = useCallback((e: React.WheelEvent) => {
    setZoom((z) => Math.max(0.25, Math.min(5, z + (e.deltaY < 0 ? 0.1 : -0.1))));
  }, []);

  const handleTranslate = useCallback(async () => {
    if (!ocrResult || ocrResult.lines.length === 0) return;
    if (translatedLines && showTranslated) { setShowTranslated(false); return; }
    if (translatedLines) { setShowTranslated(true); return; }

    setTranslateLoading(true);
    try {
      const allText = ocrResult.lines.map((l) => l.text).join("\n");
      const result = await translateText(allText, "auto", "zh");
      const translated = result.translated.split("\n");
      setTranslatedLines(ocrResult.lines.map((_, i) => translated[i] ?? ""));
      setShowTranslated(true);
    } catch (err) {
      toast.error(t("translate.error") + ": " + String(err));
    } finally {
      setTranslateLoading(false);
    }
  }, [ocrResult, translatedLines, showTranslated, t]);

  // Intercept copy to force plain text (prevent HTML/rich text clipboard pollution)
  useEffect(() => {
    const handleCopy = (e: ClipboardEvent) => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) return;
      const text = sel.toString();
      if (text) {
        e.preventDefault();
        e.clipboardData?.setData("text/plain", text);
      }
    };
    document.addEventListener("copy", handleCopy);
    return () => document.removeEventListener("copy", handleCopy);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleClose]);

  const hasOcrText = ocrResult && ocrResult.lines.length > 0;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Title bar */}
      <div
        data-tauri-drag-region
        className={cn(
          "flex items-center justify-between h-8 pr-3 bg-card/80 backdrop-blur-sm border-b border-border/50 select-none shrink-0",
          isMacOS ? "pl-[76px]" : "pl-3",
        )}
      >
        <div data-tauri-drag-region className="flex items-center gap-2">
          <span data-tauri-drag-region className="text-sm2 font-medium text-muted-foreground">
            {t("imageViewer.title")}
          </span>
          <div className="flex items-center gap-0.5">
            <button onClick={handleZoomOut} className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors" title={t("imageViewer.zoomOut")}>
              <ZoomOut className="w-3 h-3" />
            </button>
            <span className="text-xs2 text-muted-foreground min-w-[32px] text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={handleZoomIn} className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors" title={t("imageViewer.zoomIn")}>
              <ZoomIn className="w-3 h-3" />
            </button>
            <button onClick={handleResetZoom} className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors" title={t("imageViewer.resetZoom")}>
              <RotateCcw className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-0.5 -mr-1">
          {ocrLoading && (
            <span className="flex items-center gap-1 px-1.5 h-5 text-xs2 text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" />
              {t("imageViewer.extracting")}
            </span>
          )}
          {hasOcrText && (
            <button
              onClick={handleTranslate}
              disabled={translateLoading}
              className={cn(
                "flex items-center gap-1 px-1.5 h-5 rounded text-xs2 font-medium transition-colors",
                translateLoading ? "text-muted-foreground cursor-not-allowed"
                  : showTranslated ? "text-green-400 hover:bg-green-400/10"
                    : "text-blue-400 hover:bg-blue-400/10"
              )}
              title={t("imageViewer.translateText")}
            >
              {translateLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Languages className="w-3 h-3" />}
              {t("imageViewer.translateText")}
            </button>
          )}
          {!isMacOS && (
            <button onClick={handleClose} className="flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Image + text layer */}
      <div className="flex-1 overflow-auto flex items-center justify-center min-h-0" onWheel={handleWheel}>
        {imageSrc ? (
          <div
            className="relative inline-block"
            style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
          >
            <img
              ref={imgRef}
              src={imageSrc}
              alt=""
              className="block max-w-full max-h-full object-contain"
              draggable={false}
              onLoad={handleImageLoad}
            />

            {/* Transparent selectable text layer (PDF.js style) */}
            {hasOcrText && !showTranslated && (
              <div
                className="ocr-text-layer absolute top-0 left-0"
                style={{ width: imgSize.width || "100%", height: imgSize.height || "100%" }}
              >
                {ocrResult.lines.map((line, i) => (
                  <OcrSelectableText
                    key={i}
                    line={line}
                    containerWidth={imgSize.width}
                    containerHeight={imgSize.height}
                  />
                ))}
              </div>
            )}

            {/* Translation overlay */}
            {showTranslated && translatedLines && ocrResult && (
              <div
                className="ocr-text-layer absolute top-0 left-0"
                style={{ width: imgSize.width || "100%", height: imgSize.height || "100%" }}
              >
                {ocrResult.lines.map((line, i) => {
                  const text = translatedLines[i];
                  if (!text) return null;
                  return (
                    <TranslatedText
                      key={i}
                      line={line}
                      text={text}
                      containerWidth={imgSize.width}
                      containerHeight={imgSize.height}
                    />
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        )}
      </div>

      {ocrError && !hasOcrText && !ocrLoading && (
        <div className="border-t border-border/30 px-3 py-1.5 shrink-0">
          <p className="text-xs2 text-red-400">{ocrError}</p>
        </div>
      )}
    </div>
  );
}

/**
 * Invisible but selectable text positioned over the image.
 * Bounding box expanded by padding to fully cover the text in the image.
 * color: transparent, ::selection shows blue highlight.
 */
function OcrSelectableText({
  line,
  containerWidth,
  containerHeight,
}: {
  line: OcrTextLine;
  containerWidth: number;
  containerHeight: number;
}) {
  // Expand bounding box by ~20% padding to fully cover text
  const padX = line.width * 0.1;
  const padY = line.height * 0.15;
  const left = Math.max(0, line.x - padX) * containerWidth;
  const top = Math.max(0, line.y - padY) * containerHeight;
  const width = Math.min(1 - Math.max(0, line.x - padX), line.width + padX * 2) * containerWidth;
  const height = (line.height + padY * 2) * containerHeight;
  const fontSize = Math.max(8, line.height * containerHeight * 0.85);

  return (
    <span
      className="ocr-selectable-text absolute select-text cursor-text whitespace-pre"
      style={{
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: `${height}px`,
        fontSize: `${fontSize}px`,
        lineHeight: `${height}px`,
        color: "transparent",
      }}
    >
      {line.text}
    </span>
  );
}

/**
 * Translated text overlay: visible, selectable, with opaque background
 * covering the original text area on the image.
 */
function TranslatedText({
  line,
  text,
  containerWidth,
  containerHeight,
}: {
  line: OcrTextLine;
  text: string;
  containerWidth: number;
  containerHeight: number;
}) {
  // Same padding expansion as OCR selection
  const padX = line.width * 0.1;
  const padY = line.height * 0.15;
  const left = Math.max(0, line.x - padX) * containerWidth;
  const top = Math.max(0, line.y - padY) * containerHeight;
  const width = Math.min(1 - Math.max(0, line.x - padX), line.width + padX * 2) * containerWidth;
  const height = (line.height + padY * 2) * containerHeight;
  const fontSize = Math.max(8, line.height * containerHeight * 0.7);

  return (
    <span
      className="absolute select-text cursor-text whitespace-pre-wrap break-words flex items-center px-[3px] rounded-[2px] bg-white/90 dark:bg-neutral-800/95 text-green-700 dark:text-green-400 font-medium"
      style={{
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        minHeight: `${height}px`,
        fontSize: `${fontSize}px`,
        lineHeight: 1.3,
      }}
    >
      {text}
    </span>
  );
}
