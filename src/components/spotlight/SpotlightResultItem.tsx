import type { SpotlightResult } from "@/spotlight/types";
import { useEffect, useRef } from "react";
import { Languages, AlertTriangle } from "lucide-react";

interface Props {
  result: SpotlightResult;
  selected: boolean;
  index: number;
  onClick: () => void;
}

export function SpotlightResultItem({ result, selected, index, onClick }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selected && ref.current) {
      ref.current.scrollIntoView({ block: "nearest" });
    }
  }, [selected]);

  const renderIcon = () => {
    if (!result.icon) {
      return (
        <div className="spotlight-result-icon spotlight-result-icon--placeholder">
          <span>{result.title.charAt(0).toUpperCase()}</span>
        </div>
      );
    }

    if (typeof result.icon === "string") {
      if (result.icon.startsWith("data:") || result.icon.startsWith("http")) {
        return (
          <img src={result.icon} alt="" className="spotlight-result-icon" />
        );
      }
      // Lucide icon references
      if (result.icon === "lucide:languages") {
        return (
          <div className="spotlight-result-icon spotlight-result-icon--emoji">
            <Languages className="w-4 h-4" />
          </div>
        );
      }
      if (result.icon === "lucide:alert") {
        return (
          <div className="spotlight-result-icon spotlight-result-icon--emoji">
            <AlertTriangle className="w-4 h-4" />
          </div>
        );
      }
      return (
        <div className="spotlight-result-icon spotlight-result-icon--emoji">
          {result.icon}
        </div>
      );
    }

    if (result.icon.type === "thumbnail") {
      return (
        <img
          src={`data:image/png;base64,${result.icon.data}`}
          alt=""
          className="spotlight-result-icon"
        />
      );
    }

    return null;
  };

  return (
    <div
      ref={ref}
      onClick={onClick}
      className={`spotlight-result-item ${selected ? "is-selected" : ""}`}
    >
      <span className="spotlight-result-index">{index + 1}</span>
      {renderIcon()}
      <div className="spotlight-result-text">
        <div className="spotlight-result-title">{result.title}</div>
        {result.subtitle && (
          <div className="spotlight-result-subtitle">{result.subtitle}</div>
        )}
      </div>
      {result.badge && (
        <span className="spotlight-result-badge">{result.badge}</span>
      )}
    </div>
  );
}
