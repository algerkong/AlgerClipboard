import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  divider?: boolean;
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

  // Compute safe position after first render
  useEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let fx = x;
    let fy = y;

    // Horizontal: prefer right, flip left if overflow
    if (fx + rect.width > vw - MENU_PADDING) {
      fx = Math.max(MENU_PADDING, vw - rect.width - MENU_PADDING);
    }

    // Vertical: prefer below, flip above if overflow
    if (fy + rect.height > vh - MENU_PADDING) {
      fy = y - rect.height;
      if (fy < MENU_PADDING) {
        // Still doesn't fit — pin to top and let it scroll
        fy = MENU_PADDING;
      }
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
      // Keyboard navigation
      const actionItems = items.filter(() => true); // all items
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % actionItems.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) => (prev - 1 + actionItems.length) % actionItems.length);
      } else if (e.key === "Enter" && activeIndex >= 0 && activeIndex < actionItems.length) {
        e.preventDefault();
        actionItems[activeIndex].onClick();
        onClose();
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
      item.onClick();
      onClose();
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
        // Hidden until position is computed to avoid flash
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
          <div key={i}>
            {item.divider && <div className="context-menu-divider" />}
            <button
              className={`context-menu-item${item.danger ? " danger" : ""}${i === activeIndex ? " active" : ""}`}
              onClick={() => handleItemClick(item)}
              onMouseEnter={() => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(-1)}
            >
              {item.icon && <span className="context-menu-icon">{item.icon}</span>}
              <span className="context-menu-label">{item.label}</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  return createPortal(menu, document.body);
}
