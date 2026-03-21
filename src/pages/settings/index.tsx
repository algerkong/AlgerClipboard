import { useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Brain,
  PaintBrush,
  Cloud,
  Database,
  Globe,
  Translate,
  PuzzlePiece,
  Scan,
  MagnifyingGlass,
  Gear,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { GeneralTab } from "./GeneralTab";
import { SyncTab } from "./SyncTab";
import { TranslateTab } from "./TranslateTab";
import { DataTab } from "./DataTab";
import { AiTab } from "./AiTab";
import { RichTextTab } from "./RichTextTab";
import { AskAiTab } from "./AskAiTab";
import { OcrTab } from "./OcrTab";
import { SpotlightTab } from "./SpotlightTab";
import { PluginsTab } from "./PluginsTab";
import { SettingsHero } from "./shared";

type SettingsTab =
  | "general"
  | "richText"
  | "sync"
  | "translate"
  | "ocr"
  | "data"
  | "ai"
  | "askAi"
  | "spotlight"
  | "plugins";

interface Props {
  onBack: () => void;
  initialTab?: string;
}

const TABS: {
  key: SettingsTab;
  labelKey: string;
  icon: ReactNode;
  eyebrow: string;
  descriptionKey: string;
}[] = [
  {
    key: "general",
    labelKey: "settings.tabGeneral",
    icon: <Gear size={16} />,
    eyebrow: "Core",
    descriptionKey: "settingsLayout.generalDesc",
  },
  {
    key: "richText",
    labelKey: "settings.tabRichText",
    icon: <PaintBrush size={16} />,
    eyebrow: "Display",
    descriptionKey: "settingsLayout.richTextDesc",
  },
  {
    key: "sync",
    labelKey: "settings.tabSync",
    icon: <Cloud size={16} />,
    eyebrow: "Cloud",
    descriptionKey: "settingsLayout.syncDesc",
  },
  {
    key: "translate",
    labelKey: "settings.tabTranslate",
    icon: <Translate size={16} />,
    eyebrow: "Language",
    descriptionKey: "settingsLayout.translateDesc",
  },
  {
    key: "ocr",
    labelKey: "settings.tabOcr",
    icon: <Scan size={16} />,
    eyebrow: "Capture",
    descriptionKey: "settingsLayout.ocrDesc",
  },
  {
    key: "data",
    labelKey: "settings.tabData",
    icon: <Database size={16} />,
    eyebrow: "Storage",
    descriptionKey: "settingsLayout.dataDesc",
  },
  {
    key: "ai",
    labelKey: "settings.tabAi",
    icon: <Brain size={16} />,
    eyebrow: "Model",
    descriptionKey: "settingsLayout.aiDesc",
  },
  {
    key: "askAi",
    labelKey: "settings.tabAskAi",
    icon: <Globe size={16} />,
    eyebrow: "Assistant",
    descriptionKey: "settingsLayout.askAiDesc",
  },
  {
    key: "spotlight",
    labelKey: "spotlight.settings.title",
    icon: <MagnifyingGlass size={16} />,
    eyebrow: "Search",
    descriptionKey: "spotlight.settings.enable",
  },
  {
    key: "plugins",
    labelKey: "settings.tabPlugins",
    icon: <PuzzlePiece size={16} />,
    eyebrow: "Extensions",
    descriptionKey: "settingsLayout.pluginsDesc",
  },
];

export function SettingsPage({ onBack, initialTab }: Props) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<SettingsTab>(
    (initialTab as SettingsTab) || "general",
  );

  const currentTab = TABS.find((tab) => tab.key === activeTab) ?? TABS[0];

  return (
    <div className="settings-layout">
      <aside className="settings-sidebar">
        <button onClick={onBack} className="settings-back-button">
          <ArrowLeft size={16} />
          <span>{t("settings.title")}</span>
        </button>

        <div className="settings-sidebar-panel">
          <div className="space-y-1">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn("settings-sidebar-item", activeTab === tab.key && "is-active")}
              >
                <span className="settings-sidebar-icon">{tab.icon}</span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block text-sm font-medium">{t(tab.labelKey)}</span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground/80">
                    {tab.eyebrow}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </aside>

      <main className="settings-content">
        <div className="settings-content-scroll">
          <SettingsHero
            eyebrow={currentTab.eyebrow}
            title={t(currentTab.labelKey)}
            description={t(currentTab.descriptionKey)}
            badge="Preferences"
          />

          <div className="animate-float-up space-y-5">
            {activeTab === "general" && <GeneralTab />}
            {activeTab === "richText" && <RichTextTab />}
            {activeTab === "sync" && <SyncTab />}
            {activeTab === "translate" && <TranslateTab />}
            {activeTab === "ocr" && <OcrTab />}
            {activeTab === "data" && <DataTab />}
            {activeTab === "ai" && <AiTab />}
            {activeTab === "askAi" && <AskAiTab />}
            {activeTab === "spotlight" && <SpotlightTab />}
            {activeTab === "plugins" && <PluginsTab />}
          </div>
        </div>
      </main>
    </div>
  );
}
