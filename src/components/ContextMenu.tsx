import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronRight } from "lucide-react";

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
  divider?: boolean;
  children?: ContextMenuItem[];
}

interface Props {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

const MENU_PADDING = 6;

export function ContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [subMenuIndex, setSubMenuIndex] = useState(-1);

  // Compute safe position after first render
  useEffect(() => {
    if (!ref.current) return;
    const menuEl = ref.current.querySelector(".context-menu") as HTMLElement;
    if (!menuEl) return;
    const rect = menuEl.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let fx = x;
    let fy = y;

    if (fx + rect.width > vw - MENU_PADDING) {
      fx = Math.max(MENU_PADDING, vw - rect.width - MENU_PADDING);
    }

    // Calculate available space and constrain maxHeight
    const spaceBelow = vh - y - MENU_PADDING;
    const spaceAbove = y - MENU_PADDING;

    if (rect.height <= spaceBelow) {
      // Fits below cursor
      fy = y;
    } else if (rect.height <= spaceAbove) {
      // Fits above cursor
      fy = y - rect.height;
    } else {
      // Doesn't fit either way — pin to top and constrain height
      fy = MENU_PADDING;
      menuEl.style.maxHeight = `${vh - MENU_PADDING * 2}px`;
    }

    setPos({ x: fx, y: fy });
  }, [x, y]);

  // Close on outside click or escape
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      const actionItems = items;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % actionItems.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) => (prev - 1 + actionItems.length) % actionItems.length);
      } else if (e.key === "Enter" && activeIndex >= 0 && activeIndex < actionItems.length) {
        e.preventDefault();
        const item = actionItems[activeIndex];
        if (item.onClick) {
          item.onClick();
          onClose();
        }
      }
    };
    document.addEventListener("mousedown", handleClick, true);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick, true);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose, items, activeIndex]);

  const handleItemClick = useCallback(
    (item: ContextMenuItem) => {
      if (item.children) return; // submenu items don't close on click
      if (item.onClick) {
        item.onClick();
        onClose();
      }
    },
    [onClose]
  );

  const maxH = window.innerHeight - MENU_PADDING * 2;

  const menu = (
    <div
      ref={ref}
      className="context-menu-overlay"
      style={{
        position: "fixed",
        left: pos?.x ?? x,
        top: pos?.y ?? y,
        opacity: pos ? 1 : 0,
        zIndex: 9999,
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        className="context-menu"
        style={{ maxHeight: maxH }}
      >
        {items.map((item, i) => (
          <div key={i} className="relative">
            {item.divider && <div className="context-menu-divider" />}
            <button
              className={`context-menu-item${item.danger ? " danger" : ""}${i === activeIndex ? " active" : ""}`}
              onClick={() => handleItemClick(item)}
              onMouseEnter={() => {
                setActiveIndex(i);
                setSubMenuIndex(item.children ? i : -1);
              }}
              onMouseLeave={() => {
                if (!item.children) {
                  setActiveIndex(-1);
                }
              }}
            >
              {item.icon && <span className="context-menu-icon">{item.icon}</span>}
              <span className="context-menu-label">{item.label}</span>
              {item.children && <ChevronRight className="w-3.5 h-3.5 opacity-50 ml-1 flex-shrink-0" />}
            </button>
            {item.children && subMenuIndex === i && (
              <SubMenu
                items={item.children}
                parentRef={ref}
                itemIndex={i}
                onClose={onClose}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return createPortal(menu, document.body);
}

function SubMenu({
  items,
  parentRef,
  itemIndex,
  onClose,
}: {
  items: ContextMenuItem[];
  parentRef: React.RefObject<HTMLDivElement | null>;
  itemIndex: number;
  onClose: () => void;
}) {
  const subRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    if (!subRef.current || !parentRef.current) return;
    const parentRect = parentRef.current.getBoundingClientRect();
    const subRect = subRef.current.getBoundingClientRect();
    const buttons = parentRef.current.querySelectorAll(".context-menu-item");
    const btn = buttons[itemIndex];
    if (!btn) return;

    const btnRect = btn.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Try right side first, then left
    let left = parentRect.right - 4;
    if (left + subRect.width > vw - MENU_PADDING) {
      left = parentRect.left - subRect.width + 4;
    }
    // Clamp left so submenu doesn't go off-screen
    if (left < MENU_PADDING) left = MENU_PADDING;

    let top = btnRect.top - 4;
    if (top + subRect.height > vh - MENU_PADDING) {
      top = Math.max(MENU_PADDING, vh - subRect.height - MENU_PADDING);
    }

    // Constrain submenu height to viewport
    const availableHeight = vh - top - MENU_PADDING;
    if (subRect.height > availableHeight) {
      subRef.current.style.maxHeight = `${availableHeight}px`;
    }

    setPos({ left, top });
  }, [parentRef, itemIndex]);

  return (
    <div
      ref={subRef}
      className="context-menu"
      style={{
        position: "fixed",
        left: pos?.left ?? 0,
        top: pos?.top ?? 0,
        opacity: pos ? 1 : 0,
        zIndex: 10000,
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {items.map((item, i) => (
        <div key={i}>
          {item.divider && <div className="context-menu-divider" />}
          <button
            className={`context-menu-item${item.danger ? " danger" : ""}`}
            onClick={() => {
              if (item.onClick) {
                item.onClick();
                onClose();
              }
            }}
          >
            {item.icon && <span className="context-menu-icon">{item.icon}</span>}
            <span className="context-menu-label">{item.label}</span>
          </button>
        </div>
      ))}
    </div>
  );
}
