import type {
  Conversation,
  Message,
  Contact,
  NotificationItem,
  FriendRequest,
  User,
} from "../../shared/types";
import {
  loadState,
  scheduleSave,
  saveNow,
  type PersistedState,
} from "./persist.js";
import { getAccounts, registerPersistCallback } from "./authStore.js";

/**
 * 服务端数据存储 — 内存 + 文件持久化
 * 包含会话、消息、联系人、通知、用户。
 * 进程重启后从 store.json 恢复，无文件时使用种子数据。
 */

export const currentUser: User = {
  id: "you",
  displayName: "You",
  email: "you@nimbus.chat",
  initials: "Y",
  color: "brand",
  statusMessage: "Available",
  bio: "Hey there! I'm using Nimbus Chat.",
  phone: "+1 (555) 0123",
};

export const seedConversations: Conversation[] = [];

export const seedMessages: Message[] = [];

export const seedContacts: Contact[] = [];

export const seedNotifications: NotificationItem[] = [];

/** 初始化种子用户的好友列表 — 无演示数据，从空开始 */
function seedFriends(): Map<string, Set<string>> {
  return new Map<string, Set<string>>();
}

/** 反序列化 friendsByUser（[userId, contactId[]][] → Map） */
function deserializeFriends(data: [string, string[]][] | undefined): Map<string, Set<string>> {
  if (!data?.length) return seedFriends();
  const map = new Map<string, Set<string>>();
  for (const [userId, contactIds] of data) {
    map.set(userId, new Set(contactIds));
  }
  return map;
}

/** 反序列化 blockedByUser */
function deserializeBlocked(data: [string, string[]][] | undefined): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  if (data) {
    for (const [userId, contactIds] of data) {
      map.set(userId, new Set(contactIds));
    }
  }
  return map;
}

/** 从持久化文件加载或使用种子数据 */
const persisted = loadState();

// 运行时可变状态
export const db = {
  conversations: (persisted?.conversations as Conversation[] | undefined) ?? [...seedConversations],
  messages: (persisted?.messages as Message[] | undefined) ?? [...seedMessages],
  contacts: (persisted?.contacts as Contact[] | undefined) ?? [...seedContacts],
  notifications: (persisted?.notifications as NotificationItem[] | undefined) ?? [...seedNotifications],
  user: { ...currentUser },
  // 在线用户集合（socket id → userId）— 不持久化
  onlineSockets: new Map<string, string>(),
  // 按用户隔离的屏蔽列表（userId → Set<contactId>）
  blockedByUser: deserializeBlocked(persisted?.blockedByUser),
  // 按用户隔离的好友列表（userId → Set<contactId>）
  friendsByUser: deserializeFriends(persisted?.friendsByUser),
  // 好友请求列表
  friendRequests: (persisted?.friendRequests as FriendRequest[] | undefined) ?? [],
  // 全局消息序列号计数器 — 用于跨会话副本合并后的稳定排序
  // 初始化为现有消息最大 seq（没有 seq 的旧数据视为 0）
  messageSeq: ((): number => {
    const msgs = (persisted?.messages as Message[] | undefined) ?? [...seedMessages];
    return msgs.reduce((max, m) => Math.max(max, m.seq ?? 0), 0);
  })(),
};

/** 收集当前状态用于持久化 */
function collectState(): PersistedState {
  return {
    accounts: getAccounts(),
    conversations: db.conversations,
    messages: db.messages,
    contacts: db.contacts,
    notifications: db.notifications,
    friendRequests: db.friendRequests,
    friendsByUser: Array.from(db.friendsByUser.entries()).map(
      ([userId, set]) => [userId, Array.from(set)] as [string, string[]],
    ),
    blockedByUser: Array.from(db.blockedByUser.entries()).map(
      ([userId, set]) => [userId, Array.from(set)] as [string, string[]],
    ),
  };
}

/** 触发防抖保存 — 数据变更时调用 */
export function persistDb(): void {
  scheduleSave(collectState);
}

/** 立即保存 — 进程退出前调用 */
export function persistDbNow(): void {
  saveNow(collectState);
}

// 注册 authStore 的持久化回调 — 账号变更时同步保存
registerPersistCallback(persistDb);
