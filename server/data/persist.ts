import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 文件持久化 — 将内存数据保存到 JSON 文件，进程重启后恢复。
 * 采用防抖写入（500ms），避免高频写操作。
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, "store.json");

/** 持久化的数据结构 */
export interface PersistedState {
  accounts: unknown[];
  conversations: unknown[];
  messages: unknown[];
  contacts: unknown[];
  notifications: unknown[];
  friendRequests: unknown[];
  /** friendsByUser 序列化为 [userId, contactId[]][] */
  friendsByUser: [string, string[]][];
  /** blockedByUser 序列化为 [userId, contactId[]][] */
  blockedByUser: [string, string[]][];
}

/** 从文件加载持久化数据，文件不存在则返回 null */
export function loadState(): PersistedState | null {
  try {
    if (!existsSync(DATA_FILE)) return null;
    const raw = readFileSync(DATA_FILE, "utf-8");
    const data = JSON.parse(raw) as PersistedState;
    // 基本校验
    if (!Array.isArray(data.accounts)) return null;
    return data;
  } catch (err) {
    console.warn("[persist] 加载数据失败，将使用种子数据:", err);
    return null;
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

/** 防抖保存 — 500ms 内多次调用只写一次 */
export function scheduleSave(getState: () => PersistedState): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      const dir = dirname(DATA_FILE);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(DATA_FILE, JSON.stringify(getState(), null, 2), "utf-8");
    } catch (err) {
      console.error("[persist] 保存数据失败:", err);
    }
  }, 500);
}

/** 立即保存（用于进程退出前的同步写入） */
export function saveNow(getState: () => PersistedState): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  try {
    const dir = dirname(DATA_FILE);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(DATA_FILE, JSON.stringify(getState(), null, 2), "utf-8");
  } catch (err) {
    console.error("[persist] 立即保存失败:", err);
  }
}
