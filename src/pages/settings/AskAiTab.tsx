import { useEffect, useState } from "react";
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
import { Toggle } from "./shared";
import { cn } from "@/lib/utils";

/* --- Ask AI Tab --- */
export function AskAiTab() {
  const { t } = useTranslation();
  const {
    enabledServiceIds,
    loadEnabledServices,
    toggleService,
    loadFavicons,
    getFavicon,
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
    <div className="space-y-6">
      {/* AI Services Section */}
      <div className="space-y-2">
        <p className="text-xs2 text-muted-foreground">
          {t("settings.askAi.description")}
        </p>

        <div className="space-y-2">
          {AI_WEB_SERVICES.map((service) => {
            const enabled = enabledServiceIds.includes(service.id);
            const faviconUrl = getFavicon(service.id);
            return (
              <div
                key={service.id}
                className="flex items-center justify-between py-1.5"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {faviconUrl ? (
                    <img
                      src={faviconUrl}
                      alt={service.name}
                      className="w-4 h-4 rounded-sm shrink-0"
                    />
                  ) : (
                    <div className="w-4 h-4 rounded-md bg-muted inline-flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-medium leading-none text-muted-foreground">
                        {service.name.charAt(0)}
                      </span>
                    </div>
                  )}
                  <div className="min-w-0">
                    <span className="text-sm2 block truncate">
                      {service.name}
                    </span>
                    <span className="text-xs2 text-muted-foreground block truncate">
                      {service.url}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {enabled && (
                    <button
                      type="button"
                      className="text-xs2 text-muted-foreground hover:text-primary transition-colors"
                      onClick={() => openAiWebView(service)}
                      title={t("settings.askAi.open")}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <Toggle
                    value={enabled}
                    onChange={() => toggleService(service.id)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Preset Management Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm2 font-medium">
            {t("settings.askAi.presetTitle")}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => { setIsAdding(!isAdding); setEditingId(null); }}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs2 text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
            >
              <Plus className="w-3 h-3" />
              {t("settings.askAi.addPreset")}
            </button>
            <button
              type="button"
              onClick={() => { void resetPresets(); }}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs2 text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
              title={t("settings.askAi.resetPresets")}
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>
        </div>

        <p className="text-xs2 text-muted-foreground">
          {t("settings.askAi.presetDesc")}
        </p>

        {/* Add new preset form */}
        {isAdding && (
          <PresetForm
            form={newForm}
            onChange={setNewForm}
            onSave={handleAdd}
            onCancel={() => setIsAdding(false)}
            t={t}
          />
        )}

        {/* Preset list */}
        <div className="space-y-1">
          {presets.map((preset, index) => {
            const Icon = ICON_MAP[preset.iconName];
            const isEditing = editingId === preset.id;

            if (isEditing) {
              return (
                <PresetForm
                  key={preset.id}
                  form={editForm}
                  onChange={setEditForm}
                  onSave={saveEdit}
                  onCancel={cancelEdit}
                  t={t}
                />
              );
            }

            return (
              <div
                key={preset.id}
                className="group flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-accent/30 transition-colors"
              >
                <GripVertical className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                {Icon && <Icon className="w-4 h-4 text-muted-foreground shrink-0" />}
                <div className="flex-1 min-w-0">
                  <span className="text-sm2 block truncate">{preset.labelKey ? t(preset.labelKey) : preset.label}</span>
                  <span className="text-xs2 text-muted-foreground block truncate">
                    {preset.promptTemplate.slice(0, 60)}
                    {preset.promptTemplate.length > 60 ? "..." : ""}
                  </span>
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    type="button"
                    onClick={() => handleMove(index, "up")}
                    disabled={index === 0}
                    className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-20"
                  >
                    <ChevronUp className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(index, "down")}
                    disabled={index === presets.length - 1}
                    className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-20"
                  >
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => startEdit(preset)}
                    className="p-1 rounded text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void removePreset(preset.id)}
                    className="p-1 rounded text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
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
    <div className="rounded-xl border border-border/50 bg-accent/20 p-3 space-y-2">
      {/* Name + Icon row */}
      <div className="flex gap-2">
        <input
          autoFocus
          value={form.label || ""}
          onChange={(e) => onChange({ ...form, label: e.target.value })}
          placeholder={t("settings.askAi.presetNamePlaceholder")}
          className="flex-1 rounded-lg border border-border/60 bg-background/80 px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/20"
          onKeyDown={(e) => {
            if (e.key === "Enter") onSave();
            if (e.key === "Escape") onCancel();
          }}
        />
      </div>

      {/* Icon selector */}
      <div>
        <span className="text-xs2 text-muted-foreground mb-1 block">
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
                  "p-1.5 rounded-lg transition-colors",
                  form.iconName === iconName
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                )}
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Prompt template */}
      <div>
        <span className="text-xs2 text-muted-foreground mb-1 block">
          {t("settings.askAi.presetPrompt")}
        </span>
        <textarea
          value={form.promptTemplate || ""}
          onChange={(e) => onChange({ ...form, promptTemplate: e.target.value })}
          placeholder={t("settings.askAi.presetPromptPlaceholder")}
          className="w-full resize-none rounded-lg border border-border/60 bg-background/80 p-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/20"
          rows={3}
        />
        <p className="text-[10px] text-muted-foreground/60 mt-0.5">
          {t("settings.askAi.presetPromptHint")}
        </p>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-1.5">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs2 text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
        >
          <X className="w-3 h-3" />
          {t("settings.askAi.cancel")}
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={!form.label?.trim()}
          className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs2 font-medium bg-primary/15 text-primary hover:bg-primary/25 transition-colors disabled:opacity-40"
        >
          <Check className="w-3 h-3" />
          {t("settings.askAi.save")}
        </button>
      </div>
    </div>
  );
}
