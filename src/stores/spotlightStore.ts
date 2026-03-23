import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { SpotlightMode, SpotlightResult, SpotlightModifiers } from "@/spotlight/types";
import { getSetting } from "@/services/settingsService";

// Default prefix → mode mapping
const DEFAULT_PREFIXES: Record<string, string> = {
  cc: "clipboard",
  tt: "translate",
  aa: "app",
};

const GLOBAL_SEARCH_TIMEOUT = 2000;

interface ResolveResult {
  activeMode: string;
  searchQuery: string;
  isGlobal: boolean;
}

interface SpotlightState {
  visible: boolean;
  mode: string;
  query: string;
  results: SpotlightResult[];
  selectedIndex: number;
  loading: boolean;
  modes: Map<string, SpotlightMode>;
  prefixes: Record<string, string>; // prefix → modeId

  activate: (mode: string) => void;
  hide: () => void;
  setQuery: (q: string) => void;
  setResults: (results: SpotlightResult[]) => void;
  setLoading: (loading: boolean) => void;
  selectNext: () => void;
  selectPrev: () => void;
  executeSelected: (modifiers?: SpotlightModifiers) => Promise<void>;
  switchMode: (direction: 1 | -1) => void;
  registerMode: (mode: SpotlightMode) => void;
  unregisterMode: (modeId: string) => void;
  loadPrefixes: () => Promise<void>;
  resolveQuery: (input: string) => ResolveResult;
  executeQuery: (query: string) => void;
  // Legacy alias for backward compatibility (plugins, translateMode, etc.)
  checkPrefix: (input: string) => { activeMode: string; searchQuery: string };
}

