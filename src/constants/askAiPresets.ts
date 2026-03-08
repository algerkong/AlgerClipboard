export interface AskAiPreset {
  id: string;
  label: string;
  iconName: string;
  promptTemplate: string;
  builtin?: boolean;
}

export const DEFAULT_ASK_AI_PRESETS: AskAiPreset[] = [
  {
    id: "translate",
    label: "Translate",
    iconName: "Languages",
    promptTemplate:
      "Please translate the following text to English. If it's already in English, translate to Chinese:\n\n{content}",
    builtin: true,
  },
  {
    id: "summarize",
    label: "Summarize",
    iconName: "FileText",
    promptTemplate: "Please summarize the following text concisely:\n\n{content}",
    builtin: true,
  },
  {
    id: "explain",
    label: "Explain",
    iconName: "HelpCircle",
    promptTemplate:
      "Please explain the following text in simple terms:\n\n{content}",
    builtin: true,
  },
  {
    id: "rewrite",
    label: "Rewrite",
    iconName: "PenLine",
    promptTemplate:
      "Please rewrite the following text to improve clarity and style:\n\n{content}",
    builtin: true,
  },
  {
    id: "continue",
    label: "Continue Writing",
    iconName: "ArrowRight",
    promptTemplate:
      "Please continue writing from where the following text ends:\n\n{content}",
    builtin: true,
  },
  {
    id: "custom",
    label: "Custom Prompt",
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
