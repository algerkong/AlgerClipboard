import { useState } from "react";
import { Settings2, Cloud, Languages, Database, Brain } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { GeneralTab } from "./GeneralTab";
import { SyncTab } from "./SyncTab";
import { TranslateTab } from "./TranslateTab";
import { DataTab } from "./DataTab";
import { AiTab } from "./AiTab";

type SettingsTab = "general" | "sync" | "translate" | "data" | "ai";

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
];

/* ─── Settings Page ─── */
export function SettingsPage({ initialTab }: Props) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<SettingsTab>(
    (initialTab as SettingsTab) || "general"
  );
  const tabStyle = {
    gap: "var(--app-tab-gap)",
    paddingInline: "var(--app-tab-px)",
    paddingBlock: "var(--app-tab-py)",
    fontSize: "var(--app-tab-font-size)",
  } as const;

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="border-b border-border/30 shrink-0">
        <div className="tab-scroll-area overflow-x-auto px-2 py-1.5">
          <div className="flex w-max min-w-full items-center gap-0.5">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={tabStyle}
                className={cn(
                  "flex shrink-0 items-center whitespace-nowrap rounded-md font-medium transition-colors leading-none",
                  activeTab === tab.key
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                )}
              >
                {tab.icon}
                <span>{t(tab.labelKey)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "general" && <GeneralTab />}
        {activeTab === "sync" && <SyncTab />}
        {activeTab === "translate" && <TranslateTab />}
        {activeTab === "data" && <DataTab />}
        {activeTab === "ai" && <AiTab />}
      </div>
    </div>
  );
}
