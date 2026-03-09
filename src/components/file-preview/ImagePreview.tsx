import { useState, useCallback, useEffect, useRef, useLayoutEffect } from "react";
import { ZoomIn, ZoomOut, RotateCcw, Languages, Loader2 } from "lucide-react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { FileMeta, OcrResult, OcrTextLine } from "@/types";
import { getEnabledOcrEngines, ocrRecognizeFile, type OcrEngineInfo } from "@/services/ocrService";
import { translateText } from "@/services/translateService";
import { toast } from "@/lib/toast";
import { PreviewHeader } from "./PreviewHeader";

interface ImagePreviewProps {
  file: FileMeta;
  onBack?: () => void;
}

export function ImagePreview({ file, onBack }: ImagePreviewProps) {
  const { t } = useTranslation();
  const src = convertFileSrc(file.path);

  const [zoom, setZoom] = useState(1);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgSize, setImgSize] = useState({ width: 0, height: 0 });

  // OCR engine state
  const [availableEngines, setAvailableEngines] = useState<OcrEngineInfo[]>([]);
  const [selectedEngine, setSelectedEngine] = useState<string | undefined>(undefined);

  // OCR state
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);

  // Translation state
  const [translatedLines, setTranslatedLines] = useState<string[] | null>(null);
  const [translateLoading, setTranslateLoading] = useState(false);
  const [showTranslated, setShowTranslated] = useState(false);

  // Load OCR engines
  useEffect(() => {
    getEnabledOcrEngines().then(setAvailableEngines).catch(() => {});
  }, []);

  const updateImgSize = useCallback(() => {
    if (imgRef.current) {
      setImgSize({ width: imgRef.current.clientWidth, height: imgRef.current.clientHeight });
    }
  }, []);

  // Track image size for OCR overlay positioning
  useEffect(() => {
    updateImgSize();
    window.addEventListener("resize", updateImgSize);
    return () => window.removeEventListener("resize", updateImgSize);
  }, [zoom, src, updateImgSize]);

  // Auto-OCR on image load
  const ocrTriggered = useRef(false);

  // Reset OCR state when file changes
  useEffect(() => {
    ocrTriggered.current = false;
    setOcrResult(null);
    setOcrError(null);
    setTranslatedLines(null);
    setShowTranslated(false);
    setZoom(1);
  }, [file.path]);

  const runOcr = useCallback(async () => {
    if (!file.path) return;
    setOcrLoading(true);
    setOcrError(null);
    try {
      const result = await ocrRecognizeFile(file.path, selectedEngine);
      setOcrResult(result);
      if (result.lines.length === 0) {
        setOcrError(t("imageViewer.noText"));
      }
    } catch (err) {
      setOcrError(String(err));
    } finally {
      setOcrLoading(false);
    }
  }, [file.path, selectedEngine, t]);

  const handleImageLoad = useCallback(() => {
    updateImgSize();
    if (!ocrTriggered.current) {
      ocrTriggered.current = true;
      runOcr();
    }
  }, [runOcr, updateImgSize]);

  // Zoom handlers
  const handleZoomIn = useCallback(() => setZoom((z) => Math.min(z + 0.25, 5)), []);
  const handleZoomOut = useCallback(() => setZoom((z) => Math.max(z - 0.25, 0.25)), []);
  const handleResetZoom = useCallback(() => setZoom(1), []);
  const handleWheel = useCallback((e: React.WheelEvent) => {
    setZoom((z) => Math.max(0.25, Math.min(5, z + (e.deltaY < 0 ? 0.1 : -0.1))));
  }, []);

  // Translation handler
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

  // Intercept copy to force plain text
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

  const hasOcrText = ocrResult && ocrResult.lines.length > 0;

  return (
    <div className="flex h-full flex-col">
      <PreviewHeader file={file} onBack={onBack}>
        {/* Zoom controls */}
        <button onClick={handleZoomOut} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" title={t("imageViewer.zoomOut")}>
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <span className="text-xs text-muted-foreground min-w-[36px] text-center">{Math.round(zoom * 100)}%</span>
        <button onClick={handleZoomIn} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" title={t("imageViewer.zoomIn")}>
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
        <button onClick={handleResetZoom} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" title={t("imageViewer.resetZoom")}>
          <RotateCcw className="h-3 w-3" />
        </button>

        {availableEngines.length > 1 && (
          <select
            value={selectedEngine ?? ""}
            onChange={(e) => setSelectedEngine(e.target.value || undefined)}
            className="h-5 px-1 text-xs2 bg-background border border-border/50 rounded text-foreground focus:outline-none"
          >
            <option value="">{t("ocr.defaultEngine")}</option>
            {availableEngines.map((eng) => (
              <option key={eng.engine_type} value={eng.engine_type}>{eng.label}</option>
            ))}
          </select>
        )}

        {/* Divider */}
        <div className="h-4 w-px bg-border/50" />

        {/* OCR status / translate button */}
        {ocrLoading && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t("imageViewer.extracting")}
          </span>
        )}
        {hasOcrText && (
          <button
            onClick={handleTranslate}
            disabled={translateLoading}
            className={cn(
              "flex items-center gap-1 rounded-lg px-2 h-7 text-xs font-medium transition-colors",
              translateLoading ? "text-muted-foreground cursor-not-allowed"
                : showTranslated ? "text-green-400 hover:bg-green-400/10"
                  : "text-blue-400 hover:bg-blue-400/10"
            )}
            title={t("imageViewer.translateText")}
          >
            {translateLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Languages className="h-3.5 w-3.5" />}
          </button>
        )}
      </PreviewHeader>

      {/* Image + OCR overlay area */}
      <div className="flex-1 overflow-auto flex items-center justify-center bg-background/50 min-h-0" onWheel={handleWheel}>
        <div
          className="relative inline-block"
          style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
        >
          <img
            ref={imgRef}
            src={src}
            alt={file.name}
            className="block w-auto"
            style={{ maxHeight: "calc(100vh - 3rem)", maxWidth: "100%" }}
            draggable={false}
            onLoad={handleImageLoad}
          />

          {/* Transparent selectable text layer */}
          {hasOcrText && !showTranslated && (
            <div
              className="ocr-text-layer absolute top-0 left-0"
              style={{ width: imgSize.width || "100%", height: imgSize.height || "100%" }}
            >
              {ocrResult.lines.map((line, i) => (
                <OcrSelectableText key={i} line={line} containerWidth={imgSize.width} containerHeight={imgSize.height} />
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
                return <TranslatedText key={i} line={line} text={text} containerWidth={imgSize.width} containerHeight={imgSize.height} />;
              })}
            </div>
          )}
        </div>
      </div>

      {/* OCR error bar */}
      {ocrError && !hasOcrText && !ocrLoading && (
        <div className="border-t border-border/30 px-3 py-1.5 shrink-0">
          <p className="text-xs text-red-400">{ocrError}</p>
        </div>
      )}
    </div>
  );
}

