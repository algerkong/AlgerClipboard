import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Music } from "lucide-react";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { FileMeta } from "@/types";
import { PreviewHeader } from "./PreviewHeader";
import { GenericPreview } from "./GenericPreview";
import { formatFileSize } from "./utils";

interface AudioPreviewProps {
  file: FileMeta;
  onBack?: () => void;
}

export function AudioPreview({ file, onBack }: AudioPreviewProps) {
  const { t } = useTranslation();
  const [error, setError] = useState(false);
  const src = convertFileSrc(file.path);

  if (error) {
    return <GenericPreview file={file} onBack={onBack} />;
  }

  return (
    <div className="flex h-full flex-col">
      <PreviewHeader file={file} onBack={onBack} />
      <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-background/50 p-8">
        <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-border/40 bg-card/50">
          <Music className="h-12 w-12 text-pink-400" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">{file.name}</p>
          <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
        </div>
        <audio
          src={src}
          controls
          className="w-full max-w-md"
          onError={() => setError(true)}
        >
          {t("fileViewer.unsupportedFormat")}
        </audio>
      </div>
    </div>
  );
}
