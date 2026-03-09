import { useState } from "react";
import { useTranslation } from "react-i18next";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { FileMeta } from "@/types";
import { PreviewHeader } from "./PreviewHeader";
import { GenericPreview } from "./GenericPreview";

interface VideoPreviewProps {
  file: FileMeta;
  onBack?: () => void;
}

export function VideoPreview({ file, onBack }: VideoPreviewProps) {
  const { t } = useTranslation();
  const [error, setError] = useState(false);
  const src = convertFileSrc(file.path);

  if (error) {
    return <GenericPreview file={file} onBack={onBack} />;
  }

  return (
    <div className="flex h-full flex-col">
      <PreviewHeader file={file} onBack={onBack} />
      <div className="flex flex-1 items-center justify-center bg-background/50 p-4">
        <video
          src={src}
          controls
          className="max-h-full max-w-full rounded-lg"
          onError={() => setError(true)}
        >
          {t("fileViewer.unsupportedFormat")}
        </video>
      </div>
    </div>
  );
}
