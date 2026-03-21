import type { SpotlightResult } from "@/spotlight/types";
import { useEffect, useRef } from "react";
import { SpeakerHigh, SpeakerLow } from "@phosphor-icons/react";
import { LucideIcon } from "./LucideIcon";

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
    if (!result.icon) return null;

    if (typeof result.icon === "string") {
      // Image URL or data URI
      if (result.icon.startsWith("data:") || result.icon.startsWith("http")) {
        return (
          <img src={result.icon} alt="" className="spotlight-result-icon" />
        );
      }
      // Phosphor or Lucide icon reference
      if (result.icon.startsWith("ph:") || result.icon.startsWith("lucide:")) {
        return (
          <div className="spotlight-result-icon spotlight-result-icon--emoji">
            <LucideIcon name={result.icon} size={20} />
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

  const actionIconMap: Record<string, React.ReactNode> = {
    "ph:speaker-high": <SpeakerHigh size={14} weight="duotone" />,
    "ph:speaker-low": <SpeakerLow size={14} weight="duotone" />,
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
      {result.actions && result.actions.length > 0 && (
        <div className="spotlight-result-actions">
          {result.actions.map((action) => (
            <button
              key={action.id}
              className="spotlight-result-action-btn"
              title={action.id.includes("src") ? "Play source" : "Play translation"}
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                action.handler();
              }}
            >
              {actionIconMap[action.label] ?? action.label}
            </button>
          ))}
        </div>
      )}
      {result.badge && (
        <span className="spotlight-result-badge">{result.badge}</span>
      )}
    </div>
  );
}
