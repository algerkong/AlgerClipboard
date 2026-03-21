import { create } from "zustand";
import type { SpotlightMode, SpotlightResult } from "@/spotlight/types";

interface SpotlightState {
  visible: boolean;
  mode: string;
  query: string;
  results: SpotlightResult[];
  selectedIndex: number;
  loading: boolean;
  modes: Map<string, SpotlightMode>;

  activate: (mode: string) => void;
  hide: () => void;
  setQuery: (q: string) => void;
  setResults: (results: SpotlightResult[]) => void;
  setLoading: (loading: boolean) => void;
  selectNext: () => void;
  selectPrev: () => void;
  executeSelected: () => Promise<void>;
  switchMode: (direction: 1 | -1) => void;
  registerMode: (mode: SpotlightMode) => void;
}

export const useSpotlightStore = create<SpotlightState>((set, get) => ({
  visible: false,
  mode: "clipboard",
  query: "",
  results: [],
  selectedIndex: 0,
  loading: false,
  modes: new Map(),

  registerMode: (mode) => {
    set((state) => {
      const modes = new Map(state.modes);
      modes.set(mode.id, mode);
      return { modes };
    });
  },

  activate: (mode) => {
    const state = get();
    if (state.visible && state.mode === mode) {
      // Same mode pressed again → clear and restart
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

  executeSelected: async () => {
    const { mode, modes, results, selectedIndex } = get();
    const m = modes.get(mode);
    const result = results[selectedIndex];
    if (m && result) {
      await m.onSelect(result);
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
