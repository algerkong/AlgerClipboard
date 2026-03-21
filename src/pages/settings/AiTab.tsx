import { useEffect, useState } from "react";
import {
  ArrowsClockwise,
  Check,
  SpinnerGap,
  Eye,
  EyeSlash,
} from "@phosphor-icons/react";
import { useAiStore, DEFAULT_SUMMARY_PROMPT, DEFAULT_TRANSLATE_PROMPT } from "@/stores/aiStore";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { StyledSelect } from "@/components/ui/styled-select";
import {
  SettingsButton,
  SettingsField,
  SettingsInput,
  SettingsRow,
  SettingsSection,
  SettingsSubsection,
  Toggle,
} from "./shared";

/* ─── AI Tab ─── */
export function AiTab() {
  const { t } = useTranslation();
  const {
    providers,
    config,
    models,
    isFetchingModels,
    fetchModelsError,
    isTesting,
    testResult,
    loadProviders,
    loadConfig,
    loadModels,
    updateConfig,
    testConnection,
  } = useAiStore();
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    loadProviders();
    loadConfig();
  }, [loadProviders, loadConfig]);

  useEffect(() => {
    if (config.provider && (config.api_key || config.provider === "ollama")) {
      loadModels();
    }
  }, [config.provider, config.api_key, config.base_url, loadModels]);

  const selectedProvider = providers.find((p) => p.id === config.provider);
  const groupedProviders = {
    international: providers.filter((p) => p.category === "international"),
    domestic: providers.filter((p) => p.category === "domestic"),
    local: providers.filter((p) => p.category === "local"),
    custom: providers.filter((p) => p.category === "custom"),
  };

  return (
    <div className="space-y-5">
      {/* ─── Provider Configuration ─── */}
      <SettingsSection
        title={t("settings.ai.provider")}
        description={t("settings.ai.selectProvider")}
      >
        <SettingsRow
          title={t("settings.ai.enable")}
          description={t("settings.ai.enable")}
          control={
            <Toggle
              value={config.enabled}
              onChange={(v) => updateConfig({ enabled: v })}
            />
          }
        />

        <SettingsRow
          title={t("settings.ai.provider")}
          control={
            <StyledSelect
              value={config.provider}
              onChange={(v) => {
                const preset = providers.find((p) => p.id === v);
                updateConfig({
                  provider: v,
                  model: preset?.default_model || "",
                  base_url: preset?.base_url || "",
                });
              }}
              placeholder={t("settings.ai.selectProvider")}
              options={[
                ...groupedProviders.international.map((p) => ({ value: p.id, label: p.name, group: t("settings.ai.international") })),
                ...groupedProviders.domestic.map((p) => ({ value: p.id, label: p.name, group: t("settings.ai.domestic") })),
                ...groupedProviders.local.map((p) => ({ value: p.id, label: p.name, group: t("settings.ai.local") })),
                ...groupedProviders.custom.map((p) => ({ value: p.id, label: p.name, group: t("settings.ai.custom") })),
              ]}
              className="w-[15rem]"
            />
          }
        />

        <SettingsRow
          title={t("settings.ai.apiKey")}
          description={t("settings.ai.apiKeyPlaceholder")}
          control={
            <SettingsField className="w-[15rem]">
              <div className="relative flex items-center">
                <SettingsInput
                  type={showApiKey ? "text" : "password"}
                  value={config.api_key}
                  onChange={(e) => updateConfig({ api_key: e.target.value })}
                  placeholder={t("settings.ai.apiKeyPlaceholder")}
                  className="pr-8"
                />
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-0 flex h-full items-center px-2 text-muted-foreground hover:text-foreground"
                >
                  {showApiKey ? (
                    <EyeSlash size={14} />
                  ) : (
                    <Eye size={14} />
                  )}
                </button>
              </div>
            </SettingsField>
          }
        />

        {config.provider && (
          <SettingsRow
            title={t("settings.ai.model")}
            control={
              <div className="flex items-center gap-2">
                <div className="w-[15rem]">
                  {models.length > 0 && !fetchModelsError ? (
                    <StyledSelect
                      value={config.model}
                      onChange={(v) => updateConfig({ model: v })}
                      options={[
                        ...(!models.find((m) => m.id === config.model) && config.model
                          ? [{ value: config.model, label: config.model }]
                          : []),
                        ...models.map((m) => ({ value: m.id, label: m.name || m.id })),
                      ]}
                      className="w-full"
                    />
                  ) : (
                    <SettingsInput
                      type="text"
                      value={config.model}
                      onChange={(e) => updateConfig({ model: e.target.value })}
                      placeholder={selectedProvider?.default_model || "model-name"}
                    />
                  )}
                </div>
                {config.provider && (config.api_key || config.provider === "ollama") && (
                  <button
                    onClick={() => loadModels()}
                    disabled={isFetchingModels}
                    className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <ArrowsClockwise className={cn("h-3 w-3", isFetchingModels && "animate-spin")} />
                  </button>
                )}
              </div>
            }
          />
        )}

        {config.provider && (
          <SettingsRow
            title={t("settings.ai.baseUrl")}
            control={
              <SettingsField className="w-[15rem]">
                <SettingsInput
                  type="text"
                  value={config.base_url}
                  onChange={(e) => updateConfig({ base_url: e.target.value })}
                  placeholder={selectedProvider?.base_url || "https://api.example.com/v1"}
                />
              </SettingsField>
            }
          />
        )}

        <div className="flex items-center gap-3 px-5 py-3">
          <SettingsButton
            tone="primary"
            onClick={() => testConnection()}
            disabled={isTesting || !config.provider || !config.api_key}
          >
            {isTesting ? (
              <SpinnerGap size={12} className="animate-spin" />
            ) : (
              <Check size={12} />
            )}
            {t("settings.ai.testConnection")}
          </SettingsButton>
          {testResult && (
            <span
              className={cn(
                "text-sm",
                testResult.startsWith("Error") ? "text-destructive" : "text-green-500",
              )}
            >
              {testResult.length > 60 ? testResult.substring(0, 60) + "..." : testResult}
            </span>
          )}
        </div>
      </SettingsSection>

      {/* ─── Summary Settings ─── */}
      <SettingsSection
        title={t("settings.ai.autoSummary")}
        description={t("settings.ai.autoSummaryDesc")}
      >
        <SettingsRow
          title={t("settings.ai.autoSummary")}
          description={t("settings.ai.autoSummaryDesc")}
          control={
            <Toggle
              value={config.auto_summary}
              onChange={(v) => updateConfig({ auto_summary: v })}
            />
          }
        />

        <SettingsRow
          title={t("settings.ai.summaryMinLength")}
          description={t("settings.ai.summaryMinLengthDesc")}
          control={
            <SettingsField className="w-[8rem]">
              <SettingsInput
                type="number"
                min={50}
                max={10000}
                step={50}
                value={config.summary_min_length}
                onChange={(e) =>
                  updateConfig({ summary_min_length: Math.max(50, parseInt(e.target.value) || 200) })
                }
              />
            </SettingsField>
          }
        />

        <SettingsRow
          title={t("settings.ai.summaryMaxLength")}
          description={t("settings.ai.summaryMaxLengthDesc")}
          control={
            <SettingsField className="w-[8rem]">
              <SettingsInput
                type="number"
                min={20}
                max={1000}
                step={10}
                value={config.summary_max_length}
                onChange={(e) =>
                  updateConfig({ summary_max_length: Math.max(20, parseInt(e.target.value) || 100) })
                }
              />
            </SettingsField>
          }
        />

        <SettingsRow
          title={t("settings.ai.summaryLanguage")}
          control={
            <StyledSelect
              value={config.summary_language}
              onChange={(v) => updateConfig({ summary_language: v })}
              options={[
                { value: "same", label: t("settings.ai.summaryLangSame") },
                { value: "zh-CN", label: t("settings.ai.summaryLangZh") },
                { value: "en", label: t("settings.ai.summaryLangEn") },
              ]}
              className="w-[15rem]"
            />
          }
        />
      </SettingsSection>

      {/* ─── Prompt Settings ─── */}
      <SettingsSection
        title={t("settings.ai.prompts")}
        description={t("settings.ai.summaryPromptVars")}
      >
        <SettingsSubsection
          title={t("settings.ai.summaryPrompt")}
          description={t("settings.ai.summaryPromptVars")}
        >
          <div className="space-y-2 py-2">
            <textarea
              value={config.summary_prompt}
              onChange={(e) => updateConfig({ summary_prompt: e.target.value })}
              rows={3}
              className="settings-textarea"
            />
            <div className="flex justify-end">
              <SettingsButton
                tone="ghost"
                onClick={() => updateConfig({ summary_prompt: DEFAULT_SUMMARY_PROMPT })}
              >
                {t("settings.ai.resetPrompt")}
              </SettingsButton>
            </div>
          </div>
        </SettingsSubsection>

        <SettingsSubsection
          title={t("settings.ai.translatePrompt")}
          description={t("settings.ai.translatePromptVars")}
        >
          <div className="space-y-2 py-2">
            <textarea
              value={config.translate_prompt}
              onChange={(e) => updateConfig({ translate_prompt: e.target.value })}
              rows={3}
              className="settings-textarea"
            />
            <div className="flex justify-end">
              <SettingsButton
                tone="ghost"
                onClick={() => updateConfig({ translate_prompt: DEFAULT_TRANSLATE_PROMPT })}
              >
                {t("settings.ai.resetPrompt")}
              </SettingsButton>
            </div>
          </div>
        </SettingsSubsection>
      </SettingsSection>
    </div>
  );
}
