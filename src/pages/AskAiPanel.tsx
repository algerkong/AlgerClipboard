import { useEffect, useState, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useTranslation } from "react-i18next";
import { useAskAiStore } from "@/stores/askAiStore";
import { AI_WEB_SERVICES } from "@/constants/aiServices";
import type { AiWebService } from "@/constants/aiServices";
import { FaviconImg } from "@/pages/settings/AskAiTab";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TAB_BAR_HEIGHT = 40;

export function AskAiPanel() {
  const { t } = useTranslation();
  const enabledServiceIds = useAskAiStore((s) => s.enabledServiceIds);
  const loadEnabledServices = useAskAiStore((s) => s.loadEnabledServices);
  const loadFavicons = useAskAiStore((s) => s.loadFavicons);
  const getFavicon = useAskAiStore((s) => s.getFavicon);
  const setActiveServiceId = useAskAiStore((s) => s.setActiveServiceId);

  const [localActiveId, setLocalActiveId] = useState<string | null>(null);
  const [createdWebviews] = useState<Set<string>>(() => new Set());
  const [ready, setReady] = useState(false);
  const mountedRef = useRef(false);

  // Resolve enabled services to full definitions
  const enabledServices = enabledServiceIds
    .map((id) => AI_WEB_SERVICES.find((s) => s.id === id))
    .filter(Boolean) as AiWebService[];

  const isSingleService = enabledServices.length === 1;

  // Load services and favicons on mount
  useEffect(() => {
    const init = async () => {
      await loadEnabledServices();
      await loadFavicons();
      setReady(true);
    };
    void init();
  }, [loadEnabledServices, loadFavicons]);

  // Handle tab change: hide old, create/show new
  const handleTabChange = useCallback(
    async (serviceId: string) => {
      if (!serviceId) return;
      const service = AI_WEB_SERVICES.find((s) => s.id === serviceId);
      if (!service) return;

      const win = getCurrentWindow();
      const size = await win.innerSize();
      const scaleFactor = await win.scaleFactor();
      const logicalWidth = size.width / scaleFactor;
      const logicalHeight = size.height / scaleFactor;
      const barH = enabledServices.length === 1 ? 0 : TAB_BAR_HEIGHT;

      // Hide current active webview
      if (localActiveId && localActiveId !== serviceId) {
        try {
          await invoke("hide_ai_webview", { serviceId: localActiveId });
        } catch {
          // May not exist yet
        }
      }

      // Create if not yet created
      if (!createdWebviews.has(serviceId)) {
        await invoke("create_ai_child_webview", {
          parentLabel: "ask-ai-panel",
          serviceId: service.id,
          url: service.url,
          x: 0,
          y: barH,
          width: logicalWidth,
          height: logicalHeight - barH,
        });
        createdWebviews.add(serviceId);
      } else {
        // Show existing webview
        await invoke("show_ai_webview", { serviceId });
      }

      setLocalActiveId(serviceId);
      setActiveServiceId(serviceId);
    },
    [localActiveId, enabledServices.length, createdWebviews, setActiveServiceId],
  );

  // Auto-select first service on mount when services are ready
  useEffect(() => {
    if (!ready || enabledServices.length === 0 || mountedRef.current) return;
    mountedRef.current = true;
    void handleTabChange(enabledServices[0].id);
  }, [ready, enabledServices, handleTabChange]);

  // Window resize handler: resize active webview
  useEffect(() => {
    const unlisten = getCurrentWindow().onResized(async (event) => {
      if (!localActiveId) return;
      const scaleFactor = await getCurrentWindow().scaleFactor();
      const logicalWidth = event.payload.width / scaleFactor;
      const logicalHeight = event.payload.height / scaleFactor;
      const barH = enabledServices.length === 1 ? 0 : TAB_BAR_HEIGHT;

      try {
        await invoke("resize_ai_webview", {
          serviceId: localActiveId,
          x: 0,
          y: barH,
          width: logicalWidth,
          height: logicalHeight - barH,
        });
      } catch {
        // Webview might not exist yet
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [localActiveId, enabledServices.length]);

  // Single service mode: no tab bar
  if (isSingleService || enabledServices.length === 0) {
    return <div className="h-screen w-screen" />;
  }

  // Multi service mode: tab bar
  return (
    <div className="flex flex-col h-screen w-screen bg-background">
      <div
        data-tauri-drag-region
        className="flex items-center h-10 border-b border-border px-2 bg-background shrink-0"
      >
        <Tabs
          value={localActiveId || ""}
          onValueChange={(v) => void handleTabChange(v)}
          className="flex-1 min-w-0"
        >
          <TabsList
            aria-label={t("askAi.tabBar")}
            className="h-8 w-full justify-start bg-transparent gap-0 p-0"
          >
            {enabledServices.map((service) => {
              const faviconUrl = getFavicon(service.id);
              return (
                <TabsTrigger
                  key={service.id}
                  value={service.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md data-[state=active]:bg-accent data-[state=active]:shadow-none h-7"
                >
                  <FaviconImg
                    url={faviconUrl}
                    name={service.name}
                    size="w-4 h-4"
                  />
                  <span className="truncate max-w-[80px]">{service.name}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      </div>
      {/* Child webviews render below, managed by Rust */}
      <div className="flex-1" />
    </div>
  );
}
