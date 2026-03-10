import { useEffect, useState } from "react";
import { useTranslateStore } from "@/stores/translateStore";
import { useTranslation } from "react-i18next";
import {
  ENGINE_LIST,
  SettingsButton,
  SettingsField,
  SettingsInput,
  SettingsRow,
  SettingsSection,
  SettingsSubsection,
  Toggle,
} from "./shared";

export function TranslateTab() {
  const { t } = useTranslation();
  const engines = useTranslateStore((s) => s.engines);
  const loadEngines = useTranslateStore((s) => s.loadEngines);
  const saveEngine = useTranslateStore((s) => s.saveEngine);

  const [engineForms, setEngineForms] = useState<
    Record<string, { apiKey: string; apiSecret: string; enabled: boolean }>
  >({});
  const [savedEngine, setSavedEngine] = useState<string | null>(null);

  useEffect(() => {
    loadEngines();
  }, [loadEngines]);

  useEffect(() => {
    const forms: Record<string, { apiKey: string; apiSecret: string; enabled: boolean }> = {};
    for (const engine of ENGINE_LIST) {
      const existing = engines.find((item) => item.engine === engine.id);
      forms[engine.id] = {
        apiKey: existing?.api_key ?? "",
        apiSecret: existing?.api_secret ?? "",
        enabled: existing?.enabled ?? false,
      };
    }
    setEngineForms(forms);
  }, [engines]);

  const handleSaveEngine = async (engineId: string) => {
    const form = engineForms[engineId];
    if (!form) {
      return;
    }

    await saveEngine(engineId, form.apiKey, form.apiSecret, form.enabled);
    setSavedEngine(engineId);
    setTimeout(() => setSavedEngine(null), 1500);
  };

  return (
    <div className="space-y-5">
      <SettingsSection title={t("translate.engineConfig")}>
        {ENGINE_LIST.map((engine) => {
          const form = engineForms[engine.id];
          if (!form) {
            return null;
          }

          return (
            <SettingsSubsection key={engine.id} title={engine.label}>
              <SettingsRow
                title={t("translate.enabled")}
                control={
                  <Toggle
                    value={form.enabled}
                    onChange={(value) =>
                      setEngineForms((prev) => ({
                        ...prev,
                        [engine.id]: { ...prev[engine.id], enabled: value },
                      }))
                    }
                  />
                }
              />

              <SettingsRow
                title={t("translate.apiKey")}
                control={
                  <SettingsField className="w-[15rem]">
                    <SettingsInput
                      type="text"
                      placeholder={t("translate.apiKey")}
                      value={form.apiKey}
                      onChange={(event) =>
                        setEngineForms((prev) => ({
                          ...prev,
                          [engine.id]: { ...prev[engine.id], apiKey: event.target.value },
                        }))
                      }
                    />
                  </SettingsField>
                }
              />

              {engine.hasSecret ? (
                <SettingsRow
                  title={t("translate.apiSecret")}
                  control={
                    <SettingsField className="w-[15rem]">
                      <SettingsInput
                        type="password"
                        placeholder={t("translate.apiSecret")}
                        value={form.apiSecret}
                        onChange={(event) =>
                          setEngineForms((prev) => ({
                            ...prev,
                            [engine.id]: { ...prev[engine.id], apiSecret: event.target.value },
                          }))
                        }
                      />
                    </SettingsField>
                  }
                />
              ) : null}

              <div className="flex justify-end py-2">
                <SettingsButton onClick={() => handleSaveEngine(engine.id)}>
                  {savedEngine === engine.id ? t("translate.saved") : t("translate.save")}
                </SettingsButton>
              </div>
            </SettingsSubsection>
          );
        })}
      </SettingsSection>
    </div>
  );
}
