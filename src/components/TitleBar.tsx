import { useEffect, useState } from "react";
import { X, Minus, Pin, PinOff, Cloud, CloudOff, Loader2 } from "lucide-react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "@/stores/settingsStore";
import { useSyncStore } from "@/stores/syncStore";
import { usePlatform } from "@/contexts/PlatformContext";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  onClose: () => void;
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
        return <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />;
      case "synced":
        return <Cloud className="w-3 h-3 text-green-400/70" />;
      case "error":
        return <CloudOff className="w-3 h-3 text-red-400/70" />;
      default:
        return <Cloud className="w-3 h-3 text-muted-foreground/40" />;
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
          <div className="flex items-center justify-center w-5 h-5">
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

/* macOS-style traffic light close/minimize buttons */
function MacTrafficLights({ onClose }: { onClose: () => void }) {
  const handleMinimize = () => getCurrentWebviewWindow().minimize();

  return (
    <div className="macos-btn-group flex items-center gap-2 pl-3.5 pr-2">
      <button onClick={onClose} className="macos-btn macos-btn-close">
        <svg viewBox="0 0 12 12" fill="none" stroke="currentColor">
          <path d="M3 3l6 6M9 3l-6 6" />
        </svg>
      </button>
      <button onClick={handleMinimize} className="macos-btn macos-btn-minimize">
        <svg viewBox="0 0 12 12" fill="none" stroke="currentColor">
          <path d="M2 6h8" />
        </svg>
      </button>
      <div className="macos-btn macos-btn-fullscreen" />
    </div>
  );
}

/* Windows/Linux-style square icon buttons */
function WinLinuxButtons({ onClose }: { onClose: () => void }) {
  const isPinned = useSettingsStore((s) => s.isPinned);
  const setIsPinned = useSettingsStore((s) => s.setIsPinned);

  const handleMinimize = () => getCurrentWebviewWindow().minimize();
  const handleTogglePin = async () => {
    const win = getCurrentWebviewWindow();
    const next = !isPinned;
    await win.setAlwaysOnTop(next);
    setIsPinned(next);
  };

  return (
    <div className="flex items-center gap-0.5">
      <button
        onClick={handleTogglePin}
        className="flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
      >
        {isPinned ? <Pin className="w-3 h-3" /> : <PinOff className="w-3 h-3" />}
      </button>
      <button
        onClick={handleMinimize}
        className="flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
      >
        <Minus className="w-3 h-3" />
      </button>
      <button
        onClick={onClose}
        className="flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

/* Pin button standalone (used on macOS right side) */
function PinButton() {
  const isPinned = useSettingsStore((s) => s.isPinned);
  const setIsPinned = useSettingsStore((s) => s.setIsPinned);

  const handleTogglePin = async () => {
    const win = getCurrentWebviewWindow();
    const next = !isPinned;
    await win.setAlwaysOnTop(next);
    setIsPinned(next);
  };

  return (
    <button
      onClick={handleTogglePin}
      className="flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
    >
      {isPinned ? <Pin className="w-3 h-3" /> : <PinOff className="w-3 h-3" />}
    </button>
  );
}

function TitleText() {
  const { t } = useTranslation();
  return (
    <div data-tauri-drag-region className="flex items-center gap-1.5">
      <span data-tauri-drag-region className="text-sm2 font-medium text-muted-foreground tracking-wide uppercase">
        {t("titleBar.clipboard")}
      </span>
      <SyncIndicator />
    </div>
  );
}

export function TitleBar({ onClose }: Props) {
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

  // macOS: traffic lights left, title center, pin right
  if (platform === "macos") {
    return (
      <div data-tauri-drag-region className={`flex items-center justify-between h-8 bg-card/80 backdrop-blur-sm border-b border-border/50 select-none shrink-0 ${blurClass}`}>
        <MacTrafficLights onClose={onClose} />
        <TitleText />
        <div className="pr-2">
          <PinButton />
        </div>
      </div>
    );
  }

  // Linux with buttons on left
  if (platform === "linux" && buttonPosition === "left") {
    return (
      <div data-tauri-drag-region className="flex items-center justify-between h-8 px-1 bg-card/80 backdrop-blur-sm border-b border-border/50 select-none shrink-0">
        <div className="pl-1">
          <WinLinuxButtons onClose={onClose} />
        </div>
        <div data-tauri-drag-region className="flex-1" />
        <div className="pr-2">
          <TitleText />
        </div>
      </div>
    );
  }

  // Windows / Linux (buttons right, default)
  return (
    <div data-tauri-drag-region className="flex items-center justify-between h-8 px-3 bg-card/80 backdrop-blur-sm border-b border-border/50 select-none shrink-0">
      <TitleText />
      <div className="-mr-1">
        <WinLinuxButtons onClose={onClose} />
      </div>
    </div>
  );
}
