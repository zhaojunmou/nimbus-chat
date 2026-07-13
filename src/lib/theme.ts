/**
 * 主题管理 — 应用/切换 dark/light 主题
 * 通过 <html data-theme="..."> 切换 CSS 变量集。
 * 主题选择持久化到 localStorage（与 preferences 同步）。
 */

export type AppTheme = "dark" | "light";

const THEME_KEY = "nimbus_chat_theme";

/** 读取已保存的主题，默认 dark */
export function getSavedTheme(): AppTheme {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* ignore */
  }
  return "dark";
}

/** 应用主题到 <html> 元素（设置 data-theme 属性） */
export function applyTheme(theme: AppTheme): void {
  const root = document.documentElement;
  if (theme === "light") {
    root.setAttribute("data-theme", "light");
  } else {
    // dark 为默认，移除属性即可（:root 默认就是 dark）
    root.removeAttribute("data-theme");
  }
}

/** 切换并持久化主题 */
export function setTheme(theme: AppTheme): void {
  applyTheme(theme);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* ignore */
  }
}

/** 应用启动时调用 — 从 localStorage 恢复主题，避免刷新后丢失 */
export function initTheme(): void {
  applyTheme(getSavedTheme());
}
