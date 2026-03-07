import { useEffect, useMemo, useState } from "react";
import { Check, Pencil, Plus, Search, Tag, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useClipboardStore } from "@/stores/clipboardStore";
import { cn } from "@/lib/utils";

export function TagManagerPage() {
  const { t } = useTranslation();
  const tagSummaries = useClipboardStore((s) => s.tagSummaries);
  const fetchTagSummaries = useClipboardStore((s) => s.fetchTagSummaries);
  const createTag = useClipboardStore((s) => s.createTag);
  const renameTag = useClipboardStore((s) => s.renameTag);
  const deleteTagEverywhere = useClipboardStore((s) => s.deleteTagEverywhere);
  const [keyword, setKeyword] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [pendingDeleteTag, setPendingDeleteTag] = useState<string | null>(null);
  const [busyTag, setBusyTag] = useState<string | null>(null);

  useEffect(() => {
    void fetchTagSummaries();
  }, [fetchTagSummaries]);

  const filteredTags = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    if (!query) {
      return tagSummaries;
    }

    return tagSummaries.filter(({ tag }) => tag.toLowerCase().includes(query));
  }, [keyword, tagSummaries]);

  const startEditing = (tag: string) => {
    setPendingDeleteTag(null);
    setEditingTag(tag);
    setDraftName(tag);
  };

  const cancelEditing = () => {
    setEditingTag(null);
    setDraftName("");
  };

  const submitRename = async () => {
    if (!editingTag) {
      return;
    }

    const nextName = draftName.trim();
    if (!nextName) {
      toast.error(t("tags.emptyName"));
      return;
    }

    setBusyTag(editingTag);
    try {
      await renameTag(editingTag, nextName);
      toast.success(t("tags.renamed"));
      cancelEditing();
    } catch {
      toast.error(t("tags.renameFailed"));
    } finally {
      setBusyTag(null);
    }
  };

  const confirmDelete = async (tag: string) => {
    setBusyTag(tag);
    try {
      await deleteTagEverywhere(tag);
      toast.success(t("tags.deleted"));
      if (editingTag === tag) {
        cancelEditing();
      }
      setPendingDeleteTag(null);
    } catch {
      toast.error(t("tags.deleteFailed"));
    } finally {
      setBusyTag(null);
    }
  };

  const submitCreate = async () => {
    const nextName = newTagName.trim();
    if (!nextName) {
      toast.error(t("tags.emptyName"));
      return;
    }

    setBusyTag(nextName);
    try {
      await createTag(nextName);
      toast.success(t("tags.created"));
      setNewTagName("");
    } catch {
      toast.error(t("tags.createFailed"));
    } finally {
      setBusyTag(null);
    }
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="border-b border-border/30 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs2 text-muted-foreground">
            {t("tags.manageDescription")}
          </p>
          <span className="rounded-full border border-border/50 bg-muted/20 px-2 py-1 text-2xs text-muted-foreground">
            {tagSummaries.length}
          </span>
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,240px)]">
          <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/10 px-2">
            <Plus className="h-3.5 w-3.5 text-muted-foreground/70" />
            <input
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  void submitCreate();
                }
              }}
              placeholder={t("tags.addPlaceholder")}
              className="h-9 min-w-0 flex-1 bg-transparent text-sm2 text-foreground outline-none"
            />
            <button
              onClick={() => void submitCreate()}
              disabled={!newTagName.trim()}
              className="h-7 rounded-md bg-primary/15 px-2.5 text-xs2 font-medium text-primary transition-colors hover:bg-primary/25 disabled:opacity-40"
            >
              {t("tags.add")}
            </button>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/70" />
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder={t("tags.searchPlaceholder")}
              className="h-9 w-full rounded-lg border border-border/50 bg-muted/10 pl-8 pr-3 text-sm2 text-foreground outline-none transition-colors focus:border-ring/40 focus:ring-1 focus:ring-ring/30"
            />
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {filteredTags.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/50 bg-muted/10 p-6 text-center">
            <Tag className="h-8 w-8 text-muted-foreground/40" />
            <div className="space-y-1">
              <p className="text-sm2 font-medium text-foreground">
                {tagSummaries.length === 0 ? t("tags.empty") : t("tags.emptySearch")}
              </p>
              <p className="text-xs2 text-muted-foreground">
                {tagSummaries.length === 0 ? t("tags.emptyDescription") : t("tags.searchPlaceholder")}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTags.map(({ tag, count }) => {
              const isEditing = editingTag === tag;
              const isDeleting = pendingDeleteTag === tag;
              const isBusy = busyTag === tag;

              return (
                <div
                  key={tag}
                  className="rounded-xl border border-border/40 bg-card/70 px-3 py-3 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      {isEditing ? (
                        <input
                          autoFocus
                          value={draftName}
                          onChange={(e) => setDraftName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              void submitRename();
                            }
                            if (e.key === "Escape") {
                              cancelEditing();
                            }
                          }}
                          className="h-9 w-full rounded-lg border border-border/60 bg-background px-3 text-sm2 text-foreground outline-none transition-colors focus:border-ring/40 focus:ring-1 focus:ring-ring/30"
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm2 font-medium text-foreground">
                            {tag}
                          </span>
                          <span className="shrink-0 rounded-full border border-border/50 bg-background px-2 py-0.5 text-2xs text-muted-foreground">
                            {t("tags.count", { count })}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => void submitRename()}
                            disabled={isBusy}
                            className="flex h-8 w-8 items-center justify-center rounded-md text-emerald-400 transition-colors hover:bg-emerald-500/10 disabled:opacity-50"
                            title={t("tags.save")}
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            onClick={cancelEditing}
                            disabled={isBusy}
                            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground disabled:opacity-50"
                            title={t("tags.cancel")}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => startEditing(tag)}
                            disabled={isBusy}
                            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground disabled:opacity-50"
                            title={t("tags.rename")}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setPendingDeleteTag(isDeleting ? null : tag)}
                            disabled={isBusy}
                            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                            title={t("tags.delete")}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {isDeleting && !isEditing && (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
                      <div className="space-y-0.5">
                        <p className="text-xs2 font-medium text-red-400">
                          {t("tags.delete")}
                        </p>
                        <p className="text-2xs text-muted-foreground">
                          {t("tags.deleteHint")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setPendingDeleteTag(null)}
                          disabled={isBusy}
                          className="h-8 rounded-md px-2.5 text-xs2 text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground disabled:opacity-50"
                        >
                          {t("tags.cancel")}
                        </button>
                        <button
                          onClick={() => void confirmDelete(tag)}
                          disabled={isBusy}
                          className={cn(
                            "h-8 rounded-md px-2.5 text-xs2 font-medium text-white transition-colors",
                            "bg-red-500 hover:bg-red-500/90 disabled:opacity-50",
                          )}
                        >
                          {t("tags.confirmDelete")}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
