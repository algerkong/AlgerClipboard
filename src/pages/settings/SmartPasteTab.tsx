import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowCounterClockwise,
  PencilSimple,
  Plus,
  Trash,
} from "@phosphor-icons/react";
import { useSmartPasteStore } from "@/stores/smartPasteStore";
import { StyledSelect } from "@/components/ui/styled-select";
import { toast } from "@/lib/toast";
import type {
  ContentType,
  SmartPasteRule,
  SmartPasteTargetFormat,
} from "@/types";
import {
  SettingsButton,
  SettingsInput,
  SettingsRow,
  SettingsSection,
  Toggle,
} from "./shared";

const SOURCE_OPTIONS = [
  { value: "*", labelKey: "settings.smartPaste.sourceAny" },
  { value: "PlainText", labelKey: "settings.smartPaste.sourcePlainText" },
  { value: "RichText", labelKey: "settings.smartPaste.sourceRichText" },
  { value: "Image", labelKey: "settings.smartPaste.sourceImage" },
  { value: "FilePaths", labelKey: "settings.smartPaste.sourceFilePaths" },
] as const;

const FORMAT_OPTIONS: {
  value: SmartPasteTargetFormat;
  labelKey: string;
}[] = [
  { value: "original", labelKey: "settings.smartPaste.formatOriginal" },
  { value: "plaintext", labelKey: "settings.smartPaste.formatPlainText" },
  { value: "markdown", labelKey: "settings.smartPaste.formatMarkdown" },
  { value: "html", labelKey: "settings.smartPaste.formatHtml" },
  { value: "file", labelKey: "settings.smartPaste.formatFile" },
];

interface RuleDraft {
  id: string | null;
  name: string;
  app_pattern: string;
  title_pattern: string;
  source_type: ContentType | "*";
  target_format: SmartPasteTargetFormat;
  enabled: boolean;
}

const EMPTY_DRAFT: RuleDraft = {
  id: null,
  name: "",
  app_pattern: "",
  title_pattern: "",
  source_type: "*",
  target_format: "original",
  enabled: true,
};

function builtinNameKey(id: string): string {
  return `settings.smartPaste.builtin.${id.replace(/^builtin-/, "").replace(/-/g, "_")}`;
}

