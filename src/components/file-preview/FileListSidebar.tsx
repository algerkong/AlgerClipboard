import { useTranslation } from "react-i18next";
import { File, FileText, ImageIcon, Video, Music, Archive, FileCode, FileType as FileTypeIcon, Folder, PanelLeftClose } from "lucide-react";
import type { FileMeta } from "@/types";
import { formatFileSize } from "./utils";

interface FileListSidebarProps {
  files: FileMeta[];
  existsMap: boolean[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onClose: () => void;
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

export function FileListSidebar({ files, existsMap, selectedIndex, onSelect, onClose }: FileListSidebarProps) {
  const { t } = useTranslation();
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  return (
    <div className="flex h-full w-64 shrink-0 flex-col border-r border-border/50">
      <div className="flex items-center justify-between border-b border-border/50 bg-card/50 px-3 py-2.5">
        <div>
          <p className="text-sm font-medium text-foreground">
            {t("fileViewer.files", { count: files.length })}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("fileViewer.totalSize", { size: formatFileSize(totalSize) })}
          </p>
        </div>
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-1.5">
        {files.map((file, i) => {
          const deleted = existsMap[i] === false;
          return (
            <button
              key={i}
              onClick={() => onSelect(i)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition-colors ${
                selectedIndex === i ? "bg-accent" : "hover:bg-accent/50"
              } ${deleted ? "opacity-50" : ""}`}
            >
              <div className="shrink-0">
                {getFileIcon(file)}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm text-foreground ${deleted ? "line-through" : ""}`}>
                  {file.name}
                </p>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">{formatFileSize(file.size)}</span>
                  {deleted && (
                    <span className="text-[10px] text-red-400">{t("fileViewer.deleted")}</span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
