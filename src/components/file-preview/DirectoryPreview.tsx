import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, ChevronDown, Folder, File } from "lucide-react";
import type { FileMeta, DirTreeNode } from "@/types";
import { getDirectoryTree } from "@/services/clipboardService";
import { PreviewHeader } from "./PreviewHeader";
import { formatFileSize } from "./utils";

interface DirectoryPreviewProps {
  file: FileMeta;
  onBack?: () => void;
}

function TreeItem({ node, depth = 0 }: { node: DirTreeNode; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2);

  return (
    <div>
      <button
        onClick={() => node.is_dir && setExpanded(!expanded)}
        className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-sm transition-colors hover:bg-accent/50"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {node.is_dir ? (
          <>
            {expanded ? (
              <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
            )}
            <Folder className="h-3.5 w-3.5 shrink-0 text-amber-400" />
          </>
        ) : (
          <>
            <span className="w-3" />
            <File className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          </>
        )}
        <span className="min-w-0 flex-1 truncate text-foreground">{node.name}</span>
        <span className="shrink-0 text-xs text-muted-foreground">{formatFileSize(node.size)}</span>
      </button>
      {expanded && node.children && (
        <div>
          {node.children.map((child, i) => (
            <TreeItem key={i} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function DirectoryPreview({ file, onBack }: DirectoryPreviewProps) {
  const { t } = useTranslation();
  const [tree, setTree] = useState<DirTreeNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    getDirectoryTree(file.path)
      .then(setTree)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [file.path]);

  function countItems(node: DirTreeNode): { files: number; folders: number; size: number } {
    let files = 0, folders = 0, size = 0;
    if (!node.children) return { files, folders, size };
    for (const child of node.children) {
      if (child.is_dir) {
        folders++;
        const sub = countItems(child);
        files += sub.files;
        folders += sub.folders;
        size += sub.size;
      } else {
        files++;
        size += child.size;
      }
    }
    return { files, folders, size };
  }

  const stats = tree ? countItems(tree) : null;

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
        ) : tree ? (
          <div className="p-2">
            {tree.children?.map((node, i) => (
              <TreeItem key={i} node={node} />
            ))}
          </div>
        ) : null}
      </div>
      {stats && (
        <div className="border-t border-border/50 bg-card/50 px-4 py-2 text-xs text-muted-foreground">
          {stats.files} files, {stats.folders} folders, {formatFileSize(stats.size)}
        </div>
      )}
    </div>
  );
}
