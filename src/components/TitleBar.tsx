import { useState } from "react";
import { X, Minus, Pin, PinOff } from "lucide-react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { Button } from "./ui/button";

export function TitleBar() {
  const [isPinned, setIsPinned] = useState(true); // alwaysOnTop state

  const handleClose = () => getCurrentWebviewWindow().hide();
  const handleMinimize = () => getCurrentWebviewWindow().minimize();
  const handleTogglePin = async () => {
    const win = getCurrentWebviewWindow();
    const newPinned = !isPinned;
    await win.setAlwaysOnTop(newPinned);
    setIsPinned(newPinned);
  };

  return (
    <div
      data-tauri-drag-region
      className="flex items-center justify-between h-8 bg-background border-b border-border select-none"
    >
      <span
        data-tauri-drag-region
        className="text-xs font-medium pl-3 text-muted-foreground"
      >
        AlgerClipboard
      </span>
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-none hover:bg-accent"
          onClick={handleTogglePin}
        >
          {isPinned ? (
            <Pin className="h-3.5 w-3.5" />
          ) : (
            <PinOff className="h-3.5 w-3.5" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-none hover:bg-accent"
          onClick={handleMinimize}
        >
          <Minus className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-none hover:bg-destructive hover:text-destructive-foreground"
          onClick={handleClose}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
