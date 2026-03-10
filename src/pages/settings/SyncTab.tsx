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
import {
  SettingsButton,
  SettingsField,
  SettingsInput,
  SettingsRow,
  SettingsSection,
  SettingsSelect,
  SettingsSubsection,
  Toggle,
} from "./shared";

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
    <div className="space-y-5">
      {/* Existing accounts list */}
      {accounts.length > 0 && !showAddForm && (
        <SettingsSection title={t("sync.accounts") || "Accounts"}>
          {accounts.map((acc) => (
            <div
              key={acc.id}
              className="border-b border-[color-mix(in_oklab,var(--border)_76%,transparent)] px-5 py-3 last:border-b-0"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cloud className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm font-medium capitalize text-foreground">
                    {acc.provider === "google_drive"
                      ? "Google Drive"
                      : acc.provider === "onedrive"
                        ? "OneDrive"
                        : "WebDAV"}
                  </span>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs",
                    acc.enabled
                      ? "bg-green-500/15 text-green-400"
                      : "bg-muted/30 text-muted-foreground",
                  )}
                >
                  {acc.enabled ? t("sync.enabled") : "Off"}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
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
                    <Lock className="h-3 w-3" />
                  </>
                )}
              </div>
              <div className="mt-2 flex gap-2">
                <SettingsButton
                  tone="primary"
                  onClick={() => triggerSync(acc.id)}
                  disabled={syncStatus === "syncing"}
                >
                  {syncStatus === "syncing" ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                  {t("sync.syncNow")}
                </SettingsButton>
                <SettingsButton onClick={() => handleEdit(acc)}>
                  <Pencil className="h-3 w-3" />
                  {t("sync.edit")}
                </SettingsButton>
                <SettingsButton
                  tone="danger"
                  onClick={async () => {
                    await removeAccount(acc.id);
                    toast.success(t("sync.delete"));
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                  {t("sync.delete")}
                </SettingsButton>
              </div>
            </div>
          ))}

          {/* Sync status bar */}
          <div className="flex items-center justify-between px-5 py-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              {syncStatus === "syncing" && (
                <Loader2 className="h-3 w-3 animate-spin text-blue-400" />
              )}
              {syncStatus === "synced" && (
                <Cloud className="h-3 w-3 text-green-400" />
              )}
              {syncStatus === "error" && (
                <CloudOff className="h-3 w-3 text-red-400" />
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

          <div className="px-5 py-3">
            <SettingsButton onClick={() => setShowAddForm(true)}>
              <Plus className="h-3 w-3" />
              {t("sync.addAccount")}
            </SettingsButton>
          </div>
        </SettingsSection>
      )}

      {/* Sync options */}
      {accounts.length > 0 && !showAddForm && (
        <SettingsSection title={t("sync.settingsSync")}>
          <SettingsRow
            title={t("sync.settingsSync")}
            description={t("sync.settingsSyncDesc")}
            control={<Toggle value={settingsSyncEnabled} onChange={setSettingsSyncEnabled} size="sm" />}
          />
          <SettingsRow
            title={t("sync.syncMaxFileSize")}
            description={t("sync.syncMaxFileSizeDesc")}
            control={
              <SettingsField className="w-[12rem]">
                <SettingsSelect
                  value={syncMaxFileSize}
                  onChange={(e) => setSyncMaxFileSize(Number(e.target.value))}
                >
                  <option value={0}>{t("sync.syncMaxFileSizeUnlimited")}</option>
                  <option value={1}>1 MB</option>
                  <option value={5}>5 MB</option>
                  <option value={10}>10 MB</option>
                  <option value={50}>50 MB</option>
                  <option value={100}>100 MB</option>
                </SettingsSelect>
              </SettingsField>
            }
          />
        </SettingsSection>
      )}

      {/* Empty state */}
      {accounts.length === 0 && !showAddForm && (
        <div className="flex flex-col items-center justify-center gap-3 py-8 text-muted-foreground/70">
          <Cloud className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm">{t("sync.noAccounts")}</p>
          <p className="text-xs">{t("sync.noAccountsDesc")}</p>
          <SettingsButton tone="primary" onClick={() => setShowAddForm(true)}>
            <Plus className="h-3 w-3" />
            {t("sync.addAccount")}
          </SettingsButton>
        </div>
      )}

      {showAddForm && (
        <SettingsSection title={editingAccountId ? t("sync.edit") : t("sync.addAccount")}>
          <SettingsRow
            title={t("sync.provider")}
            control={
              <SettingsField className="w-[15rem]">
                <SettingsSelect
                  value={provider}
                  onChange={(e) => {
                    if (!editingAccountId) {
                      setProvider(e.target.value as "webdav" | "google_drive" | "onedrive");
                      setOauthTokens(null);
                    }
                  }}
                  disabled={!!editingAccountId}
                >
                  {providers.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.label}
                    </option>
                  ))}
                </SettingsSelect>
              </SettingsField>
            }
          />

          <SettingsSubsection title={provider === "webdav" ? "WebDAV" : provider === "google_drive" ? "Google Drive" : "OneDrive"}>
            {provider === "webdav" && (
              <div className="space-y-2 py-2">
                <SettingsInput type="text" placeholder={t("sync.url")} value={webdavUrl} onChange={(e) => setWebdavUrl(e.target.value)} className="settings-input-standalone" />
                <SettingsInput type="text" placeholder={t("sync.username")} value={webdavUser} onChange={(e) => setWebdavUser(e.target.value)} className="settings-input-standalone" />
                <SettingsInput type="password" placeholder={t("sync.password")} value={webdavPass} onChange={(e) => setWebdavPass(e.target.value)} className="settings-input-standalone" />
              </div>
            )}

            {(provider === "google_drive" || provider === "onedrive") && (
              <div className="space-y-2 py-2">
                <SettingsInput type="text" placeholder={t("sync.clientId")} value={oauthClientId} onChange={(e) => setOauthClientId(e.target.value)} className="settings-input-standalone" />
                {provider === "google_drive" && (
                  <SettingsInput type="password" placeholder={t("sync.clientSecret")} value={oauthClientSecret} onChange={(e) => setOauthClientSecret(e.target.value)} className="settings-input-standalone" />
                )}
                <SettingsButton onClick={handleOAuth} disabled={authorizing || !oauthClientId}>
                  {authorizing && <Loader2 className="h-3 w-3 animate-spin" />}
                  {oauthTokens ? t("sync.authorized") : t("sync.authorize")}
                </SettingsButton>
              </div>
            )}
          </SettingsSubsection>

          <SettingsRow
            title={t("sync.syncFrequency")}
            control={
              <SettingsField className="w-[15rem]">
                <SettingsSelect value={syncFreq} onChange={(e) => setSyncFreq(e.target.value as "realtime" | "interval" | "manual")}>
                  {freqOptions.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </SettingsSelect>
              </SettingsField>
            }
          />
          {syncFreq === "interval" && (
            <SettingsRow
              title={t("sync.interval")}
              description={t("sync.intervalMinutes")}
              control={
                <SettingsField className="w-[8rem]">
                  <SettingsInput
                    type="number"
                    min={1}
                    max={1440}
                    value={intervalMin}
                    onChange={(e) => setIntervalMin(parseInt(e.target.value, 10) || 15)}
                  />
                </SettingsField>
              }
            />
          )}

          <SettingsRow
            title={t("sync.encryption")}
            description={t("sync.encryptionDesc")}
            control={<Toggle value={encEnabled} onChange={setEncEnabled} size="sm" />}
          />
          {encEnabled && (
            <div className="px-5 py-2">
              <SettingsInput
                type="password"
                placeholder={t("sync.passphrase")}
                value={passphraseVal}
                onChange={(e) => setPassphraseVal(e.target.value)}
                className="settings-input-standalone"
              />
            </div>
          )}

          <div className="flex gap-2 px-5 py-3">
            <SettingsButton
              tone="ghost"
              onClick={() => {
                setShowAddForm(false);
                setEditingAccountId(null);
                resetForm();
              }}
            >
              <X className="h-3 w-3" />
              {t("template.cancel")}
            </SettingsButton>
            <SettingsButton
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Check className="h-3 w-3" />
              )}
              {t("sync.save")}
            </SettingsButton>
            {provider === "webdav" && (
              <SettingsButton
                onClick={handleTest}
                disabled={testing}
                className="ml-auto"
              >
                {testing ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                {t("sync.testConnection")}
              </SettingsButton>
            )}
          </div>
        </SettingsSection>
      )}
    </div>
  );
}
