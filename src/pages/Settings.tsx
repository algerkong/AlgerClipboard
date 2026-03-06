import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Sun,
  Moon,
  Monitor,
  Download,
  Upload,
  Trash2,
  FolderOpen,
  Settings2,
  Cloud,
  Languages,
  Database,
  Plus,
  RefreshCw,
  Check,
  X,
  Lock,
  Loader2,
  CloudOff,
  Pencil,
} from "lucide-react";
import {
  useSettingsStore,
  type UIScale,
  type FontFamily,
  type ButtonPosition,
} from "@/stores/settingsStore";
import { useTranslateStore } from "@/stores/translateStore";
import { useClipboardStore } from "@/stores/clipboardStore";
import { useSyncStore } from "@/stores/syncStore";
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
import {
  checkForUpdates,
  downloadAndInstall,
} from "@/services/updateService";
import type { ClipboardStats } from "@/types";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { usePlatform } from "@/contexts/PlatformContext";

type Theme = "light" | "dark" | "system";
type SettingsTab = "general" | "sync" | "translate" | "data";

interface Props {
  onBack: () => void;
}

const languages = [
  { value: "zh-CN", label: "\u4E2D\u6587" },
  { value: "en", label: "English" },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

const ENGINE_LIST = [
  { id: "baidu", label: "Baidu", hasSecret: true },
  { id: "youdao", label: "Youdao", hasSecret: true },
  { id: "google", label: "Google", hasSecret: false },
] as const;

const TABS: { key: SettingsTab; labelKey: string; icon: React.ReactNode }[] = [
  {
    key: "general",
    labelKey: "settings.tabGeneral",
    icon: <Settings2 className="w-3 h-3" />,
  },
  {
    key: "sync",
    labelKey: "settings.tabSync",
    icon: <Cloud className="w-3 h-3" />,
  },
  {
    key: "translate",
    labelKey: "settings.tabTranslate",
    icon: <Languages className="w-3 h-3" />,
  },
  {
    key: "data",
    labelKey: "settings.tabData",
    icon: <Database className="w-3 h-3" />,
  },
];

const MODIFIER_KEYS = new Set(["Shift", "Control", "Meta", "Alt"]);

function normalizeShortcutMainKey(event: KeyboardEvent): string | null {
  const { code, key } = event;

  if (/^Key[A-Z]$/.test(code)) {
    return code.slice(3);
  }

  if (/^Digit\d$/.test(code)) {
    return code.slice(5);
  }

  if (/^F([1-9]|1\d|2[0-4])$/.test(code)) {
    return code;
  }

  const byCode: Record<string, string> = {
    Space: "Space",
    Enter: "Enter",
    NumpadEnter: "Enter",
    Tab: "Tab",
    Backspace: "Backspace",
    Delete: "Delete",
    Insert: "Insert",
    Home: "Home",
    End: "End",
    PageUp: "PageUp",
    PageDown: "PageDown",
    ArrowUp: "Up",
    ArrowDown: "Down",
    ArrowLeft: "Left",
    ArrowRight: "Right",
    Escape: "Escape",
  };

  if (byCode[code]) {
    return byCode[code];
  }

  if (key.length === 1 && /[a-z0-9]/i.test(key)) {
    return key.toUpperCase();
  }

  return null;
}

function buildShortcutFromKeyboardEvent(event: KeyboardEvent): string | null {
  if (MODIFIER_KEYS.has(event.key)) {
    return null;
  }

  const mainKey = normalizeShortcutMainKey(event);
  if (!mainKey) {
    return null;
  }

  const hasModifier =
    event.metaKey || event.ctrlKey || event.altKey || event.shiftKey;
  if (!hasModifier) {
    return null;
  }

  const parts: string[] = [];
  if (event.metaKey || event.ctrlKey) {
    parts.push("CmdOrCtrl");
  }
  if (event.altKey) {
    parts.push("Alt");
  }
  if (event.shiftKey) {
    parts.push("Shift");
  }
  parts.push(mainKey);

  return parts.join("+");
}

/* ─── Toggle switch helper ─── */
function Toggle({
  value,
  onChange,
  size = "md",
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  size?: "sm" | "md";
}) {
  const w = size === "sm" ? "w-7 h-[16px]" : "w-8 h-[18px]";
  const dot = size === "sm" ? "w-[12px] h-[12px]" : "w-[14px] h-[14px]";
  const shift = size === "sm" ? "translate-x-[11px]" : "translate-x-[14px]";
  return (
    <button
      onClick={() => onChange(!value)}
      className={cn(
        "relative rounded-full transition-colors",
        w,
        value ? "bg-primary/80" : "bg-muted",
      )}
    >
      <span
        className={cn(
          "absolute top-[2px] left-[2px] rounded-full bg-white shadow transition-transform",
          dot,
          value && shift,
        )}
      />
    </button>
  );
}

/* ─── General Tab ─── */
function GeneralTab() {
  const { t, i18n } = useTranslation();
  const theme = useSettingsStore((s) => s.theme);
  const maxHistory = useSettingsStore((s) => s.maxHistory);
  const expireDays = useSettingsStore((s) => s.expireDays);
  const pasteAndClose = useSettingsStore((s) => s.pasteAndClose);
  const autoStart = useSettingsStore((s) => s.autoStart);
  const locale = useSettingsStore((s) => s.locale);
  const uiScale = useSettingsStore((s) => s.uiScale);
  const fontFamily = useSettingsStore((s) => s.fontFamily);
  const toggleShortcut = useSettingsStore((s) => s.toggleShortcut);
  const autoCheckUpdate = useSettingsStore((s) => s.autoCheckUpdate);
  const autoDownloadUpdate = useSettingsStore((s) => s.autoDownloadUpdate);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const setMaxHistory = useSettingsStore((s) => s.setMaxHistory);
  const setExpireDays = useSettingsStore((s) => s.setExpireDays);
  const setPasteAndClose = useSettingsStore((s) => s.setPasteAndClose);
  const setAutoStart = useSettingsStore((s) => s.setAutoStart);
  const setLocale = useSettingsStore((s) => s.setLocale);
  const setUIScale = useSettingsStore((s) => s.setUIScale);
  const setFontFamily = useSettingsStore((s) => s.setFontFamily);
  const setToggleShortcut = useSettingsStore((s) => s.setToggleShortcut);
  const setAutoCheckUpdate = useSettingsStore((s) => s.setAutoCheckUpdate);
  const setAutoDownloadUpdate = useSettingsStore((s) => s.setAutoDownloadUpdate);
  const buttonPosition = useSettingsStore((s) => s.buttonPosition);
  const setButtonPosition = useSettingsStore((s) => s.setButtonPosition);
  const platform = usePlatform();
  const [isRecordingShortcut, setIsRecordingShortcut] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);

  useEffect(() => {
    if (!isRecordingShortcut) {
      return;
    }

    const handleRecordShortcut = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (event.key === "Escape") {
        setIsRecordingShortcut(false);
        return;
      }

      if (MODIFIER_KEYS.has(event.key)) {
        return;
      }

      const nextShortcut = buildShortcutFromKeyboardEvent(event);
      if (!nextShortcut) {
        toast.error(t("settings.shortcutInvalid"));
        return;
      }

      setIsRecordingShortcut(false);
      setToggleShortcut(nextShortcut)
        .then(() => {
          toast.success(t("settings.shortcutSaved"));
        })
        .catch(() => {
          toast.error(t("settings.shortcutInvalid"));
        });
    };

    window.addEventListener("keydown", handleRecordShortcut, true);
    return () => {
      window.removeEventListener("keydown", handleRecordShortcut, true);
    };
  }, [isRecordingShortcut, setToggleShortcut, t]);

  const themes: { value: Theme; labelKey: string; icon: React.ReactNode }[] = [
    {
      value: "light",
      labelKey: "settings.light",
      icon: <Sun className="w-3.5 h-3.5" />,
    },
    {
      value: "dark",
      labelKey: "settings.dark",
      icon: <Moon className="w-3.5 h-3.5" />,
    },
    {
      value: "system",
      labelKey: "settings.auto",
      icon: <Monitor className="w-3.5 h-3.5" />,
    },
  ];

  const handleLocaleChange = (newLocale: string) => {
    setLocale(newLocale);
    i18n.changeLanguage(newLocale);
  };

  return (
    <div className="space-y-5">
      {/* Language */}
      <section>
        <label className="text-sm2 font-medium text-muted-foreground uppercase tracking-wider">
          {t("settings.language")}
        </label>
        <div className="flex gap-1.5 mt-2">
          {languages.map((lang) => (
            <button
              key={lang.value}
              onClick={() => handleLocaleChange(lang.value)}
              className={cn(
                "flex-1 flex items-center justify-center py-1.5 rounded-md text-xs font-medium transition-colors",
                locale === lang.value
                  ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                  : "bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              )}
            >
              {lang.label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs2 text-muted-foreground/70">
          {t("settings.languageDesc")}
        </p>
      </section>

      {/* Theme */}
      <section>
        <label className="text-sm2 font-medium text-muted-foreground uppercase tracking-wider">
          {t("settings.theme")}
        </label>
        <div className="flex gap-1.5 mt-2">
          {themes.map((themeItem) => (
            <button
              key={themeItem.value}
              onClick={() => setTheme(themeItem.value)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors",
                theme === themeItem.value
                  ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                  : "bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              )}
            >
              {themeItem.icon}
              {t(themeItem.labelKey)}
            </button>
          ))}
        </div>
      </section>

      {/* UI Scale */}
      <section>
        <label className="text-sm2 font-medium text-muted-foreground uppercase tracking-wider">
          {t("settings.uiScale")}
        </label>
        <div className="flex gap-1 mt-2">
          {(["xs", "sm", "md", "lg", "xl"] as UIScale[]).map((scale) => (
            <button
              key={scale}
              onClick={() => setUIScale(scale)}
              className={cn(
                "flex-1 flex items-center justify-center py-1.5 rounded-md text-xs font-medium transition-colors",
                uiScale === scale
                  ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                  : "bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              )}
            >
              {t(`settings.uiScale_${scale}`)}
            </button>
          ))}
        </div>
      </section>

      {/* Font Family */}
      <section>
        <label className="text-sm2 font-medium text-muted-foreground uppercase tracking-wider">
          {t("settings.fontFamily")}
        </label>
        <select
          value={fontFamily}
          onChange={(e) => setFontFamily(e.target.value as FontFamily)}
          className="mt-2 w-full h-7 px-2 text-xs bg-muted/30 border border-border/50 rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-ring/30"
        >
          {(
            ["system", "microsoft-yahei", "noto-sans", "mono"] as FontFamily[]
          ).map((f) => (
            <option key={f} value={f}>
              {t(`settings.fontFamily_${f}`)}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs2 text-muted-foreground/70">
          {t("settings.fontFamilyDesc")}
        </p>
      </section>

      {/* Button position (Linux only) */}
      {platform === "linux" && (
        <section>
          <label className="text-sm2 font-medium text-muted-foreground uppercase tracking-wider">
            {t("settings.buttonPosition")}
          </label>
          <div className="flex gap-1.5 mt-2">
            {(["left", "right"] as ButtonPosition[]).map((pos) => (
              <button
                key={pos}
                onClick={() => setButtonPosition(pos)}
                className={cn(
                  "flex-1 flex items-center justify-center py-1.5 rounded-md text-xs font-medium transition-colors",
                  buttonPosition === pos
                    ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                    : "bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
              >
                {t(`settings.buttonPosition${pos.charAt(0).toUpperCase() + pos.slice(1)}`)}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs2 text-muted-foreground/70">
            {t("settings.buttonPositionDesc")}
          </p>
        </section>
      )}

      {/* Max history */}
      <section>
        <label className="text-sm2 font-medium text-muted-foreground uppercase tracking-wider">
          {t("settings.historyLimit")}
        </label>
        <input
          type="number"
          min={10}
          max={10000}
          value={maxHistory}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (!isNaN(v) && v > 0) setMaxHistory(v);
          }}
          className="mt-2 w-24 h-7 px-2 text-xs bg-muted/30 border border-border/50 rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-ring/30"
        />
        <p className="mt-1 text-xs2 text-muted-foreground/70">
          {t("settings.maxEntries")}
        </p>
      </section>

      {/* Auto expire */}
      <section>
        <label className="text-sm2 font-medium text-muted-foreground uppercase tracking-wider">
          {t("settings.expireDays")}
        </label>
        <div className="flex gap-1.5 mt-2">
          {[
            { value: 0, labelKey: "settings.expireNever" },
            { value: 1, labelKey: "settings.expire1day" },
            { value: 7, labelKey: "settings.expire7days" },
            { value: 30, labelKey: "settings.expire30days" },
            { value: 90, labelKey: "settings.expire90days" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setExpireDays(opt.value)}
              className={cn(
                "flex-1 flex items-center justify-center py-1.5 rounded-md text-xs font-medium transition-colors",
                expireDays === opt.value
                  ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                  : "bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              )}
            >
              {t(opt.labelKey)}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs2 text-muted-foreground/70">
          {t("settings.expireDaysDesc")}
        </p>
      </section>

      {/* Paste and close */}
      <section>
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm2 font-medium text-muted-foreground uppercase tracking-wider">
              {t("settings.autoClose")}
            </label>
            <p className="mt-0.5 text-xs2 text-muted-foreground/70">
              {t("settings.hidePanel")}
            </p>
          </div>
          <Toggle value={pasteAndClose} onChange={setPasteAndClose} />
        </div>
      </section>

      {/* Auto start */}
      <section>
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm2 font-medium text-muted-foreground uppercase tracking-wider">
              {t("settings.autoStart")}
            </label>
            <p className="mt-0.5 text-xs2 text-muted-foreground/70">
              {t("settings.autoStartDesc")}
            </p>
          </div>
          <Toggle value={autoStart} onChange={setAutoStart} />
        </div>
      </section>

      {/* Toggle shortcut */}
      <section>
        <label className="text-sm2 font-medium text-muted-foreground uppercase tracking-wider">
          {t("settings.toggleShortcut")}
        </label>
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-7 px-2 text-xs bg-muted/30 border border-border/50 rounded-md text-foreground flex items-center">
            {isRecordingShortcut ? t("settings.shortcutRecording") : toggleShortcut}
          </div>
          <button
            onClick={() => setIsRecordingShortcut((prev) => !prev)}
            className={cn(
              "h-7 px-3 text-xs font-medium rounded-md transition-colors",
              isRecordingShortcut
                ? "bg-muted/50 text-muted-foreground hover:bg-muted/60"
                : "bg-primary/15 text-primary hover:bg-primary/25",
            )}
          >
            {isRecordingShortcut ? t("template.cancel") : t("settings.shortcutRecord")}
          </button>
        </div>
        <p className="mt-1 text-xs2 text-muted-foreground/70">
          {t("settings.toggleShortcutDesc")}
        </p>
      </section>

      {/* Auto check update */}
      <section>
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm2 font-medium text-muted-foreground uppercase tracking-wider">
              {t("settings.autoCheckUpdate")}
            </label>
            <p className="mt-0.5 text-xs2 text-muted-foreground/70">
              {t("settings.autoCheckUpdateDesc")}
            </p>
          </div>
          <Toggle value={autoCheckUpdate} onChange={setAutoCheckUpdate} />
        </div>
      </section>

      {/* Auto download update */}
      <section>
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm2 font-medium text-muted-foreground uppercase tracking-wider">
              {t("settings.autoDownloadUpdate")}
            </label>
            <p className="mt-0.5 text-xs2 text-muted-foreground/70">
              {t("settings.autoDownloadUpdateDesc")}
            </p>
          </div>
          <Toggle value={autoDownloadUpdate} onChange={setAutoDownloadUpdate} />
        </div>
      </section>

      {/* Check for updates button */}
      <section>
        <button
          disabled={isCheckingUpdate}
          onClick={async () => {
            setIsCheckingUpdate(true);
            try {
              const info = await checkForUpdates();
              if (info) {
                toast.success(t("update.available", { version: info.version }));
                await downloadAndInstall(info.update);
              } else {
                toast.info(t("update.latest"));
              }
            } catch {
              toast.error(t("update.failed"));
            } finally {
              setIsCheckingUpdate(false);
            }
          }}
          className={cn(
            "w-full h-7 px-3 text-xs font-medium rounded-md transition-colors",
            "bg-primary/15 text-primary hover:bg-primary/25",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          )}
        >
          {isCheckingUpdate
            ? t("settings.checkingUpdate")
            : t("settings.checkUpdate")}
        </button>
      </section>
    </div>
  );
}

/* ─── Sync Tab ─── */
function SyncTab() {
  const { t } = useTranslation();
  const accounts = useSyncStore((s) => s.accounts);
  const syncStatus = useSyncStore((s) => s.syncStatus);
  const lastSyncTime = useSyncStore((s) => s.lastSyncTime);
  const loadAccounts = useSyncStore((s) => s.loadAccounts);
  const addAccount = useSyncStore((s) => s.addAccount);
  const removeAccount = useSyncStore((s) => s.removeAccount);
  const updateAccount = useSyncStore((s) => s.updateAccount);
  const testConnection = useSyncStore((s) => s.testConnection);
  const triggerSync = useSyncStore((s) => s.triggerSync);
  const startOAuth = useSyncStore((s) => s.startOAuth);
  const setPassphrase = useSyncStore((s) => s.setPassphrase);
  const settingsSyncEnabled = useSyncStore((s) => s.settingsSyncEnabled);
  const syncMaxFileSize = useSyncStore((s) => s.syncMaxFileSize);
  const loadSyncSettings = useSyncStore((s) => s.loadSyncSettings);
  const setSettingsSyncEnabled = useSyncStore((s) => s.setSettingsSyncEnabled);
  const setSyncMaxFileSize = useSyncStore((s) => s.setSyncMaxFileSize);

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [provider, setProvider] = useState<
    "webdav" | "google_drive" | "onedrive"
  >("webdav");
  const [webdavUrl, setWebdavUrl] = useState("");
  const [webdavUser, setWebdavUser] = useState("");
  const [webdavPass, setWebdavPass] = useState("");
  const [oauthClientId, setOauthClientId] = useState("");
  const [oauthClientSecret, setOauthClientSecret] = useState("");
  const [oauthTokens, setOauthTokens] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [syncFreq, setSyncFreq] = useState<"realtime" | "interval" | "manual">(
    "manual",
  );
  const [intervalMin, setIntervalMin] = useState(15);
  const [encEnabled, setEncEnabled] = useState(false);
  const [passphraseVal, setPassphraseVal] = useState("");
  const [testing, setTesting] = useState(false);
  const [authorizing, setAuthorizing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadAccounts();
    loadSyncSettings();
  }, [loadAccounts, loadSyncSettings]);

  const providers = [
    { key: "webdav" as const, label: t("sync.webdav") },
    { key: "google_drive" as const, label: t("sync.googleDrive") },
    { key: "onedrive" as const, label: t("sync.oneDrive") },
  ];

  const freqOptions = [
    { key: "realtime" as const, label: t("sync.realtime") },
    { key: "interval" as const, label: t("sync.interval") },
    { key: "manual" as const, label: t("sync.manual") },
  ];

  const buildConfig = (): string => {
    if (provider === "webdav") {
      return JSON.stringify({
        url: webdavUrl,
        username: webdavUser,
        password: webdavPass,
      });
    }
    return JSON.stringify({
      client_id: oauthClientId,
      client_secret: oauthClientSecret,
      tokens: oauthTokens,
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (encEnabled && passphraseVal) {
        await setPassphrase(passphraseVal);
      }
      if (editingAccountId) {
        await updateAccount(
          editingAccountId,
          buildConfig(),
          syncFreq,
          syncFreq === "interval" ? intervalMin : null,
          encEnabled,
          true,
        );
      } else {
        await addAccount(
          provider,
          buildConfig(),
          syncFreq,
          syncFreq === "interval" ? intervalMin : undefined,
        );
      }
      toast.success(t("sync.saved"));
      setShowAddForm(false);
      setEditingAccountId(null);
      resetForm();
    } catch {
      toast.error(t("sync.connectionFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const ok = await testConnection(provider, buildConfig());
      if (ok) toast.success(t("sync.connectionSuccess"));
      else toast.error(t("sync.connectionFailed"));
    } catch {
      toast.error(t("sync.connectionFailed"));
    } finally {
      setTesting(false);
    }
  };

  const handleOAuth = async () => {
    setAuthorizing(true);
    try {
      const tokens = await startOAuth(
        provider,
        oauthClientId,
        oauthClientSecret || undefined,
      );
      setOauthTokens(tokens);
      toast.success(t("sync.authorized"));
    } catch {
      toast.error(t("sync.connectionFailed"));
    } finally {
      setAuthorizing(false);
    }
  };

  const handleEdit = (acc: (typeof accounts)[0]) => {
    setEditingAccountId(acc.id);
    setProvider(acc.provider);
    setSyncFreq(acc.sync_frequency);
    setIntervalMin(acc.interval_minutes ?? 15);
    setEncEnabled(acc.encryption_enabled);
    setPassphraseVal("");

    try {
      const cfg = JSON.parse(acc.config);
      if (acc.provider === "webdav") {
        setWebdavUrl(cfg.url ?? "");
        setWebdavUser(cfg.username ?? "");
        setWebdavPass(cfg.password ?? "");
      } else {
        setOauthClientId(cfg.client_id ?? "");
        setOauthClientSecret(cfg.client_secret ?? "");
        setOauthTokens(cfg.tokens ?? null);
      }
    } catch {
      // config parse failed, leave defaults
    }

    setShowAddForm(true);
  };

  const resetForm = () => {
    setProvider("webdav");
    setWebdavUrl("");
    setWebdavUser("");
    setWebdavPass("");
    setOauthClientId("");
    setOauthClientSecret("");
    setOauthTokens(null);
    setSyncFreq("manual");
    setIntervalMin(15);
    setEncEnabled(false);
    setPassphraseVal("");
    setEditingAccountId(null);
  };

  return (
    <div className="space-y-4">
      {/* Existing accounts list */}
      {accounts.length > 0 && !showAddForm && (
        <div className="space-y-2">
          {accounts.map((acc) => (
            <div
              key={acc.id}
              className="bg-muted/20 rounded-md p-2.5 space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Cloud className="w-3 h-3 text-muted-foreground" />
                  <span className="text-sm2 font-medium text-foreground capitalize">
                    {acc.provider === "google_drive"
                      ? "Google Drive"
                      : acc.provider === "onedrive"
                        ? "OneDrive"
                        : "WebDAV"}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span
                    className={cn(
                      "text-2xs px-1.5 py-0.5 rounded-full",
                      acc.enabled
                        ? "bg-green-500/15 text-green-400"
                        : "bg-muted/30 text-muted-foreground",
                    )}
                  >
                    {acc.enabled ? t("sync.enabled") : "Off"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs2 text-muted-foreground">
                <span>{acc.sync_frequency}</span>
                {acc.last_sync_at && (
                  <>
                    <span>·</span>
                    <span>
                      {t("sync.lastSync")}:{" "}
                      {new Date(acc.last_sync_at).toLocaleTimeString()}
                    </span>
                  </>
                )}
                {acc.encryption_enabled && (
                  <>
                    <span>·</span>
                    <Lock className="w-2.5 h-2.5" />
                  </>
                )}
              </div>
              <div className="flex gap-1.5 mt-1">
                <button
                  onClick={() => triggerSync(acc.id)}
                  disabled={syncStatus === "syncing"}
                  className="flex items-center gap-1 h-6 px-2 text-xs2 font-medium bg-primary/15 text-primary hover:bg-primary/25 rounded transition-colors disabled:opacity-50"
                >
                  {syncStatus === "syncing" ? (
                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-2.5 h-2.5" />
                  )}
                  {t("sync.syncNow")}
                </button>
                <button
                  onClick={() => handleEdit(acc)}
                  className="flex items-center gap-1 h-6 px-2 text-xs2 font-medium bg-muted/30 hover:bg-muted/50 rounded transition-colors"
                >
                  <Pencil className="w-2.5 h-2.5" />
                  {t("sync.edit")}
                </button>
                <button
                  onClick={async () => {
                    await removeAccount(acc.id);
                    toast.success(t("sync.delete"));
                  }}
                  className="flex items-center gap-1 h-6 px-2 text-xs2 font-medium text-destructive bg-destructive/10 hover:bg-destructive/20 rounded transition-colors"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                  {t("sync.delete")}
                </button>
              </div>
            </div>
          ))}

          {/* Sync status bar */}
          <div className="flex items-center justify-between text-xs2 text-muted-foreground px-1">
            <div className="flex items-center gap-1">
              {syncStatus === "syncing" && (
                <Loader2 className="w-2.5 h-2.5 animate-spin text-blue-400" />
              )}
              {syncStatus === "synced" && (
                <Cloud className="w-2.5 h-2.5 text-green-400" />
              )}
              {syncStatus === "error" && (
                <CloudOff className="w-2.5 h-2.5 text-red-400" />
              )}
              <span>
                {syncStatus === "syncing"
                  ? t("sync.syncing")
                  : syncStatus === "synced"
                    ? t("sync.synced")
                    : syncStatus === "error"
                      ? t("sync.syncFailed")
                      : ""}
              </span>
            </div>
            {lastSyncTime && (
              <span>{new Date(lastSyncTime).toLocaleTimeString()}</span>
            )}
          </div>

          {/* Add more button */}
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 h-7 px-3 text-sm2 font-medium bg-muted/30 hover:bg-muted/50 rounded-md transition-colors"
          >
            <Plus className="w-3 h-3" />
            {t("sync.addAccount")}
          </button>

          {/* Settings sync toggle */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/30">
            <div>
              <label className="text-sm2 font-medium text-muted-foreground uppercase tracking-wider">
                {t("sync.settingsSync")}
              </label>
              <p className="text-xs2 text-muted-foreground/70">
                {t("sync.settingsSyncDesc")}
              </p>
            </div>
            <Toggle value={settingsSyncEnabled} onChange={setSettingsSyncEnabled} size="sm" />
          </div>

          {/* File sync size limit */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm2 font-medium text-muted-foreground uppercase tracking-wider">
                {t("sync.syncMaxFileSize")}
              </label>
              <p className="text-xs2 text-muted-foreground/70">
                {t("sync.syncMaxFileSizeDesc")}
              </p>
            </div>
            <select
              value={syncMaxFileSize}
              onChange={(e) => setSyncMaxFileSize(Number(e.target.value))}
              className="h-6 px-1.5 text-xs2 bg-muted/30 border border-border/50 rounded text-foreground focus:outline-none focus:ring-1 focus:ring-ring/30"
            >
              <option value={0}>{t("sync.syncMaxFileSizeUnlimited")}</option>
              <option value={1}>1 MB</option>
              <option value={5}>5 MB</option>
              <option value={10}>10 MB</option>
              <option value={50}>50 MB</option>
              <option value={100}>100 MB</option>
            </select>
          </div>
        </div>
      )}

      {/* Empty state */}
      {accounts.length === 0 && !showAddForm && (
        <div className="flex flex-col items-center justify-center py-6 gap-3 text-muted-foreground/70">
          <Cloud className="w-8 h-8 text-muted-foreground/40" />
          <p className="text-xs">{t("sync.noAccounts")}</p>
          <p className="text-xs2">{t("sync.noAccountsDesc")}</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 h-7 px-3 text-sm2 font-medium bg-primary/15 text-primary hover:bg-primary/25 rounded-md transition-colors mt-1"
          >
            <Plus className="w-3 h-3" />
            {t("sync.addAccount")}
          </button>
        </div>
      )}

      {showAddForm && (
        <div className="space-y-4">
          {/* Provider selector */}
          <section>
            <label className="text-sm2 font-medium text-muted-foreground uppercase tracking-wider">
              {t("sync.provider")}
            </label>
            <div className="flex gap-1.5 mt-2">
              {providers.map((p) => (
                <button
                  key={p.key}
                  onClick={() => {
                    if (!editingAccountId) {
                      setProvider(p.key);
                      setOauthTokens(null);
                    }
                  }}
                  disabled={!!editingAccountId}
                  className={cn(
                    "flex-1 flex items-center justify-center py-1.5 rounded-md text-xs font-medium transition-colors",
                    provider === p.key
                      ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                      : "bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                    editingAccountId && "opacity-60 cursor-not-allowed",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </section>

          {/* Provider-specific config */}
          {provider === "webdav" && (
            <section className="space-y-2">
              <input
                type="text"
                placeholder={t("sync.url")}
                value={webdavUrl}
                onChange={(e) => setWebdavUrl(e.target.value)}
                className="w-full h-7 px-2 text-sm2 bg-muted/30 border border-border/50 rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-ring/30"
              />
              <input
                type="text"
                placeholder={t("sync.username")}
                value={webdavUser}
                onChange={(e) => setWebdavUser(e.target.value)}
                className="w-full h-7 px-2 text-sm2 bg-muted/30 border border-border/50 rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-ring/30"
              />
              <input
                type="password"
                placeholder={t("sync.password")}
                value={webdavPass}
                onChange={(e) => setWebdavPass(e.target.value)}
                className="w-full h-7 px-2 text-sm2 bg-muted/30 border border-border/50 rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-ring/30"
              />
            </section>
          )}

          {(provider === "google_drive" || provider === "onedrive") && (
            <section className="space-y-2">
              <input
                type="text"
                placeholder={t("sync.clientId")}
                value={oauthClientId}
                onChange={(e) => setOauthClientId(e.target.value)}
                className="w-full h-7 px-2 text-sm2 bg-muted/30 border border-border/50 rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-ring/30"
              />
              {provider === "google_drive" && (
                <input
                  type="password"
                  placeholder={t("sync.clientSecret")}
                  value={oauthClientSecret}
                  onChange={(e) => setOauthClientSecret(e.target.value)}
                  className="w-full h-7 px-2 text-sm2 bg-muted/30 border border-border/50 rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-ring/30"
                />
              )}
              <button
                onClick={handleOAuth}
                disabled={authorizing || !oauthClientId}
                className="flex items-center gap-1.5 h-7 px-3 text-sm2 font-medium bg-primary/15 text-primary hover:bg-primary/25 rounded-md transition-colors disabled:opacity-50"
              >
                {authorizing && <Loader2 className="w-3 h-3 animate-spin" />}
                {oauthTokens ? t("sync.authorized") : t("sync.authorize")}
              </button>
            </section>
          )}

          {/* Sync frequency */}
          <section>
            <label className="text-sm2 font-medium text-muted-foreground uppercase tracking-wider">
              {t("sync.syncFrequency")}
            </label>
            <div className="flex gap-1.5 mt-2">
              {freqOptions.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setSyncFreq(f.key)}
                  className={cn(
                    "flex-1 flex items-center justify-center py-1.5 rounded-md text-xs font-medium transition-colors",
                    syncFreq === f.key
                      ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                      : "bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {syncFreq === "interval" && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={1440}
                  value={intervalMin}
                  onChange={(e) =>
                    setIntervalMin(parseInt(e.target.value, 10) || 15)
                  }
                  className="w-20 h-7 px-2 text-xs bg-muted/30 border border-border/50 rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-ring/30"
                />
                <span className="text-xs2 text-muted-foreground">
                  {t("sync.intervalMinutes")}
                </span>
              </div>
            )}
          </section>

          {/* Encryption */}
          <section>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-muted-foreground" />
                <div>
                  <label className="text-sm2 font-medium text-muted-foreground uppercase tracking-wider">
                    {t("sync.encryption")}
                  </label>
                  <p className="text-xs2 text-muted-foreground/70">
                    {t("sync.encryptionDesc")}
                  </p>
                </div>
              </div>
              <Toggle value={encEnabled} onChange={setEncEnabled} size="sm" />
            </div>
            {encEnabled && (
              <input
                type="password"
                placeholder={t("sync.passphrase")}
                value={passphraseVal}
                onChange={(e) => setPassphraseVal(e.target.value)}
                className="mt-2 w-full h-7 px-2 text-sm2 bg-muted/30 border border-border/50 rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-ring/30"
              />
            )}
          </section>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowAddForm(false);
                setEditingAccountId(null);
                resetForm();
              }}
              className="flex items-center gap-1.5 h-7 px-3 text-sm2 font-medium bg-muted/30 hover:bg-muted/50 rounded-md transition-colors"
            >
              <X className="w-3 h-3" />
              {t("template.cancel")}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 h-7 px-3 text-sm2 font-medium bg-primary/15 text-primary hover:bg-primary/25 rounded-md transition-colors disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Check className="w-3 h-3" />
              )}
              {t("sync.save")}
            </button>
            {provider === "webdav" && (
              <button
                onClick={handleTest}
                disabled={testing}
                className="flex items-center gap-1.5 h-7 px-3 text-sm2 font-medium bg-muted/30 hover:bg-muted/50 rounded-md transition-colors ml-auto disabled:opacity-50"
              >
                {testing ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <RefreshCw className="w-3 h-3" />
                )}
                {t("sync.testConnection")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Translate Tab ─── */
function TranslateTab() {
  const { t } = useTranslation();
  const engines = useTranslateStore((s) => s.engines);
  const loadEngines = useTranslateStore((s) => s.loadEngines);
  const saveEngine = useTranslateStore((s) => s.saveEngine);

  const [engineForms, setEngineForms] = useState<
    Record<string, { apiKey: string; apiSecret: string; enabled: boolean }>
  >({});
  const [savedEngine, setSavedEngine] = useState<string | null>(null);

  useEffect(() => {
    loadEngines();
  }, [loadEngines]);

  useEffect(() => {
    const forms: Record<
      string,
      { apiKey: string; apiSecret: string; enabled: boolean }
    > = {};
    for (const eng of ENGINE_LIST) {
      const existing = engines.find((e) => e.engine === eng.id);
      forms[eng.id] = {
        apiKey: existing?.api_key ?? "",
        apiSecret: existing?.api_secret ?? "",
        enabled: existing?.enabled ?? false,
      };
    }
    setEngineForms(forms);
  }, [engines]);

  const handleSaveEngine = async (engineId: string) => {
    const form = engineForms[engineId];
    if (!form) return;
    await saveEngine(engineId, form.apiKey, form.apiSecret, form.enabled);
    setSavedEngine(engineId);
    setTimeout(() => setSavedEngine(null), 1500);
  };

  return (
    <div className="space-y-3">
      <label className="text-sm2 font-medium text-muted-foreground uppercase tracking-wider">
        {t("translate.engineConfig")}
      </label>
      {ENGINE_LIST.map((eng) => {
        const form = engineForms[eng.id];
        if (!form) return null;
        return (
          <div key={eng.id} className="bg-muted/20 rounded-md p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm2 font-medium text-foreground">
                {eng.label}
              </span>
              <Toggle
                value={form.enabled}
                onChange={(v) =>
                  setEngineForms((prev) => ({
                    ...prev,
                    [eng.id]: { ...prev[eng.id], enabled: v },
                  }))
                }
                size="sm"
              />
            </div>
            <input
              type="text"
              placeholder={t("translate.apiKey")}
              value={form.apiKey}
              onChange={(e) =>
                setEngineForms((prev) => ({
                  ...prev,
                  [eng.id]: { ...prev[eng.id], apiKey: e.target.value },
                }))
              }
              className="w-full h-6 px-2 text-sm2 bg-background border border-border/50 rounded text-foreground focus:outline-none focus:ring-1 focus:ring-ring/30"
            />
            {eng.hasSecret && (
              <input
                type="password"
                placeholder={t("translate.apiSecret")}
                value={form.apiSecret}
                onChange={(e) =>
                  setEngineForms((prev) => ({
                    ...prev,
                    [eng.id]: { ...prev[eng.id], apiSecret: e.target.value },
                  }))
                }
                className="w-full h-6 px-2 text-sm2 bg-background border border-border/50 rounded text-foreground focus:outline-none focus:ring-1 focus:ring-ring/30"
              />
            )}
            <button
              onClick={() => handleSaveEngine(eng.id)}
              className="h-6 px-3 text-xs2 font-medium bg-primary/15 text-primary hover:bg-primary/25 rounded transition-colors"
            >
              {savedEngine === eng.id
                ? t("translate.saved")
                : t("translate.save")}
            </button>
          </div>
        );
      })}
    </div>
  );
}

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
function DataTab() {
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

/* ─── Settings Page ─── */
export function SettingsPage({ onBack }: Props) {
  const { t } = useTranslation();
  const platform = usePlatform();
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div data-tauri-drag-region className="flex items-center gap-2 px-2 py-1.5 border-b border-border/30 shrink-0">
        {platform === "macos" && <div className="w-14" />}
        <button
          onClick={onBack}
          className="flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>
        <span className="text-xs font-medium">{t("settings.title")}</span>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border/30 shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-md text-sm2 font-medium transition-colors",
              activeTab === tab.key
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
            )}
          >
            {tab.icon}
            <span>{t(tab.labelKey)}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "general" && <GeneralTab />}
        {activeTab === "sync" && <SyncTab />}
        {activeTab === "translate" && <TranslateTab />}
        {activeTab === "data" && <DataTab />}
      </div>
    </div>
  );
}
