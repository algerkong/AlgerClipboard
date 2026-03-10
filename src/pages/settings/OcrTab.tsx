import { useEffect, useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { StyledSelect } from "@/components/ui/styled-select";
import {
  Toggle,
  getOcrEngineList,
  SettingsButton,
  SettingsField,
  SettingsInput,
  SettingsRow,
  SettingsSection,
  SettingsSubsection,
} from "./shared";
import {
  getOcrEngines,
  configureOcrEngine,
  getDefaultOcrEngine,
  setDefaultOcrEngine,
  clearOcrCache,
  getRapidOcrRuntimeStatus,
  installRapidOcrRuntime,
  removeRapidOcrRuntime,
  type OcrEngineConfig,
  type RapidOcrRuntimeStatus,
} from "@/services/ocrService";
import { usePlatform } from "@/contexts/PlatformContext";
import { Loader2, Trash2 } from "lucide-react";

type FieldKey = "apiKey" | "apiSecret" | "endpoint" | "model" | "command";

interface EngineForm {
  enabled: boolean;
  apiKey: string;
  apiSecret: string;
  endpoint: string;
  model: string;
  command: string;
  extra: string;
}

const emptyForm = (): EngineForm => ({
  enabled: false,
  apiKey: "",
  apiSecret: "",
  endpoint: "",
  model: "",
  command: "",
  extra: "",
});

/* ─── OCR Tab ─── */
export function OcrTab() {
  const { t } = useTranslation();
  const platform = usePlatform();
  const engineList = getOcrEngineList(platform);

  const [engineForms, setEngineForms] = useState<Record<string, EngineForm>>({});
  const [defaultEngine, setDefaultEngine] = useState("");
  const [cacheCleared, setCacheCleared] = useState(false);
  const [rapidStatus, setRapidStatus] = useState<RapidOcrRuntimeStatus | null>(null);
  const [rapidBusy, setRapidBusy] = useState(false);
  const [rapidActionError, setRapidActionError] = useState<string | null>(null);
  const loadedRef = useRef(false);
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    getOcrEngines()
      .then((configs) => {
        const forms: Record<string, EngineForm> = {};
        for (const eng of engineList) {
          const existing = configs.find((c) => c.engine_type === eng.id);
          forms[eng.id] = existing
            ? {
                enabled: existing.enabled,
                apiKey: existing.api_key,
                apiSecret: existing.api_secret,
                endpoint: existing.endpoint,
                model: existing.model,
                command: existing.command,
                extra: existing.extra,
              }
            : emptyForm();
        }
        setEngineForms(forms);
        setTimeout(() => { loadedRef.current = true; }, 0);
      })
      .catch(() => {});

    getDefaultOcrEngine()
      .then(setDefaultEngine)
      .catch(() => {});

    getRapidOcrRuntimeStatus()
      .then(setRapidStatus)
      .catch(() => {});
  }, [engineList]);

  const saveEngine = useCallback(async (engineId: string, form: EngineForm) => {
    const config: OcrEngineConfig = {
      engine_type: engineId,
      enabled: form.enabled,
      api_key: form.apiKey,
      api_secret: form.apiSecret,
      endpoint: form.endpoint,
      model: form.model,
      command: form.command,
      extra: form.extra,
    };
    await configureOcrEngine(config).catch(() => {});
  }, []);

  const debouncedSave = useCallback((engineId: string, form: EngineForm) => {
    if (!loadedRef.current) return;
    if (debounceTimers.current[engineId]) {
      clearTimeout(debounceTimers.current[engineId]);
    }
    debounceTimers.current[engineId] = setTimeout(() => {
      saveEngine(engineId, form);
    }, 500);
  }, [saveEngine]);

  const handleSetDefault = async (engineType: string) => {
    setDefaultEngine(engineType);
    await setDefaultOcrEngine(engineType).catch(() => {});
  };

  const updateField = (engineId: string, field: keyof EngineForm, value: string | boolean) => {
    setEngineForms((prev) => {
      const updated = { ...prev, [engineId]: { ...prev[engineId], [field]: value } };
      if (field === "enabled") {
        saveEngine(engineId, updated[engineId]);
      } else {
        debouncedSave(engineId, updated[engineId]);
      }
      return updated;
    });
  };

  const handleClearCache = async () => {
    await clearOcrCache().catch(() => {});
    setCacheCleared(true);
    setTimeout(() => setCacheCleared(false), 1500);
  };

  const fieldLabel: Record<FieldKey, string> = {
    apiKey: t("ocr.apiKey"),
    apiSecret: t("ocr.apiSecret"),
    endpoint: t("ocr.endpoint"),
    model: t("ocr.model"),
    command: t("ocr.command"),
  };

  const fieldType: Record<FieldKey, string> = {
    apiKey: "text",
    apiSecret: "password",
    endpoint: "text",
    model: "text",
    command: "text",
  };

  const refreshRapidStatus = useCallback(async () => {
    const status = await getRapidOcrRuntimeStatus().catch(() => null);
    if (status) setRapidStatus(status);
  }, []);

  const handleInstallRapidOcr = useCallback(async () => {
    setRapidBusy(true);
    setRapidActionError(null);
    try {
      const status = await installRapidOcrRuntime();
      setRapidStatus(status);
    } catch (error) {
      setRapidActionError(String(error));
      await refreshRapidStatus();
    } finally {
      setRapidBusy(false);
    }
  }, [refreshRapidStatus]);

  const handleRemoveRapidOcr = useCallback(async () => {
    setRapidBusy(true);
    setRapidActionError(null);
    try {
      const status = await removeRapidOcrRuntime();
      setRapidStatus(status);
    } catch (error) {
      setRapidActionError(String(error));
      await refreshRapidStatus();
    } finally {
      setRapidBusy(false);
    }
  }, [refreshRapidStatus]);

  return (
    <div className="space-y-5">
      {/* ─── Default Engine ─── */}
      <SettingsSection
        title={t("ocr.defaultEngine")}
        description={t("ocr.defaultEngine")}
      >
        <SettingsRow
          title={t("ocr.defaultEngine")}
          control={
            <StyledSelect
              value={defaultEngine}
              onChange={handleSetDefault}
              options={engineList.map((eng) => ({ value: eng.id, label: eng.label }))}
              className="w-[15rem]"
            />
          }
        />
      </SettingsSection>

      {/* ─── Engine Configuration ─── */}
      <SettingsSection
        title={t("ocr.engineConfig")}
        description={t("ocr.engineConfig")}
      >
        {engineList.map((eng) => {
          const form = engineForms[eng.id];
          if (!form) return null;
          const isRapid = eng.id === "rapidocr";
          const rapidInstalled = rapidStatus?.installed ?? false;
          const rapidSupported = rapidStatus?.supported ?? true;
          const rapidUnavailable = isRapid && (!rapidSupported || !rapidInstalled);

          return (
            <SettingsSubsection key={eng.id} title={eng.label}>
              <SettingsRow
                title={eng.label}
                control={
                  <Toggle
                    value={form.enabled}
                    onChange={(v) => updateField(eng.id, "enabled", v)}
                    size="sm"
                  />
                }
              />

              {/* RapidOCR specific */}
              {isRapid && (
                <div className="space-y-3 py-2">
                  <p className="text-xs text-muted-foreground">
                    {rapidSupported
                      ? rapidInstalled
                        ? t("ocr.rapidInstalled", { version: rapidStatus?.version ?? "unknown" })
                        : t("ocr.rapidNotInstalled")
                      : t("ocr.rapidUnsupported")}
                  </p>

                  <div>
                    <textarea
                      value={form.extra}
                      onChange={(e) => updateField(eng.id, "extra", e.target.value)}
                      placeholder={t("ocr.rapidSourcesPlaceholder")}
                      rows={3}
                      className="settings-textarea"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("ocr.rapidSourcesHint")}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <SettingsButton
                      tone="primary"
                      onClick={handleInstallRapidOcr}
                      disabled={rapidBusy || !rapidSupported}
                    >
                      {rapidBusy && <Loader2 className="h-3 w-3 animate-spin" />}
                      {rapidBusy ? t("ocr.rapidInstalling") : rapidInstalled ? t("ocr.rapidRepair") : t("ocr.rapidInstall")}
                    </SettingsButton>
                    {rapidInstalled && (
                      <SettingsButton
                        tone="danger"
                        onClick={handleRemoveRapidOcr}
                        disabled={rapidBusy}
                      >
                        {t("ocr.rapidRemove")}
                      </SettingsButton>
                    )}
                  </div>

                  {rapidStatus?.configured_urls?.length ? (
                    <p className="text-xs text-muted-foreground break-all">
                      {t("ocr.rapidUsingSources")}: {rapidStatus.configured_urls.join(" , ")}
                    </p>
                  ) : null}

                  {(rapidActionError || rapidStatus?.last_error) && (
                    <p className="text-xs text-destructive break-words">
                      {rapidActionError ?? rapidStatus?.last_error}
                    </p>
                  )}
                </div>
              )}

              {/* Field inputs */}
              {eng.fields.length > 0 && (
                <div className="space-y-1">
                  {eng.fields.map((field) => (
                    <SettingsRow
                      key={field}
                      title={fieldLabel[field]}
                      control={
                        <SettingsField className="w-[15rem]">
                          <SettingsInput
                            type={fieldType[field]}
                            placeholder={fieldLabel[field]}
                            value={form[field]}
                            onChange={(e) => updateField(eng.id, field, e.target.value)}
                          />
                        </SettingsField>
                      }
                    />
                  ))}
                </div>
              )}

              {rapidUnavailable && (
                <p className="px-1 py-2 text-xs text-amber-400">
                  {t("ocr.rapidInstallRequired")}
                </p>
              )}

              {eng.id === "local_model" && (
                <p className="px-1 py-2 text-xs text-muted-foreground">
                  {t("ocr.localModelHint")}
                </p>
              )}
            </SettingsSubsection>
          );
        })}
      </SettingsSection>

      {/* ─── Cache ─── */}
      <SettingsSection
        title={t("ocr.clearCache")}
        description={t("ocr.clearCache")}
      >
        <div className="px-5 py-4">
          <SettingsButton
            tone="danger"
            onClick={handleClearCache}
          >
            <Trash2 className="h-3 w-3" />
            {cacheCleared ? t("ocr.cacheCleared") : t("ocr.clearCache")}
          </SettingsButton>
        </div>
      </SettingsSection>
    </div>
  );
}
