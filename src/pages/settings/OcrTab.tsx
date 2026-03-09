import { useEffect, useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Toggle, OCR_ENGINE_LIST } from "./shared";
import {
  getOcrEngines,
  configureOcrEngine,
  getDefaultOcrEngine,
  setDefaultOcrEngine,
  clearOcrCache,
  type OcrEngineConfig,
} from "@/services/ocrService";

type FieldKey = "apiKey" | "apiSecret" | "endpoint" | "model" | "command";

interface EngineForm {
  enabled: boolean;
  apiKey: string;
  apiSecret: string;
  endpoint: string;
  model: string;
  command: string;
}

const emptyForm = (): EngineForm => ({
  enabled: false,
  apiKey: "",
  apiSecret: "",
  endpoint: "",
  model: "",
  command: "",
});

/* ─── OCR Tab ─── */
export function OcrTab() {
  const { t } = useTranslation();

  const [engineForms, setEngineForms] = useState<Record<string, EngineForm>>({});
  const [defaultEngine, setDefaultEngine] = useState("");
  const [cacheCleared, setCacheCleared] = useState(false);
  const loadedRef = useRef(false);
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Load engine configs
  useEffect(() => {
    getOcrEngines()
      .then((configs) => {
        const forms: Record<string, EngineForm> = {};
        for (const eng of OCR_ENGINE_LIST) {
          const existing = configs.find((c) => c.engine_type === eng.id);
          forms[eng.id] = existing
            ? {
                enabled: existing.enabled,
                apiKey: existing.api_key,
                apiSecret: existing.api_secret,
                endpoint: existing.endpoint,
                model: existing.model,
                command: existing.command,
              }
            : emptyForm();
        }
        setEngineForms(forms);
        // Mark as loaded after state is set
        setTimeout(() => { loadedRef.current = true; }, 0);
      })
      .catch(() => {});

    getDefaultOcrEngine()
      .then(setDefaultEngine)
      .catch(() => {});
  }, []);

  const saveEngine = useCallback(async (engineId: string, form: EngineForm) => {
    const config: OcrEngineConfig = {
      engine_type: engineId,
      enabled: form.enabled,
      api_key: form.apiKey,
      api_secret: form.apiSecret,
      endpoint: form.endpoint,
      model: form.model,
      command: form.command,
      extra: "",
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
      // Auto-save: immediate for toggle, debounced for text
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

  return (
    <div className="space-y-3">
      {/* Default engine selector */}
      <div className="space-y-1">
        <label className="text-sm2 font-medium text-muted-foreground uppercase tracking-wider">
          {t("ocr.defaultEngine")}
        </label>
        <select
          value={defaultEngine}
          onChange={(e) => handleSetDefault(e.target.value)}
          className="w-full h-7 px-2 text-sm2 bg-background border border-border/50 rounded text-foreground focus:outline-none focus:ring-1 focus:ring-ring/30"
        >
          {OCR_ENGINE_LIST.map((eng) => (
            <option key={eng.id} value={eng.id}>
              {eng.label}
            </option>
          ))}
        </select>
      </div>

      {/* Engine configs */}
      <label className="text-sm2 font-medium text-muted-foreground uppercase tracking-wider">
        {t("ocr.engineConfig")}
      </label>
      {OCR_ENGINE_LIST.map((eng) => {
        const form = engineForms[eng.id];
        if (!form) return null;
        return (
          <div key={eng.id} className="bg-muted/20 rounded-md p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm2 font-medium text-foreground">
                {eng.label}
              </span>
              <Toggle
                value={form.enabled}
                onChange={(v) => updateField(eng.id, "enabled", v)}
                size="sm"
              />
            </div>
            {eng.fields.map((field) => (
              <input
                key={field}
                type={fieldType[field]}
                placeholder={fieldLabel[field]}
                value={form[field]}
                onChange={(e) => updateField(eng.id, field, e.target.value)}
                className="w-full h-6 px-2 text-sm2 bg-background border border-border/50 rounded text-foreground focus:outline-none focus:ring-1 focus:ring-ring/30"
              />
            ))}
            {eng.id === "local_model" && (
              <p className="text-xs2 text-muted-foreground">
                {t("ocr.localModelHint")}
              </p>
            )}
          </div>
        );
      })}

      {/* Clear OCR cache */}
      <div className="pt-1">
        <button
          onClick={handleClearCache}
          className="h-6 px-3 text-xs2 font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded transition-colors"
        >
          {cacheCleared ? t("ocr.cacheCleared") : t("ocr.clearCache")}
        </button>
      </div>
    </div>
  );
}
