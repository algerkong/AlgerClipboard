import { useState } from "react";
import { X, Minus, Pin, PinOff } from "lucide-react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useTranslation } from "react-i18next";

export function TitleBar() {
  const { t } = useTranslation();
  const [isPinned, setIsPinned] = useState(true);

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
      <span data-tauri-drag-region className="text-[11px] font-medium text-muted-foreground/70 tracking-wide uppercase">
        {t("titleBar.clipboard")}
      </span>
      <div className="flex items-center gap-0.5 -mr-1">
        <button
          onClick={handleTogglePin}
          className="flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-accent/50 transition-colors"
        >
          {isPinned ? <Pin className="w-3 h-3" /> : <PinOff className="w-3 h-3" />}
        </button>
        <button
          onClick={handleMinimize}
          className="flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-accent/50 transition-colors"
        >
          <Minus className="w-3 h-3" />
        </button>
        <button
          onClick={handleClose}
          className="flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
