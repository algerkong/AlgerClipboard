import { useState, useEffect } from "react";
import { Settings2, Cloud, Languages, Database, Brain, Brush, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { GeneralTab } from "./GeneralTab";
import { SyncTab } from "./SyncTab";
import { TranslateTab } from "./TranslateTab";
import { DataTab } from "./DataTab";
import { AiTab } from "./AiTab";
import { RichTextTab } from "./RichTextTab";
import { AskAiTab } from "./AskAiTab";
import { trackWindowSize } from "@/lib/windowSize";
import { SETTINGS_SIZE_KEY } from "@/services/settingsWindowService";

type SettingsTab = "general" | "richText" | "sync" | "translate" | "data" | "ai" | "askAi";

interface Props {
  onBack: () => void;
  initialTab?: string;
}

const TABS: { key: SettingsTab; labelKey: string; icon: React.ReactNode }[] = [
  {
    key: "general",
    labelKey: "settings.tabGeneral",
    icon: <Settings2 className="h-[var(--app-tab-icon-size)] w-[var(--app-tab-icon-size)]" />,
  },
  {
    key: "richText",
    labelKey: "settings.tabRichText",
    icon: <Brush className="h-[var(--app-tab-icon-size)] w-[var(--app-tab-icon-size)]" />,
  },
  {
    key: "sync",
    labelKey: "settings.tabSync",
    icon: <Cloud className="h-[var(--app-tab-icon-size)] w-[var(--app-tab-icon-size)]" />,
  },
  {
    key: "translate",
    labelKey: "settings.tabTranslate",
    icon: <Languages className="h-[var(--app-tab-icon-size)] w-[var(--app-tab-icon-size)]" />,
  },
  {
    key: "data",
    labelKey: "settings.tabData",
    icon: <Database className="h-[var(--app-tab-icon-size)] w-[var(--app-tab-icon-size)]" />,
  },
  {
    key: "ai",
    labelKey: "settings.tabAi",
    icon: <Brain className="h-[var(--app-tab-icon-size)] w-[var(--app-tab-icon-size)]" />,
  },
  {
    key: "askAi",
    labelKey: "settings.tabAskAi",
    icon: <Globe className="h-[var(--app-tab-icon-size)] w-[var(--app-tab-icon-size)]" />,
  },
];

/* ─── Settings Page ─── */
export function SettingsPage({ initialTab }: Props) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<SettingsTab>(
    (initialTab as SettingsTab) || "general"
  );

  // Save window size on resize
  useEffect(() => trackWindowSize(SETTINGS_SIZE_KEY), []);
  const tabStyle = {
    gap: "var(--app-tab-gap)",
    paddingInline: "var(--app-tab-px)",
    paddingBlock: "var(--app-tab-py)",
    fontSize: "var(--app-tab-font-size)",
  } as const;

  return (
    <div className="flex flex-col h-full">
      <div className="tab-shell shrink-0">
        <div className="tab-scroll-area overflow-x-auto px-3 py-2">
          <div className="flex w-max min-w-full items-center gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={tabStyle}
                data-active={activeTab === tab.key}
                className={cn(
                  "filter-pill flex shrink-0 items-center whitespace-nowrap font-medium leading-none text-muted-foreground transition-all",
                  activeTab === tab.key
                    ? "text-foreground"
                    : "hover:border-primary/20 hover:bg-accent/50 hover:text-foreground",
                )}
              >
                {tab.icon}
                <span>{t(tab.labelKey)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "general" && <GeneralTab />}
        {activeTab === "richText" && <RichTextTab />}
        {activeTab === "sync" && <SyncTab />}
        {activeTab === "translate" && <TranslateTab />}
        {activeTab === "data" && <DataTab />}
        {activeTab === "ai" && <AiTab />}
        {activeTab === "askAi" && <AskAiTab />}
      </div>
    </div>
  );
}
