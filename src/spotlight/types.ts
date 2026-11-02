export interface SpotlightFooterHint {
  /** Key label, e.g. "Ctrl+↵". `key` is accepted as a legacy alias. */
  kbd?: string;
  key?: string;
  /** Plain text, an i18n key resolved via t(), or a locale map. */
  label: string | Record<string, string>;
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
  placeholder: string | Record<string, string>;
  shortcutSettingKey?: string;
  onQuery: (query: string) => Promise<SpotlightResult[]>;
  onSelect: (
    result: SpotlightResult,
    modifiers?: SpotlightModifiers
  ) => Promise<unknown>;
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
