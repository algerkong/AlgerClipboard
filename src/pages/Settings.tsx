import { ArrowLeft, Sun, Moon, Monitor } from "lucide-react";
import { useSettingsStore } from "@/stores/settingsStore";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

type Theme = "light" | "dark" | "system";

interface Props {
  onBack: () => void;
}

const languages = [
  { value: "zh-CN", label: "\u4E2D\u6587" },
  { value: "en", label: "English" },
];

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
      </div>
    </div>
  );
}
