import { useEffect, useRef, useState } from "react";
import { FileText, Copy } from "lucide-react";
import { useTemplateStore } from "@/stores/templateStore";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

interface Props {
  onClose: () => void;
}

export function TemplateQuickPicker({ onClose }: Props) {
  const { t } = useTranslation();
  const templates = useTemplateStore((s) => s.templates);
  const fetchTemplates = useTemplateStore((s) => s.fetchTemplates);
  const applyTemplate = useTemplateStore((s) => s.applyTemplate);
  const ref = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTemplates().then(() => setLoading(false));
  }, [fetchTemplates]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const handleApply = async (id: string) => {
    try {
      const result = await applyTemplate(id);
      await navigator.clipboard.writeText(result);
      toast.success(t("template.applied"));
      onClose();
    } catch {
      toast.error(t("template.applyFailed"));
    }
  };

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-1 z-50 w-56 max-h-60 overflow-y-auto bg-popover border border-border rounded-lg shadow-lg animate-fade-in"
    >
      {loading ? (
        <div className="px-3 py-4 text-xs text-muted-foreground text-center">
          {t("template.loading")}
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center gap-1 px-3 py-4 text-muted-foreground">
          <FileText className="w-5 h-5" />
          <p className="text-sm2">{t("template.noTemplates")}</p>
        </div>
      ) : (
        <div className="py-1">
          {templates.map((tmpl) => (
            <button
              key={tmpl.id}
              onClick={() => handleApply(tmpl.id)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-accent/50 transition-colors"
            >
              <Copy className="w-3 h-3 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm2 font-medium text-foreground truncate">
                  {tmpl.title}
                </div>
                <div className="text-2xs text-muted-foreground truncate">
                  {tmpl.content.length > 40 ? tmpl.content.substring(0, 40) + "\u2026" : tmpl.content}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
