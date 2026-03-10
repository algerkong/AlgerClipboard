import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// Auto-import all JSON files from locale directories via Vite's glob import
const enModules = import.meta.glob<Record<string, unknown>>(
  "./locales/en/*.json",
  { eager: true, import: "default" },
);
const zhModules = import.meta.glob<Record<string, unknown>>(
  "./locales/zh-CN/*.json",
  { eager: true, import: "default" },
);

function mergeModules(modules: Record<string, Record<string, unknown>>) {
  const merged: Record<string, unknown> = {};
  for (const mod of Object.values(modules)) {
    Object.assign(merged, mod);
  }
  return merged;
}

const en = mergeModules(enModules);
const zhCN = mergeModules(zhModules);

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    "zh-CN": { translation: zhCN },
  },
  lng: "zh-CN",
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
