import { invoke } from "@tauri-apps/api/core";
import type { SyncAccount, SyncResult } from "@/types";

export async function getSyncAccounts(): Promise<SyncAccount[]> {
  return invoke("get_sync_accounts");
}

export async function createSyncAccount(
  provider: string,
  config: string,
  syncFrequency: string,
  intervalMinutes?: number
): Promise<SyncAccount> {
  return invoke("create_sync_account", {
    provider,
    config,
    syncFrequency,
    intervalMinutes: intervalMinutes ?? null,
  });
}

export async function updateSyncAccount(
  id: string,
  config: string,
  syncFrequency: string,
  intervalMinutes: number | null,
  encryptionEnabled: boolean,
  enabled: boolean
): Promise<void> {
  return invoke("update_sync_account", {
    id,
    config,
    syncFrequency,
    intervalMinutes,
    encryptionEnabled,
    enabled,
  });
}

export async function deleteSyncAccount(id: string): Promise<void> {
  return invoke("delete_sync_account", { id });
}

export async function testSyncConnection(
  provider: string,
  config: string
): Promise<boolean> {
  return invoke("test_sync_connection", { provider, config });
}

export async function triggerSync(accountId: string): Promise<SyncResult> {
  return invoke("trigger_sync", { accountId });
}

export async function startOAuthFlow(
  provider: string,
  clientId: string,
  clientSecret?: string
): Promise<Record<string, unknown>> {
  return invoke("start_oauth_flow", {
    provider,
    clientId,
    clientSecret: clientSecret ?? null,
  });
}

export async function setSyncPassphrase(passphrase: string): Promise<void> {
  return invoke("set_sync_passphrase", { passphrase });
}

export async function resolveSyncConflict(
  entryId: string,
  resolution: string
): Promise<void> {
  return invoke("resolve_sync_conflict", { entryId, resolution });
}

export async function setSettingsSyncEnabled(enabled: boolean): Promise<void> {
  return invoke("set_settings_sync_enabled", { enabled });
}

export async function getSettingsSyncEnabled(): Promise<boolean> {
  return invoke("get_settings_sync_enabled");
}

export async function setSyncMaxFileSize(maxSizeMb: number): Promise<void> {
  return invoke("set_sync_max_file_size", { maxSizeMb });
}

export async function getSyncMaxFileSize(): Promise<number> {
  return invoke("get_sync_max_file_size");
}
