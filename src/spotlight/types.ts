export interface SpotlightMode {
  id: string;
  name: string;
  icon: string;
  placeholder: string;
  shortcutSettingKey?: string;
  onQuery: (query: string) => Promise<SpotlightResult[]>;
  onSelect: (result: SpotlightResult) => Promise<void>;
  debounceMs?: number;
}

export interface SpotlightResult {
  id: string;
  title: string;
  subtitle?: string;
  icon?: string | { type: "thumbnail"; data: string };
  badge?: string;
  actions?: SpotlightAction[];
}

export interface SpotlightAction {
  id: string;
  label: string;
  shortcut?: string;
  handler: () => Promise<void>;
}
