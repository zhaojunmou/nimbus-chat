// i18next 配置 — 支持中英文切换，语言选择持久化到 localStorage

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { en } from "./locales/en";
import { zh } from "./locales/zh";

const LANG_KEY = "nimbus_chat_lang";

/** 支持的语言 */
export type AppLanguage = "en" | "zh";

export const availableLanguages: { code: AppLanguage; label: string }[] = [
  { code: "en", label: "English" },
  { code: "zh", label: "中文" },
];

/** 读取已保存的语言，回退到浏览器语言，再回退到 en */
function detectLanguage(): AppLanguage {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === "en" || saved === "zh") return saved;
  } catch {
    /* ignore */
  }
  if (typeof navigator !== "undefined") {
    const navLang = navigator.language.toLowerCase();
    if (navLang.startsWith("zh")) return "zh";
  }
  return "en";
}

/** 切换语言并持久化 */
export function changeLanguage(lang: AppLanguage) {
  i18n.changeLanguage(lang);
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* ignore */
  }
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    zh: { translation: zh },
  },
  lng: detectLanguage(),
  fallbackLng: "en",
  interpolation: {
    escapeValue: false, // React 已防 XSS
  },
  returnNull: false,
});

export default i18n;
