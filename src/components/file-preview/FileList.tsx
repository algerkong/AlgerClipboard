import { useTranslation } from "react-i18next";
import { File, FileText, ImageIcon, Video, Music, Archive, FileCode, FileType as FileTypeIcon, Folder, FolderOpen } from "lucide-react";
import type { FileMeta } from "@/types";
import { openInFileExplorer } from "@/services/clipboardService";
import { formatFileSize, formatDate } from "./utils";
import { toast } from "@/lib/toast";

interface FileListProps {
  files: FileMeta[];
  onSelect: (file: FileMeta) => void;
}

function getFileIcon(file: FileMeta) {
  if (file.is_dir) return <Folder className="h-4 w-4 text-amber-400" />;
  switch (file.file_type) {
    case "Image": return <ImageIcon className="h-4 w-4 text-sky-400" />;
    case "Video": return <Video className="h-4 w-4 text-purple-400" />;
    case "Audio": return <Music className="h-4 w-4 text-pink-400" />;
    case "Document": return <FileText className="h-4 w-4 text-blue-400" />;
    case "Archive": return <Archive className="h-4 w-4 text-orange-400" />;
    case "Code": return <FileCode className="h-4 w-4 text-green-400" />;
    case "Executable": return <FileTypeIcon className="h-4 w-4 text-red-400" />;
    default: return <File className="h-4 w-4 text-gray-400" />;
  }
}

export function FileList({ files, onSelect }: FileListProps) {
  const { t } = useTranslation();
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border/50 bg-card/50 px-4 py-2.5">
        <div>
          <p className="text-sm font-medium text-foreground">
            {t("fileViewer.files", { count: files.length })}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("fileViewer.totalSize", { size: formatFileSize(totalSize) })}
          </p>
        </div>
        {files.length > 0 && (
          <button
            onClick={() => {
              const dir = files[0].path.replace(/[/\\][^/\\]*$/, "");
              openInFileExplorer(dir).catch(() => toast.error(t("toast.openUrlFailed")));
            }}
            className="flex h-7 items-center gap-1.5 rounded-lg px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title={t("fileViewer.openInExplorer")}
          >
            <FolderOpen className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {files.map((file, i) => (
          <button
            key={i}
            onClick={() => onSelect(file)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent/50"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/40 bg-card/50">
              {getFileIcon(file)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-foreground">{file.name}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{formatFileSize(file.size)}</span>
                {file.modified && <span>{formatDate(file.modified)}</span>}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
