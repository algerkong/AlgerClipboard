import { useTranslation } from "react-i18next";
import { useSettingsStore } from "@/stores/settingsStore";
import type { RichTextPreviewOptions } from "@/lib/richText";
import { cn } from "@/lib/utils";
import {
  SettingsField,
  SettingsRow,
  SettingsSection,
  SettingsSelect,
  Toggle,
} from "./shared";

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
      <SettingsSection title={t("settings.richText.listTitle")}>
        <SettingsRow
          title={t("settings.richText.enableListPreview")}
          description={t("settings.richText.enableListPreviewDesc")}
          control={
            <Toggle
              value={richTextPreview.enabled}
              onChange={(value) => void setRichTextPreviewEnabled(value)}
            />
          }
        />

        <div className={cn(!richTextPreview.enabled && "opacity-55")}>
          {PREVIEW_OPTION_KEYS.map((key) => (
            <SettingsRow
              key={key}
              title={t(`settings.richText.previewOptions.${key}.label`)}
              description={t(`settings.richText.previewOptions.${key}.desc`)}
              control={
                <Toggle
                  value={richTextPreview[key]}
                  onChange={(value) => void setRichTextPreviewOption(key, value)}
                  size="sm"
                />
              }
            />
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title={t("settings.richText.detailTitle")}>
        <SettingsRow
          title={t("settings.richText.detailTitle")}
          description={t("settings.richText.detailDesc")}
          control={
            <SettingsField className="w-[15rem]">
              <SettingsSelect
                value={richTextDetailMode}
                onChange={(event) => void setRichTextDetailMode(event.target.value as "clean" | "full")}
              >
                {(["clean", "full"] as const).map((mode) => (
                  <option key={mode} value={mode}>
                    {t(`settings.richText.detailModes.${mode}.label`)}
                  </option>
                ))}
              </SettingsSelect>
            </SettingsField>
          }
        />
      </SettingsSection>
    </div>
  );
}
