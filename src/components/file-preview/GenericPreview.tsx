import { useTranslation } from "react-i18next";
import { File, FolderOpen, ArrowSquareOut } from "@phosphor-icons/react";
import type { FileMeta } from "@/types";
import { openInFileExplorer, openFileDefault } from "@/services/clipboardService";
import { formatFileSize, formatDate } from "./utils";
import { toast } from "@/lib/toast";

interface GenericPreviewProps {
  file: FileMeta;
  onBack?: () => void;
}

export function GenericPreview({ file, onBack }: GenericPreviewProps) {
  const { t } = useTranslation();

  return (
    <div className="flex h-full flex-col">
      {onBack && (
        <div className="border-b border-border/50 bg-card/50 px-4 py-2.5">
          <button
            onClick={onBack}
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            &larr;
          </button>
        </div>
      )}
      <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-background/50 p-8">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-border/40 bg-card/50">
          <File size={40} className="text-gray-400" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-base font-medium text-foreground">{file.name}</p>
          <p className="text-sm text-muted-foreground">{formatFileSize(file.size)}</p>
          {file.extension && (
            <p className="text-xs text-muted-foreground">{t("fileViewer.fileType")}: {file.extension.toUpperCase()}</p>
          )}
          {file.modified && (
            <p className="text-xs text-muted-foreground">{t("fileViewer.modified")}: {formatDate(file.modified)}</p>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{t("fileViewer.noPreview")}</p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              openInFileExplorer(file.path).catch(() => toast.error(t("toast.openUrlFailed")));
            }}
            className="flex items-center gap-1.5 rounded-lg border border-border/50 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <FolderOpen size={14} />
            {t("fileViewer.openInExplorer")}
          </button>
          <button
            onClick={() => {
              openFileDefault(file.path).catch(() => toast.error(t("toast.openUrlFailed")));
            }}
            className="flex items-center gap-1.5 rounded-lg border border-border/50 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ArrowSquareOut size={14} />
            {t("fileViewer.openWithDefault")}
          </button>
        </div>
      </div>
    </div>
  );
}
