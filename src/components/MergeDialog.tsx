import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "@/lib/toast";
import type { ClipboardEntry } from "@/types";

type SeparatorType = "newline" | "doubleNewline" | "none" | "custom";

interface Props {
  entries: ClipboardEntry[];
  onClose: () => void;
}

export function MergeDialog({ entries, onClose }: Props) {
  const { t } = useTranslation();
  const [separatorType, setSeparatorType] = useState<SeparatorType>("newline");
  const [customSeparator, setCustomSeparator] = useState(", ");

  const textEntries = useMemo(
    () => entries.filter(e =>
      (e.content_type === "PlainText" || e.content_type === "RichText") && e.text_content
    ),
    [entries]
  );

  const separator = useMemo(() => {
    switch (separatorType) {
      case "newline": return "\n";
      case "doubleNewline": return "\n\n";
      case "none": return "";
      case "custom": return customSeparator;
    }
  }, [separatorType, customSeparator]);

  const mergedText = useMemo(
    () => textEntries.map(e => e.text_content!).join(separator),
    [textEntries, separator]
  );

  const handlePaste = async () => {
    try {
      await invoke("paste_text_direct", { text: mergedText });
      toast.success(t("toast.pasted"));
    } catch {
      toast.error(t("toast.pasteFailed"));
    }
    onClose();
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(mergedText);
    toast.success(t("toast.copied"));
    onClose();
  };

  const separatorOptions: { type: SeparatorType; labelKey: string }[] = [
    { type: "newline", labelKey: "merge.separatorNewline" },
    { type: "doubleNewline", labelKey: "merge.separatorDoubleNewline" },
    { type: "none", labelKey: "merge.separatorNone" },
    { type: "custom", labelKey: "merge.separatorCustom" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-[400px] max-h-[80vh] rounded-lg bg-popover border border-border shadow-lg flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-border">
          <h3 className="font-medium">{t("merge.title")}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("merge.itemCount", { count: textEntries.length })}
          </p>
        </div>

        <div className="px-4 py-2 border-b border-border space-y-2">
          <label className="text-xs font-medium text-muted-foreground">{t("merge.separator")}</label>
          <div className="flex flex-wrap gap-1.5">
            {separatorOptions.map(({ type, labelKey }) => (
              <button
                key={type}
                className={`px-2 py-1 text-xs rounded-md border transition-colors ${
                  separatorType === type
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border hover:bg-muted"
                }`}
                onClick={() => setSeparatorType(type)}
              >
                {t(labelKey)}
              </button>
            ))}
          </div>
          {separatorType === "custom" && (
            <input
              className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
              placeholder={t("merge.customSeparator")}
              value={customSeparator}
              onChange={e => setCustomSeparator(e.target.value)}
            />
          )}
        </div>

        <div className="flex-1 min-h-0 px-4 py-2 overflow-hidden">
          <label className="text-xs font-medium text-muted-foreground">{t("merge.preview")}</label>
          <pre className="mt-1 max-h-[200px] overflow-auto rounded-md bg-muted p-2 text-xs whitespace-pre-wrap break-all">
            {mergedText}
          </pre>
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-border">
          <button
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
            onClick={handleCopy}
          >
            {t("merge.copy")}
          </button>
          <button
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
            onClick={handlePaste}
          >
            {t("merge.paste")}
          </button>
        </div>
      </div>
    </div>
  );
}
