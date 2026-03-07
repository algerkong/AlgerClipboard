import { useTranslation } from "react-i18next";
import { useSettingsStore } from "@/stores/settingsStore";
import type { RichTextPreviewOptions } from "@/lib/richText";
import { cn } from "@/lib/utils";
import { Toggle } from "./shared";

const PREVIEW_OPTION_KEYS: Exclude<keyof RichTextPreviewOptions, "enabled">[] = [
  "preserveBold",
  "preserveItalic",
  "preserveDecoration",
  "preserveLinks",
  "preserveLists",
  "preserveCode",
  "preserveBlockquotes",
  "preserveFontSize",
  "preserveTextColor",
  "preserveBackground",
  "preserveFontFamily",
  "preserveTables",
  "preserveImages",
  "preserveLayout",
];

export function RichTextTab() {
  const { t } = useTranslation();
  const richTextPreview = useSettingsStore((s) => s.richTextPreview);
  const richTextDetailMode = useSettingsStore((s) => s.richTextDetailMode);
  const setRichTextPreviewEnabled = useSettingsStore((s) => s.setRichTextPreviewEnabled);
  const setRichTextPreviewOption = useSettingsStore((s) => s.setRichTextPreviewOption);
  const setRichTextDetailMode = useSettingsStore((s) => s.setRichTextDetailMode);

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <div>
          <label className="text-sm2 font-medium text-muted-foreground uppercase tracking-wider">
            {t("settings.richText.listTitle")}
          </label>
          <p className="mt-1 text-xs2 text-muted-foreground/70">
            {t("settings.richText.listDesc")}
          </p>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
          <div>
            <div className="text-sm2 font-medium text-foreground">
              {t("settings.richText.enableListPreview")}
            </div>
            <div className="mt-0.5 text-xs2 text-muted-foreground/70">
              {t("settings.richText.enableListPreviewDesc")}
            </div>
          </div>
          <Toggle
            value={richTextPreview.enabled}
            onChange={(value) => void setRichTextPreviewEnabled(value)}
          />
        </div>

        <div
          className={cn(
            "space-y-2 rounded-xl border border-border/50 p-3",
            !richTextPreview.enabled && "opacity-55",
          )}
        >
          {PREVIEW_OPTION_KEYS.map((key) => (
            <div
              key={key}
              className="flex items-start justify-between gap-3 rounded-lg bg-muted/20 px-3 py-2"
            >
              <div className="min-w-0">
                <div className="text-sm2 font-medium text-foreground">
                  {t(`settings.richText.previewOptions.${key}.label`)}
                </div>
                <div className="mt-0.5 text-xs2 leading-relaxed text-muted-foreground/70">
                  {t(`settings.richText.previewOptions.${key}.desc`)}
                </div>
              </div>
              <Toggle
                value={richTextPreview[key]}
                onChange={(value) => void setRichTextPreviewOption(key, value)}
                size="sm"
              />
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <label className="text-sm2 font-medium text-muted-foreground uppercase tracking-wider">
            {t("settings.richText.detailTitle")}
          </label>
          <p className="mt-1 text-xs2 text-muted-foreground/70">
            {t("settings.richText.detailDesc")}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {(["clean", "full"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => void setRichTextDetailMode(mode)}
              className={cn(
                "rounded-lg border px-3 py-2 text-left transition-colors",
                richTextDetailMode === mode
                  ? "border-primary/40 bg-primary/12 text-primary"
                  : "border-border/50 bg-muted/20 text-foreground hover:bg-muted/30",
              )}
            >
              <div className="text-sm2 font-medium">
                {t(`settings.richText.detailModes.${mode}.label`)}
              </div>
              <div className="mt-1 text-xs2 leading-relaxed text-muted-foreground">
                {t(`settings.richText.detailModes.${mode}.desc`)}
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
