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
    icon: <Settings2 className="w-3 h-3" />,
  },
  {
    key: "sync",
    labelKey: "settings.tabSync",
    icon: <Cloud className="w-3 h-3" />,
  },
  {
    key: "translate",
    labelKey: "settings.tabTranslate",
    icon: <Languages className="w-3 h-3" />,
  },
  {
    key: "data",
    labelKey: "settings.tabData",
    icon: <Database className="w-3 h-3" />,
  },
  {
    key: "ai",
    labelKey: "settings.tabAi",
    icon: <Brain className="w-3 h-3" />,
  },
];

/* ─── Settings Page ─── */
export function SettingsPage({ initialTab }: Props) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<SettingsTab>(
    (initialTab as SettingsTab) || "general"
  );

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border/30 shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-md text-sm2 font-medium transition-colors",
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
