import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlignLeft, FolderOpen, Image, LayoutGrid, Settings, Star, Tag } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useClipboardStore } from "@/stores/clipboardStore";
import { openTagManagerWindow } from "@/services/tagManagerWindowService";
import type { ContentType } from "@/types";
import { cn } from "@/lib/utils";

const filters: { labelKey: string; icon: React.ReactNode; filter: ContentType | null; isFavorites?: boolean }[] = [
  { labelKey: "typeFilter.all", icon: <LayoutGrid className="h-[var(--app-tab-icon-size)] w-[var(--app-tab-icon-size)]" />, filter: null },
  { labelKey: "typeFilter.text", icon: <AlignLeft className="h-[var(--app-tab-icon-size)] w-[var(--app-tab-icon-size)]" />, filter: "PlainText" },
  { labelKey: "typeFilter.image", icon: <Image className="h-[var(--app-tab-icon-size)] w-[var(--app-tab-icon-size)]" />, filter: "Image" },
  { labelKey: "typeFilter.file", icon: <FolderOpen className="h-[var(--app-tab-icon-size)] w-[var(--app-tab-icon-size)]" />, filter: "FilePaths" },
  { labelKey: "typeFilter.starred", icon: <Star className="h-[var(--app-tab-icon-size)] w-[var(--app-tab-icon-size)]" />, filter: null, isFavorites: true },
];

