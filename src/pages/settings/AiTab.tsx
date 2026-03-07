import { useEffect, useState } from "react";
import {
  RefreshCw,
  Check,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
import { useAiStore } from "@/stores/aiStore";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { Toggle } from "./shared";

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

  // Auto-fetch models when provider + api_key + base_url are ready
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
    <div className="space-y-4">
      {/* Enable AI */}
      <div className="flex items-center justify-between">
        <span className="text-sm2">{t("settings.ai.enable")}</span>
        <button
          onClick={() => updateConfig({ enabled: !config.enabled })}
          className={cn(
            "w-9 h-5 rounded-full transition-colors relative",
            config.enabled ? "bg-primary" : "bg-muted"
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform",
              config.enabled ? "left-[18px]" : "left-0.5"
            )}
          />
        </button>
      </div>

      {/* Provider */}
      <div className="space-y-1.5">
        <label className="text-sm2 text-muted-foreground">
          {t("settings.ai.provider")}
        </label>
        <select
          value={config.provider}
          onChange={(e) => {
            const preset = providers.find((p) => p.id === e.target.value);
            updateConfig({
              provider: e.target.value,
              model: preset?.default_model || "",
              base_url: preset?.base_url || "",
            });
          }}
          className="w-full h-8 px-2 rounded-md border border-border bg-background text-sm2"
        >
          <option value="">{t("settings.ai.selectProvider")}</option>
          {groupedProviders.international.length > 0 && (
            <optgroup label={t("settings.ai.international")}>
              {groupedProviders.international.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </optgroup>
          )}
          {groupedProviders.domestic.length > 0 && (
            <optgroup label={t("settings.ai.domestic")}>
              {groupedProviders.domestic.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </optgroup>
          )}
          {groupedProviders.local.length > 0 && (
            <optgroup label={t("settings.ai.local")}>
              {groupedProviders.local.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </optgroup>
          )}
          {groupedProviders.custom.length > 0 && (
            <optgroup label={t("settings.ai.custom")}>
              {groupedProviders.custom.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      {/* API Key */}
      <div className="space-y-1.5">
        <label className="text-sm2 text-muted-foreground">
          {t("settings.ai.apiKey")}
        </label>
        <div className="relative">
          <input
            type={showApiKey ? "text" : "password"}
            value={config.api_key}
            onChange={(e) => updateConfig({ api_key: e.target.value })}
            placeholder={t("settings.ai.apiKeyPlaceholder")}
            className="w-full h-8 px-2 pr-8 rounded-md border border-border bg-background text-sm2"
          />
          <button
            onClick={() => setShowApiKey(!showApiKey)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showApiKey ? (
              <EyeOff className="w-3.5 h-3.5" />
            ) : (
              <Eye className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Model */}
      {config.provider && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-sm2 text-muted-foreground">
              {t("settings.ai.model")}
            </label>
            {config.provider && (config.api_key || config.provider === "ollama") && (
              <button
                onClick={() => loadModels()}
                disabled={isFetchingModels}
                className="flex items-center gap-1 text-xs2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <RefreshCw className={cn("w-3 h-3", isFetchingModels && "animate-spin")} />
                {t("settings.ai.fetchModels")}
              </button>
            )}
          </div>
          {models.length > 0 && !fetchModelsError ? (
            <select
              value={config.model}
              onChange={(e) => updateConfig({ model: e.target.value })}
              className="w-full h-8 px-2 rounded-md border border-border bg-background text-sm2"
            >
              {!models.find((m) => m.id === config.model) && config.model && (
                <option value={config.model}>{config.model}</option>
              )}
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name || m.id}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={config.model}
              onChange={(e) => updateConfig({ model: e.target.value })}
              placeholder={selectedProvider?.default_model || "model-name"}
              className="w-full h-8 px-2 rounded-md border border-border bg-background text-sm2"
            />
          )}
          {fetchModelsError && (
            <p className="text-xs2 text-muted-foreground">
              {t("settings.ai.fetchModelsFailed")}
            </p>
          )}
        </div>
      )}

      {/* Base URL */}
      {config.provider && (
        <div className="space-y-1.5">
          <label className="text-sm2 text-muted-foreground">
            {t("settings.ai.baseUrl")}
          </label>
          <input
            type="text"
            value={config.base_url}
            onChange={(e) => updateConfig({ base_url: e.target.value })}
            placeholder={
              selectedProvider?.base_url || "https://api.example.com/v1"
            }
            className="w-full h-8 px-2 rounded-md border border-border bg-background text-sm2"
          />
        </div>
      )}

      {/* Test Connection */}
      <div className="space-y-2">
        <button
          onClick={() => testConnection()}
          disabled={isTesting || !config.provider || !config.api_key}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm2 font-medium transition-colors",
            "bg-primary text-primary-foreground hover:bg-primary/90",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          {isTesting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Check className="w-3.5 h-3.5" />
          )}
          {t("settings.ai.testConnection")}
        </button>
        {testResult && (
          <div
            className={cn(
              "text-sm2 p-2 rounded-md",
              testResult.startsWith("Error")
                ? "bg-destructive/10 text-destructive"
                : "bg-green-500/10 text-green-500"
            )}
          >
            {testResult.length > 100
              ? testResult.substring(0, 100) + "..."
              : testResult}
          </div>
        )}
      </div>

      {/* ─── Summary Settings ─── */}
      <div className="border-t border-border/30 pt-4 space-y-3">
        {/* Auto Summary toggle */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm2">{t("settings.ai.autoSummary")}</span>
            <p className="text-xs2 text-muted-foreground mt-0.5">
              {t("settings.ai.autoSummaryDesc")}
            </p>
          </div>
          <Toggle
            value={config.auto_summary}
            onChange={(v) => updateConfig({ auto_summary: v })}
          />
        </div>

        {/* Min length */}
        <div className="space-y-1.5">
          <label className="text-sm2 text-muted-foreground">
            {t("settings.ai.summaryMinLength")}
          </label>
          <p className="text-xs2 text-muted-foreground/70">
            {t("settings.ai.summaryMinLengthDesc")}
          </p>
          <input
            type="number"
            min={50}
            max={10000}
            step={50}
            value={config.summary_min_length}
            onChange={(e) =>
              updateConfig({ summary_min_length: Math.max(50, parseInt(e.target.value) || 200) })
            }
            className="w-full h-8 px-2 rounded-md border border-border bg-background text-sm2"
          />
        </div>

        {/* Max summary length */}
        <div className="space-y-1.5">
          <label className="text-sm2 text-muted-foreground">
            {t("settings.ai.summaryMaxLength")}
          </label>
          <p className="text-xs2 text-muted-foreground/70">
            {t("settings.ai.summaryMaxLengthDesc")}
          </p>
          <input
            type="number"
            min={20}
            max={1000}
            step={10}
            value={config.summary_max_length}
            onChange={(e) =>
              updateConfig({ summary_max_length: Math.max(20, parseInt(e.target.value) || 100) })
            }
            className="w-full h-8 px-2 rounded-md border border-border bg-background text-sm2"
          />
        </div>

        {/* Summary language */}
        <div className="space-y-1.5">
          <label className="text-sm2 text-muted-foreground">
            {t("settings.ai.summaryLanguage")}
          </label>
          <select
            value={config.summary_language}
            onChange={(e) => updateConfig({ summary_language: e.target.value })}
            className="w-full h-8 px-2 rounded-md border border-border bg-background text-sm2"
          >
            <option value="same">{t("settings.ai.summaryLangSame")}</option>
            <option value="zh-CN">{t("settings.ai.summaryLangZh")}</option>
            <option value="en">{t("settings.ai.summaryLangEn")}</option>
          </select>
        </div>
      </div>
    </div>
  );
}