// Abort controller for cancelling in-flight global searches
let activeAbort: AbortController | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export const useSpotlightStore = create<SpotlightState>((set, get) => ({
  visible: false,
  mode: "app",
  query: "",
  results: [],
  selectedIndex: 0,
  loading: false,
  modes: new Map(),
  prefixes: { ...DEFAULT_PREFIXES },

  registerMode: (mode) => {
    set((state) => {
      const modes = new Map(state.modes);
      modes.set(mode.id, mode);
      return { modes };
    });
  },

  unregisterMode: (modeId) => {
    set((state) => {
      const modes = new Map(state.modes);
      modes.delete(modeId);
      return { modes };
    });
  },

  loadPrefixes: async () => {
    try {
      const json = await getSetting("spotlight_prefixes");
      if (json) {
        const parsed = JSON.parse(json);
        if (typeof parsed === "object" && parsed !== null) {
          set({ prefixes: parsed });
          return;
        }
      }
    } catch { /* use defaults */ }
    set({ prefixes: { ...DEFAULT_PREFIXES } });
  },

  /**
   * Parse input for prefix routing. Returns the active mode, actual search query,
   * and whether this is a global search (no prefix matched).
   */
  resolveQuery: (input: string): ResolveResult => {
    const { prefixes, mode } = get();
    const spaceIdx = input.indexOf(" ");
    if (spaceIdx >= 1) {
      const prefix = input.slice(0, spaceIdx).toLowerCase();
      const targetMode = prefixes[prefix];
      if (targetMode) {
        return { activeMode: targetMode, searchQuery: input.slice(spaceIdx + 1), isGlobal: false };
      }
    }
    return { activeMode: mode, searchQuery: input, isGlobal: true };
  },

  // Legacy alias — plugins and existing code may still use checkPrefix
  checkPrefix: (input: string) => {
    const { activeMode, searchQuery } = get().resolveQuery(input);
    return { activeMode, searchQuery };
  },

  executeQuery: (query: string) => {
    // Cancel previous query
    if (activeAbort) {
      activeAbort.abort();
      activeAbort = null;
    }
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    const { resolveQuery, modes } = get();
    const resolved = resolveQuery(query);

    if (!query.trim()) {
      set({ results: [], loading: false, selectedIndex: 0 });
      return;
    }

    set({ loading: true, selectedIndex: 0 });

    if (!resolved.isGlobal) {
      // === PREFIX MODE: single mode query (existing behavior) ===
      const targetMode = modes.get(resolved.activeMode);
      if (!targetMode) {
        set({ results: [], loading: false });
        return;
      }

      debounceTimer = setTimeout(async () => {
        try {
          const newResults = await targetMode.onQuery(resolved.searchQuery);
          for (const r of newResults) {
            r._modeId = targetMode.id;
          }
          const currentResults = get().results;
          if (newResults.length > 0 || currentResults.length === 0) {
            set({ results: newResults, loading: false });
          } else {
            set({ loading: false });
          }
        } catch (err) {
          console.error("Spotlight query error:", err);
          set({ results: [], loading: false });
        }
      }, targetMode.debounceMs ?? 200);
    } else {
      // === GLOBAL SEARCH: parallel multi-mode query ===
      const abort = new AbortController();
      activeAbort = abort;

      // Collect all global-search-enabled modes that match this input
      const globalModes: SpotlightMode[] = [];
      for (const m of modes.values()) {
        if (!m.globalSearch) continue;
        if (m.match && !m.match(resolved.searchQuery)) continue;
        globalModes.push(m);
      }

      if (globalModes.length === 0) {
        set({ results: [], loading: false });
        return;
      }

      // Use the shortest debounce among matched modes (min 50ms)
      const debounceMs = Math.max(
        50,
        Math.min(...globalModes.map((m) => m.debounceMs ?? 200))
      );

      // Clear results for fresh global search
      set({ results: [] });

      debounceTimer = setTimeout(() => {
        let completed = 0;
        const total = globalModes.length;

        // Timeout to stop accepting results
        const timeoutId = setTimeout(() => {
          if (!abort.signal.aborted) {
            abort.abort();
            set({ loading: false });
          }
        }, GLOBAL_SEARCH_TIMEOUT);

        for (const m of globalModes) {
          m.onQuery(resolved.searchQuery)
            .then((results) => {
              if (abort.signal.aborted) return;

              // Tag results with mode ID and ensure score
              for (const r of results) {
                r._modeId = m.id;
                if (r.score == null) r.score = 0.5;
              }

              // Merge into current results, sorted by score * priority
              const current = get().results;
              const allModes = get().modes;
              const merged = [...current, ...results];
              merged.sort((a, b) => {
                const sa = (a.score ?? 0.5) * (allModes.get(a._modeId ?? "")?.priority ?? 50);
                const sb = (b.score ?? 0.5) * (allModes.get(b._modeId ?? "")?.priority ?? 50);
                return sb - sa;
              });
              set({ results: merged });
            })
            .catch(() => { /* ignore individual mode errors */ })
            .finally(() => {
              completed++;
              if (completed >= total && !abort.signal.aborted) {
                clearTimeout(timeoutId);
                set({ loading: false });
              }
            });
        }
      }, debounceMs);
    }
  },

  activate: (mode) => {
    const state = get();
    if (state.visible && state.mode === mode) {
      set({ query: "", results: [], selectedIndex: 0 });
    } else {
      set({ visible: true, mode, query: "", results: [], selectedIndex: 0 });
    }
  },

  hide: () => {
    set({ visible: false });
  },

  setQuery: (q) => set({ query: q, selectedIndex: 0 }),

  setResults: (results) => set({ results, loading: false }),

  setLoading: (loading) => set({ loading }),

  selectNext: () =>
    set((s) => ({
      selectedIndex: Math.min(s.selectedIndex + 1, s.results.length - 1),
    })),

  selectPrev: () =>
    set((s) => ({
      selectedIndex: Math.max(s.selectedIndex - 1, 0),
    })),

  executeSelected: async (modifiers) => {
    const { query, modes, results, selectedIndex } = get();
    const result = results[selectedIndex];
    if (!result) return;

    // For global search results, use _modeId; for prefix mode, use resolveQuery
    const modeId = result._modeId ?? get().resolveQuery(query).activeMode;
    const m = modes.get(modeId);
    if (m) {
      await m.onSelect(result, modifiers);

      // Record to history (fire-and-forget)
      invoke("add_spotlight_history", {
        entry: {
          id: `${Date.now()}-${result.id}`,
          title: result.title,
          subtitle: result.subtitle ?? "",
          mode_id: modeId,
          mode_name: m.name,
          original_result_id: result.id,
          query: query,
          timestamp: new Date().toISOString(),
        },
      }).catch(() => { /* ignore history errors */ });
    }
  },

  switchMode: (direction) => {
    const { modes, mode } = get();
    const ids = Array.from(modes.keys());
    if (ids.length === 0) return;
    const idx = ids.indexOf(mode);
    const next = (idx + direction + ids.length) % ids.length;
    set({ mode: ids[next], query: "", results: [], selectedIndex: 0 });
  },
}));