export function TypeFilter() {
  const { t } = useTranslation();
  const typeFilter = useClipboardStore((s) => s.typeFilter);
  const showFavoritesOnly = useClipboardStore((s) => s.showFavoritesOnly);
  const showTagPanel = useClipboardStore((s) => s.showTagPanel);
  const tagFilter = useClipboardStore((s) => s.tagFilter);
  const tagSummaries = useClipboardStore((s) => s.tagSummaries);
  const setTypeFilter = useClipboardStore((s) => s.setTypeFilter);
  const setShowFavoritesOnly = useClipboardStore((s) => s.setShowFavoritesOnly);
  const setTagFilter = useClipboardStore((s) => s.setTagFilter);
  const setShowTagPanel = useClipboardStore((s) => s.setShowTagPanel);
  const primaryButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const secondaryButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [activeRow, setActiveRow] = useState<"primary" | "secondary">("primary");
  const tabStyle = {
    gap: "var(--app-tab-gap)",
    paddingInline: "var(--app-tab-px)",
    paddingBlock: "var(--app-tab-py)",
    fontSize: "var(--app-tab-font-size)",
  } as const;
  const tabIconStyle = {
    width: "var(--app-tab-icon-size)",
    height: "var(--app-tab-icon-size)",
  } as const;
  const secondaryTabs = useMemo(() => [null, ...tagSummaries.map(({ tag }) => tag)], [tagSummaries]);

  const handlePrimaryClick = useCallback((item: typeof filters[number] | "tag") => {
    setActiveRow("primary");
    if (item === "tag") {
      setShowTagPanel(true);
      return;
    }

    if (item.isFavorites) {
      setShowFavoritesOnly(!showFavoritesOnly);
      return;
    }

    setShowFavoritesOnly(false);
    setTypeFilter(item.filter);
  }, [setShowFavoritesOnly, setShowTagPanel, setTypeFilter, showFavoritesOnly]);

  const handleSecondaryClick = useCallback((tag: string | null) => {
    setActiveRow("secondary");
    setTagFilter(tag);
  }, [setTagFilter]);

  const getActivePrimaryIndex = useCallback(() => {
    if (showTagPanel) return filters.length;
    if (showFavoritesOnly) return filters.findIndex((item) => item.isFavorites);
    return filters.findIndex((item) => !item.isFavorites && item.filter === typeFilter);
  }, [showFavoritesOnly, showTagPanel, typeFilter]);

  const isPrimaryActive = (item: typeof filters[number] | "tag") => {
    if (item === "tag") return showTagPanel;
    if (item.isFavorites) return showFavoritesOnly;
    if (showFavoritesOnly || showTagPanel) return false;
    return typeFilter === item.filter;
  };

  useEffect(() => {
    const activeIndex = showTagPanel ? filters.length : getActivePrimaryIndex();
    primaryButtonRefs.current[activeIndex]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [getActivePrimaryIndex, showTagPanel]);

  useEffect(() => {
    if (!showTagPanel) {
      return;
    }

    const activeIndex = Math.max(0, secondaryTabs.findIndex((item) => item === tagFilter));
    secondaryButtonRefs.current[activeIndex]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [secondaryTabs, showTagPanel, tagFilter]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
      const target = event.target as HTMLElement;
      if ((target.tagName === "INPUT" || target.tagName === "TEXTAREA") && !event.defaultPrevented) {
        return;
      }

      if (showTagPanel && event.key === "ArrowDown") {
        event.preventDefault();
        setActiveRow("secondary");
        return;
      }

      if (showTagPanel && event.key === "ArrowUp") {
        event.preventDefault();
        setActiveRow("primary");
        return;
      }

      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
        return;
      }

      event.preventDefault();

      if (showTagPanel && activeRow === "secondary") {
        const currentIndex = Math.max(0, secondaryTabs.findIndex((item) => item === tagFilter));
        const nextIndex = event.key === "ArrowLeft"
          ? currentIndex <= 0 ? secondaryTabs.length - 1 : currentIndex - 1
          : currentIndex >= secondaryTabs.length - 1 ? 0 : currentIndex + 1;
        handleSecondaryClick(secondaryTabs[nextIndex]);
        return;
      }

      const primaryTabs = [...filters, "tag" as const];
      const currentIndex = getActivePrimaryIndex();
      const nextIndex = event.key === "ArrowLeft"
        ? currentIndex <= 0 ? primaryTabs.length - 1 : currentIndex - 1
        : currentIndex >= primaryTabs.length - 1 ? 0 : currentIndex + 1;
      handlePrimaryClick(primaryTabs[nextIndex]);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeRow, getActivePrimaryIndex, handlePrimaryClick, handleSecondaryClick, secondaryTabs, showTagPanel, tagFilter]);

  return (
    <div className="px-3 pb-2 pt-1">
      <div className="surface-panel overflow-hidden rounded-[1.25rem] shadow-sm">
        <div className="tab-scroll-area overflow-x-auto px-2 py-1.5">
          <div className="inline-flex min-w-full items-center gap-1">
          {filters.map((item, index) => (
            <button
              key={item.labelKey}
              ref={(element) => {
                primaryButtonRefs.current[index] = element;
              }}
              onClick={() => handlePrimaryClick(item)}
              style={tabStyle}
              data-active={isPrimaryActive(item)}
              className={cn(
                "filter-pill flex shrink-0 items-center whitespace-nowrap px-0 font-medium leading-none text-muted-foreground transition-all",
                isPrimaryActive(item)
                  ? "text-foreground"
                  : "hover:border-primary/20 hover:bg-accent/50 hover:text-foreground"
              )}
            >
              <span style={tabIconStyle} className="inline-flex items-center justify-center">{item.icon}</span>
              <span>{t(item.labelKey)}</span>
            </button>
          ))}

          <button
            ref={(element) => {
              primaryButtonRefs.current[filters.length] = element;
            }}
            onClick={() => handlePrimaryClick("tag")}
            style={tabStyle}
            data-active={isPrimaryActive("tag")}
            className={cn(
              "filter-pill flex shrink-0 items-center whitespace-nowrap px-0 font-medium leading-none text-muted-foreground transition-all",
              isPrimaryActive("tag")
                ? "text-foreground"
                : "hover:border-primary/20 hover:bg-accent/50 hover:text-foreground"
            )}
          >
            <Tag style={tabIconStyle} />
            <span>{t("typeFilter.tag")}</span>
          </button>
        </div>
      </div>

      {showTagPanel && (
        <div className="border-t border-border/10 bg-background/20 px-2.5 py-2">
          <div className="mb-1 flex items-center justify-between px-1">
            <span className="text-2xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
              {t("tags.title")}
            </span>
          </div>
          <div className="tab-scroll-area overflow-x-auto">
            <div className="inline-flex min-w-full items-center gap-1">
              <button
                ref={(element) => {
                  secondaryButtonRefs.current[0] = element;
                }}
                onClick={() => handleSecondaryClick(null)}
                style={tabStyle}
                data-active={tagFilter === null}
                className={cn(
                  "filter-pill flex shrink-0 items-center whitespace-nowrap px-0 font-medium leading-none text-muted-foreground transition-all",
                  tagFilter === null
                    ? "text-foreground"
                    : "hover:border-primary/20 hover:bg-accent/50 hover:text-foreground"
                )}
              >
                <span>{t("tags.all")}</span>
              </button>

              {tagSummaries.map(({ tag, count }, index) => (
                <button
                  key={tag}
                  ref={(element) => {
                    secondaryButtonRefs.current[index + 1] = element;
                  }}
                  onClick={() => handleSecondaryClick(tag)}
                  style={tabStyle}
                  data-active={tagFilter === tag}
                  className={cn(
                    "filter-pill flex shrink-0 items-center whitespace-nowrap px-0 font-medium leading-none text-muted-foreground transition-all",
                    tagFilter === tag
                      ? "text-foreground"
                      : "hover:border-primary/20 hover:bg-accent/50 hover:text-foreground"
                  )}
                >
                  <span>{tag}</span>
                  <span className="meta-pill px-1.5 py-0.5 text-[10px] leading-none text-muted-foreground">
                    {count}
                  </span>
                </button>
              ))}

              <button
                onClick={() => void openTagManagerWindow()}
                style={tabStyle}
                className="filter-pill ml-1 flex shrink-0 items-center whitespace-nowrap px-0 font-medium leading-none text-muted-foreground transition-all hover:border-primary/20 hover:bg-accent/50 hover:text-foreground"
              >
                <Settings style={tabIconStyle} />
                <span>{t("tags.manage")}</span>
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
