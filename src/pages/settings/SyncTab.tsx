import { useEffect, useState } from "react";
import {
  Cloud,
  Plus,
  RefreshCw,
  Check,
  X,
  Lock,
  Loader2,
  CloudOff,
  Pencil,
  Trash2,
} from "lucide-react";
import { useSyncStore } from "@/stores/syncStore";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { toast } from "@/lib/toast";
import { Toggle } from "./shared";

/* ─── Sync Tab ─── */
export function SyncTab() {
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
