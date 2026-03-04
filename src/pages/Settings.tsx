import { useEffect, useState } from "react";
import { ArrowLeft, Sun, Moon, Monitor, Download, Upload, Trash2 } from "lucide-react";
import { useSettingsStore } from "@/stores/settingsStore";
import { useTranslateStore } from "@/stores/translateStore";
import { useClipboardStore } from "@/stores/clipboardStore";
import { exportData, importData, clearHistory } from "@/services/clipboardService";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

type Theme = "light" | "dark" | "system";

interface Props {
  onBack: () => void;
}

const languages = [
  { value: "zh-CN", label: "\u4E2D\u6587" },
  { value: "en", label: "English" },
];

const ENGINE_LIST = [
  { id: "baidu", label: "Baidu", hasSecret: true },
  { id: "youdao", label: "Youdao", hasSecret: true },
  { id: "google", label: "Google", hasSecret: false },
] as const;

export function SettingsPage({ onBack }: Props) {
  const { t, i18n } = useTranslation();
  const theme = useSettingsStore((s) => s.theme);
  const maxHistory = useSettingsStore((s) => s.maxHistory);
  const pasteAndClose = useSettingsStore((s) => s.pasteAndClose);
  const locale = useSettingsStore((s) => s.locale);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const setMaxHistory = useSettingsStore((s) => s.setMaxHistory);
  const setPasteAndClose = useSettingsStore((s) => s.setPasteAndClose);
  const setLocale = useSettingsStore((s) => s.setLocale);

  const engines = useTranslateStore((s) => s.engines);
  const loadEngines = useTranslateStore((s) => s.loadEngines);
  const saveEngine = useTranslateStore((s) => s.saveEngine);

  const [engineForms, setEngineForms] = useState<Record<string, { apiKey: string; apiSecret: string; enabled: boolean }>>({});
  const [savedEngine, setSavedEngine] = useState<string | null>(null);

  useEffect(() => {
    loadEngines();
  }, [loadEngines]);

  useEffect(() => {
    const forms: Record<string, { apiKey: string; apiSecret: string; enabled: boolean }> = {};
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

  const themes: { value: Theme; labelKey: string; icon: React.ReactNode }[] = [
    { value: "light", labelKey: "settings.light", icon: <Sun className="w-3.5 h-3.5" /> },
    { value: "dark", labelKey: "settings.dark", icon: <Moon className="w-3.5 h-3.5" /> },
    { value: "system", labelKey: "settings.auto", icon: <Monitor className="w-3.5 h-3.5" /> },
  ];

  const handleLocaleChange = (newLocale: string) => {
    setLocale(newLocale);
    i18n.changeLanguage(newLocale);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-border/30 shrink-0">
        <button
          onClick={onBack}
          className="flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-accent/50 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>
        <span className="text-xs font-medium">{t("settings.title")}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Language */}
        <section>
          <label className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">
            {t("settings.language")}
          </label>
          <div className="flex gap-1.5 mt-2">
            {languages.map((lang) => (
              <button
                key={lang.value}
                onClick={() => handleLocaleChange(lang.value)}
                className={cn(
                  "flex-1 flex items-center justify-center py-1.5 rounded-md text-xs font-medium transition-colors",
                  locale === lang.value
                    ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                    : "bg-muted/30 text-muted-foreground/60 hover:bg-muted/50 hover:text-foreground"
                )}
              >
                {lang.label}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground/40">{t("settings.languageDesc")}</p>
        </section>

        {/* Theme */}
        <section>
          <label className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">
            {t("settings.theme")}
          </label>
          <div className="flex gap-1.5 mt-2">
            {themes.map((themeItem) => (
              <button
                key={themeItem.value}
                onClick={() => setTheme(themeItem.value)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors",
                  theme === themeItem.value
                    ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                    : "bg-muted/30 text-muted-foreground/60 hover:bg-muted/50 hover:text-foreground"
                )}
              >
                {themeItem.icon}
                {t(themeItem.labelKey)}
              </button>
            ))}
          </div>
        </section>

        {/* Max history */}
        <section>
          <label className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">
            {t("settings.historyLimit")}
          </label>
          <input
            type="number"
            min={10}
            max={10000}
            value={maxHistory}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v) && v > 0) setMaxHistory(v);
            }}
            className="mt-2 w-24 h-7 px-2 text-xs bg-muted/30 border border-border/50 rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-ring/30"
          />
          <p className="mt-1 text-[10px] text-muted-foreground/40">{t("settings.maxEntries")}</p>
        </section>

        {/* Paste and close */}
        <section>
          <div className="flex items-center justify-between">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">
                {t("settings.autoClose")}
              </label>
              <p className="mt-0.5 text-[10px] text-muted-foreground/40">{t("settings.hidePanel")}</p>
            </div>
            <button
              onClick={() => setPasteAndClose(!pasteAndClose)}
              className={cn(
                "relative w-8 h-[18px] rounded-full transition-colors",
                pasteAndClose ? "bg-primary/80" : "bg-muted"
              )}
            >
              <span
                className={cn(
                  "absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-white shadow transition-transform",
                  pasteAndClose && "translate-x-[14px]"
                )}
              />
            </button>
          </div>
        </section>

        {/* Data management */}
        <section>
          <label className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">
            {t("settings.dataManagement")}
          </label>
          <div className="flex flex-col gap-2 mt-2">
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  try {
                    const json = await exportData();
                    const blob = new Blob([json], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `alger-clipboard-backup-${new Date().toISOString().slice(0, 10)}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast.success(t("toast.exported"));
                  } catch {
                    toast.error(t("toast.exportFailed"));
                  }
                }}
                className="flex items-center gap-1.5 h-7 px-3 text-[11px] font-medium bg-muted/30 hover:bg-muted/50 rounded-md transition-colors"
              >
                <Download className="w-3 h-3" />
                {t("settings.export")}
              </button>
              <button
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = ".json";
                  input.onchange = async (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (!file) return;
                    try {
                      const text = await file.text();
                      const count = await importData(text);
                      toast.success(t("toast.imported", { count }));
                      useClipboardStore.getState().fetchHistory();
                    } catch {
                      toast.error(t("toast.importFailed"));
                    }
                  };
                  input.click();
                }}
                className="flex items-center gap-1.5 h-7 px-3 text-[11px] font-medium bg-muted/30 hover:bg-muted/50 rounded-md transition-colors"
              >
                <Upload className="w-3 h-3" />
                {t("settings.import")}
              </button>
            </div>
            <button
              onClick={async () => {
                try {
                  await clearHistory(true);
                  useClipboardStore.getState().fetchHistory();
                  toast.success(t("toast.cleared"));
                } catch {
                  toast.error(t("toast.clearFailed"));
                }
              }}
              className="flex items-center gap-1.5 h-7 px-3 text-[11px] font-medium text-destructive bg-destructive/10 hover:bg-destructive/20 rounded-md transition-colors w-fit"
            >
              <Trash2 className="w-3 h-3" />
              {t("settings.clearHistory")}
            </button>
            <p className="text-[10px] text-muted-foreground/40">{t("settings.clearHistoryDesc")}</p>
          </div>
        </section>

        {/* Translation engine config */}
        <section>
          <label className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">
            {t("translate.engineConfig")}
          </label>
          <div className="mt-2 space-y-3">
            {ENGINE_LIST.map((eng) => {
              const form = engineForms[eng.id];
              if (!form) return null;
              return (
                <div key={eng.id} className="bg-muted/20 rounded-md p-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-foreground/80">{eng.label}</span>
                    <button
                      onClick={() => {
                        setEngineForms((prev) => ({
                          ...prev,
                          [eng.id]: { ...prev[eng.id], enabled: !prev[eng.id].enabled },
                        }));
                      }}
                      className={cn(
                        "relative w-7 h-[16px] rounded-full transition-colors",
                        form.enabled ? "bg-primary/80" : "bg-muted"
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-[2px] left-[2px] w-[12px] h-[12px] rounded-full bg-white shadow transition-transform",
                          form.enabled && "translate-x-[11px]"
                        )}
                      />
                    </button>
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
                    className="w-full h-6 px-2 text-[11px] bg-background border border-border/50 rounded text-foreground focus:outline-none focus:ring-1 focus:ring-ring/30"
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
                      className="w-full h-6 px-2 text-[11px] bg-background border border-border/50 rounded text-foreground focus:outline-none focus:ring-1 focus:ring-ring/30"
                    />
                  )}
                  <button
                    onClick={() => handleSaveEngine(eng.id)}
                    className="h-6 px-3 text-[10px] font-medium bg-primary/15 text-primary hover:bg-primary/25 rounded transition-colors"
                  >
                    {savedEngine === eng.id ? t("translate.saved") : t("translate.save")}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
