import { useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { useSpotlightStore } from "@/stores/spotlightStore";
import { LucideIcon } from "./LucideIcon";

export function SpotlightInput() {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const mode = useSpotlightStore((s) => s.mode);
  const query = useSpotlightStore((s) => s.query);
  const visible = useSpotlightStore((s) => s.visible);
  const setQuery = useSpotlightStore((s) => s.setQuery);
  const resolveQuery = useSpotlightStore((s) => s.resolveQuery);
  const modes = useSpotlightStore((s) => s.modes);
  const switchMode = useSpotlightStore((s) => s.switchMode);
  const loading = useSpotlightStore((s) => s.loading);
  const selectAll = useSpotlightStore((s) => s._selectAll);

  const resolved = resolveQuery(query);
  const displayMode = resolved.isGlobal ? null : modes.get(resolved.activeMode);
  const fallbackMode = modes.get(mode);
  const iconKey = displayMode?.icon ?? "";
  const modeIcon = displayMode && (iconKey.startsWith("ph:") || iconKey.startsWith("lucide:")) ? (
    <LucideIcon name={iconKey} size={30} className="text-[var(--primary)]" />
  ) : (
    <MagnifyingGlass size={30} className="text-[var(--primary)]" />
  );
  const placeholder = displayMode
    ? t(displayMode.placeholder)
    : t("spotlight.placeholder.global", t("spotlight.placeholder.clipboard"));

  // Focus when Spotlight becomes visible or mode changes
  useEffect(() => {
    if (!visible) return;
    const focusInput = () => {
      inputRef.current?.focus();
    };
    requestAnimationFrame(() => {
      focusInput();
      setTimeout(focusInput, 50);
      setTimeout(focusInput, 150);
    });
  }, [visible, mode]);

  // Select all text when _selectAll flag is set (on reopen with preserved query)
  useEffect(() => {
    if (selectAll && visible && inputRef.current) {
      inputRef.current.select();
      useSpotlightStore.setState({ _selectAll: false });
    }
  }, [selectAll, visible]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  };

  return (
    <div className="spotlight-input-row">
      <div className="spotlight-mode-icon">{modeIcon}</div>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={handleChange}
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
        {displayMode ? t(displayMode.name) : (fallbackMode ? t(fallbackMode.name) : mode)}
      </button>
    </div>
  );
}
