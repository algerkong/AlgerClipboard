import { useEffect, useState } from "react";
import { useTranslateStore } from "@/stores/translateStore";
import { useTranslation } from "react-i18next";
import { Toggle, ENGINE_LIST } from "./shared";

/* ─── Translate Tab ─── */
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
    const forms: Record<
      string,
      { apiKey: string; apiSecret: string; enabled: boolean }
    > = {};
    for (const eng of ENGINE_LIST) {
      const existing = engines.find((e) => e.engine === eng.id);
      forms[eng.id] = {
        apiKey: existing?.api_key ?? "",
        apiSecret: existing?.api_secret ?? "",
        enabled: existing?.enabled ?? false,
      };
    }
    setEngineForms(forms);
  }, [engines]);

  const handleSaveEngine = async (engineId: string) => {
    const form = engineForms[engineId];
    if (!form) return;
    await saveEngine(engineId, form.apiKey, form.apiSecret, form.enabled);
    setSavedEngine(engineId);
    setTimeout(() => setSavedEngine(null), 1500);
  };

  return (
    <div className="space-y-3">
      <label className="text-sm2 font-medium text-muted-foreground uppercase tracking-wider">
        {t("translate.engineConfig")}
      </label>
      {ENGINE_LIST.map((eng) => {
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
                onChange={(v) =>
                  setEngineForms((prev) => ({
                    ...prev,
                    [eng.id]: { ...prev[eng.id], enabled: v },
                  }))
                }
                size="sm"
              />
            </div>
            <input
              type="text"
              placeholder={t("translate.apiKey")}
              value={form.apiKey}
              onChange={(e) =>
                setEngineForms((prev) => ({
                  ...prev,
                  [eng.id]: { ...prev[eng.id], apiKey: e.target.value },
                }))
              }
              className="w-full h-6 px-2 text-sm2 bg-background border border-border/50 rounded text-foreground focus:outline-none focus:ring-1 focus:ring-ring/30"
            />
            {eng.hasSecret && (
              <input
                type="password"
                placeholder={t("translate.apiSecret")}
                value={form.apiSecret}
                onChange={(e) =>
                  setEngineForms((prev) => ({
                    ...prev,
                    [eng.id]: { ...prev[eng.id], apiSecret: e.target.value },
                  }))
                }
                className="w-full h-6 px-2 text-sm2 bg-background border border-border/50 rounded text-foreground focus:outline-none focus:ring-1 focus:ring-ring/30"
              />
            )}
            <button
              onClick={() => handleSaveEngine(eng.id)}
              className="h-6 px-3 text-xs2 font-medium bg-primary/15 text-primary hover:bg-primary/25 rounded transition-colors"
            >
              {savedEngine === eng.id
                ? t("translate.saved")
                : t("translate.save")}
            </button>
          </div>
        );
      })}
    </div>
  );
}
