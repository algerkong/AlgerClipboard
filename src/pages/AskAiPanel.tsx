import { useEffect, useState, useCallback, useRef, type CSSProperties } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useTranslation } from "react-i18next";
import { useAskAiStore } from "@/stores/askAiStore";
import { AI_WEB_SERVICES } from "@/constants/aiServices";
import type { AiWebService } from "@/constants/aiServices";
import { FaviconImg } from "@/pages/settings/AskAiTab";
import { usePlatform } from "@/contexts/PlatformContext";
import { cn } from "@/lib/utils";

const TAB_BAR_HEIGHT = 44;
export const ASK_AI_SIZE_KEY = "ask-ai-panel";

function getAskAiChromeMetrics(platform: "windows" | "macos" | "linux", isSingleService: boolean) {
  const topInset = isSingleService ? 0 : platform === "macos" ? 28 : 0;
  const tabBarHeight = isSingleService ? 0 : TAB_BAR_HEIGHT;

  return {
    topInset,
    tabBarHeight,
    contentTop: topInset + tabBarHeight,
  };
}

export function AskAiPanel() {
  const { t } = useTranslation();
  const platform = usePlatform();
  const enabledServiceIds = useAskAiStore((s) => s.enabledServiceIds);
  const loadEnabledServices = useAskAiStore((s) => s.loadEnabledServices);
  const loadFavicons = useAskAiStore((s) => s.loadFavicons);
  const getFavicon = useAskAiStore((s) => s.getFavicon);
  const setActiveServiceId = useAskAiStore((s) => s.setActiveServiceId);

  const [localActiveId, setLocalActiveId] = useState<string | null>(null);
  const [createdWebviews] = useState<Set<string>>(() => new Set());
  const [ready, setReady] = useState(false);
  const mountedRef = useRef(false);
  const pendingTargetServiceIdRef = useRef<string | null>(null);

  // Resolve enabled services to full definitions
  const enabledServices = enabledServiceIds
    .map((id) => AI_WEB_SERVICES.find((s) => s.id === id))
    .filter(Boolean) as AiWebService[];

  const isSingleService = enabledServices.length === 1;
  const chromeMetrics = getAskAiChromeMetrics(platform, isSingleService);

  // Get the parent window (ask-ai-panel) for size calculations
  const getParentWindow = useCallback(() => {
    // The tab bar webview is a child of ask-ai-panel window
    return getCurrentWindow();
  }, []);

  const getWindowMetrics = useCallback(async () => {
    const win = getParentWindow();
    const size = await win.innerSize();
    const scaleFactor = await win.scaleFactor();
    const logicalWidth = size.width / scaleFactor;
    const logicalHeight = size.height / scaleFactor;

    return {
      logicalWidth,
      logicalHeight,
      contentTop: chromeMetrics.contentTop,
      contentHeight: Math.max(logicalHeight - chromeMetrics.contentTop, 0),
    };
  }, [chromeMetrics.contentTop, getParentWindow]);

  const resizeServiceWebview = useCallback(async (serviceId: string) => {
    const { logicalWidth, contentTop, contentHeight } = await getWindowMetrics();
    await invoke("resize_ai_webview", {
      serviceId,
      x: 0,
      y: contentTop,
      width: logicalWidth,
      height: contentHeight,
    });
  }, [getWindowMetrics]);

  const resizeAllCreatedWebviews = useCallback(async () => {
    const serviceIds = Array.from(createdWebviews);
    if (serviceIds.length === 0) {
      return;
    }

    await Promise.all(serviceIds.map(async (serviceId) => {
      try {
        await resizeServiceWebview(serviceId);
      } catch {
        // Webview may not exist yet.
      }
    }));
  }, [createdWebviews, resizeServiceWebview]);

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
      const { logicalWidth, contentTop, contentHeight } = await getWindowMetrics();

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
          y: contentTop,
          width: logicalWidth,
          height: contentHeight,
        });
        createdWebviews.add(serviceId);
      } else {
        await resizeServiceWebview(serviceId);
        // Show existing webview
        await invoke("show_ai_webview", { serviceId });
      }

      // Bring the tab bar to front so it's not occluded by the service webview
      if (!isSingleService) {
        try {
          await invoke("bring_tab_bar_to_front");
        } catch {
          // Tab bar might not exist yet
        }
      }

      setLocalActiveId(serviceId);
      setActiveServiceId(serviceId);
    },
    [createdWebviews, getWindowMetrics, isSingleService, localActiveId, resizeServiceWebview, setActiveServiceId],
  );

  useEffect(() => {
    const unlisten = listen<{ serviceId?: string }>("ask-ai:open-service", (event) => {
      const nextServiceId = event.payload?.serviceId;
      if (!nextServiceId) {
        return;
      }

      pendingTargetServiceIdRef.current = nextServiceId;
      if (ready) {
        void handleTabChange(nextServiceId);
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [handleTabChange, ready]);

  // Auto-select initial service when services are ready
  useEffect(() => {
    if (!ready || enabledServices.length === 0 || mountedRef.current) return;
    mountedRef.current = true;
    const requestedId = pendingTargetServiceIdRef.current;
    const initialServiceId = requestedId && enabledServices.some((service) => service.id === requestedId)
      ? requestedId
      : enabledServices[0].id;
    const timer = window.setTimeout(() => {
      void handleTabChange(initialServiceId);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [ready, enabledServices, handleTabChange]);

  // Window resize handler: resize tab bar and active child webview
  useEffect(() => {
    const win = getParentWindow();
    const unlisten = win.onResized(async (event) => {
      const scaleFactor = await win.scaleFactor();
      const logicalWidth = event.payload.width / scaleFactor;
      const logicalHeight = event.payload.height / scaleFactor;

      // Resize the tab bar webview to match window width
      try {
        await invoke("resize_tab_bar", {
          y: chromeMetrics.topInset,
          width: logicalWidth,
          height: chromeMetrics.tabBarHeight > 0 ? chromeMetrics.tabBarHeight : logicalHeight,
        });
      } catch {
        // Tab bar might not exist yet
      }

      void logicalHeight;
      await resizeAllCreatedWebviews();
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [chromeMetrics.tabBarHeight, chromeMetrics.topInset, getParentWindow, resizeAllCreatedWebviews]);

  const tabBarStyle: CSSProperties = {
    background: "linear-gradient(180deg, color-mix(in oklab, var(--muted) 82%, var(--background) 18%), color-mix(in oklab, var(--muted) 52%, var(--background) 48%))",
    borderBottomColor: "color-mix(in oklab, var(--border) 92%, transparent)",
  };

  const activeTabStyle: CSSProperties = {
    color: "var(--foreground)",
    boxShadow: "0 1px 0 var(--background), var(--app-shadow-soft)",
  };

  const inactiveTabStyle: CSSProperties = {
    color: "var(--muted-foreground)",
  };

  // Single service mode: no tab bar, transparent background
  if (isSingleService || enabledServices.length === 0) {
    return <div className="h-screen w-screen" />;
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      <div
        className="shrink-0 border-b px-2"
        style={tabBarStyle}
      >
        <div style={{ height: chromeMetrics.tabBarHeight }}>
          <div
            aria-label={t("askAi.tabBar")}
            className="flex h-full items-end gap-0.5 overflow-x-auto px-1 pt-1"
          >
            {enabledServices.map((service) => {
              const faviconUrl = getFavicon(service.id);
              const isActive = localActiveId === service.id;
              const tabSurfaceStyle: CSSProperties = {
                background: isActive
                  ? "linear-gradient(180deg, color-mix(in oklab, white 42%, var(--background) 58%), var(--background))"
                  : "linear-gradient(180deg, color-mix(in oklab, white 16%, var(--accent) 84%), color-mix(in oklab, var(--accent) 82%, var(--muted) 18%))",
                borderColor: isActive
                  ? "color-mix(in oklab, var(--border) 92%, transparent)"
                  : "color-mix(in oklab, var(--border) 55%, transparent)",
              };

              return (
                <button
                  key={service.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => void handleTabChange(service.id)}
                  className={cn(
                    "group relative isolate flex h-[38px] min-w-[164px] max-w-[280px] items-center gap-2 px-5 text-[12px] font-medium transition-all",
                    isActive ? "z-20" : "z-10 hover:z-20 hover:text-foreground",
                  )}
                  style={isActive ? activeTabStyle : inactiveTabStyle}
                >
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-[4px] inset-y-0 rounded-t-[14px] border border-b-0"
                    style={tabSurfaceStyle}
                  />
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute bottom-0 left-[4px] right-[4px] h-[1px]"
                    style={{
                      background: isActive
                        ? "var(--background)"
                        : "color-mix(in oklab, var(--border) 48%, transparent)",
                    }}
                  />
                  <span className="relative z-10 inline-flex shrink-0">
                    <FaviconImg
                      url={faviconUrl}
                      name={service.name}
                      size="h-4 w-4"
                    />
                  </span>
                  <span className="relative z-10 truncate text-left">{service.name}</span>
                  <span
                    className={cn(
                      "absolute inset-x-5 top-[2px] z-10 h-[2px] rounded-full transition-opacity",
                      isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                    )}
                    style={{
                      background: isActive
                        ? "var(--primary)"
                        : "color-mix(in oklab, var(--primary) 30%, transparent)",
                    }}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
