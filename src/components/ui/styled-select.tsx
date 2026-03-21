import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { CaretDown, Check } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  /** Optional group label — items with the same group are rendered under a shared heading */
  group?: string;
}

interface StyledSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
  /** Which side the dropdown opens on */
  side?: "bottom" | "top";
}

export function StyledSelect({
  value,
  onChange,
  options,
  placeholder,
  className,
  triggerClassName,
  disabled = false,
  side = "bottom",
}: StyledSelectProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const selectedOption = options.find((o) => o.value === value);

  // Build flat render list with group headers injected
  const renderItems = useMemo(() => {
    const hasGroups = options.some((o) => o.group);
    if (!hasGroups) {
      return options.map((o) => ({ type: "option" as const, option: o }));
    }
    const items: Array<
      | { type: "group"; label: string }
      | { type: "option"; option: SelectOption }
    > = [];
    let lastGroup: string | undefined;
    for (const o of options) {
      if (o.group && o.group !== lastGroup) {
        items.push({ type: "group", label: o.group });
        lastGroup = o.group;
      }
      items.push({ type: "option", option: o });
    }
    return items;
  }, [options]);

  // Selectable items only (for keyboard navigation indexing)
  const selectableIndices = useMemo(
    () =>
      renderItems
        .map((item, i) => (item.type === "option" ? i : -1))
        .filter((i) => i >= 0),
    [renderItems],
  );

  const close = useCallback(() => {
    setOpen(false);
    setFocusedIndex(-1);
  }, []);

  // Position the dropdown relative to the trigger using fixed positioning (portal)
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const maxHeight = 192; // 12rem
    const resolvedSide =
      side === "top" || (side === "bottom" && spaceBelow < maxHeight && spaceAbove > spaceBelow)
        ? "top"
        : "bottom";

    setDropdownStyle({
      position: "fixed",
      left: rect.left,
      width: rect.width,
      zIndex: 9999,
      ...(resolvedSide === "bottom"
        ? { top: rect.bottom + 4 }
        : { bottom: window.innerHeight - rect.top + 4 }),
    });
  }, [side]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        listRef.current?.parentElement?.contains(target)
      ) {
        return;
      }
      close();
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, close]);

  // Reposition on scroll/resize while open
  useEffect(() => {
    if (!open) return;
    updatePosition();
    const handleUpdate = () => updatePosition();
    window.addEventListener("scroll", handleUpdate, true);
    window.addEventListener("resize", handleUpdate);
    return () => {
      window.removeEventListener("scroll", handleUpdate, true);
      window.removeEventListener("resize", handleUpdate);
    };
  }, [open, updatePosition]);

  const focusValue = useCallback(
    (val: string) => {
      const idx = renderItems.findIndex(
        (item) => item.type === "option" && item.option.value === val,
      );
      setFocusedIndex(idx >= 0 ? idx : selectableIndices[0] ?? -1);
    },
    [renderItems, selectableIndices],
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;
      switch (e.key) {
        case "Enter":
        case " ":
          e.preventDefault();
          if (open && focusedIndex >= 0) {
            const item = renderItems[focusedIndex];
            if (item.type === "option") {
              onChange(item.option.value);
              close();
            }
          } else {
            setOpen(true);
            focusValue(value);
          }
          break;
        case "ArrowDown": {
          e.preventDefault();
          if (!open) {
            setOpen(true);
            focusValue(value);
          } else {
            const curPos = selectableIndices.indexOf(focusedIndex);
            const next = selectableIndices[curPos + 1];
            if (next !== undefined) setFocusedIndex(next);
          }
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          if (open) {
            const curPos = selectableIndices.indexOf(focusedIndex);
            const prev = selectableIndices[curPos - 1];
            if (prev !== undefined) setFocusedIndex(prev);
          }
          break;
        }
        case "Escape":
          e.preventDefault();
          close();
          break;
      }
    },
    [open, focusedIndex, renderItems, selectableIndices, value, onChange, close, disabled, focusValue],
  );

  // Scroll focused item into view (within dropdown only, never page)
  useEffect(() => {
    if (!open || focusedIndex < 0 || !listRef.current) return;
    const container = listRef.current;
    const el = container.children[focusedIndex] as HTMLElement | undefined;
    if (!el) return;
    const elTop = el.offsetTop;
    const elBottom = elTop + el.offsetHeight;
    if (elTop < container.scrollTop) {
      container.scrollTop = elTop;
    } else if (elBottom > container.scrollTop + container.clientHeight) {
      container.scrollTop = elBottom - container.clientHeight;
    }
  }, [focusedIndex, open]);

  const dropdown = open
    ? createPortal(
        <div className="styled-select-content" style={dropdownStyle}>
          <div
            ref={listRef}
            role="listbox"
            className="styled-select-viewport"
          >
            {renderItems.map((item, i) => {
              if (item.type === "group") {
                return (
                  <div key={`g-${item.label}`} className="styled-select-group">
                    {item.label}
                  </div>
                );
              }
              const { option } = item;
              const isSelected = option.value === value;
              const isFocused = i === focusedIndex;
              return (
                <div
                  key={option.value}
                  role="option"
                  aria-selected={isSelected}
                  data-focused={isFocused || undefined}
                  className={cn(
                    "styled-select-item",
                    option.group && "pl-4",
                  )}
                  onMouseEnter={() => setFocusedIndex(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onChange(option.value);
                    close();
                  }}
                >
                  <span className="truncate">{option.label}</span>
                  {isSelected && (
                    <Check className="styled-select-check" />
                  )}
                </div>
              );
            })}
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <div className={cn("styled-select", className)}>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setOpen(!open);
            if (!open) focusValue(value);
          }
        }}
        onKeyDown={handleKeyDown}
        className={cn("styled-select-trigger", triggerClassName)}
      >
        <span className="truncate">
          {selectedOption?.label ?? placeholder ?? ""}
        </span>
        <CaretDown
          className={cn(
            "styled-select-chevron",
            open && "rotate-180",
          )}
        />
      </button>
      {dropdown}
    </div>
  );
}
