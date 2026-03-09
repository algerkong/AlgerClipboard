import { useTranslation } from "react-i18next";
import { ArrowLeft, FolderOpen, ExternalLink } from "lucide-react";
import type { FileMeta } from "@/types";
import { openInFileExplorer, openFileDefault } from "@/services/clipboardService";
import { formatFileSize } from "./utils";
import { toast } from "@/lib/toast";

interface PreviewHeaderProps {
  file: FileMeta;
  onBack?: () => void;
  children?: React.ReactNode;
}

export function PreviewHeader({ file, onBack, children }: PreviewHeaderProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-2 border-b border-border/50 bg-card/50 px-4 py-2.5">
      {onBack && (
        <button
          onClick={onBack}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
        <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          onClick={() => {
            openInFileExplorer(file.path).catch(() => toast.error(t("toast.openUrlFailed")));
          }}
          className="flex h-7 items-center gap-1.5 rounded-lg px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title={t("fileViewer.openInExplorer")}
        >
          <FolderOpen className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => {
            openFileDefault(file.path).catch(() => toast.error(t("toast.openUrlFailed")));
          }}
          className="flex h-7 items-center gap-1.5 rounded-lg px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title={t("fileViewer.openWithDefault")}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
        {children}
      </div>
    </div>
  );
}
