import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  ExternalLink,
  Plus,
  Pencil,
  Trash2,
  RotateCcw,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Check,
  X,
} from "lucide-react";
import { useAskAiStore } from "@/stores/askAiStore";
import { AI_WEB_SERVICES } from "@/constants/aiServices";
import { openAiWebView } from "@/services/askAiService";
import {
  type AskAiPreset,
  PRESET_ICON_OPTIONS,
} from "@/constants/askAiPresets";
import { ICON_MAP } from "@/components/PresetSelector";
import {
  Toggle,
  SettingsButton,
  SettingsRow,
  SettingsSection,
} from "./shared";
import { cn } from "@/lib/utils";

/* --- Ask AI Tab --- */
export function AskAiTab() {
  const { t } = useTranslation();
  const {
    enabledServiceIds,
    loadEnabledServices,
    toggleService,
    loadFavicons,
    presets,
    loadPresets,
    addPreset,
    updatePreset,
    removePreset,
    reorderPresets,
    resetPresets,
  } = useAskAiStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<AskAiPreset>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [newForm, setNewForm] = useState<Partial<AskAiPreset>>({
    label: "",
    iconName: "Sparkles",
    promptTemplate: "{content}",
  });

  useEffect(() => {
    loadEnabledServices();
    loadFavicons();
    loadPresets();
  }, [loadEnabledServices, loadFavicons, loadPresets]);

  const startEdit = (preset: AskAiPreset) => {
    setEditingId(preset.id);
    setEditForm({
      label: preset.label,
      iconName: preset.iconName,
      promptTemplate: preset.promptTemplate,
    });
    setIsAdding(false);
  };

  const saveEdit = () => {
    if (!editingId || !editForm.label?.trim()) return;
    void updatePreset(editingId, editForm);
    setEditingId(null);
    setEditForm({});
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleAdd = () => {
    if (!newForm.label?.trim()) return;
    const id = `custom_${Date.now()}`;
    void addPreset({
      id,
      label: newForm.label!.trim(),
      iconName: newForm.iconName || "Sparkles",
      promptTemplate: newForm.promptTemplate || "{content}",
    });
    setNewForm({ label: "", iconName: "Sparkles", promptTemplate: "{content}" });
    setIsAdding(false);
  };

  const handleMove = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= presets.length) return;
    const next = [...presets];
    [next[index], next[newIndex]] = [next[newIndex], next[index]];
    void reorderPresets(next);
  };

  return (
    <div className="space-y-5">
      {/* ─── AI Web Services ─── */}
      <SettingsSection
        title={t("settings.askAi.title") || "AI Services"}
        description={t("settings.askAi.description")}
      >
        {AI_WEB_SERVICES.map((service) => {
          const enabled = enabledServiceIds.includes(service.id);
          return (
            <SettingsRow
              key={service.id}
              title={service.name}
              description={service.url}
              control={
                <div className="flex items-center gap-2.5">
                  {enabled && (
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-primary"
                      onClick={() => openAiWebView(service)}
                      title={t("settings.askAi.open")}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <Toggle
                    value={enabled}
                    onChange={() => toggleService(service.id)}
                  />
                </div>
              }
            />
          );
        })}
      </SettingsSection>

      {/* ─── Preset Management ─── */}
      <SettingsSection
        title={t("settings.askAi.presetTitle")}
        description={t("settings.askAi.presetDesc")}
        aside={
          <div className="flex items-center gap-1.5">
            <SettingsButton
              tone="ghost"
              onClick={() => { setIsAdding(!isAdding); setEditingId(null); }}
            >
              <Plus className="h-3 w-3" />
              {t("settings.askAi.addPreset")}
            </SettingsButton>
            <SettingsButton
              tone="ghost"
              onClick={() => { void resetPresets(); }}
            >
              <RotateCcw className="h-3 w-3" />
            </SettingsButton>
          </div>
        }
      >
        {/* Add new preset form */}
        {isAdding && (
          <div className="px-5 py-4">
            <PresetForm
              form={newForm}
              onChange={setNewForm}
              onSave={handleAdd}
              onCancel={() => setIsAdding(false)}
              t={t}
            />
          </div>
        )}

        {/* Preset list */}
        {presets.map((preset, index) => {
          const Icon = ICON_MAP[preset.iconName];
          const isEditing = editingId === preset.id;

          if (isEditing) {
            return (
              <div key={preset.id} className="px-5 py-4">
                <PresetForm
                  form={editForm}
                  onChange={setEditForm}
                  onSave={saveEdit}
                  onCancel={cancelEdit}
                  t={t}
                />
              </div>
            );
          }

          return (
            <div
              key={preset.id}
              className="group flex items-center gap-3 border-b border-[color-mix(in_oklab,var(--border)_76%,transparent)] px-5 py-3 last:border-b-0"
            >
              <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
              {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />}
              <div className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {preset.labelKey ? t(preset.labelKey) : preset.label}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {preset.promptTemplate.slice(0, 60)}
                  {preset.promptTemplate.length > 60 ? "..." : ""}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => handleMove(index, "up")}
                  disabled={index === 0}
                  className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-20"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleMove(index, "down")}
                  disabled={index === presets.length - 1}
                  className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-20"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => startEdit(preset)}
                  className="rounded p-1 text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => void removePreset(preset.id)}
                  className="rounded p-1 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </SettingsSection>
    </div>
  );
}

/* --- Inline preset editor form --- */
function PresetForm({
  form,
  onChange,
  onSave,
  onCancel,
  t,
}: {
  form: Partial<AskAiPreset>;
  onChange: (f: Partial<AskAiPreset>) => void;
  onSave: () => void;
  onCancel: () => void;
  t: (key: string) => string;
}) {
  return (
    <div className="settings-inline-panel space-y-3">
      {/* Name */}
      <div>
        <span className="settings-subsection-title mb-1.5 block">
          {t("settings.askAi.presetNamePlaceholder")}
        </span>
        <input
          autoFocus
          value={form.label || ""}
          onChange={(e) => onChange({ ...form, label: e.target.value })}
          placeholder={t("settings.askAi.presetNamePlaceholder")}
          className="settings-input h-9 rounded-lg border border-[color-mix(in_oklab,var(--border)_60%,transparent)] bg-[color-mix(in_oklab,var(--background)_80%,var(--card)_20%)] px-3 text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter") onSave();
            if (e.key === "Escape") onCancel();
          }}
        />
      </div>

      {/* Icon selector */}
      <div>
        <span className="settings-subsection-title mb-1.5 block">
          {t("settings.askAi.presetIcon")}
        </span>
        <div className="flex flex-wrap gap-1">
          {PRESET_ICON_OPTIONS.map((iconName) => {
            const Icon = ICON_MAP[iconName];
            if (!Icon) return null;
            return (
              <button
                key={iconName}
                type="button"
                onClick={() => onChange({ ...form, iconName })}
                className={cn(
                  "rounded-lg p-1.5 transition-colors",
                  form.iconName === iconName
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Prompt template */}
      <div>
        <span className="settings-subsection-title mb-1.5 block">
          {t("settings.askAi.presetPrompt")}
        </span>
        <textarea
          value={form.promptTemplate || ""}
          onChange={(e) => onChange({ ...form, promptTemplate: e.target.value })}
          placeholder={t("settings.askAi.presetPromptPlaceholder")}
          className="settings-textarea"
          rows={3}
        />
        <p className="mt-1 text-xs text-muted-foreground/60">
          {t("settings.askAi.presetPromptHint")}
        </p>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <SettingsButton tone="ghost" onClick={onCancel}>
          <X className="h-3 w-3" />
          {t("settings.askAi.cancel")}
        </SettingsButton>
        <SettingsButton
          tone="primary"
          onClick={onSave}
          disabled={!form.label?.trim()}
        >
          <Check className="h-3 w-3" />
          {t("settings.askAi.save")}
        </SettingsButton>
      </div>
    </div>
  );
}

/* --- Favicon with onError fallback --- */
export function FaviconImg({ url, name, size = "w-4 h-4" }: { url: string | null; name: string; size?: string }) {
  const [failed, setFailed] = useState(false);
  const onError = useCallback(() => setFailed(true), []);

  if (url && !failed) {
    return (
      <img
        src={url}
        alt={name}
        className={`${size} rounded-sm shrink-0`}
        onError={onError}
      />
    );
  }

  return (
    <div className={`${size} rounded-md bg-muted inline-flex items-center justify-center shrink-0`}>
      <span className="text-[10px] font-medium leading-none text-muted-foreground">
        {name.charAt(0)}
      </span>
    </div>
  );
}
