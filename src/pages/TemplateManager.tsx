import { useEffect, useState, useMemo } from "react";
import {
  X,
  Plus,
  Pencil,
  Trash,
  Copy,
  FileText,
} from "@phosphor-icons/react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useTemplateStore } from "@/stores/templateStore";
import { useTranslation } from "react-i18next";
import { usePlatform } from "@/contexts/PlatformContext";
import type { Template } from "@/types";

interface Props {
  onBack: () => void;
}

export function TemplateManager({ onBack }: Props) {
  const { t } = useTranslation();
  const platform = usePlatform();
  const templates = useTemplateStore((s) => s.templates);
  const loading = useTemplateStore((s) => s.loading);
  const fetchTemplates = useTemplateStore((s) => s.fetchTemplates);
  const createTemplate = useTemplateStore((s) => s.createTemplate);
  const updateTemplate = useTemplateStore((s) => s.updateTemplate);
  const deleteTemplate = useTemplateStore((s) => s.deleteTemplate);
  const applyTemplate = useTemplateStore((s) => s.applyTemplate);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [groupName, setGroupName] = useState("default");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const grouped = useMemo(() => {
    const map: Record<string, Template[]> = {};
    for (const tmpl of templates) {
      const g = tmpl.group_name || "default";
      if (!map[g]) map[g] = [];
      map[g].push(tmpl);
    }
    return map;
  }, [templates]);

  const openCreate = () => {
    setEditingTemplate(null);
    setTitle("");
    setContent("");
    setGroupName("default");
    setDialogOpen(true);
  };

  const openEdit = (tmpl: Template) => {
    setEditingTemplate(tmpl);
    setTitle(tmpl.title);
    setContent(tmpl.content);
    setGroupName(tmpl.group_name);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) return;
    if (editingTemplate) {
      await updateTemplate(editingTemplate.id, title, content, groupName);
    } else {
      await createTemplate(title, content, groupName);
    }
    setDialogOpen(false);
  };

  const handleDelete = async (id: string) => {
    await deleteTemplate(id);
    setDeleteConfirmId(null);
  };

  const handleApply = async (id: string) => {
    try {
      const result = await applyTemplate(id);
      await navigator.clipboard.writeText(result);
      toast.success(t("template.applied"));
    } catch (err) {
      console.error("Failed to apply template:", err);
      toast.error(t("template.applyFailed"));
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header / Title bar */}
      <div data-tauri-drag-region className="flex items-center gap-2 px-3 py-2 border-b border-border/30 select-none shrink-0">
        {platform === "macos" && <div className="w-[72px] shrink-0" />}
        <span data-tauri-drag-region className="text-xs font-medium text-foreground">{t("template.title")}</span>
        <div data-tauri-drag-region className="flex-1" />
        <Button size="xs" onClick={openCreate}>
          <Plus size={12} />
          {t("template.new")}
        </Button>
        {platform !== "macos" && (
          <button
            onClick={onBack}
            className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2">
        {loading ? (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
            {t("template.loading")}
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground/70">
            <FileText size={32} />
            <p className="text-xs">{t("template.noTemplates")}</p>
            <p className="text-xs2">{t("template.createHint")}</p>
          </div>
        ) : (
          Object.entries(grouped).map(([group, items]) => (
            <div key={group} className="mb-3">
              <div className="text-xs2 font-medium text-muted-foreground uppercase tracking-wider px-1 mb-1">
                {group}
              </div>
              <div className="space-y-1">
                {items.map((tmpl) => (
                  <div
                    key={tmpl.id}
                    className="flex items-start gap-2 px-2 py-1.5 rounded-md border border-border/30 bg-card/50 hover:bg-accent/30 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-foreground truncate">
                        {tmpl.title}
                      </div>
                      <div className="text-xs2 text-muted-foreground line-clamp-2 mt-0.5">
                        {tmpl.content}
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={() => handleApply(tmpl.id)}
                        className="flex w-6 h-6 items-center justify-center rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                        title={t("template.apply")}
                      >
                        <Copy size={12} />
                      </button>
                      <button
                        onClick={() => openEdit(tmpl)}
                        className="flex w-6 h-6 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
                        title={t("template.edit")}
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(tmpl.id)}
                        className="flex w-6 h-6 items-center justify-center rounded text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title={t("template.delete")}
                      >
                        <Trash size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Hint bar */}
      <div className="px-3 py-1 text-xs2 text-muted-foreground/70 border-t border-border/20 shrink-0">
        {t("template.variables")}: {"{date}"} {"{time}"} {"{datetime}"} {"{clipboard}"}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {editingTemplate ? t("template.editTemplate") : t("template.newTemplate")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm2 text-muted-foreground mb-1 block">
                {t("template.titleField")}
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("template.titlePlaceholder")}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-sm2 text-muted-foreground mb-1 block">
                {t("template.content")}
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={t("template.contentPlaceholder")}
                rows={5}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 resize-none dark:bg-input/30"
              />
            </div>
            <div>
              <label className="text-sm2 text-muted-foreground mb-1 block">
                {t("template.group")}
              </label>
              <Input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="default"
                className="h-8 text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogOpen(false)}
            >
              {t("template.cancel")}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!title.trim() || !content.trim()}>
              {editingTemplate ? t("template.save") : t("template.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirmId(null);
        }}
      >
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-sm">{t("template.deleteTemplate")}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            {t("template.deleteConfirm")}
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteConfirmId(null)}
            >
              {t("template.cancel")}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
            >
              {t("template.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
