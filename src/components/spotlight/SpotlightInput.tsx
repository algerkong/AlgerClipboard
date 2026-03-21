import { useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ClipboardList, LayoutGrid, Languages, Search } from "lucide-react";
import { useSpotlightStore } from "@/stores/spotlightStore";

const ICON_MAP: Record<string, React.ReactNode> = {
  "lucide:clipboard-list": <ClipboardList className="w-[18px] h-[18px]" />,
  "lucide:layout-grid": <LayoutGrid className="w-[18px] h-[18px]" />,
  "lucide:languages": <Languages className="w-[18px] h-[18px]" />,
};

export function SpotlightInput() {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const mode = useSpotlightStore((s) => s.mode);
  const query = useSpotlightStore((s) => s.query);
  const setQuery = useSpotlightStore((s) => s.setQuery);
  const modes = useSpotlightStore((s) => s.modes);
  const switchMode = useSpotlightStore((s) => s.switchMode);
  const loading = useSpotlightStore((s) => s.loading);

  const currentMode = modes.get(mode);
  const iconKey = currentMode?.icon ?? "";
  const modeIcon = ICON_MAP[iconKey] ?? <Search className="w-[18px] h-[18px]" />;
  const placeholder = currentMode
    ? t(currentMode.placeholder)
    : t("spotlight.placeholder.clipboard");

  useEffect(() => {
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, [mode]);

  return (
    <div className="spotlight-input-row">
      <div className="spotlight-mode-icon">{modeIcon}</div>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="spotlight-input"
        autoFocus
        spellCheck={false}
        autoComplete="off"
      />
      {loading && <div className="spotlight-spinner" />}
      <button
        onClick={() => switchMode(1)}
        className="spotlight-mode-tag"
        tabIndex={-1}
      >
        {currentMode ? t(currentMode.name) : mode}
      </button>
    </div>
  );
}
