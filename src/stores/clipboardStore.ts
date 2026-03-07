import { create } from "zustand";
import type { ClipboardEntry, ContentType } from "@/types";
import {
  getClipboardHistory,
  deleteEntries as deleteEntriesApi,
  toggleFavorite as toggleFavoriteApi,
  togglePin as togglePinApi,
  addTag as addTagApi,
  removeTag as removeTagApi,
  getAllTags as getAllTagsApi,
} from "@/services/clipboardService";

interface ClipboardState {
  entries: ClipboardEntry[];
  selectedId: string | null;
  loading: boolean;
  typeFilter: ContentType | null;
  keyword: string;
  showFavoritesOnly: boolean;
  tagFilter: string | null;
  allTags: string[];

  fetchHistory: () => Promise<void>;
  setTypeFilter: (filter: ContentType | null) => void;
  setKeyword: (keyword: string) => void;
  setShowFavoritesOnly: (show: boolean) => void;
  setTagFilter: (tag: string | null) => void;
  selectEntry: (id: string | null) => void;
  toggleFavorite: (id: string) => Promise<void>;
  togglePin: (id: string) => Promise<void>;
  deleteEntries: (ids: string[]) => Promise<void>;
  addEntry: (entry: ClipboardEntry) => void;
  addTag: (entryId: string, tag: string) => Promise<void>;
  removeTag: (entryId: string, tag: string) => Promise<void>;
  fetchAllTags: () => Promise<void>;
  updateEntrySummary: (id: string, summary: string) => void;
  updateEntryText: (id: string, text: string) => void;
  resetView: () => void;
}

export const useClipboardStore = create<ClipboardState>((set, get) => ({
  entries: [],
  selectedId: null,
  loading: false,
  typeFilter: null,
  keyword: "",
  showFavoritesOnly: false,
  tagFilter: null,
  allTags: [],

  fetchHistory: async () => {
    set({ loading: true });
    try {
      const state = get();
      const entries = await getClipboardHistory({
        limit: 200,
        offset: 0,
        type_filter: state.typeFilter ?? undefined,
        keyword: state.keyword || undefined,
        tag_filter: state.tagFilter ?? undefined,
      });
      set({ entries, loading: false });
    } catch (err) {
      console.error("Failed to fetch clipboard history:", err);
      set({ loading: false });
    }
  },

  setTypeFilter: (filter: ContentType | null) => {
    set({ typeFilter: filter, showFavoritesOnly: false, tagFilter: null });
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

  togglePin: async (id: string) => {
    try {
      const newValue = await togglePinApi(id);
      set((state) => ({
        entries: state.entries.map((e) =>
          e.id === id ? { ...e, is_pinned: newValue } : e
        ),
      }));
      // Re-fetch to get correct sort order (pinned first)
      get().fetchHistory();
    } catch (err) {
      console.error("Failed to toggle pin:", err);
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

  setTagFilter: (tag: string | null) => {
    set({ tagFilter: tag, showFavoritesOnly: false });
    get().fetchHistory();
  },

  addTag: async (entryId: string, tag: string) => {
    try {
      await addTagApi(entryId, tag);
      set((state) => ({
        entries: state.entries.map((e) =>
          e.id === entryId ? { ...e, tags: [...e.tags.filter((t) => t !== tag), tag] } : e
        ),
      }));
      get().fetchAllTags();
    } catch (err) {
      console.error("Failed to add tag:", err);
    }
  },

  removeTag: async (entryId: string, tag: string) => {
    try {
      await removeTagApi(entryId, tag);
      set((state) => ({
        entries: state.entries.map((e) =>
          e.id === entryId ? { ...e, tags: e.tags.filter((t) => t !== tag) } : e
        ),
      }));
      get().fetchAllTags();
    } catch (err) {
      console.error("Failed to remove tag:", err);
    }
  },

  fetchAllTags: async () => {
    try {
      const allTags = await getAllTagsApi();
      set({ allTags });
    } catch (err) {
      console.error("Failed to fetch tags:", err);
    }
  },

  updateEntrySummary: (id: string, summary: string) => {
    set((state) => ({
      entries: state.entries.map((e) =>
        e.id === id ? { ...e, ai_summary: summary } : e
      ),
    }));
  },

  updateEntryText: (id: string, text: string) => {
    set((state) => ({
      entries: state.entries.map((e) =>
        e.id === id ? { ...e, text_content: text } : e
      ),
    }));
  },

  resetView: () => {
    set({ typeFilter: null, keyword: "", showFavoritesOnly: false, tagFilter: null, selectedId: null });
    get().fetchHistory();
  },
}));
