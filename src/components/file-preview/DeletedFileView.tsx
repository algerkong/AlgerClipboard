import { useTranslation } from "react-i18next";
import { Warning } from "@phosphor-icons/react";
import type { FileMeta } from "@/types";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

interface DeletedFileViewProps {
  file: FileMeta;
  entryId: string;
  totalFiles: number;
}

export function DeletedFileView({ file, entryId, totalFiles }: DeletedFileViewProps) {
  const { t } = useTranslation();

  const handleRemove = async () => {
    await invoke("delete_entries", { ids: [entryId] });
    await invoke("focus_main_window").catch(() => {});
    await getCurrentWebviewWindow().close();
  };

  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-4 px-8 text-center">
        <Warning size={48} className="text-amber-400" />
        <p className="text-base font-medium text-foreground">
          {t("fileViewer.fileDeleted")}
        </p>
        <div className="max-w-md">
          <p className="mb-1 text-xs text-muted-foreground">{t("fileViewer.originalPath")}</p>
          <p className="select-text break-all font-mono text-xs text-muted-foreground/70">
            {file.path}
          </p>
        </div>
        {totalFiles === 1 && (
          <button
            onClick={handleRemove}
            className="mt-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
          >
            {t("fileViewer.removeFromHistory")}
          </button>
        )}
      </div>
    </div>
  );
}
