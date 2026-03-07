import { useEffect, useState } from "react";
import {
  Download,
  Upload,
  Trash2,
  FolderOpen,
  Loader2,
} from "lucide-react";
import { useClipboardStore } from "@/stores/clipboardStore";
import {
  exportData,
  importData,
  clearHistory,
  getCacheInfo,
  cleanupCache,
  getClipboardStats,
  setCacheDir,
  migrateCache,
  setCacheMaxSize,
  getCacheMaxSize,
  cleanupCacheBySize,
  openInExplorer,
  type CacheInfo,
} from "@/services/clipboardService";
import { open as openFolderDialog } from "@tauri-apps/plugin-dialog";
import type { ClipboardStats } from "@/types";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { formatBytes } from "./shared";

/* ─── Stats Mini Chart Components ─── */

const TYPE_COLORS: Record<string, string> = {
  PlainText: "bg-blue-400",
  RichText: "bg-purple-400",
  Image: "bg-green-400",
  FilePaths: "bg-amber-400",
};

const TYPE_LABELS: Record<string, string> = {
  PlainText: "Text",
  RichText: "Rich",
  Image: "Image",
  FilePaths: "File",
};

function TypePieChart({ typeCounts, total }: { typeCounts: ClipboardStats["type_counts"]; total: number }) {
  if (total === 0) return null;
  return (
    <div className="space-y-1.5">
      {/* Stacked bar */}
      <div className="flex h-2 rounded-full overflow-hidden bg-muted/30">
        {typeCounts.map((tc) => (
          <div
            key={tc.content_type}
            className={cn("transition-all", TYPE_COLORS[tc.content_type] ?? "bg-gray-400")}
            style={{ width: `${(tc.count / total) * 100}%` }}
          />
        ))}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {typeCounts.map((tc) => (
          <div key={tc.content_type} className="flex items-center gap-1 text-xs2 text-muted-foreground">
            <span className={cn("w-2 h-2 rounded-full", TYPE_COLORS[tc.content_type] ?? "bg-gray-400")} />
            <span>{TYPE_LABELS[tc.content_type] ?? tc.content_type}</span>
            <span className="text-foreground font-medium">{tc.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DailyTrendChart({ dailyTrend }: { dailyTrend: ClipboardStats["daily_trend"] }) {
  if (dailyTrend.length === 0) return null;
  const maxCount = Math.max(...dailyTrend.map((d) => d.count), 1);
  return (
    <div className="flex items-end gap-1 h-12">
      {dailyTrend.map((d) => (
        <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5">
          <div
            className="w-full bg-primary/40 rounded-t transition-all min-h-[2px]"
            style={{ height: `${(d.count / maxCount) * 100}%` }}
            title={`${d.date}: ${d.count}`}
          />
          <span className="text-2xs text-muted-foreground/70">
            {d.date.slice(5)}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ─── Data Tab ─── */
export function DataTab() {
  const { t } = useTranslation();
  const [cacheInfo, setCacheInfo] = useState<CacheInfo | null>(null);
  const [stats, setStats] = useState<ClipboardStats | null>(null);
  const [pendingCacheDir, setPendingCacheDir] = useState<string | null>(null);
  const [showMigrateDialog, setShowMigrateDialog] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [cacheMaxSize, setCacheMaxSizeState] = useState(0);

  const cacheSizeOptions = [
    { value: 0, label: t("settings.cacheUnlimited") },
    { value: 100, label: "100 MB" },
    { value: 250, label: "250 MB" },
    { value: 500, label: "500 MB" },
    { value: 1024, label: "1 GB" },
    { value: 2048, label: "2 GB" },
  ];

  useEffect(() => {
    getCacheInfo().then(setCacheInfo).catch(() => {});
    getClipboardStats().then(setStats).catch(() => {});
    getCacheMaxSize().then(setCacheMaxSizeState).catch(() => {});
  }, []);

  const handleCacheDirChange = async () => {
    const selected = await openFolderDialog({
      directory: true,
      title: t("settings.selectCacheDir"),
    });
    if (!selected) return;
    setPendingCacheDir(selected);
    setShowMigrateDialog(true);
  };

  const handleMigrate = async (doMigrate: boolean) => {
    setShowMigrateDialog(false);
    if (!pendingCacheDir) return;
    setMigrating(true);
    try {
      if (doMigrate) {
        await migrateCache(pendingCacheDir);
        toast.success(t("settings.migrated"));
      } else {
        await setCacheDir(pendingCacheDir);
      }
      toast.info(t("settings.restartRequired"));
      setPendingCacheDir(null);
      const info = await getCacheInfo();
      setCacheInfo(info);
    } catch (err) {
      toast.error(String(err));
    } finally {
      setMigrating(false);
    }
  };

  const handleCacheMaxSizeChange = async (mb: number) => {
    setCacheMaxSizeState(mb);
    try {
      await setCacheMaxSize(mb);
      if (mb > 0) {
        await cleanupCacheBySize();
        const info = await getCacheInfo();
        setCacheInfo(info);
      }
    } catch (err) {
      console.error("Failed to set cache max size:", err);
    }
  };

  return (
    <div className="space-y-5">
      {/* Statistics */}
      {stats && (
        <section>
          <label className="text-sm2 font-medium text-muted-foreground uppercase tracking-wider">
            {t("settings.statistics")}
          </label>
          <div className="mt-2 space-y-3">
            {/* Summary row */}
            <div className="flex gap-2">
              <div className="flex-1 bg-muted/20 rounded-md px-2.5 py-2 text-center">
                <div className="text-lg font-semibold text-foreground">{stats.total}</div>
                <div className="text-2xs text-muted-foreground">{t("settings.statsTotal")}</div>
              </div>
              <div className="flex-1 bg-muted/20 rounded-md px-2.5 py-2 text-center">
                <div className="text-lg font-semibold text-yellow-400">{stats.favorites}</div>
                <div className="text-2xs text-muted-foreground">{t("settings.statsFavorites")}</div>
              </div>
              <div className="flex-1 bg-muted/20 rounded-md px-2.5 py-2 text-center">
                <div className="text-lg font-semibold text-primary">{stats.pinned}</div>
                <div className="text-2xs text-muted-foreground">{t("settings.statsPinned")}</div>
              </div>
            </div>

            {/* Type distribution */}
            <div>
              <div className="text-xs2 text-muted-foreground mb-1">{t("settings.statsTypeDistribution")}</div>
              <TypePieChart typeCounts={stats.type_counts} total={stats.total} />
            </div>

            {/* Daily trend */}
            {stats.daily_trend.length > 0 && (
              <div>
                <div className="text-xs2 text-muted-foreground mb-1">{t("settings.statsDailyTrend")}</div>
                <DailyTrendChart dailyTrend={stats.daily_trend} />
              </div>
            )}
          </div>
        </section>
      )}

      {/* Data management */}
      <section>
        <label className="text-sm2 font-medium text-muted-foreground uppercase tracking-wider">
          {t("settings.dataManagement")}
        </label>
        <div className="flex flex-col gap-2 mt-2">
          <div className="flex gap-2">
            <button
              onClick={async () => {
                try {
                  const json = await exportData();
                  const blob = new Blob([json], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `alger-clipboard-backup-${new Date().toISOString().slice(0, 10)}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                  toast.success(t("toast.exported"));
                } catch {
                  toast.error(t("toast.exportFailed"));
                }
              }}
              className="flex items-center gap-1.5 h-7 px-3 text-sm2 font-medium bg-muted/30 hover:bg-muted/50 rounded-md transition-colors"
            >
              <Download className="w-3 h-3" />
              {t("settings.export")}
            </button>
            <button
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = ".json";
                input.onchange = async (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (!file) return;
                  try {
                    const text = await file.text();
                    const count = await importData(text);
                    toast.success(t("toast.imported", { count }));
                    useClipboardStore.getState().fetchHistory();
                  } catch {
                    toast.error(t("toast.importFailed"));
                  }
                };
                input.click();
              }}
              className="flex items-center gap-1.5 h-7 px-3 text-sm2 font-medium bg-muted/30 hover:bg-muted/50 rounded-md transition-colors"
            >
              <Upload className="w-3 h-3" />
              {t("settings.import")}
            </button>
          </div>
          <button
            onClick={async () => {
              try {
                await clearHistory(true);
                useClipboardStore.getState().fetchHistory();
                toast.success(t("toast.cleared"));
              } catch {
                toast.error(t("toast.clearFailed"));
              }
            }}
            className="flex items-center gap-1.5 h-7 px-3 text-sm2 font-medium text-destructive bg-destructive/10 hover:bg-destructive/20 rounded-md transition-colors w-fit"
          >
            <Trash2 className="w-3 h-3" />
            {t("settings.clearHistory")}
          </button>
          <p className="text-xs2 text-muted-foreground/70">
            {t("settings.clearHistoryDesc")}
          </p>
        </div>
      </section>

      {/* Cache management */}
      <section>
        <label className="text-sm2 font-medium text-muted-foreground uppercase tracking-wider">
          {t("settings.cache")}
        </label>
        {cacheInfo && (
          <div className="mt-2 space-y-2">
            <div className="flex items-center gap-2 text-sm2">
              <FolderOpen className="w-3 h-3 text-muted-foreground shrink-0" />
              <span
                className="text-muted-foreground truncate text-xs2 flex-1"
                title={cacheInfo.cache_dir}
              >
                {cacheInfo.cache_dir}
              </span>
              <button
                onClick={() => openInExplorer(cacheInfo.cache_dir).catch(() => {})}
                className="text-xs2 text-muted-foreground hover:text-foreground shrink-0"
                title={t("settings.openCacheDir")}
              >
                {t("settings.openCacheDir")}
              </button>
              <button
                onClick={handleCacheDirChange}
                disabled={migrating}
                className="text-xs2 text-primary hover:text-primary/80 shrink-0 disabled:opacity-50"
              >
                {migrating ? (
                  <Loader2 className="w-2.5 h-2.5 animate-spin inline" />
                ) : (
                  t("settings.changeCacheDir")
                )}
              </button>
            </div>

            {/* Migrate dialog */}
            {showMigrateDialog && (
              <div className="bg-muted/30 rounded-md p-2.5 space-y-2">
                <p className="text-sm2 font-medium">{t("settings.migrateCacheTitle")}</p>
                <p className="text-xs2 text-muted-foreground">{t("settings.migrateCacheDesc")}</p>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => handleMigrate(true)}
                    className="h-6 px-2 text-xs2 font-medium bg-primary/15 text-primary hover:bg-primary/25 rounded transition-colors"
                  >
                    {t("settings.migrateCacheYes")}
                  </button>
                  <button
                    onClick={() => handleMigrate(false)}
                    className="h-6 px-2 text-xs2 font-medium bg-muted/30 hover:bg-muted/50 rounded transition-colors"
                  >
                    {t("settings.migrateCacheNo")}
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 text-sm2">
              <span className="text-muted-foreground">
                {t("settings.cacheSize")}:{" "}
                <span className="text-foreground font-medium">
                  {formatBytes(cacheInfo.total_size_bytes)}
                </span>
              </span>
              <span className="text-muted-foreground">
                {t("settings.cacheFiles", { count: cacheInfo.file_count })}
              </span>
            </div>

            {/* Cache size limit */}
            <div className="flex items-center justify-between">
              <span className="text-sm2 text-muted-foreground">
                {t("settings.cacheMaxSize")}
              </span>
              <select
                value={cacheMaxSize}
                onChange={(e) => handleCacheMaxSizeChange(Number(e.target.value))}
                className="h-6 px-1.5 text-xs2 bg-muted/30 border border-border/50 rounded text-foreground focus:outline-none focus:ring-1 focus:ring-ring/30"
              >
                {cacheSizeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={async () => {
                try {
                  await cleanupCache();
                  const info = await getCacheInfo();
                  setCacheInfo(info);
                  toast.success(t("settings.cacheCleanedUp"));
                } catch {
                  toast.error("Cleanup failed");
                }
              }}
              className="flex items-center gap-1.5 h-7 px-3 text-sm2 font-medium bg-muted/30 hover:bg-muted/50 rounded-md transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              {t("settings.cleanupCache")}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
