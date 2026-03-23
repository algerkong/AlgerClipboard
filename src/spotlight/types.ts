export interface SpotlightFooterHint {
  kbd: string;
  label: string;
}

export interface SpotlightModifiers {
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
}

export interface SpotlightMode {
  id: string;
  name: string;
  icon: string;
  placeholder: string;
  shortcutSettingKey?: string;
  onQuery: (query: string) => Promise<SpotlightResult[]>;
  onSelect: (result: SpotlightResult, modifiers?: SpotlightModifiers) => Promise<void>;
  debounceMs?: number;
  footerHints?: SpotlightFooterHint[];
  globalSearch?: boolean;
  match?: (input: string) => boolean;
  priority?: number;
}

export interface SpotlightResult {
  id: string;
  title: string;
  subtitle?: string;
  icon?: string | { type: "thumbnail"; data: string };
  badge?: string;
  actions?: SpotlightAction[];
  score?: number;
  _modeId?: string;
}

export interface SpotlightAction {
  id: string;
  label: string;
  shortcut?: string;
  handler: () => Promise<void>;
}
