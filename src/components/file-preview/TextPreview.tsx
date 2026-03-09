import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { FileMeta } from "@/types";
import { readFilePreview } from "@/services/clipboardService";
import { PreviewHeader } from "./PreviewHeader";

interface TextPreviewProps {
  file: FileMeta;
  onBack?: () => void;
}

export function TextPreview({ file, onBack }: TextPreviewProps) {
  const { t } = useTranslation();
  const [content, setContent] = useState<string>("");
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    readFilePreview(file.path)
      .then((preview) => {
        setContent(preview.content);
        setTruncated(preview.truncated);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [file.path]);

  const lines = content.split("\n");

  return (
    <div className="flex h-full flex-col">
      <PreviewHeader file={file} onBack={onBack} />
      <div className="flex-1 overflow-auto bg-background/50">
        {loading ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            {t("fileViewer.loading")}
          </div>
        ) : error ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            {t("fileViewer.fileNotFound")}
          </div>
        ) : (
          <div className="p-4">
            <pre className="text-sm font-mono leading-relaxed">
              {lines.map((line, i) => (
                <div key={i} className="flex">
                  <span className="w-12 shrink-0 select-none pr-3 text-right text-xs text-muted-foreground/50">
                    {i + 1}
                  </span>
                  <span className="flex-1 whitespace-pre-wrap break-all text-foreground">
                    {line}
                  </span>
                </div>
              ))}
            </pre>
            {truncated && (
              <div className="mt-2 rounded-lg border border-border/50 bg-card/50 px-3 py-2 text-xs text-muted-foreground">
                {t("fileViewer.noPreview")}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
