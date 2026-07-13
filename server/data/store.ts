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

export const seedConversations: Conversation[] = [
  {
    id: "alex",
    name: "Alex Chen",
    initials: "AC",
    color: "brand",
    lastMessage: "Hey, did you check the new API docs?",
    lastTime: "2m",
    unreadCount: 3,
    isOnline: false,
    ownerId: "you",
    contactId: "alex",
  },
  {
    id: "design-team",
    name: "Design Team",
    initials: "DT",
    color: "violet",
    lastMessage: "Sarah: Updated the mockups for v2",
    lastTime: "15m",
    unreadCount: 0,
    isOnline: false,
    isGroup: true,
    ownerId: "you",
    contactId: "design-team",
  },
  {
    id: "maya",
    name: "Maya Rodriguez",
    initials: "MR",
    color: "coral",
    lastMessage: "The deployment is done",
    lastTime: "1h",
    unreadCount: 1,
    isOnline: false,
    ownerId: "you",
    contactId: "maya",
  },
  {
    id: "project-alpha",
    name: "Project Alpha",
    initials: "PA",
    color: "amber",
    lastMessage: "Files uploaded to shared drive",
    lastTime: "3h",
    unreadCount: 0,
    isOnline: false,
    isGroup: true,
    ownerId: "you",
    contactId: "project-alpha",
  },
  {
    id: "liam",
    name: "Liam Foster",
    initials: "LF",
    color: "cyan",
    lastMessage: "Can we sync tomorrow morning?",
    lastTime: "Yesterday",
    unreadCount: 0,
    isOnline: false,
    ownerId: "you",
    contactId: "liam",
  },
  {
    id: "engineering",
    name: "Engineering",
    initials: "EN",
    color: "teal",
    lastMessage: "Build #4521 passed all tests",
    lastTime: "Yesterday",
    unreadCount: 0,
    isOnline: false,
    isGroup: true,
    ownerId: "you",
    contactId: "engineering",
  },
];

export const seedMessages: Message[] = [
  { id: "m1", conversationId: "alex", senderId: "alex", text: "Hey! Did you get a chance to review the API docs I sent over?", isSent: false, timestamp: "10:24 AM", isRead: true },
  { id: "m2", conversationId: "alex", senderId: "you", text: "Yes, just went through them. The WebSocket implementation looks solid.", isSent: true, timestamp: "10:26 AM", isRead: true },
  { id: "m3", conversationId: "alex", senderId: "alex", text: "Great! I was thinking we could add a reconnection strategy with exponential backoff.", isSent: false, timestamp: "10:27 AM", isRead: true },
  { id: "m4", conversationId: "alex", senderId: "you", text: "That's a good idea. I can draft something up this afternoon. Any specific retry limits in mind?", isSent: true, timestamp: "10:30 AM", isRead: true },
  { id: "m5", conversationId: "alex", senderId: "alex", text: "Let's cap it at 5 retries with a max delay of 30 seconds. Also we should make sure the design tokens are documented properly.", isSent: false, timestamp: "10:32 AM", isRead: true },
  { id: "m6", conversationId: "alex", senderId: "you", text: "Agreed. I'll also add a section on the new design tokens we shipped last week.", isSent: true, timestamp: "10:35 AM", isRead: true },
  { id: "m7", conversationId: "alex", senderId: "alex", text: "Perfect. One more thing — can we sync on the auth flow tomorrow? I have some thoughts on the token refresh logic.", isSent: false, timestamp: "10:38 AM", isRead: true },
  { id: "m8", conversationId: "alex", senderId: "you", text: "Sure, I'm free after 2pm. Let's do a quick call then.", isSent: true, timestamp: "10:40 AM", isRead: true },
];

export const seedContacts: Contact[] = [
  { id: "alex", name: "Alex Chen", initials: "AC", color: "brand", isOnline: false, lastSeen: "Offline", email: "alex.chen@techcorp.com", phone: "+1 (555) 0456", location: "San Francisco, CA", bio: "Building beautiful interfaces. Coffee enthusiast.", role: "Product Designer at TechCorp" },
  { id: "anna", name: "Anna Kim", initials: "AK", color: "cyan", isOnline: false, lastSeen: "1h ago" },
  { id: "design-team", name: "Design Team", initials: "DT", color: "violet", isOnline: false, lastSeen: "5 members", isGroup: true, memberCount: 5 },
  { id: "engineering", name: "Engineering", initials: "EN", color: "teal", isOnline: false, lastSeen: "12 members", isGroup: true, memberCount: 12 },
  { id: "emily", name: "Emily Park", initials: "EP", color: "coral", isOnline: false, lastSeen: "Offline" },
  { id: "james", name: "James Liu", initials: "JL", color: "amber", isOnline: false, lastSeen: "Yesterday" },
  { id: "liam", name: "Liam Foster", initials: "LF", color: "cyan", isOnline: false, lastSeen: "3h ago" },
  { id: "maya", name: "Maya Rodriguez", initials: "MR", color: "coral", isOnline: false, lastSeen: "Offline" },
  { id: "project-alpha", name: "Project Alpha", initials: "PA", color: "amber", isOnline: false, lastSeen: "8 members", isGroup: true, memberCount: 8 },
  { id: "sarah", name: "Sarah Miller", initials: "SM", color: "brand", isOnline: false, lastSeen: "Offline" },
  { id: "tom", name: "Tom Wilson", initials: "TW", color: "violet", isOnline: false, lastSeen: "Offline" },
];

export const seedNotifications: NotificationItem[] = [
  { id: "n1", actorName: "Alex Chen", actorInitials: "AC", actorColor: "brand", action: "sent you a message", content: "Hey, did you check the new API docs?", timestamp: "2m ago", isRead: false, type: "message", ownerId: "you" },
  { id: "n2", actorName: "Maya Rodriguez", actorInitials: "MR", actorColor: "coral", action: "mentioned you", content: "@You can you review the PR when you have a moment?", timestamp: "15m ago", isRead: false, type: "mention", ownerId: "you" },
  { id: "n3", actorName: "Sarah Miller", actorInitials: "SM", actorColor: "brand", action: "reacted to your message", content: "👍 \"Let's ship it!\"", timestamp: "1h ago", isRead: false, type: "reaction", ownerId: "you" },
  { id: "n4", actorName: "Design Team", actorInitials: "DT", actorColor: "violet", action: "new message in group", content: "Sarah: Updated the mockups for v2", timestamp: "2h ago", isRead: true, type: "group", ownerId: "you" },
  { id: "n5", actorName: "Engineering", actorInitials: "EN", actorColor: "teal", action: "new build notification", content: "Build #4521 passed all tests", timestamp: "5h ago", isRead: true, type: "system", ownerId: "you" },
  { id: "n6", actorName: "Liam Foster", actorInitials: "LF", actorColor: "cyan", action: "sent you a message", content: "Can we sync tomorrow morning?", timestamp: "Yesterday", isRead: true, type: "message", ownerId: "you" },
  { id: "n7", actorName: "Project Alpha", actorInitials: "PA", actorColor: "amber", action: "files shared in group", content: "3 files uploaded to shared drive", timestamp: "Yesterday", isRead: true, type: "group", ownerId: "you" },
];

/** 初始化种子用户的好友列表（demo 用户预填所有种子联系人） */
function seedFriends(): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  const youFriends = new Set(seedContacts.map((c) => c.id));
  map.set("you", youFriends);
  // alex 也是注册用户，预填部分好友
  map.set("alex", new Set(["you", "maya", "sarah", "liam"]));
  return map;
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
