import { X, Minus, Pin, PinOff, Cloud, CloudOff, Loader2 } from "lucide-react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "@/stores/settingsStore";
import { useSyncStore } from "@/stores/syncStore";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
        <TooltipContent side="bottom" className="text-[10px]">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function TitleBar() {
  const { t } = useTranslation();
  const isPinned = useSettingsStore((s) => s.isPinned);
  const setIsPinned = useSettingsStore((s) => s.setIsPinned);

  const handleClose = () => getCurrentWebviewWindow().hide();
  const handleMinimize = () => getCurrentWebviewWindow().minimize();
  const handleTogglePin = async () => {
    const win = getCurrentWebviewWindow();
    const next = !isPinned;
    await win.setAlwaysOnTop(next);
    setIsPinned(next);
  };

  return (
    <div data-tauri-drag-region className="flex items-center justify-between h-8 px-3 bg-card/80 backdrop-blur-sm border-b border-border/50 select-none shrink-0">
      <div data-tauri-drag-region className="flex items-center gap-1.5">
        <span data-tauri-drag-region className="text-[11px] font-medium text-muted-foreground tracking-wide uppercase">
          {t("titleBar.clipboard")}
        </span>
        <SyncIndicator />
      </div>
      <div className="flex items-center gap-0.5 -mr-1">
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
          onClick={handleClose}
          className="flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
