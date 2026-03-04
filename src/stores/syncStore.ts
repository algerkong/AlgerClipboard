import { create } from "zustand";
import * as syncService from "@/services/syncService";
import type { SyncAccount } from "@/types";

type SyncStatusType = "idle" | "syncing" | "synced" | "error";

interface SyncState {
  accounts: SyncAccount[];
  syncStatus: SyncStatusType;
  lastSyncTime: string | null;
  syncError: string | null;
  loading: boolean;

  loadAccounts: () => Promise<void>;
  addAccount: (
    provider: string,
    config: string,
    frequency: string,
    interval?: number
  ) => Promise<SyncAccount>;
  removeAccount: (id: string) => Promise<void>;
  updateAccount: (
    id: string,
    config: string,
    frequency: string,
    interval: number | null,
    encryption: boolean,
    enabled: boolean
  ) => Promise<void>;
  testConnection: (provider: string, config: string) => Promise<boolean>;
  triggerSync: (accountId: string) => Promise<void>;
  startOAuth: (
    provider: string,
    clientId: string,
    clientSecret?: string
  ) => Promise<Record<string, unknown>>;
  setPassphrase: (passphrase: string) => Promise<void>;
  setSyncStatus: (status: SyncStatusType, error?: string | null) => void;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  accounts: [],
  syncStatus: "idle",
  lastSyncTime: null,
  syncError: null,
  loading: false,

  loadAccounts: async () => {
    set({ loading: true });
    try {
      const accounts = await syncService.getSyncAccounts();
      set({ accounts, loading: false });
    } catch (err) {
      console.error("Failed to load sync accounts:", err);
      set({ loading: false });
    }
  },

  addAccount: async (provider, config, frequency, interval) => {
    const account = await syncService.createSyncAccount(
      provider,
      config,
      frequency,
      interval
    );
    set((s) => ({ accounts: [...s.accounts, account] }));
    return account;
  },

  removeAccount: async (id) => {
    await syncService.deleteSyncAccount(id);
    set((s) => ({ accounts: s.accounts.filter((a) => a.id !== id) }));
  },

  updateAccount: async (id, config, frequency, interval, encryption, enabled) => {
    await syncService.updateSyncAccount(
      id,
      config,
      frequency,
      interval,
      encryption,
      enabled
    );
    await get().loadAccounts();
  },

  testConnection: async (provider, config) => {
    return syncService.testSyncConnection(provider, config);
  },

  triggerSync: async (accountId) => {
    set({ syncStatus: "syncing", syncError: null });
    try {
      await syncService.triggerSync(accountId);
      set({
        syncStatus: "synced",
        lastSyncTime: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ syncStatus: "error", syncError: msg });
    }
  },

  startOAuth: async (provider, clientId, clientSecret) => {
    return syncService.startOAuthFlow(provider, clientId, clientSecret);
  },

  setPassphrase: async (passphrase) => {
    await syncService.setSyncPassphrase(passphrase);
  },

  setSyncStatus: (status, error = null) => {
    set({ syncStatus: status, syncError: error });
  },
}));
