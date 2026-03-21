import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { File, Folder, WarningCircle } from "@phosphor-icons/react";
import type { FileMeta, ArchiveEntry } from "@/types";
import { listArchiveContents } from "@/services/clipboardService";
import { PreviewHeader } from "./PreviewHeader";
import { GenericPreview } from "./GenericPreview";
import { formatFileSize } from "./utils";

interface ArchivePreviewProps {
  file: FileMeta;
  onBack?: () => void;
}

export function ArchivePreview({ file, onBack }: ArchivePreviewProps) {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<ArchiveEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isZip = file.extension?.toLowerCase() === "zip";

  useEffect(() => {
    if (!isZip) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    listArchiveContents(file.path)
      .then(setEntries)
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, [file.path, isZip]);

  if (!isZip) {
    return (
      <GenericPreview file={file} onBack={onBack} />
    );
  }

  const fileEntries = entries.filter((e) => !e.is_dir);
  const totalSize = fileEntries.reduce((sum, e) => sum + e.size, 0);
  const totalCompressed = fileEntries.reduce((sum, e) => sum + e.compressed_size, 0);

  return (
    <div className="flex h-full flex-col">
      <PreviewHeader file={file} onBack={onBack} />
      <div className="flex-1 overflow-auto bg-background/50">
        {loading ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            {t("fileViewer.loading")}
          </div>
        ) : error ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <WarningCircle size={24} className="text-red-400" />
            <p className="text-sm">{error}</p>
          </div>
        ) : (
          <div className="p-2">
            {entries.map((entry, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-accent/50"
              >
                {entry.is_dir ? (
                  <Folder size={14} className="shrink-0 text-amber-400" />
                ) : (
                  <File size={14} className="shrink-0 text-gray-400" />
                )}
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {entry.name}
                </span>
                {!entry.is_dir && (
                  <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                    <span>{formatFileSize(entry.size)}</span>
                    <span>{formatFileSize(entry.compressed_size)}</span>
                    {entry.size > 0 && (
                      <span className="text-green-400">
                        {Math.round((1 - entry.compressed_size / entry.size) * 100)}%
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {!loading && !error && entries.length > 0 && (
        <div className="border-t border-border/50 bg-card/50 px-4 py-2 text-xs text-muted-foreground">
          {fileEntries.length} {t("fileViewer.archiveContents")}, {formatFileSize(totalSize)} → {formatFileSize(totalCompressed)}
        </div>
      )}
    </div>
  );
}
