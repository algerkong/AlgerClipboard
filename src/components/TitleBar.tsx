import { useEffect, useState } from "react";
import { X, Minus, PushPin, PushPinSlash, Cloud, CloudSlash, SpinnerGap } from "@phosphor-icons/react";
import appIcon from "@/assets/app-icon.png";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "@/stores/settingsStore";
import { useSyncStore } from "@/stores/syncStore";
import { usePlatform } from "@/contexts/PlatformContext";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  onClose: () => void;
  title?: string;
  showSyncIndicator?: boolean;
  showPinButton?: boolean;
}

function SyncIndicator() {
  const { t } = useTranslation();
  const syncStatus = useSyncStore((s) => s.syncStatus);
  const lastSyncTime = useSyncStore((s) => s.lastSyncTime);
  const accounts = useSyncStore((s) => s.accounts);

  if (accounts.length === 0) return null;

  const icon = (() => {
    switch (syncStatus) {
      case "syncing":
        return <SpinnerGap size={12} className="text-blue-400 animate-spin" />;
      case "synced":
        return <Cloud size={12} className="text-green-400/70" />;
      case "error":
        return <CloudSlash size={12} className="text-red-400/70" />;
      default:
        return <Cloud size={12} className="text-muted-foreground/40" />;
    }
  })();

  const tooltip = (() => {
    switch (syncStatus) {
      case "syncing": return t("sync.syncing");
      case "synced": return lastSyncTime
        ? `${t("sync.synced")} · ${new Date(lastSyncTime).toLocaleTimeString()}`
        : t("sync.synced");
      case "error": return t("sync.syncFailed");
      default: return t("sync.title");
    }
  })();

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="h-5 w-5 flex items-center justify-center">
            {icon}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs2">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/* Windows/Linux-style square icon buttons */
function WinLinuxButtons({ onClose, showPinButton = true }: { onClose: () => void; showPinButton?: boolean }) {
  const isPinned = useSettingsStore((s) => s.isPinned);
  const setIsPinned = useSettingsStore((s) => s.setIsPinned);

  const handleMinimize = () => getCurrentWebviewWindow().minimize();
  const handleTogglePin = () => {
    // Pin only controls auto-hide-on-blur behavior.
    // alwaysOnTop stays true always — it's required for a skip-taskbar
    // popup window to properly receive focus on Windows.
    setIsPinned(!isPinned);
  };

  return (
    <div className="flex items-center gap-0.5">
      {showPinButton && (
        <button
          onClick={handleTogglePin}
          className="titlebar-icon-btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {isPinned ? <PushPin size={12} /> : <PushPinSlash size={12} />}
        </button>
      )}
      <button
        onClick={handleMinimize}
        className="titlebar-icon-btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Minus size={12} />
      </button>
      <button
        onClick={onClose}
        className="titlebar-icon-btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X size={12} />
      </button>
    </div>
  );
}

/* Pin button standalone (used on macOS right side) */
function PinButton() {
  const isPinned = useSettingsStore((s) => s.isPinned);
  const setIsPinned = useSettingsStore((s) => s.setIsPinned);

  const handleTogglePin = () => {
    setIsPinned(!isPinned);
  };

  return (
    <button
      onClick={handleTogglePin}
      className="titlebar-icon-btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {isPinned ? <PushPin size={12} /> : <PushPinSlash size={12} />}
    </button>
  );
}

function TitleText({
  title,
  showSyncIndicator = true,
}: {
  title?: string;
  showSyncIndicator?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div data-tauri-drag-region className="flex items-center gap-1.5">
      <img src={appIcon} alt="" className="h-4 w-4 shrink-0" draggable={false} data-tauri-drag-region />
      <span
        data-tauri-drag-region
        className="text-[length:var(--app-title-font-size)] font-semibold text-muted-foreground"
      >
        {title ?? t("titleBar.clipboard")}
      </span>
      {showSyncIndicator ? <SyncIndicator /> : null}
    </div>
  );
}

export function TitleBar({
  onClose,
  title,
  showSyncIndicator = true,
  showPinButton = true,
}: Props) {
  const platform = usePlatform();
  const buttonPosition = useSettingsStore((s) => s.buttonPosition);
  const [windowFocused, setWindowFocused] = useState(true);

  // Track window focus for macOS button dimming
  useEffect(() => {
    if (platform !== "macos") return;
    const win = getCurrentWebviewWindow();
    const unlistenFocus = win.onFocusChanged(({ payload }) => {
      setWindowFocused(payload);
    });
    return () => { unlistenFocus.then((fn) => fn()); };
  }, [platform]);

  const blurClass = platform === "macos" && !windowFocused ? "window-blurred" : "";

  // macOS: native title bar / traffic lights, custom content only
  if (platform === "macos") {
    return (
      <div data-tauri-drag-region className={`flex h-9 shrink-0 items-center justify-between border-b border-border/50 bg-card/70 px-2 backdrop-blur-md select-none ${blurClass}`}>
        <div className="w-[72px] shrink-0" />
        <TitleText title={title} showSyncIndicator={showSyncIndicator} />
        {showPinButton && (
          <div className="pr-2">
            <PinButton />
          </div>
        )}
      </div>
    );
  }

  // Linux with buttons on left
  if (platform === "linux" && buttonPosition === "left") {
    return (
      <div data-tauri-drag-region className="flex h-9 shrink-0 items-center justify-between border-b border-border/50 bg-card/70 px-2 backdrop-blur-md select-none">
        <div className="pl-1">
          <WinLinuxButtons onClose={onClose} showPinButton={showPinButton} />
        </div>
        <div data-tauri-drag-region className="flex-1" />
        <div className="pr-2">
          <TitleText title={title} showSyncIndicator={showSyncIndicator} />
        </div>
      </div>
    );
  }

  // Windows / Linux (buttons right, default)
  return (
    <div data-tauri-drag-region className="flex h-9 shrink-0 items-center justify-between border-b border-border/50 bg-card/70 px-3 backdrop-blur-md select-none">
      <TitleText title={title} showSyncIndicator={showSyncIndicator} />
      <div className="-mr-1">
        <WinLinuxButtons onClose={onClose} showPinButton={showPinButton} />
      </div>
    </div>
  );
}
