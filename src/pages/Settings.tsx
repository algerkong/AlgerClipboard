import { ArrowLeft, Sun, Moon, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useSettingsStore } from "@/stores/settingsStore";
import { cn } from "@/lib/utils";

interface SettingsProps {
  onBack: () => void;
}

export function SettingsPage({ onBack }: SettingsProps) {
  const theme = useSettingsStore((s) => s.theme);
  const maxHistory = useSettingsStore((s) => s.maxHistory);
  const pasteAndClose = useSettingsStore((s) => s.pasteAndClose);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const setMaxHistory = useSettingsStore((s) => s.setMaxHistory);
  const setPasteAndClose = useSettingsStore((s) => s.setPasteAndClose);

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex items-center gap-2 p-2 shrink-0">
        <Button variant="ghost" size="icon-sm" onClick={onBack}>
          <ArrowLeft className="size-4" />
        </Button>
        <h2 className="text-sm font-semibold">Settings</h2>
      </div>
      <Separator />

      {/* Settings content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Theme */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Theme</label>
          <div className="flex gap-2">
            <Button
              variant={theme === "light" ? "default" : "outline"}
              size="sm"
              className={cn("flex-1 gap-1.5")}
              onClick={() => setTheme("light")}
            >
              <Sun className="size-3.5" />
              Light
            </Button>
            <Button
              variant={theme === "dark" ? "default" : "outline"}
              size="sm"
              className={cn("flex-1 gap-1.5")}
              onClick={() => setTheme("dark")}
            >
              <Moon className="size-3.5" />
              Dark
            </Button>
            <Button
              variant={theme === "system" ? "default" : "outline"}
              size="sm"
              className={cn("flex-1 gap-1.5")}
              onClick={() => setTheme("system")}
            >
              <Monitor className="size-3.5" />
              System
            </Button>
          </div>
        </div>

        <Separator />

        {/* Max history */}
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="max-history">
            Maximum history entries
          </label>
          <Input
            id="max-history"
            type="number"
            min={10}
            max={10000}
            value={maxHistory}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val) && val > 0) {
                setMaxHistory(val);
              }
            }}
            className="w-32 h-8"
          />
          <p className="text-xs text-muted-foreground">
            Number of clipboard entries to keep in history
          </p>
        </div>

        <Separator />

        {/* Paste and close */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <label className="text-sm font-medium" htmlFor="paste-close">
              Close panel after paste
            </label>
            <p className="text-xs text-muted-foreground">
              Automatically hide the panel after pasting an entry
            </p>
          </div>
          <button
            id="paste-close"
            role="switch"
            aria-checked={pasteAndClose}
            onClick={() => setPasteAndClose(!pasteAndClose)}
            className={cn(
              "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
              pasteAndClose ? "bg-primary" : "bg-input"
            )}
          >
            <span
              className={cn(
                "pointer-events-none block size-4 rounded-full bg-background shadow-lg ring-0 transition-transform",
                pasteAndClose ? "translate-x-4" : "translate-x-0"
              )}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
