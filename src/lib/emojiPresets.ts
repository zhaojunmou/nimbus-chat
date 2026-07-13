/**
 * 表情预设与自定义表情管理
 * - 预设表情按分类组织
 * - 自定义表情持久化到 localStorage
 */

/** 表情分类 */
export interface EmojiCategory {
  /** 分类 id（用于 i18n 翻译键） */
  id: string;
  /** 分类图标（单个 emoji 作为 tab 图标） */
  icon: string;
  /** 该分类下的表情列表 */
  emojis: string[];
}

/** 默认表情分类（按主题分组） */
export const defaultCategories: EmojiCategory[] = [
  {
    id: "smileys",
    icon: "😀",
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂",
      "🙂", "🙃", "😉", "😊", "😇", "🥰", "😍", "🤩",
      "😘", "😗", "😚", "😙", "😋", "😛", "😜", "🤪",
      "😝", "🤑", "🤗", "🤭", "🤫", "🤔", "🤐", "🤨",
      "😐", "😑", "😶", "😏", "😒", "🙄", "😬", "😮‍💨",
    ],
  },
  {
    id: "gestures",
    icon: "👍",
    emojis: [
      "👍", "👎", "👌", "🤌", "🤏", "✌️", "🤞", "🤟",
      "🤘", "🤙", "👈", "👉", "👆", "👇", "☝️", "👋",
      "🤚", "🖐️", "✋", "🖖", "👏", "🙌", "👐", "🤲",
      "🙏", "🤝", "✍️", "💪", "🦾", "🦿", "🦵", "🦶",
    ],
  },
  {
    id: "hearts",
    icon: "❤️",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍",
      "🤎", "💔", "❣️", "💕", "💞", "💓", "💗", "💖",
      "💘", "💝", "💟", "♥️", "💌", "💋", "💍", "💎",
    ],
  },
  {
    id: "symbols",
    icon: "🔥",
    emojis: [
      "🔥", "✨", "🌟", "⭐", "⚡", "💥", "💫", "🌈",
      "☀️", "🌙", "⛅", "☁️", "🌧️", "❄️", "🌊", "🎉",
      "🎊", "🎈", "🎁", "🏆", "🥇", "🎯", "🎮", "🎵",
      "✅", "❌", "⚠️", "💯", "🔔", "📌", "📍", "💡",
    ],
  },
  {
    id: "animals",
    icon: "🐱",
    emojis: [
      "🐱", "🐶", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼",
      "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵", "🐔",
      "🐧", "🐦", "🦆", "🦉", "🐺", "🐗", "🐴", "🦄",
      "🐝", "🐛", "🦋", "🐌", "🐞", "🐢", "🐍", "🐙",
    ],
  },
  {
    id: "food",
    icon: "🍔",
    emojis: [
      "🍏", "🍎", "🍐", "🍊", "🍋", "🍌", "🍉", "🍇",
      "🍓", "🫐", "🍈", "🍒", "🍑", "🥭", "🍍", "🥥",
      "🍅", "🥑", "🍔", "🍟", "🍕", "🌭", "🥪", "🌮",
      "🌯", "🍜", "🍣", "🍱", "🍚", "🍰", "🎂", "☕",
    ],
  },
];

const STORAGE_KEY = "nimbus.customEmojis";

/** 自定义表情条目 — 支持文本 emoji 和图片 data URL */
export interface CustomEmoji {
  /** 唯一 id */
  id: string;
  /** 显示名（可选） */
  name: string;
  /** 内容：文本 emoji 或图片 data URL（以 data: 开头） */
  content: string;
  /** 是否为图片 */
  isImage: boolean;
}

/** 读取自定义表情列表 */
export function loadCustomEmojis(): CustomEmoji[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter(
      (x): x is CustomEmoji =>
        x && typeof x.id === "string" && typeof x.content === "string",
    );
  } catch {
    return [];
  }
}

/** 保存自定义表情列表 */
export function saveCustomEmojis(list: CustomEmoji[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    // localStorage 配额不足（图片太大）— 静默失败
    console.warn("[emoji] 保存自定义表情失败:", err);
  }
}

/** 添加自定义表情 — 返回新列表 */
export function addCustomEmoji(
  list: CustomEmoji[],
  content: string,
  name?: string,
): { list: CustomEmoji[]; item: CustomEmoji } {
  const isImage = content.startsWith("data:");
  const item: CustomEmoji = {
    id: `c${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
    name: name ?? "",
    content,
    isImage,
  };
  return { list: [...list, item], item };
}

/** 删除自定义表情 — 返回新列表 */
export function removeCustomEmoji(list: CustomEmoji[], id: string): CustomEmoji[] {
  return list.filter((x) => x.id !== id);
}
