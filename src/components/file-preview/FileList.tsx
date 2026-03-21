import { useTranslation } from "react-i18next";
import { File, FileText, Image, VideoCamera, MusicNote, Archive, FileCode, FileText as FileTypeIcon, Folder, FolderOpen } from "@phosphor-icons/react";
import type { FileMeta } from "@/types";
import { openInFileExplorer } from "@/services/clipboardService";
import { formatFileSize, formatDate } from "./utils";
import { toast } from "@/lib/toast";

interface FileListProps {
  files: FileMeta[];
  onSelect: (file: FileMeta) => void;
}

function getFileIcon(file: FileMeta) {
  if (file.is_dir) return <Folder size={16} className="text-amber-400" />;
  switch (file.file_type) {
    case "Image": return <Image size={16} className="text-sky-400" />;
    case "Video": return <VideoCamera size={16} className="text-purple-400" />;
    case "Audio": return <MusicNote size={16} className="text-pink-400" />;
    case "Document": return <FileText size={16} className="text-blue-400" />;
    case "Archive": return <Archive size={16} className="text-orange-400" />;
    case "Code": return <FileCode size={16} className="text-green-400" />;
    case "Executable": return <FileTypeIcon size={16} className="text-red-400" />;
    default: return <File size={16} className="text-gray-400" />;
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
            <FolderOpen size={14} />
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
            <div className="h-8 w-8 flex shrink-0 items-center justify-center rounded-lg border border-border/40 bg-card/50">
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
