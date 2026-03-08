export interface AskAiPreset {
  id: string;
  labelKey: string;
  iconName: string;
  promptTemplate: string;
}

export const ASK_AI_PRESETS: AskAiPreset[] = [
  {
    id: "translate",
    labelKey: "askAi.presets.translate",
    iconName: "Languages",
    promptTemplate:
      "Please translate the following text to English. If it's already in English, translate to Chinese:\n\n{content}",
  },
  {
    id: "summarize",
    labelKey: "askAi.presets.summarize",
    iconName: "FileText",
    promptTemplate: "Please summarize the following text concisely:\n\n{content}",
  },
  {
    id: "explain",
    labelKey: "askAi.presets.explain",
    iconName: "HelpCircle",
    promptTemplate:
      "Please explain the following text in simple terms:\n\n{content}",
  },
  {
    id: "rewrite",
    labelKey: "askAi.presets.rewrite",
    iconName: "PenLine",
    promptTemplate:
      "Please rewrite the following text to improve clarity and style:\n\n{content}",
  },
  {
    id: "continue",
    labelKey: "askAi.presets.continue",
    iconName: "ArrowRight",
    promptTemplate:
      "Please continue writing from where the following text ends:\n\n{content}",
  },
  {
    id: "custom",
    labelKey: "askAi.presets.custom",
    iconName: "MessageSquare",
    promptTemplate: "{customPrompt}\n\n{content}",
  },
];
