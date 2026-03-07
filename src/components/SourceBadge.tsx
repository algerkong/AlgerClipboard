import { type ComponentType, useEffect, useMemo, useState } from "react";
import { Globe, FolderOpen, SquareTerminal, Monitor, Code2 } from "lucide-react";
import { openUrl } from "@/services/settingsService";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface SourceBadgeProps {
  sourceApp: string | null;
  sourceUrl?: string | null;
  className?: string;
  textClassName?: string;
  iconClassName?: string;
}

interface AppBadgeMeta {
  label: string;
  className: string;
  icon?: ComponentType<{ className?: string }>;
}

const APP_BADGE_MAP: Record<string, AppBadgeMeta> = {
  "Google Chrome": { label: "C", className: "bg-amber-500/18 text-amber-300 border border-amber-500/25" },
  Chromium: { label: "C", className: "bg-slate-500/18 text-slate-200 border border-slate-500/25" },
  "Microsoft Edge": { label: "E", className: "bg-cyan-500/18 text-cyan-300 border border-cyan-500/25" },
  Brave: { label: "B", className: "bg-orange-500/18 text-orange-300 border border-orange-500/25" },
  Firefox: { label: "F", className: "bg-orange-500/18 text-orange-300 border border-orange-500/25" },
  Safari: { label: "S", className: "bg-sky-500/18 text-sky-300 border border-sky-500/25" },
  Arc: { label: "A", className: "bg-fuchsia-500/18 text-fuchsia-300 border border-fuchsia-500/25" },
  "VS Code": { label: "VS", className: "bg-sky-500/18 text-sky-300 border border-sky-500/25", icon: Code2 },
  Finder: { label: "F", className: "bg-blue-500/18 text-blue-300 border border-blue-500/25", icon: FolderOpen },
  "File Explorer": { label: "FE", className: "bg-yellow-500/18 text-yellow-300 border border-yellow-500/25", icon: FolderOpen },
  Terminal: { label: "T", className: "bg-zinc-500/18 text-zinc-300 border border-zinc-500/25", icon: SquareTerminal },
  iTerm: { label: "IT", className: "bg-zinc-500/18 text-zinc-300 border border-zinc-500/25", icon: SquareTerminal },
  WezTerm: { label: "W", className: "bg-zinc-500/18 text-zinc-300 border border-zinc-500/25", icon: SquareTerminal },
};

function getAppBadgeMeta(sourceApp: string): AppBadgeMeta {
  return APP_BADGE_MAP[sourceApp] ?? {
    label: sourceApp.slice(0, 2).toUpperCase(),
    className: "bg-muted/60 text-foreground/80 border border-border/60",
    icon: Monitor,
  };
}

function getFaviconCandidates(sourceUrl: string): string[] {
  try {
    const url = new URL(sourceUrl);
    return [
      `${url.origin}/favicon.ico`,
      `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(sourceUrl)}`,
    ];
  } catch {
    return [];
  }
}

export function SourceBadge({
  sourceApp,
  sourceUrl,
  className,
  textClassName,
  iconClassName,
}: SourceBadgeProps) {
  const { t } = useTranslation();
  const [faviconIndex, setFaviconIndex] = useState(0);

  const faviconCandidates = useMemo(
    () => (sourceUrl ? getFaviconCandidates(sourceUrl) : []),
    [sourceUrl],
  );

  useEffect(() => {
    setFaviconIndex(0);
  }, [sourceUrl]);

  if (!sourceApp) {
    return null;
  }

  const badgeMeta = getAppBadgeMeta(sourceApp);
  const BadgeIcon = badgeMeta.icon ?? Globe;
  const faviconSrc = faviconCandidates[faviconIndex];

  const content = (
    <>
      <span
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden rounded-[4px]",
          iconClassName,
        )}
      >
        {faviconSrc ? (
          <img
            src={faviconSrc}
            alt=""
            className="h-full w-full object-cover"
            onError={() => {
              if (faviconIndex < faviconCandidates.length - 1) {
                setFaviconIndex((current) => current + 1);
              } else {
                setFaviconIndex(faviconCandidates.length);
              }
            }}
          />
        ) : (
          <span
            className={cn(
              "flex h-full w-full items-center justify-center rounded-[4px] text-[9px] font-semibold leading-none",
              badgeMeta.className,
            )}
          >
            {badgeMeta.icon ? <BadgeIcon className="h-2.5 w-2.5" /> : badgeMeta.label}
          </span>
        )}
      </span>
      <span className={cn("truncate", textClassName)}>{sourceApp}</span>
    </>
  );

  if (!sourceUrl) {
    return (
      <span className={cn("inline-flex min-w-0 items-center gap-1", className)}>
        {content}
      </span>
    );
  }

  return (
    <button
      type="button"
      title={sourceUrl}
      className={cn(
        "inline-flex min-w-0 items-center gap-1 text-left text-blue-400/85 hover:text-blue-400 hover:underline",
        className,
      )}
      onClick={(event) => {
        event.stopPropagation();
        openUrl(sourceUrl).catch(() => toast.error(t("toast.openUrlFailed")));
      }}
    >
      {content}
    </button>
  );
}
