export interface AskAiPreset {
  id: string;
  label: string;
  /** i18n key for built-in presets; if set, takes priority over label for display */
  labelKey?: string;
  iconName: string;
  promptTemplate: string;
  /** Localized prompt templates for built-in presets */
  promptTemplates?: Partial<Record<"en" | "zh-CN", string>>;
  builtin?: boolean;
}

/**
 * Resolve the prompt for the current app language.
 * User-edited presets have no `promptTemplates` and keep their own text.
 */
export function getPresetPrompt(preset: AskAiPreset, locale: string): string {
  if (!preset.promptTemplates) {
    return preset.promptTemplate;
  }

  const lang = locale.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
  return (
    preset.promptTemplates[lang] ??
    preset.promptTemplates.en ??
    preset.promptTemplate
  );
}

export const DEFAULT_ASK_AI_PRESETS: AskAiPreset[] = [
  {
    id: "translate",
    label: "Translate",
    labelKey: "askAi.presets.translate",
    iconName: "Languages",
    promptTemplate:
      "Please translate the following text to English. If it's already in English, translate to Chinese:\n\n{content}",
    promptTemplates: {
      en:
        "Please translate the following text to English. If it's already in English, translate to Chinese:\n\n{content}",
      "zh-CN":
        "请将以下文本翻译成英文。如果它已经是英文，请翻译成中文：\n\n{content}",
    },
    builtin: true,
  },
  {
    id: "summarize",
    label: "Summarize",
    labelKey: "askAi.presets.summarize",
    iconName: "FileText",
    promptTemplate: "Please summarize the following text concisely:\n\n{content}",
    promptTemplates: {
      en: "Please summarize the following text concisely:\n\n{content}",
      "zh-CN": "请简洁地总结以下文本：\n\n{content}",
    },
    builtin: true,
  },
  {
    id: "explain",
    label: "Explain",
    labelKey: "askAi.presets.explain",
    iconName: "HelpCircle",
    promptTemplate:
      "Please explain the following text in simple terms:\n\n{content}",
    promptTemplates: {
      en: "Please explain the following text in simple terms:\n\n{content}",
      "zh-CN": "请用通俗易懂的语言解释以下文本：\n\n{content}",
    },
    builtin: true,
  },
  {
    id: "rewrite",
    label: "Rewrite",
    labelKey: "askAi.presets.rewrite",
    iconName: "PenLine",
    promptTemplate:
      "Please rewrite the following text to improve clarity and style:\n\n{content}",
    promptTemplates: {
      en:
        "Please rewrite the following text to improve clarity and style:\n\n{content}",
      "zh-CN": "请改写以下文本，使其表达更清晰、风格更好：\n\n{content}",
    },
    builtin: true,
  },
  {
    id: "continue",
    label: "Continue Writing",
    labelKey: "askAi.presets.continue",
    iconName: "ArrowRight",
    promptTemplate:
      "Please continue writing from where the following text ends:\n\n{content}",
    promptTemplates: {
      en:
        "Please continue writing from where the following text ends:\n\n{content}",
      "zh-CN": "请从以下文本结束的地方继续写作：\n\n{content}",
    },
    builtin: true,
  },
  {
    id: "custom",
    label: "Custom Prompt",
    labelKey: "askAi.presets.custom",
    iconName: "MessageSquare",
    promptTemplate: "{customPrompt}\n\n{content}",
    builtin: true,
  },
];

export const PRESET_ICON_OPTIONS = [
  "Languages",
  "FileText",
  "HelpCircle",
  "PenLine",
  "ArrowRight",
  "MessageSquare",
  "Sparkles",
  "Wand2",
  "BookOpen",
  "Code",
  "ListChecks",
  "Lightbulb",
  "Search",
  "Zap",
] as const;
