import { create } from "zustand";
import type { SpotlightMode, SpotlightResult, SpotlightModifiers } from "@/spotlight/types";
import { getSetting } from "@/services/settingsService";

// Default prefix → mode mapping
const DEFAULT_PREFIXES: Record<string, string> = {
  cc: "clipboard",
  tt: "translate",
  aa: "app",
};

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
  checkPrefix: (input: string) => { activeMode: string; searchQuery: string };
}

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
   * Parse input for prefix routing. Returns the active mode and the actual search query.
   * Does NOT mutate state — the caller uses this to determine which mode's onQuery to call.
   * e.g. "tt hello" → { activeMode: "translate", searchQuery: "hello" }
   * e.g. "hello"    → { activeMode: current mode, searchQuery: "hello" }
   */
  checkPrefix: (input: string) => {
    const { prefixes, mode } = get();
    const spaceIdx = input.indexOf(" ");
    if (spaceIdx >= 1) {
      const prefix = input.slice(0, spaceIdx).toLowerCase();
      const targetMode = prefixes[prefix];
      if (targetMode) {
        return { activeMode: targetMode, searchQuery: input.slice(spaceIdx + 1) };
      }
    }
    return { activeMode: mode, searchQuery: input };
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
    const { activeMode } = get().checkPrefix(query);
    const m = modes.get(activeMode);
    const result = results[selectedIndex];
    if (m && result) {
      await m.onSelect(result, modifiers);
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
