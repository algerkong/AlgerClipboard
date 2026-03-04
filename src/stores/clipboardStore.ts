import { create } from "zustand";
import type { ClipboardEntry, ContentType } from "@/types";
import {
  getClipboardHistory,
  deleteEntries as deleteEntriesApi,
  toggleFavorite as toggleFavoriteApi,
} from "@/services/clipboardService";

interface ClipboardState {
  entries: ClipboardEntry[];
  selectedId: string | null;
  loading: boolean;
  typeFilter: ContentType | null;
  keyword: string;
  showFavoritesOnly: boolean;

  fetchHistory: () => Promise<void>;
  setTypeFilter: (filter: ContentType | null) => void;
  setKeyword: (keyword: string) => void;
  setShowFavoritesOnly: (show: boolean) => void;
  selectEntry: (id: string | null) => void;
  toggleFavorite: (id: string) => Promise<void>;
  deleteEntries: (ids: string[]) => Promise<void>;
  addEntry: (entry: ClipboardEntry) => void;
}

export const useClipboardStore = create<ClipboardState>((set, get) => ({
  entries: [],
  selectedId: null,
  loading: false,
  typeFilter: null,
  keyword: "",
  showFavoritesOnly: false,

  fetchHistory: async () => {
    set({ loading: true });
    try {
      const state = get();
      const entries = await getClipboardHistory({
        limit: 200,
        offset: 0,
        type_filter: state.typeFilter ?? undefined,
        keyword: state.keyword || undefined,
      });
      set({ entries, loading: false });
    } catch (err) {
      console.error("Failed to fetch clipboard history:", err);
      set({ loading: false });
    }
  },

  setTypeFilter: (filter: ContentType | null) => {
    set({ typeFilter: filter, showFavoritesOnly: false });
    get().fetchHistory();
  },

  setKeyword: (keyword: string) => {
    set({ keyword });
    get().fetchHistory();
  },

  setShowFavoritesOnly: (show: boolean) => {
    set({ showFavoritesOnly: show, typeFilter: null });
    get().fetchHistory();
  },

  selectEntry: (id: string | null) => {
    set({ selectedId: id });
  },

  toggleFavorite: async (id: string) => {
    try {
      const newValue = await toggleFavoriteApi(id);
      set((state) => ({
        entries: state.entries.map((e) =>
          e.id === id ? { ...e, is_favorite: newValue } : e
        ),
      }));
    } catch (err) {
      console.error("Failed to toggle favorite:", err);
    }
  },

  deleteEntries: async (ids: string[]) => {
    try {
      await deleteEntriesApi(ids);
      set((state) => ({
        entries: state.entries.filter((e) => !ids.includes(e.id)),
        selectedId:
          state.selectedId && ids.includes(state.selectedId)
            ? null
            : state.selectedId,
      }));
    } catch (err) {
      console.error("Failed to delete entries:", err);
    }
  },

  addEntry: (entry: ClipboardEntry) => {
    set((state) => {
      // Deduplicate by content_hash - remove existing entry with same hash
      const filtered = state.entries.filter(
        (e) => e.content_hash !== entry.content_hash
      );
      return { entries: [entry, ...filtered] };
    });
  },
}));