function OcrSelectableText({ line, containerWidth, containerHeight }: { line: OcrTextLine; containerWidth: number; containerHeight: number }) {
  const spanRef = useRef<HTMLSpanElement>(null);
  const [scaleX, setScaleX] = useState(1);

  const left = line.x * containerWidth;
  const top = line.y * containerHeight;
  const targetWidth = line.width * containerWidth;
  const height = line.height * containerHeight;
  const fontSize = Math.max(8, height * 0.85);

  useLayoutEffect(() => {
    if (spanRef.current) {
      const naturalWidth = spanRef.current.scrollWidth;
      if (naturalWidth > 0 && targetWidth > 0) {
        setScaleX(targetWidth / naturalWidth);
      }
    }
  }, [line.text, targetWidth, fontSize]);

  return (
    <span
      ref={spanRef}
      className="ocr-selectable-text absolute select-text cursor-text whitespace-pre"
      style={{
        left: `${left}px`,
        top: `${top}px`,
        height: `${height}px`,
        fontSize: `${fontSize}px`,
        lineHeight: `${height}px`,
        color: "transparent",
        transformOrigin: "left top",
        transform: `scaleX(${scaleX})`,
      }}
    >
      {line.text}
    </span>
  );
}

function TranslatedText({ line, text, containerWidth, containerHeight }: { line: OcrTextLine; text: string; containerWidth: number; containerHeight: number }) {
  const left = line.x * containerWidth;
  const top = line.y * containerHeight;
  const width = line.width * containerWidth;
  const height = line.height * containerHeight;
  const fontSize = Math.max(8, height * 0.7);

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
