import { listen } from "@tauri-apps/api/event";
import { create } from "zustand";
import type { ClipboardEntry, ContentType, TagSummary, TimeRange } from "@/types";
import {
  getClipboardHistory,
  getEntryCount,
  deleteEntries as deleteEntriesApi,
  toggleFavorite as toggleFavoriteApi,
  togglePin as togglePinApi,
  createTag as createTagApi,
  addTag as addTagApi,
  removeTag as removeTagApi,
  getAllTags as getAllTagsApi,
  getTagSummaries as getTagSummariesApi,
  renameTag as renameTagApi,
  deleteTagEverywhere as deleteTagEverywhereApi,
  searchEntries,
} from "@/services/clipboardService";

interface ClipboardState {
  entries: ClipboardEntry[];
  totalCount: number;
  selectedId: string | null;
  loading: boolean;
  typeFilter: ContentType | null;
  keyword: string;
  showFavoritesOnly: boolean;
  tagFilter: string | null;
  showTagPanel: boolean;
  timeRange: TimeRange;
  allTags: string[];
  tagSummaries: TagSummary[];

  fetchHistory: () => Promise<void>;
  setTypeFilter: (filter: ContentType | null) => void;
  setKeyword: (keyword: string) => void;
  setShowFavoritesOnly: (show: boolean) => void;
  setTagFilter: (tag: string | null) => void;
  setTimeRange: (range: TimeRange) => void;
  setShowTagPanel: (show: boolean) => void;
  selectEntry: (id: string | null) => void;
  toggleFavorite: (id: string) => Promise<void>;
  togglePin: (id: string) => Promise<void>;
  deleteEntries: (ids: string[]) => Promise<void>;
  addEntry: (entry: ClipboardEntry) => void;
  addTag: (entryId: string, tag: string) => Promise<void>;
  createTag: (tag: string) => Promise<void>;
  removeTag: (entryId: string, tag: string) => Promise<void>;
  fetchAllTags: () => Promise<void>;
  fetchTagSummaries: () => Promise<void>;
  renameTag: (oldTag: string, newTag: string) => Promise<void>;
  deleteTagEverywhere: (tag: string) => Promise<void>;
  updateEntrySummary: (id: string, summary: string) => void;
  updateEntryText: (id: string, text: string) => void;
  resetView: () => void;
}

interface TagChangeEvent {
  action: "create" | "add" | "remove" | "rename" | "delete";
  tag?: string | null;
  old_tag?: string | null;
  new_tag?: string | null;
}

