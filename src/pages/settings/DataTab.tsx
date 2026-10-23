import { useEffect, useState } from "react";
import {
  Download,
  Upload,
  Trash,
  FolderOpen,
  SpinnerGap,
  Copy,
} from "@phosphor-icons/react";
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
import { open as openFolderDialog, save as saveFileDialog } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import type { ClipboardStats, HttpApiStatus } from "@/types";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { toast } from "@/lib/toast";
import { StyledSelect } from "@/components/ui/styled-select";
import { exportAsCSV, exportAsText, exportAsHTML } from "@/services/exportService";
import {
  applyHttpApiConfig,
  getHttpApiStatus,
  regenerateHttpApiKey,
} from "@/services/httpApiService";
import {
  formatBytes,
  SettingsButton,
  SettingsInput,
  SettingsRow,
  SettingsSection,
  Toggle,
} from "./shared";

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
      <div className="flex h-2 overflow-hidden rounded-full bg-muted/30">
        {typeCounts.map((tc) => (
          <div
            key={tc.content_type}
            className={cn("transition-all", TYPE_COLORS[tc.content_type] ?? "bg-gray-400")}
            style={{ width: `${(tc.count / total) * 100}%` }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {typeCounts.map((tc) => (
          <div key={tc.content_type} className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className={cn("h-2 w-2 rounded-full", TYPE_COLORS[tc.content_type] ?? "bg-gray-400")} />
            <span>{TYPE_LABELS[tc.content_type] ?? tc.content_type}</span>
            <span className="font-medium text-foreground">{tc.count}</span>
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
    <div className="flex h-12 items-end gap-1">
      {dailyTrend.map((d) => (
        <div key={d.date} className="flex flex-1 flex-col items-center gap-0.5">
          <div
            className="w-full min-h-[2px] rounded-t bg-primary/40 transition-all"
            style={{ height: `${(d.count / maxCount) * 100}%` }}
            title={`${d.date}: ${d.count}`}
          />
          <span className="text-[10px] text-muted-foreground/70">
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
  const [httpApi, setHttpApi] = useState<HttpApiStatus | null>(null);
  const [httpApiEnabled, setHttpApiEnabled] = useState(false);
  const [httpApiPort, setHttpApiPort] = useState("25483");
  const [httpApiAllowWrite, setHttpApiAllowWrite] = useState(false);
  const [httpApiSaving, setHttpApiSaving] = useState(false);

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
    getHttpApiStatus()
      .then((status) => {
        setHttpApi(status);
        setHttpApiEnabled(status.enabled);
        setHttpApiPort(String(status.port));
        setHttpApiAllowWrite(status.allow_write);
      })
      .catch(() => {});
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

  const handleHttpApiApply = async () => {
    const port = Number(httpApiPort);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      toast.error(t("settings.httpApi.invalidPort"));
      return;
    }

    setHttpApiSaving(true);
    try {
      const status = await applyHttpApiConfig({
        enabled: httpApiEnabled,
        port,
        api_key: httpApi?.api_key ?? "",
        allow_write: httpApiAllowWrite,
      });
      setHttpApi(status);
      setHttpApiEnabled(status.enabled);
      setHttpApiPort(String(status.port));
      setHttpApiAllowWrite(status.allow_write);
      toast.success(t("settings.httpApi.applied"));
    } catch (err) {
      toast.error(String(err));
      getHttpApiStatus().then(setHttpApi).catch(() => {});
    } finally {
      setHttpApiSaving(false);
    }
  };

  const handleHttpApiRegenerate = async () => {
    setHttpApiSaving(true);
    try {
      const status = await regenerateHttpApiKey();
      setHttpApi(status);
      setHttpApiEnabled(status.enabled);
      setHttpApiPort(String(status.port));
      setHttpApiAllowWrite(status.allow_write);
      toast.success(t("settings.httpApi.keyRegenerated"));
    } catch (err) {
      toast.error(String(err));
    } finally {
      setHttpApiSaving(false);
    }
  };

  const handleCopyApiKey = async () => {
    if (!httpApi?.api_key) return;
    await navigator.clipboard.writeText(httpApi.api_key);
    toast.success(t("settings.httpApi.copied"));
  };

  return (
    <div className="space-y-5">
      {/* ─── Statistics ─── */}
      {stats && (
        <SettingsSection title={t("settings.statistics")}>
          <div className="grid gap-3 px-5 py-4 md:grid-cols-3">
            <div className="settings-stat-card">
              <div className="settings-stat-value">{stats.total}</div>
              <div className="settings-stat-label">{t("settings.statsTotal")}</div>
            </div>
            <div className="settings-stat-card">
              <div className="settings-stat-value text-yellow-500 dark:text-yellow-300">{stats.favorites}</div>
              <div className="settings-stat-label">{t("settings.statsFavorites")}</div>
            </div>
            <div className="settings-stat-card">
              <div className="settings-stat-value text-primary">{stats.pinned}</div>
              <div className="settings-stat-label">{t("settings.statsPinned")}</div>
            </div>
          </div>

          <div className="space-y-4 border-t border-[color-mix(in_oklab,var(--border)_76%,transparent)] px-5 py-4">
            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground/75">
                {t("settings.statsTypeDistribution")}
              </div>
              <TypePieChart typeCounts={stats.type_counts} total={stats.total} />
            </div>

            {stats.daily_trend.length > 0 && (
              <div>
                <div className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground/75">
                  {t("settings.statsDailyTrend")}
                </div>
                <DailyTrendChart dailyTrend={stats.daily_trend} />
              </div>
            )}
          </div>
        </SettingsSection>
      )}

      {/* ─── Data Management ─── */}
      <SettingsSection title={t("settings.dataManagement")}>
        <div className="flex flex-wrap gap-2 px-5 py-3">
          <SettingsButton
            onClick={async () => {
              try {
                const path = await saveFileDialog({
                  defaultPath: `alger-clipboard-${new Date().toISOString().slice(0, 10)}.json`,
                  filters: [{ name: "JSON", extensions: ["json"] }],
                });
                if (!path) return;
                const json = await exportData();
                await invoke("write_export_file", { path, content: json });
                toast.success(t("toast.exported"));
              } catch {
                toast.error(t("toast.exportFailed"));
              }
            }}
          >
            <Download size={12} />
            JSON
          </SettingsButton>
          <SettingsButton
            onClick={async () => {
              try {
                const path = await saveFileDialog({
                  defaultPath: `alger-clipboard-${new Date().toISOString().slice(0, 10)}.csv`,
                  filters: [{ name: "CSV", extensions: ["csv"] }],
                });
                if (!path) return;
                const content = await exportAsCSV();
                await invoke("write_export_file", { path, content });
                toast.success(t("toast.exported"));
              } catch {
                toast.error(t("toast.exportFailed"));
              }
            }}
          >
            <Download size={12} />
            CSV
          </SettingsButton>
          <SettingsButton
            onClick={async () => {
              try {
                const path = await saveFileDialog({
                  defaultPath: `alger-clipboard-${new Date().toISOString().slice(0, 10)}.txt`,
                  filters: [{ name: "Text", extensions: ["txt"] }],
                });
                if (!path) return;
                const content = await exportAsText();
                await invoke("write_export_file", { path, content });
                toast.success(t("toast.exported"));
              } catch {
                toast.error(t("toast.exportFailed"));
              }
            }}
          >
            <Download size={12} />
            TXT
          </SettingsButton>
          <SettingsButton
            onClick={async () => {
              try {
                const path = await saveFileDialog({
                  defaultPath: `alger-clipboard-${new Date().toISOString().slice(0, 10)}.html`,
                  filters: [{ name: "HTML", extensions: ["html"] }],
                });
                if (!path) return;
                const content = await exportAsHTML();
                await invoke("write_export_file", { path, content });
                toast.success(t("toast.exported"));
              } catch {
                toast.error(t("toast.exportFailed"));
              }
            }}
          >
            <Download size={12} />
            HTML
          </SettingsButton>
          <SettingsButton
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
          >
            <Upload size={12} />
            {t("settings.import")}
          </SettingsButton>
          <SettingsButton
            tone="danger"
            onClick={async () => {
              try {
                await clearHistory(true);
                useClipboardStore.getState().fetchHistory();
                toast.success(t("toast.cleared"));
              } catch {
                toast.error(t("toast.clearFailed"));
              }
            }}
          >
            <Trash size={12} />
            {t("settings.clearHistory")}
          </SettingsButton>
        </div>
      </SettingsSection>

      {/* ─── Cache ─── */}
      <SettingsSection title={t("settings.cache")}>
        {cacheInfo && (
          <>
            <div className="flex flex-wrap items-center gap-2 px-5 py-3 text-sm">
              <FolderOpen size={14} className="shrink-0 text-muted-foreground" />
              <span
                className="flex-1 truncate text-xs text-muted-foreground"
                title={cacheInfo.cache_dir}
              >
                {cacheInfo.cache_dir}
              </span>
              <SettingsButton
                tone="ghost"
                onClick={() => openInExplorer(cacheInfo.cache_dir).catch(() => {})}
                title={t("settings.openCacheDir")}
              >
                {t("settings.openCacheDir")}
              </SettingsButton>
              <SettingsButton
                onClick={handleCacheDirChange}
                disabled={migrating}
              >
                {migrating ? (
                  <SpinnerGap size={12} className="inline animate-spin" />
                ) : (
                  t("settings.changeCacheDir")
                )}
              </SettingsButton>
            </div>

            {showMigrateDialog && (
              <div className="settings-inline-panel mx-5 space-y-3">
                <p className="settings-row-title">{t("settings.migrateCacheTitle")}</p>
                <p className="settings-row-description">{t("settings.migrateCacheDesc")}</p>
                <div className="flex gap-2">
                  <SettingsButton onClick={() => handleMigrate(true)}>
                    {t("settings.migrateCacheYes")}
                  </SettingsButton>
                  <SettingsButton tone="ghost" onClick={() => handleMigrate(false)}>
                    {t("settings.migrateCacheNo")}
                  </SettingsButton>
                </div>
              </div>
            )}

            <SettingsRow
              title={t("settings.cacheSize")}
              description={t("settings.cacheFiles", { count: cacheInfo.file_count })}
              control={
                <div className="text-sm font-semibold text-foreground">
                  {formatBytes(cacheInfo.total_size_bytes)}
                </div>
              }
            />

            <SettingsRow
              title={t("settings.cacheMaxSize")}
              control={
                <StyledSelect
                  value={String(cacheMaxSize)}
                  onChange={(v) => handleCacheMaxSizeChange(Number(v))}
                  options={cacheSizeOptions.map((opt) => ({ value: String(opt.value), label: opt.label }))}
                  className="w-[11rem]"
                />
              }
            />

            <div className="px-5 py-3">
              <SettingsButton
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
              >
                <Trash size={12} />
                {t("settings.cleanupCache")}
              </SettingsButton>
            </div>
          </>
        )}
      </SettingsSection>

      {/* ─── HTTP API ─── */}
      <SettingsSection
        title={t("settings.httpApi.title")}
        description={t("settings.httpApi.desc")}
      >
        <SettingsRow
          title={t("settings.httpApi.enable")}
          description={t("settings.httpApi.enableDesc")}
          control={
            <Toggle value={httpApiEnabled} onChange={setHttpApiEnabled} />
          }
        />
        <SettingsRow
          title={t("settings.httpApi.port")}
          description={t("settings.httpApi.portDesc")}
          control={
            <SettingsInput
              className="w-[8rem]"
              value={httpApiPort}
              inputMode="numeric"
              onChange={(e) => setHttpApiPort(e.target.value)}
            />
          }
        />
        <SettingsRow
          title={t("settings.httpApi.allowWrite")}
          description={t("settings.httpApi.allowWriteDesc")}
          control={
            <Toggle
              value={httpApiAllowWrite}
              onChange={setHttpApiAllowWrite}
            />
          }
        />
        <div className="space-y-3 border-t border-[color-mix(in_oklab,var(--border)_76%,transparent)] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="settings-row-title">
                {t("settings.httpApi.apiKey")}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <code className="max-w-[22rem] truncate rounded bg-muted/50 px-2 py-1 text-xs">
                  {httpApi?.api_key || t("settings.httpApi.noKey")}
                </code>
                <button
                  type="button"
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
                  title={t("settings.httpApi.copyKey")}
                  disabled={!httpApi?.api_key}
                  onClick={() => void handleCopyApiKey()}
                >
                  <Copy size={14} />
                </button>
              </div>
            </div>
            <SettingsButton
              onClick={() => void handleHttpApiRegenerate()}
              disabled={httpApiSaving}
            >
              {t("settings.httpApi.regenerate")}
            </SettingsButton>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-[color-mix(in_oklab,var(--border)_60%,transparent)] pt-3">
            <span
              className={cn(
                "text-xs",
                httpApi?.running
                  ? "text-emerald-500"
                  : "text-muted-foreground",
              )}
            >
              {httpApi?.running
                ? t("settings.httpApi.running", { port: httpApi.port })
                : t("settings.httpApi.stopped")}
            </span>
            <SettingsButton
              tone="primary"
              onClick={() => void handleHttpApiApply()}
              disabled={httpApiSaving}
            >
              {httpApiSaving
                ? t("settings.httpApi.applying")
                : t("settings.httpApi.apply")}
            </SettingsButton>
          </div>

          {httpApi?.error && (
            <p className="text-xs text-destructive">{httpApi.error}</p>
          )}

          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">
              {t("settings.httpApi.curlExample")}
            </p>
            <pre className="overflow-x-auto rounded-md bg-muted/50 px-3 py-2 text-xs">
              {`curl -H "X-API-Key: ${
                httpApi?.api_key || "YOUR_KEY"
              }" http://127.0.0.1:${
                httpApi?.port ?? httpApiPort
              }/api/v1/status`}
            </pre>
          </div>
        </div>
      </SettingsSection>
    </div>
  );
}
