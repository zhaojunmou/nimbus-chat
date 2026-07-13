/**
 * 浏览器标签页通知 — 通过 document.title 和 favicon 展示未读消息数。
 *
 * - title: 在原标题前加 "(N)" 前缀，并闪烁吸引注意
 * - favicon: 在原 favicon 右下角绘制红色未读数徽章，并与原 favicon 交替闪烁
 *
 * 设计为单例，由 store 在未读总数变化时调用 setUnreadBadge()。
 * 只要有未读消息就闪烁（不依赖 document.hidden，避免某些内置浏览器不可靠）。
 */

import { getPreferences } from "./preferences";

const BASE_TITLE = "Nimbus Chat";
const FAVICON_HREF = "/favicon.svg";
const DEBUG = true;

function log(...args: unknown[]): void {
  if (DEBUG) console.log("[notify]", ...args);
}

let originalTitle = BASE_TITLE;
let lastUnread = 0;
let blinkTimer: ReturnType<typeof setInterval> | null = null;
let faviconLink: HTMLLinkElement | null = null;
let originalFaviconHref = FAVICON_HREF;
let badgeCanvas: HTMLCanvasElement | null = null;

/** 缓存原始 title（在首次调用时记录，避免被其他脚本修改后丢失） */
function ensureOriginalTitle(): void {
  const t = document.title;
  if (t) {
    // 剥离可能已有的未读后缀（如 "Nimbus Chat (3)" → "Nimbus Chat"）
    // 防止多次收到消息时后缀累加成 "Nimbus Chat (1) (2)"
    const stripped = t.replace(/\s*\(\d+\)\s*$/, "").replace(/\s*\(99\+\)\s*$/, "");
    if (stripped) {
      originalTitle = stripped;
      return;
    }
  }
  if (!originalTitle) {
    originalTitle = BASE_TITLE;
  }
}

/** 查找或创建 favicon link 元素 */
function getFaviconLink(): HTMLLinkElement | null {
  if (faviconLink && document.head.contains(faviconLink)) return faviconLink;
  const existing = document.querySelector<HTMLLinkElement>(
    'link[rel="icon"], link[rel="shortcut icon"]',
  );
  if (existing) {
    faviconLink = existing;
    originalFaviconHref = existing.getAttribute("href") || FAVICON_HREF;
    return existing;
  }
  // 不存在则创建一个
  const link = document.createElement("link");
  link.rel = "icon";
  link.type = "image/svg+xml";
  link.href = FAVICON_HREF;
  document.head.appendChild(link);
  faviconLink = link;
  originalFaviconHref = FAVICON_HREF;
  return link;
}

/**
 * 强制设置 favicon — 某些浏览器对 data: URL 的 href 变更不敏感，
 * 通过移除旧 link + 创建新 link 的方式强制刷新。
 */
function forceFavicon(href: string): void {
  const old = faviconLink;
  if (old) {
    old.remove();
  }
  const link = document.createElement("link");
  link.rel = "icon";
  // 不设 type，让浏览器自动识别（避免 SVG/PNG 类型冲突）
  link.href = href;
  document.head.appendChild(link);
  faviconLink = link;
  log("favicon set to", href.startsWith("data:") ? `${href.slice(0, 40)}...` : href);
}

/** 用 canvas 渲染徽章 favicon（PNG data URL，比 SVG 更可靠） */
function buildBadgeFaviconPng(count: number): string {
  if (!badgeCanvas) {
    badgeCanvas = document.createElement("canvas");
    badgeCanvas.width = 32;
    badgeCanvas.height = 32;
  }
  const ctx = badgeCanvas.getContext("2d");
  if (!ctx) return originalFaviconHref;
  // 清空
  ctx.clearRect(0, 0, 32, 32);
  // 绘制深色背景
  ctx.fillStyle = "#0A0B0D";
  ctx.fillRect(0, 0, 32, 32);
  // 绘制简化的 logo 标记（绿色矩形 + 内部小方块）
  ctx.fillStyle = "#32F08C";
  ctx.fillRect(5, 8, 22, 16);
  ctx.fillStyle = "#0A0B0D";
  ctx.fillRect(8, 11, 16, 10);
  // 绘制右下角红色徽章
  const num = count > 99 ? "99+" : String(count);
  ctx.fillStyle = "#F65A5A";
  ctx.beginPath();
  ctx.arc(25, 25, 8, 0, Math.PI * 2);
  ctx.fill();
  // 徽章数字
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `700 ${num.length > 2 ? 7 : 9}px Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(num, 25, 26);
  return badgeCanvas.toDataURL("image/png");
}

/** 停止闪烁，恢复 title */
function stopBlink(): void {
  if (blinkTimer) {
    clearInterval(blinkTimer);
    blinkTimer = null;
    log("blink stopped");
  }
}

/**
 * 启动 title + favicon 闪烁。
 * favicon 在"带徽章"和"原 favicon"之间交替，title 同步闪烁。
 */
function startBlink(count: number): void {
  stopBlink();
  const badgeHref = buildBadgeFaviconPng(count);
  const suffix = ` (${count > 99 ? "99+" : count})`;
  let toggle = false;
  log("blink started, count=", count);
  blinkTimer = setInterval(() => {
    toggle = !toggle;
    if (toggle) {
      // 显示带未读徽章的 favicon + 标题后缀
      forceFavicon(badgeHref);
      document.title = `${originalTitle}${suffix}`;
    } else {
      // 切回原 favicon + 原标题（闪烁效果）
      forceFavicon(originalFaviconHref);
      document.title = originalTitle;
    }
  }, 800);
}

/**
 * 设置未读消息徽章 — 更新 title 和 favicon。
 * count > 0 时启动闪烁；count 为 0 时停止并恢复原状。
 */
export function setUnreadBadge(count: number): void {
  if (count < 0) count = 0;
  lastUnread = count;
  ensureOriginalTitle();
  // 确保 favicon link 已就绪
  getFaviconLink();
  log("setUnreadBadge", count);

  if (count === 0) {
    stopBlink();
    forceFavicon(originalFaviconHref);
    document.title = originalTitle;
    return;
  }

  // 有未读消息 → 启动 title + favicon 闪烁
  startBlink(count);
}

/**
 * 页面可见性变化处理 — 切回页面时停止闪烁（如果未读已清）。
 * 在 App 启动时注册一次即可。
 */
export function initVisibilityListener(): void {
  document.addEventListener("visibilitychange", () => {
    log("visibilitychange, hidden=", document.hidden, "unread=", lastUnread);
    // 页面重新可见时，如果未读已为 0，确保停止闪烁
    if (!document.hidden && lastUnread === 0) {
      stopBlink();
      forceFavicon(originalFaviconHref);
      document.title = originalTitle;
    }
  });
}

/** 计算当前会话列表的未读总数 */
export function sumUnread(convUnread: number[]): number {
  return convUnread.reduce((a, b) => a + (b > 0 ? b : 0), 0);
}

/** msgNoti 偏好是否启用（用于上层决定是否触发 title/favicon 提示） */
export function isNotiEnabled(): boolean {
  return getPreferences().msgNoti;
}