export const useClipboardStore = create<ClipboardState>((set, get) => ({
  entries: [],
  totalCount: 0,
  selectedId: null,
  loading: false,
  typeFilter: null,
  keyword: "",
  showFavoritesOnly: false,
  tagFilter: null,
  showTagPanel: false,
  timeRange: "all" as TimeRange,
  allTags: [],
  tagSummaries: [],

  fetchHistory: async () => {
    set({ loading: true });
    try {
      const state = get();
      let entries: ClipboardEntry[];

      if (state.keyword.trim()) {
        // Use FTS search when keyword is present
        entries = await searchEntries(state.keyword, {
          typeFilter: state.typeFilter ?? undefined,
          timeRange: state.timeRange !== "all" ? state.timeRange : undefined,
          tagFilter: state.tagFilter ?? undefined,
          taggedOnly: state.showTagPanel && !state.tagFilter,
        });
      } else {
        // Normal history fetch (no keyword)
        entries = await getClipboardHistory({
          limit: 200,
          offset: 0,
          type_filter: state.typeFilter ?? undefined,
          tag_filter: state.tagFilter ?? undefined,
          tagged_only: state.showTagPanel && !state.tagFilter,
        });
      }

      const totalCount = await getEntryCount();
      set({ entries, totalCount, loading: false });
    } catch (err) {
      console.error("Failed to fetch clipboard history:", err);
      set({ loading: false });
    }
  },

  setTypeFilter: (filter: ContentType | null) => {
    set({ typeFilter: filter, showFavoritesOnly: false, tagFilter: null, showTagPanel: false });
    get().fetchHistory();
  },

  setKeyword: (keyword: string) => {
    set({ keyword });
    get().fetchHistory();
  },

  setShowFavoritesOnly: (show: boolean) => {
    set({ showFavoritesOnly: show, typeFilter: null, tagFilter: null, showTagPanel: false });
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
        totalCount: Math.max(0, state.totalCount - ids.length),
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
      const existed = filtered.length !== state.entries.length;
      return {
        entries: [entry, ...filtered],
        totalCount: existed ? state.totalCount : state.totalCount + 1,
      };
    });
  },

  createTag: async (tag: string) => {
    try {
      await createTagApi(tag);
      void get().fetchAllTags();
      void get().fetchTagSummaries();
    } catch (err) {
      console.error("Failed to create tag:", err);
      throw err;
    }
  },

  setTagFilter: (tag: string | null) => {
    set({ tagFilter: tag, showFavoritesOnly: false, showTagPanel: true });
    get().fetchHistory();
  },

  setTimeRange: (range: TimeRange) => {
    set({ timeRange: range });
    get().fetchHistory();
  },

  setShowTagPanel: (show: boolean) => {
    set((state) => ({
      showTagPanel: show,
      typeFilter: show ? null : state.typeFilter,
      showFavoritesOnly: show ? false : state.showFavoritesOnly,
      tagFilter: show ? state.tagFilter : null,
    }));
    if (show) {
      void get().fetchAllTags();
      void get().fetchTagSummaries();
    }
    void get().fetchHistory();
  },

  addTag: async (entryId: string, tag: string) => {
    try {
      await addTagApi(entryId, tag);
      set((state) => ({
        entries: state.entries.map((e) =>
          e.id === entryId ? { ...e, tags: [...e.tags.filter((t) => t !== tag), tag] } : e
        ),
      }));
      void get().fetchAllTags();
      void get().fetchTagSummaries();
      void get().fetchHistory();
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
      void get().fetchAllTags();
      void get().fetchTagSummaries();
      void get().fetchHistory();
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

  fetchTagSummaries: async () => {
    try {
      const tagSummaries = await getTagSummariesApi();
      set({ tagSummaries });
    } catch (err) {
      console.error("Failed to fetch tag summaries:", err);
    }
  },

  renameTag: async (oldTag: string, newTag: string) => {
    try {
      await renameTagApi(oldTag, newTag);
      set((state) => ({
        entries: state.entries.map((entry) => ({
          ...entry,
          tags: entry.tags.map((tag) => (tag === oldTag ? newTag : tag)),
        })),
        tagFilter: state.tagFilter === oldTag ? newTag : state.tagFilter,
      }));
      get().fetchAllTags();
      get().fetchTagSummaries();
      get().fetchHistory();
    } catch (err) {
      console.error("Failed to rename tag:", err);
      throw err;
    }
  },

  deleteTagEverywhere: async (tag: string) => {
    try {
      await deleteTagEverywhereApi(tag);
      set((state) => ({
        entries: state.entries.map((entry) => ({
          ...entry,
          tags: entry.tags.filter((item) => item !== tag),
        })),
        tagFilter: state.tagFilter === tag ? null : state.tagFilter,
      }));
      get().fetchAllTags();
      get().fetchTagSummaries();
      get().fetchHistory();
    } catch (err) {
      console.error("Failed to delete tag:", err);
      throw err;
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
    set({ typeFilter: null, keyword: "", showFavoritesOnly: false, tagFilter: null, showTagPanel: false, selectedId: null, timeRange: "all" });
    get().fetchHistory();
  },
}));

// Refresh list when an entry is edited in the detail window
listen<string>("entry-updated", () => {
  void useClipboardStore.getState().fetchHistory();
}).catch(() => {});

listen<TagChangeEvent>("tags-changed", (event) => {
  const state = useClipboardStore.getState();
  const payload = event.payload;

  if (payload.action === "rename" && payload.old_tag && payload.new_tag && state.tagFilter === payload.old_tag) {
    useClipboardStore.setState({ tagFilter: payload.new_tag });
  }

  if (payload.action === "delete" && payload.tag && state.tagFilter === payload.tag) {
    useClipboardStore.setState({ tagFilter: null });
  }

  const nextState = useClipboardStore.getState();
  void nextState.fetchAllTags();
  if (nextState.showTagPanel) {
    void nextState.fetchTagSummaries();
  }
  void nextState.fetchHistory();
}).catch(() => {});
