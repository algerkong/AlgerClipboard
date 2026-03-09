import { useTranslation } from "react-i18next";

interface CloseConfirmDialogProps {
  shortcutKey: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function CloseConfirmDialog({ shortcutKey, onConfirm, onCancel }: CloseConfirmDialogProps) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-xl">
        <p className="text-sm font-medium text-foreground">
          {t("preview.closeConfirmTitle", { key: shortcutKey })}
        </p>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {t("preview.closeConfirmDesc")}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent"
          >
            {t("preview.closeConfirmNo")}
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("preview.closeConfirmYes")}
          </button>
        </div>
      </div>
    </div>
  );
}
