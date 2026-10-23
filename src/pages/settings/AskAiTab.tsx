import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowSquareOut,
  Plus,
  Pencil,
  Trash,
  ArrowCounterClockwise,
  DotsSixVertical,
  CaretUp,
  CaretDown,
  Check,
  X,
  Star,
  Sparkle,
} from "@phosphor-icons/react";
import { useAskAiStore } from "@/stores/askAiStore";
import { AI_WEB_SERVICES } from "@/constants/aiServices";
import { openAiWebView } from "@/services/askAiService";
import {
  type AskAiPreset,
  PRESET_ICON_OPTIONS,
  getPresetPrompt,
} from "@/constants/askAiPresets";
import { ICON_MAP } from "@/components/PresetSelector";
import { Toggle, SettingsButton, SettingsSection } from "./shared";
import { StyledSelect } from "@/components/ui/styled-select";
import { cn } from "@/lib/utils";

function formatHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/* --- Ask AI Tab --- */
export function AskAiTab() {
  const { t, i18n } = useTranslation();
  const {
    enabledServiceIds,
    defaultServiceId,
    loadEnabledServices,
    loadDefaultService,
    setDefaultService,
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
    loadDefaultService();
    loadFavicons();
    loadPresets();
  }, [loadEnabledServices, loadDefaultService, loadFavicons, loadPresets]);

  const defaultService =
    AI_WEB_SERVICES.find((service) => service.id === defaultServiceId) ??
    AI_WEB_SERVICES[0];
  const defaultEnabled = enabledServiceIds.includes(defaultService.id);

  const handleToggleService = async (serviceId: string) => {
    const enabled = enabledServiceIds.includes(serviceId);

    // Keep the default pointing at an enabled service when possible.
    if (enabled && serviceId === defaultServiceId) {
      const remaining = enabledServiceIds.filter((id) => id !== serviceId);
      if (remaining.length > 0) {
        await setDefaultService(remaining[0]);
      }
    }

    await toggleService(serviceId);
  };

  const startEdit = (preset: AskAiPreset) => {
    setEditingId(preset.id);
    setEditForm({
      label: preset.label,
      iconName: preset.iconName,
      promptTemplate: getPresetPrompt(preset, i18n.language),
    });
    setIsAdding(false);
  };

  const saveEdit = () => {
    if (!editingId || !editForm.label?.trim()) return;

    const preset = presets.find((p) => p.id === editingId);
    const updates: Partial<AskAiPreset> = {
      label: editForm.label,
      iconName: editForm.iconName,
    };

    // Only persist the prompt when the user actually changed it. Otherwise
    // keep the built-in localized templates intact.
    if (
      !preset ||
      editForm.promptTemplate !== getPresetPrompt(preset, i18n.language)
    ) {
      updates.promptTemplate = editForm.promptTemplate;
    }

    void updatePreset(editingId, updates);
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
      {/* ─── Default AI ─── */}
      <SettingsSection
        title={t("settings.askAi.defaultTitle")}
        description={t("settings.askAi.defaultDesc")}
      >
        <div className="px-4 py-4">
          <div className="flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/[0.04] p-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <FaviconImg
                url={getFavicon(defaultService.id)}
                name={defaultService.name}
                size="h-6 w-6"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">
                  {defaultService.name}
                </span>
                {!defaultEnabled && (
                  <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-500">
                    {t("settings.askAi.notEnabled")}
                  </span>
                )}
              </div>
              <div className="truncate text-[11px] text-muted-foreground">
                {formatHost(defaultService.url)}
              </div>
            </div>
            <StyledSelect
              value={defaultServiceId}
              onChange={(value) => void setDefaultService(value)}
              options={AI_WEB_SERVICES.map((service) => ({
                value: service.id,
                label: service.name,
              }))}
              className="w-[9.5rem] shrink-0"
            />
          </div>
          {!defaultEnabled && (
            <p className="mt-2 text-[11px] text-amber-500/90">
              {t("settings.askAi.defaultDisabledHint")}
            </p>
          )}
        </div>
      </SettingsSection>

      {/* ─── AI Web Services ─── */}
      <SettingsSection
        title={t("settings.askAi.servicesTitle")}
        description={t("settings.askAi.servicesDesc")}
      >
        <div className="grid grid-cols-1 gap-2 px-4 py-4 sm:grid-cols-2">
          {AI_WEB_SERVICES.map((service) => {
            const enabled = enabledServiceIds.includes(service.id);
            const isDefault = defaultServiceId === service.id;

            return (
              <div
                key={service.id}
                className={cn(
                  "group flex items-center gap-3 rounded-xl border p-3 transition-colors",
                  enabled
                    ? "border-border/50 bg-[color-mix(in_oklab,var(--card)_88%,var(--background))]"
                    : "border-border/30 bg-muted/20",
                  isDefault && "border-primary/35 ring-1 ring-primary/10",
                )}
              >
                <FaviconImg
                  url={getFavicon(service.id)}
                  name={service.name}
                  size="h-9 w-9"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "truncate text-sm font-medium",
                        !enabled && "text-muted-foreground",
                      )}
                    >
                      {service.name}
                    </span>
                    {isDefault && (
                      <span className="shrink-0 rounded-full bg-primary/12 px-1.5 py-px text-[10px] font-medium text-primary">
                        {t("settings.askAi.defaultBadge")}
                      </span>
                    )}
                  </div>
                  <div className="truncate text-[11px] text-muted-foreground/70">
                    {formatHost(service.url)}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void openAiWebView(service)}
                    title={t("settings.askAi.open")}
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <ArrowSquareOut size={14} />
                  </button>
                  {!isDefault && enabled && (
                    <button
                      type="button"
                      onClick={() => void setDefaultService(service.id)}
                      title={t("settings.askAi.setDefault")}
                      className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
                    >
                      <Star size={14} />
                    </button>
                  )}
                  <Toggle
                    value={enabled}
                    onChange={() => void handleToggleService(service.id)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </SettingsSection>

      {/* ─── Preset Management ─── */}
      <SettingsSection
        title={t("settings.askAi.presetTitle")}
        description={t("settings.askAi.presetDesc")}
        aside={
          <div className="flex items-center gap-1.5">
            <SettingsButton
              tone="ghost"
              onClick={() => {
                setIsAdding(!isAdding);
                setEditingId(null);
              }}
            >
              <Plus size={12} />
              {t("settings.askAi.addPreset")}
            </SettingsButton>
            <SettingsButton
              tone="ghost"
              onClick={() => {
                void resetPresets();
              }}
            >
              <ArrowCounterClockwise size={12} />
            </SettingsButton>
          </div>
        }
      >
        <div className="space-y-2 px-4 py-4">
          {isAdding && (
            <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-3">
              <PresetForm
                form={newForm}
                onChange={setNewForm}
                onSave={handleAdd}
                onCancel={() => setIsAdding(false)}
                t={t}
              />
            </div>
          )}

          {presets.map((preset, index) => {
            const Icon = ICON_MAP[preset.iconName];
            const isEditing = editingId === preset.id;

            if (isEditing) {
              return (
                <div
                  key={preset.id}
                  className="rounded-xl border border-primary/30 bg-primary/[0.04] p-3"
                >
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
                className="group flex items-center gap-2.5 rounded-xl border border-border/40 bg-[color-mix(in_oklab,var(--card)_88%,var(--background))] px-3 py-2.5 transition-colors hover:border-border/70"
              >
                <DotsSixVertical
                  size={14}
                  className="shrink-0 text-muted-foreground/30"
                />
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
                  {Icon ? <Icon size={15} /> : <Sparkle size={15} />}
                </span>
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">
                    {preset.labelKey ? t(preset.labelKey) : preset.label}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground/70">
                    {getPresetPrompt(preset, i18n.language).slice(0, 70)}
                    {getPresetPrompt(preset, i18n.language).length > 70
                      ? "..."
                      : ""}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-0.5 opacity-50 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => handleMove(index, "up")}
                    disabled={index === 0}
                    className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-20"
                  >
                    <CaretUp size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(index, "down")}
                    disabled={index === presets.length - 1}
                    className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-20"
                  >
                    <CaretDown size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => startEdit(preset)}
                    className="rounded p-1 text-muted-foreground hover:text-foreground"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void removePreset(preset.id)}
                    className="rounded p-1 text-muted-foreground hover:text-destructive"
                  >
                    <Trash size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
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
                <Icon size={16} />
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
          <X size={12} />
          {t("settings.askAi.cancel")}
        </SettingsButton>
        <SettingsButton
          tone="primary"
          onClick={onSave}
          disabled={!form.label?.trim()}
        >
          <Check size={12} />
          {t("settings.askAi.save")}
        </SettingsButton>
      </div>
    </div>
  );
}

/* --- Favicon with onError fallback --- */
export function FaviconImg({
  url,
  name,
  size = "w-4 h-4",
}: {
  url: string | null;
  name: string;
  size?: string;
}) {
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
    <div
      className={`${size} rounded-md bg-muted inline-flex items-center justify-center shrink-0`}
    >
      <span className="text-[10px] font-medium leading-none text-muted-foreground">
        {name.charAt(0)}
      </span>
    </div>
  );
}
