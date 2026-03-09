import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { ChevronLeft, ChevronRight, PanelLeft } from "lucide-react";
import { usePreviewCloseShortcut } from "@/hooks/usePreviewCloseShortcut";
import { CloseConfirmDialog } from "@/components/CloseConfirmDialog";
import type { ClipboardEntry, FileMeta } from "@/types";
import { FileListSidebar } from "@/components/file-preview/FileListSidebar";
import { DeletedFileView } from "@/components/file-preview/DeletedFileView";
import { ImagePreview } from "@/components/file-preview/ImagePreview";
import { TextPreview } from "@/components/file-preview/TextPreview";
import { VideoPreview } from "@/components/file-preview/VideoPreview";
import { AudioPreview } from "@/components/file-preview/AudioPreview";
import { DirectoryPreview } from "@/components/file-preview/DirectoryPreview";
import { GenericPreview } from "@/components/file-preview/GenericPreview";
import { ArchivePreview } from "@/components/file-preview/ArchivePreview";
import { trackWindowSize } from "@/lib/windowSize";
import { FILE_VIEWER_SIZE_KEY } from "@/services/fileViewerService";

const HTML5_VIDEO_EXTS = ["mp4", "webm", "ogg"];
const HTML5_AUDIO_EXTS = ["mp3", "wav", "ogg", "m4a", "aac"];

function isHtml5Video(ext: string | null): boolean {
  return !!ext && HTML5_VIDEO_EXTS.includes(ext.toLowerCase());
}
function isHtml5Audio(ext: string | null): boolean {
  return !!ext && HTML5_AUDIO_EXTS.includes(ext.toLowerCase());
}

function renderPreview(file: FileMeta) {
  if (file.is_dir) return <DirectoryPreview file={file} />;

  switch (file.file_type) {
    case "Image":
      return <ImagePreview file={file} />;
    case "Video":
      return isHtml5Video(file.extension) ? <VideoPreview file={file} /> : <GenericPreview file={file} />;
    case "Audio":
      return isHtml5Audio(file.extension) ? <AudioPreview file={file} /> : <GenericPreview file={file} />;
    case "Archive":
      return <ArchivePreview file={file} />;
    case "Code":
    case "Data":
      return <TextPreview file={file} />;
    case "Document":
      if (file.extension && ["txt", "rtf", "md", "log"].includes(file.extension.toLowerCase())) {
        return <TextPreview file={file} />;
      }
      return <GenericPreview file={file} />;
    default:
      if (file.size < 1024 * 100) {
        return <TextPreview file={file} />;
      }
      return <GenericPreview file={file} />;
  }
}

export function FileViewerPage() {
  const { t } = useTranslation();
  const [entry, setEntry] = useState<ClipboardEntry | null>(null);
  const [fileMetas, setFileMetas] = useState<FileMeta[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [existsMap, setExistsMap] = useState<boolean[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    return trackWindowSize(FILE_VIEWER_SIZE_KEY);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (!id) return;
    invoke<ClipboardEntry>("get_entry", { id }).then(async (e) => {
      if (!e) return;
      setEntry(e);

      let metas: FileMeta[] = [];

      if (e.file_meta) {
        try {
          metas = JSON.parse(e.file_meta);
        } catch { /* ignore */ }
      }

      // Fallback: if file_meta is missing, collect from file paths on the fly
      if (metas.length === 0 && e.content_type === "FilePaths" && e.text_content) {
        const paths = e.text_content.split("\n").filter((p) => p.trim());
        if (paths.length > 0) {
          try {
            metas = await invoke<FileMeta[]>("collect_file_metas", { paths });
          } catch { /* ignore */ }
        }
      }

      if (metas.length > 0) {
        setFileMetas(metas);
        // Check which files still exist
        const paths = metas.map(m => m.path);
        try {
          const exists = await invoke<boolean[]>("check_paths_exist", { paths });
          setExistsMap(exists);
        } catch {
          setExistsMap(metas.map(() => true)); // assume exists on error
        }
        // Auto-select first existing file
        if (metas.length === 1) {
          setSelectedIndex(0);
        }
      }
    });
  }, []);

  const goNext = useCallback(() => {
    setSelectedIndex((prev) => (prev < fileMetas.length - 1 ? prev + 1 : prev));
  }, [fileMetas.length]);

  const goPrev = useCallback(() => {
    setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
  }, []);

  const { showConfirm, handleConfirmYes, handleConfirmNo, closeKey } = usePreviewCloseShortcut();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && fileMetas.length > 1) {
        // Don't navigate if user is interacting with text
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        if (window.getSelection()?.toString()) return;
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight" && fileMetas.length > 1) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        if (window.getSelection()?.toString()) return;
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [fileMetas.length, goPrev, goNext]);

  if (!entry) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        {t("fileViewer.loading")}
      </div>
    );
  }

  if (fileMetas.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        {t("fileViewer.noPreview")}
      </div>
    );
  }

  const file = fileMetas[selectedIndex];
  const fileExists = existsMap[selectedIndex] !== false;
  const isMultiFile = fileMetas.length > 1;

  return (
    <div className="flex h-full">
      {/* Left sidebar - only for multi-file */}
      {isMultiFile && sidebarOpen && (
        <FileListSidebar
          files={fileMetas}
          existsMap={existsMap}
          selectedIndex={selectedIndex}
          onSelect={setSelectedIndex}
          onClose={() => setSidebarOpen(false)}
        />
      )}

      {/* Right preview area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Navigation bar for multi-file */}
        {isMultiFile && (
          <div className="flex items-center gap-2 border-b border-border/50 bg-card/80 px-3 py-1.5">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                title={t("fileViewer.showFileList")}
              >
                <PanelLeft className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={goPrev}
              disabled={selectedIndex === 0}
              className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs text-muted-foreground">
              {selectedIndex + 1} / {fileMetas.length}
            </span>
            <button
              onClick={goNext}
              disabled={selectedIndex === fileMetas.length - 1}
              className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Preview content */}
        {!fileExists ? (
          <DeletedFileView file={file} entryId={entry.id} totalFiles={fileMetas.length} />
        ) : (
          renderPreview(file)
        )}
      </div>
      {showConfirm && (
        <CloseConfirmDialog
          shortcutKey={closeKey}
          onConfirm={handleConfirmYes}
          onCancel={handleConfirmNo}
        />
      )}
    </div>
  );
}