export function SmartPasteTab() {
  const { t } = useTranslation();
  const config = useSmartPasteStore((s) => s.config);
  const loading = useSmartPasteStore((s) => s.loading);
  const loaded = useSmartPasteStore((s) => s.loaded);
  const load = useSmartPasteStore((s) => s.load);
  const setEnabled = useSmartPasteStore((s) => s.setEnabled);
  const upsertRule = useSmartPasteStore((s) => s.upsertRule);
  const deleteRule = useSmartPasteStore((s) => s.deleteRule);
  const reset = useSmartPasteStore((s) => s.reset);

  const [draft, setDraft] = useState<RuleDraft | null>(null);

  useEffect(() => {
    if (!loaded) {
      void load().catch(() => toast.error(t("settings.smartPaste.loadFailed")));
    }
  }, [loaded, load, t]);

  const formatLabel = (format: string): string => {
    const option = FORMAT_OPTIONS.find((item) => item.value === format);
    return option ? t(option.labelKey) : format;
  };

  const sourceLabel = (source: string): string => {
    const option = SOURCE_OPTIONS.find((item) => item.value === source);
    return option ? t(option.labelKey) : source;
  };

  const ruleName = (rule: SmartPasteRule): string =>
    rule.is_builtin
      ? t(builtinNameKey(rule.id), { defaultValue: rule.name })
      : rule.name;

  const handleToggle = async (rule: SmartPasteRule, enabled: boolean) => {
    try {
      await upsertRule({ ...rule, enabled });
    } catch {
      toast.error(t("settings.smartPaste.saveFailed"));
    }
  };

  const handleDelete = async (rule: SmartPasteRule) => {
    if (!window.confirm(t("settings.smartPaste.deleteConfirm"))) {
      return;
    }
    try {
      await deleteRule(rule.id);
      toast.success(t("settings.smartPaste.ruleDeleted"));
    } catch {
      toast.error(t("settings.smartPaste.saveFailed"));
    }
  };

  const handleReset = async () => {
    if (!window.confirm(t("settings.smartPaste.resetConfirm"))) {
      return;
    }
    try {
      await reset();
      setDraft(null);
      toast.success(t("settings.smartPaste.rulesReset"));
    } catch {
      toast.error(t("settings.smartPaste.saveFailed"));
    }
  };

  const openNewRule = () => {
    setDraft({ ...EMPTY_DRAFT });
  };

  const openEditRule = (rule: SmartPasteRule) => {
    setDraft({
      id: rule.id,
      name: rule.name,
      app_pattern: rule.app_pattern,
      title_pattern: rule.title_pattern ?? "",
      source_type: rule.source_type,
      target_format: rule.target_format,
      enabled: rule.enabled,
    });
  };

  const handleSaveDraft = async () => {
    if (!draft || !draft.app_pattern.trim()) {
      toast.error(t("settings.smartPaste.appPatternRequired"));
      return;
    }

    const rule: SmartPasteRule = {
      id: draft.id ?? `custom-${Date.now()}`,
      name:
        draft.name.trim() ||
        `${draft.app_pattern.trim()} → ${formatLabel(draft.target_format)}`,
      app_pattern: draft.app_pattern.trim(),
      title_pattern: draft.title_pattern.trim() || null,
      source_type: draft.source_type,
      target_format: draft.target_format,
      enabled: draft.enabled,
      is_builtin: false,
    };

    try {
      await upsertRule(rule);
      setDraft(null);
      toast.success(
        draft.id
          ? t("settings.smartPaste.ruleSaved")
          : t("settings.smartPaste.ruleAdded"),
      );
    } catch {
      toast.error(t("settings.smartPaste.saveFailed"));
    }
  };

  const builtinRules = config.rules.filter((rule) => rule.is_builtin);
  const customRules = config.rules.filter((rule) => !rule.is_builtin);

  return (
    <>
      <SettingsSection
        title={t("settings.smartPaste.title")}
        description={t("settings.smartPaste.desc")}
      >
        <SettingsRow
          title={t("settings.smartPaste.enable")}
          description={t("settings.smartPaste.enableDesc")}
          control={
            <Toggle
              value={config.enabled}
              onChange={(enabled) =>
                void setEnabled(enabled).catch(() =>
                  toast.error(t("settings.smartPaste.saveFailed")),
                )
              }
            />
          }
        />
      </SettingsSection>

      <SettingsSection
        title={t("settings.smartPaste.builtinRules")}
        description={t("settings.smartPaste.builtinRulesDesc")}
        aside={
          <SettingsButton
            onClick={handleReset}
            disabled={loading}
            className="flex items-center gap-1.5"
          >
            <ArrowCounterClockwise size={14} />
            {t("settings.smartPaste.reset")}
          </SettingsButton>
        }
      >
        {builtinRules.map((rule) => (
          <SettingsRow
            key={rule.id}
            title={ruleName(rule)}
            description={`${sourceLabel(rule.source_type)} → ${formatLabel(
              rule.target_format,
            )} · ${rule.app_pattern}`}
            control={
              <Toggle
                value={rule.enabled}
                onChange={(enabled) => void handleToggle(rule, enabled)}
              />
            }
          />
        ))}
      </SettingsSection>

      <SettingsSection
        title={t("settings.smartPaste.customRules")}
        description={t("settings.smartPaste.customRulesDesc")}
        aside={
          <SettingsButton
            tone="primary"
            onClick={openNewRule}
            disabled={draft !== null}
            className="flex items-center gap-1.5"
          >
            <Plus size={14} />
            {t("settings.smartPaste.addRule")}
          </SettingsButton>
        }
      >
        {customRules.length === 0 && !draft && (
          <div className="px-5 py-4 text-sm text-muted-foreground">
            {t("settings.smartPaste.noCustomRules")}
          </div>
        )}

        {customRules.map((rule) => (
          <SettingsRow
            key={rule.id}
            title={ruleName(rule)}
            description={`${sourceLabel(rule.source_type)} → ${formatLabel(
              rule.target_format,
            )} · ${rule.app_pattern}`}
            control={
              <div className="flex items-center gap-2">
                <Toggle
                  value={rule.enabled}
                  onChange={(enabled) => void handleToggle(rule, enabled)}
                />
                <button
                  type="button"
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title={t("settings.smartPaste.editRule")}
                  onClick={() => openEditRule(rule)}
                >
                  <PencilSimple size={15} />
                </button>
                <button
                  type="button"
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                  title={t("settings.smartPaste.delete")}
                  onClick={() => void handleDelete(rule)}
                >
                  <Trash size={15} />
                </button>
              </div>
            }
          />
        ))}

        {draft && (
          <div className="space-y-4 border-t border-border/60 px-5 py-4">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1.5 text-xs text-muted-foreground">
                <span>{t("settings.smartPaste.ruleName")}</span>
                <SettingsInput
                  className="w-full"
                  value={draft.name}
                  placeholder={t("settings.smartPaste.ruleNamePlaceholder")}
                  onChange={(e) =>
                    setDraft({ ...draft, name: e.target.value })
                  }
                />
              </label>

              <label className="space-y-1.5 text-xs text-muted-foreground">
                <span>{t("settings.smartPaste.appPattern")}</span>
                <SettingsInput
                  className="w-full"
                  value={draft.app_pattern}
                  placeholder={t("settings.smartPaste.appPatternPlaceholder")}
                  onChange={(e) =>
                    setDraft({ ...draft, app_pattern: e.target.value })
                  }
                />
              </label>

              <label className="space-y-1.5 text-xs text-muted-foreground">
                <span>{t("settings.smartPaste.titlePattern")}</span>
                <SettingsInput
                  className="w-full"
                  value={draft.title_pattern}
                  placeholder={t("settings.smartPaste.titlePatternPlaceholder")}
                  onChange={(e) =>
                    setDraft({ ...draft, title_pattern: e.target.value })
                  }
                />
              </label>

              <label className="space-y-1.5 text-xs text-muted-foreground">
                <span>{t("settings.smartPaste.sourceType")}</span>
                <StyledSelect
                  value={draft.source_type}
                  onChange={(value) =>
                    setDraft({
                      ...draft,
                      source_type: value as ContentType | "*",
                    })
                  }
                  options={SOURCE_OPTIONS.map((option) => ({
                    value: option.value,
                    label: t(option.labelKey),
                  }))}
                />
              </label>

              <label className="space-y-1.5 text-xs text-muted-foreground">
                <span>{t("settings.smartPaste.targetFormat")}</span>
                <StyledSelect
                  value={draft.target_format}
                  onChange={(value) =>
                    setDraft({
                      ...draft,
                      target_format: value as SmartPasteTargetFormat,
                    })
                  }
                  options={FORMAT_OPTIONS.map((option) => ({
                    value: option.value,
                    label: t(option.labelKey),
                  }))}
                />
              </label>
            </div>

            <p className="text-xs text-muted-foreground">
              {t("settings.smartPaste.appPatternDesc")}
            </p>

            <div className="flex justify-end gap-2">
              <SettingsButton onClick={() => setDraft(null)}>
                {t("settings.smartPaste.cancel")}
              </SettingsButton>
              <SettingsButton tone="primary" onClick={() => void handleSaveDraft()}>
                {t("settings.smartPaste.save")}
              </SettingsButton>
            </div>
          </div>
        )}
      </SettingsSection>
    </>
  );
}
