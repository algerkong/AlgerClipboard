import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

interface SplitViewProps {
  left: React.ReactNode;
  right: React.ReactNode;
  defaultRatio?: number;
  minRatio?: number;
  maxRatio?: number;
  className?: string;
}

export function SplitView({
  left,
  right,
  defaultRatio = 0.5,
  minRatio = 0.25,
  maxRatio = 0.75,
  className,
}: SplitViewProps) {
  const [ratio, setRatio] = useState(defaultRatio);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;

    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      setRatio(Math.min(maxRatio, Math.max(minRatio, x)));
    };

    const onMouseUp = () => {
      dragging.current = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [minRatio, maxRatio]);

  return (
    <div ref={containerRef} className={cn("flex h-full overflow-hidden", className)}>
      <div className="overflow-hidden" style={{ width: `${ratio * 100}%` }}>
        {left}
      </div>
      <div
        onMouseDown={handleMouseDown}
        className="group relative w-1 shrink-0 cursor-col-resize hover:bg-primary/20 transition-colors"
      >
        <div className="absolute inset-y-0 -left-1 -right-1" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-1 rounded-full bg-border/40 group-hover:bg-primary/50 transition-colors" />
      </div>
      <div className="flex-1 overflow-hidden">
        {right}
      </div>
    </div>
  );
}
