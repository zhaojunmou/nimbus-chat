import { nanoid } from "nanoid";
import type { Server } from "socket.io";
import { db, persistDb } from "../data/store.js";
import { getAccountById } from "../data/authStore.js";
import type {
  Conversation,
  Message,
  Contact,
  FriendRequest,
  ClientToServerEvents,
  ServerToClientEvents,
} from "../../shared/types.js";

type IO = Server<ClientToServerEvents, ServerToClientEvents>;

// 模块级 io 引用 — 由 initRealtime(io) 注入，供好友请求函数实时推送
let ioRef: IO | null = null;

/** 注入 Socket.IO 实例，供 chatService 发送实时事件 */
export function initRealtime(io: IO): void {
  ioRef = io;
}

/** 向指定用户推送事件（通过 user:${userId} 房间） */
function emitToUser(
  userId: string,
  event: "friend:request:new" | "friend:request:update",
  payload: FriendRequest,
): void;
function emitToUser(
  userId: string,
  event: "profile:updated",
  payload: {
    userId: string;
    name: string;
    initials: string;
    color: import("../../shared/types.js").AvatarColor;
    avatarUrl?: string;
  },
): void;
function emitToUser(userId: string, event: string, payload: unknown): void {
  if (!ioRef) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ioRef.to(`user:${userId}`).emit(event as any, payload as any);
}

/** 检查用户是否当前在线（至少有一个 socket 连接） */
export function isUserOnline(userId: string): boolean {
  return Array.from(db.onlineSockets.values()).includes(userId);
}

/** 获取账号信息（封装 getAccountById 供 socket handler 使用） */
export function getAccountByIdPublic(userId: string) {
  return getAccountById(userId);
}

/** 当前时间字符串（如 10:42 AM） */
function now(): string {
  return new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** 相对时间简写 */
function relativeTime(): string {
  return "now";
}

/** 创建并保存一条新消息，返回 (message, updatedConversation) */
export function createMessage(
  conversationId: string,
  senderId: string,
  text: string,
  currentUserId: string,
  imageUrl?: string,
  fileName?: string,
): { message: Message; conversation: Conversation } | null {
  const conv = db.conversations.find((c) => c.id === conversationId);
  if (!conv) return null;

  const isSent = senderId === currentUserId;
  db.messageSeq += 1;
  const message: Message = {
    id: nanoid(8),
    conversationId,
    senderId,
    text,
    isSent,
    timestamp: now(),
    isRead: false,
    seq: db.messageSeq,
    ...(imageUrl ? { imageUrl } : {}),
    ...(fileName ? { fileName } : {}),
  };
  db.messages.push(message);

  // 更新会话的最后消息与时间（图片消息显示 📷 占位）
  const preview = imageUrl ? "📷 Photo" : text;
  conv.lastMessage = isSent ? preview : `${conv.name.split(" ")[0]}: ${preview}`;
  conv.lastTime = relativeTime();

  persistDb();

  return { message, conversation: conv };
}

/** 查找用户的某个联系人会话（按 ownerId + contactId） */
export function findConversationByContact(
  ownerId: string,
  contactId: string,
): Conversation | undefined {
  return db.conversations.find(
    (c) => c.ownerId === ownerId && c.contactId === contactId,
  );
}

/**
 * 为接收方在其自己的会话中创建消息副本（isSent: false，对接收方视角正确）。
 * 同时更新接收方会话的 lastMessage / lastTime / unreadCount。
 * 返回 (message, conversation) 或 null（接收方会话不存在时）。
 */
export function createRecipientMessage(
  recipientConversationId: string,
  senderId: string,
  senderName: string,
  text: string,
  timestamp: string,
  seq: number,
  imageUrl?: string,
  fileName?: string,
): { message: Message; conversation: Conversation } | null {
  const conv = db.conversations.find((c) => c.id === recipientConversationId);
  if (!conv) return null;

  const message: Message = {
    id: nanoid(8),
    conversationId: recipientConversationId,
    senderId,
    text,
    isSent: false, // 接收方视角
    timestamp,
    isRead: false,
    seq,
    ...(imageUrl ? { imageUrl } : {}),
    ...(fileName ? { fileName } : {}),
  };
  db.messages.push(message);

  // 更新接收方会话最后消息与未读数（图片消息显示 📷 占位）
  const preview = imageUrl ? "📷 Photo" : text;
  conv.lastMessage = `${senderName.split(" ")[0]}: ${preview}`;
  conv.lastTime = relativeTime();
  conv.unreadCount = (conv.unreadCount ?? 0) + 1;

  persistDb();
  return { message, conversation: conv };
}

/** 标记某个会话所有消息为已读，返回被标记的消息 id 列表 */
export function markConversationRead(
  conversationId: string,
): string[] {
  const updated: string[] = [];
  // 收集本会话 + 对端会话的 id（双方各有会话副本）
  const conv = db.conversations.find((c) => c.id === conversationId);
  const convIds = new Set<string>([conversationId]);
  if (conv?.contactId && conv?.ownerId) {
    const otherConv = db.conversations.find(
      (c) => c.ownerId === conv.contactId && c.contactId === conv.ownerId,
    );
    if (otherConv) convIds.add(otherConv.id);
  }
  db.messages.forEach((m) => {
    if (convIds.has(m.conversationId) && !m.isRead) {
      m.isRead = true;
      updated.push(m.id);
    }
  });
  if (conv) conv.unreadCount = 0;
  persistDb();
  return updated;
}

/** 删除会话及其消息 */
export function deleteConversation(conversationId: string): void {
  db.conversations = db.conversations.filter((c) => c.id !== conversationId);
  db.messages = db.messages.filter((m) => m.conversationId !== conversationId);
  persistDb();
}

/** 获取或创建与会话：按 (contactId, ownerId) 查找，不存在则创建（防止向不存在的会话发消息被丢弃） */
export function ensureConversation(contactId: string, ownerId: string): Conversation {
  // 先查该用户是否已有与此联系人的会话
  const existing = db.conversations.find(
    (c) => c.contactId === contactId && c.ownerId === ownerId,
  );
  if (existing) return existing;
  const contact = db.contacts.find((c) => c.id === contactId);
  const id = nanoid(8);
  const base: Conversation = contact
    ? {
        id,
        name: contact.name,
        initials: contact.initials,
        color: contact.color,
        lastMessage: "",
        lastTime: "",
        unreadCount: 0,
        isOnline: contact.isOnline,
        isGroup: contact.isGroup,
        ownerId,
        contactId,
        avatarUrl: contact.avatarUrl,
      }
    : {
        id,
        name: contactId,
        initials: contactId.slice(0, 2).toUpperCase(),
        color: "brand",
        lastMessage: "",
        lastTime: "",
        unreadCount: 0,
        isOnline: false,
        ownerId,
        contactId,
      };
  db.conversations.push(base);
  // 群组自动加入好友列表（群组无需好友请求）
  if (contact?.isGroup) {
    if (!db.friendsByUser.has(ownerId)) db.friendsByUser.set(ownerId, new Set());
    db.friendsByUser.get(ownerId)!.add(contactId);
  }
  persistDb();
  return base;
}

/** 切换置顶/静音 */
export function togglePinned(conversationId: string): Conversation | null {
  const conv = db.conversations.find((c) => c.id === conversationId);
  if (conv) conv.isPinned = !conv.isPinned;
  persistDb();
  return conv ?? null;
}

export function toggleMuted(conversationId: string): Conversation | null {
  const conv = db.conversations.find((c) => c.id === conversationId);
  if (conv) conv.isMuted = !conv.isMuted;
  persistDb();
  return conv ?? null;
}

/** 更新用户资料 */
export function updateUser(patch: Partial<typeof db.user>): typeof db.user {
  Object.assign(db.user, patch);
  persistDb();
  return db.user;
}

/** 标记某用户所有通知已读 */
export function markAllNotificationsRead(ownerId: string): void {
  db.notifications.forEach((n) => {
    if (n.ownerId === ownerId) n.isRead = true;
  });
  persistDb();
}

/** 标记单条通知已读（验证归属） */
export function markNotificationRead(id: string, ownerId: string): void {
  const n = db.notifications.find((x) => x.id === id && x.ownerId === ownerId);
  if (n) n.isRead = true;
  persistDb();
}

/** 设置在线状态 */
export function setOnline(socketId: string, userId: string): void {
  db.onlineSockets.set(socketId, userId);
}

/** 移除在线状态并返回受影响的 userId */
export function setOffline(socketId: string): string | null {
  const userId = db.onlineSockets.get(socketId);
  if (!userId) return null;
  db.onlineSockets.delete(socketId);
  // 检查该用户是否还有其它 socket 在线
  const stillOnline = Array.from(db.onlineSockets.values()).includes(userId);
  if (!stillOnline) {
    // 同步更新联系人与会话在线状态（会话按 contactId 匹配）
    db.contacts.forEach((c) => {
      if (c.id === userId) {
        c.isOnline = false;
        c.lastSeen = "Just now";
      }
    });
    db.conversations.forEach((c) => {
      if ((c.contactId ?? c.id) === userId) c.isOnline = false;
    });
  }
  return stillOnline ? null : userId;
}

/** 用户上线：同步联系人与会话在线状态（会话按 contactId 匹配） */
export function userWentOnline(userId: string): void {
  db.contacts.forEach((c) => {
    if (c.id === userId) {
      c.isOnline = true;
      c.lastSeen = "Online";
    }
  });
  db.conversations.forEach((c) => {
    if ((c.contactId ?? c.id) === userId) c.isOnline = true;
  });
}

/** 清空某个会话的所有消息（保留会话本身） */
export function clearConversationMessages(conversationId: string): boolean {
  const conv = db.conversations.find((c) => c.id === conversationId);
  if (!conv) return false;
  db.messages = db.messages.filter((m) => m.conversationId !== conversationId);
  conv.lastMessage = "";
  conv.lastTime = "";
  persistDb();
  return true;
}

/** 清空某个用户所有会话的消息（按 ownerId 隔离） */
export function clearAllMessages(ownerId: string): void {
  const convIds = new Set(
    db.conversations.filter((c) => c.ownerId === ownerId).map((c) => c.id),
  );
  db.messages = db.messages.filter((m) => !convIds.has(m.conversationId));
  db.conversations.forEach((c) => {
    if (c.ownerId === ownerId) {
      c.lastMessage = "";
      c.lastTime = "";
      c.unreadCount = 0;
    }
  });
  persistDb();
}

/** 屏蔽联系人（按用户隔离） */
export function blockContact(contactId: string, ownerId: string): boolean {
  const c = db.contacts.find((x) => x.id === contactId);
  if (!c) return false;
  if (!db.blockedByUser.has(ownerId)) db.blockedByUser.set(ownerId, new Set());
  db.blockedByUser.get(ownerId)!.add(contactId);
  persistDb();
  return true;
}

/** 取消屏蔽（按用户隔离） */
export function unblockContact(contactId: string, ownerId: string): boolean {
  const c = db.contacts.find((x) => x.id === contactId);
  if (!c) return false;
  db.blockedByUser.get(ownerId)?.delete(contactId);
  persistDb();
  return true;
}

/** 获取已屏蔽联系人列表（按用户隔离） */
export function getBlockedContacts(ownerId: string): Contact[] {
  const blocked = db.blockedByUser.get(ownerId);
  if (!blocked || blocked.size === 0) return [];
  return db.contacts.filter((c) => blocked.has(c.id));
}

// ── 好友系统 ──

/** 获取用户的好友联系人列表（按 ownerId 隔离） */
export function getFriends(ownerId: string): Contact[] {
  const friendIds = db.friendsByUser.get(ownerId);
  if (!friendIds || friendIds.size === 0) return [];
  return db.contacts.filter((c) => friendIds.has(c.id));
}

/** 检查是否已是好友 */
export function areFriends(userId: string, contactId: string): boolean {
  return db.friendsByUser.get(userId)?.has(contactId) ?? false;
}

/** 确保注册用户在联系人表中存在对应条目（好友系统需要 Contact 信息） */
export function ensureContactForAccount(userId: string): void {
  if (db.contacts.some((c) => c.id === userId)) return;
  const account = getAccountById(userId);
  if (!account) return;
  const online = isUserOnline(userId);
  db.contacts.push({
    id: account.id,
    name: account.displayName,
    initials: account.initials,
    color: account.color,
    isOnline: online,
    lastSeen: online ? "Online" : "Offline",
    email: account.email,
    phone: account.phone,
    bio: account.bio,
    avatarUrl: account.avatarUrl,
  });
  persistDb();
}

/**
 * 账号资料变更后同步到 Contact / Conversation 表，并通知所有相关对话方。
 * 在 PATCH /me（updateAccount）后调用，确保好友/对方看到最新头像/昵称。
 */
export function syncAccountProfile(userId: string): void {
  const account = getAccountById(userId);
  if (!account) return;
  const profile = {
    userId,
    name: account.displayName,
    initials: account.initials,
    color: account.color,
    avatarUrl: account.avatarUrl,
  };

  // 1. 同步 Contact 表中 id === userId 的记录
  let contactChanged = false;
  for (const c of db.contacts) {
    if (c.id === userId) {
      c.name = account.displayName;
      c.initials = account.initials;
      c.color = account.color;
      c.avatarUrl = account.avatarUrl;
      c.email = account.email;
      c.phone = account.phone;
      c.bio = account.bio;
      contactChanged = true;
    }
  }

  // 2. 同步所有 contactId === userId 的 Conversation 记录，并通知其归属用户
  const notifyOwnerIds = new Set<string>();
  for (const conv of db.conversations) {
    if (conv.contactId === userId) {
      conv.name = account.displayName;
      conv.initials = account.initials;
      conv.color = account.color;
      conv.avatarUrl = account.avatarUrl;
      // 通知该会话归属用户（对话方）刷新
      if (conv.ownerId && conv.ownerId !== userId) {
        notifyOwnerIds.add(conv.ownerId);
      }
    }
  }

  // 3. 推送 profile:updated 事件给所有受影响的对话方
  for (const ownerId of notifyOwnerIds) {
    emitToUser(ownerId, "profile:updated", profile);
    // 同时推送 conversation:updated 让前端会话列表立即刷新
    const ownerConv = db.conversations.find(
      (c) => c.contactId === userId && c.ownerId === ownerId,
    );
    if (ownerConv) {
      ioRef?.to(`user:${ownerId}`).emit("conversation:updated", { ...ownerConv });
    }
  }

  if (contactChanged || notifyOwnerIds.size > 0) {
    persistDb();
  }
}

/** 发送好友请求 — 返回 { request, autoAccepted } */
export function sendFriendRequest(
  fromUserId: string,
  toContactId: string,
): { request: FriendRequest; autoAccepted: boolean } | { error: string } {
  const target = db.contacts.find((c) => c.id === toContactId);
  if (!target) return { error: "Contact not found" };
  if (target.isGroup) return { error: "Cannot send friend request to a group" };
  if (areFriends(fromUserId, toContactId)) return { error: "Already friends" };

  // 确保发起者在联系人表中存在（注册用户可能尚无 Contact 条目）
  ensureContactForAccount(fromUserId);

  // 查找发起者的展示信息
  const fromAccount = getAccountById(fromUserId);
  const fromName = fromAccount?.displayName ?? fromUserId;
  const fromInitials = fromAccount?.initials ?? fromUserId.slice(0, 2).toUpperCase();
  const fromColor = fromAccount?.color ?? "brand";
  const fromAvatarUrl = fromAccount?.avatarUrl;

  // 检查是否已有 pending 请求
  const existing = db.friendRequests.find(
    (r) =>
      r.fromUserId === fromUserId &&
      r.toUserId === toContactId &&
      r.status === "pending",
  );
  if (existing) return { error: "Request already sent" };

  const request: FriendRequest = {
    id: nanoid(8),
    fromUserId,
    fromName,
    fromInitials,
    fromColor,
    fromAvatarUrl,
    toUserId: toContactId,
    toName: target.name,
    toInitials: target.initials,
    toColor: target.color,
    status: "pending",
    timestamp: "now",
  };
  db.friendRequests.push(request);

  // 实时推送给接收方（仅注册用户有 socket 连接）
  emitToUser(toContactId, "friend:request:new", request);

  persistDb();

  // 若对方不是注册用户（NPC），3 秒后自动接受
  const targetAccount = getAccountById(toContactId);
  const autoAccepted = !targetAccount;
  if (autoAccepted) {
    setTimeout(() => {
      if (request.status === "pending") {
        acceptFriendRequest(request.id, toContactId);
      }
    }, 3000);
  }

  return { request, autoAccepted };
}

/** 接受好友请求 — 仅 toUserId 可接受 */
export function acceptFriendRequest(
  requestId: string,
  acceptingUserId: string,
): FriendRequest | null {
  const req = db.friendRequests.find((r) => r.id === requestId);
  if (!req || req.status !== "pending") return null;
  // 接受者必须是请求的接收方（toUserId）
  if (req.toUserId !== acceptingUserId) return null;

  req.status = "accepted";

  // 双向添加好友
  addFriend(req.fromUserId, req.toUserId);
  // 如果接收方也是注册用户，则双向；否则仅发起方添加
  addFriend(req.toUserId, req.fromUserId);

  // 通知发起方请求已被接受
  emitToUser(req.fromUserId, "friend:request:update", req);

  persistDb();
  return req;
}

/** 拒绝好友请求 — 仅 toUserId 可拒绝 */
export function rejectFriendRequest(
  requestId: string,
  rejectingUserId: string,
): FriendRequest | null {
  const req = db.friendRequests.find((r) => r.id === requestId);
  if (!req || req.status !== "pending") return null;
  if (req.toUserId !== rejectingUserId) return null;

  req.status = "rejected";

  // 通知发起方请求已被拒绝
  emitToUser(req.fromUserId, "friend:request:update", req);

  persistDb();
  return req;
}

/** 获取用户收到的好友请求（incoming pending） */
export function getIncomingRequests(userId: string): FriendRequest[] {
  return db.friendRequests.filter(
    (r) => r.toUserId === userId && r.status === "pending",
  );
}

/** 获取用户发出的好友请求（outgoing pending） */
export function getOutgoingRequests(userId: string): FriendRequest[] {
  return db.friendRequests.filter(
    (r) => r.fromUserId === userId && r.status === "pending",
  );
}

/** 内部：双向添加好友 */
function addFriend(userId: string, contactId: string): void {
  if (!db.friendsByUser.has(userId)) db.friendsByUser.set(userId, new Set());
  db.friendsByUser.get(userId)!.add(contactId);
  persistDb();
}

// ── 群聊系统 ──

/** 头像配色循环（创建群聊时按顺序选取） */
const groupColorCycle: import("../../shared/types.js").AvatarColor[] = [
  "violet",
  "amber",
  "cyan",
  "teal",
  "coral",
  "brand",
];

/**
 * 创建群聊 — 由 owner 发起，邀请初始成员组建群。
 * 会创建：1 个 Contact（群组联系人）+ N 个 Conversation（每个成员各一份，ownerId 隔离）。
 */
export function createGroup(
  ownerUserId: string,
  name: string,
  memberIds: string[],
): Conversation | { error: string } {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Group name is required" };
  if (memberIds.length === 0) return { error: "At least one member is required" };

  // 群组 id（用 nanoid 生成，加 "group-" 前缀避免与用户 id 冲突）
  const groupId = `group-${nanoid(8)}`;
  const initials = trimmed.slice(0, 2).toUpperCase();
  const color = groupColorCycle[Math.floor(Math.random() * groupColorCycle.length)];

  // 全部成员 id（含群主）
  const allMembers = Array.from(new Set([ownerUserId, ...memberIds]));

  // 1. 创建群组 Contact（全局共享，所有成员都能看到）
  const groupContact: Contact = {
    id: groupId,
    name: trimmed,
    initials,
    color,
    isOnline: false,
    lastSeen: `${allMembers.length} members`,
    isGroup: true,
    memberCount: allMembers.length,
    memberIds: allMembers,
    groupOwnerId: ownerUserId,
    groupAdminIds: [ownerUserId],
  };
  db.contacts.push(groupContact);

  // 2. 为每个成员创建会话副本（ownerId 隔离）
  for (const memberId of allMembers) {
    const conv: Conversation = {
      id: memberId === ownerUserId ? groupId : `${groupId}__${memberId}`,
      name: trimmed,
      initials,
      color,
      lastMessage: "",
      lastTime: "",
      unreadCount: 0,
      isOnline: false,
      isGroup: true,
      ownerId: memberId,
      contactId: groupId,
      memberIds: allMembers,
      groupOwnerId: ownerUserId,
      groupAdminIds: [ownerUserId],
    };
    db.conversations.push(conv);

    // 群组自动加入好友列表
    if (!db.friendsByUser.has(memberId)) {
      db.friendsByUser.set(memberId, new Set());
    }
    db.friendsByUser.get(memberId)!.add(groupId);
  }

  persistDb();

  // 3. 通知所有在线成员（除群主外）刷新会话列表
  const ownerConv = db.conversations.find(
    (c) => c.ownerId === ownerUserId && c.contactId === groupId,
  );
  if (ownerConv) {
    for (const memberId of allMembers) {
      if (memberId === ownerUserId) continue;
      emitToUser(memberId, "group:members:updated", {
        groupId,
        conversation: ownerConv,
      });
    }
  }

  return ownerConv ?? { error: "Failed to create group" };
}

/** 获取群聊信息（返回群主的会话副本作为权威信息源） */
export function getGroup(groupId: string): Conversation | null {
  return (
    db.conversations.find(
      (c) => c.contactId === groupId && c.ownerId === c.groupOwnerId,
    ) ?? db.conversations.find((c) => c.contactId === groupId) ?? null
  );
}

/** 获取群聊成员的 Contact 列表 */
export function getGroupMembers(groupId: string): Contact[] {
  const group = db.contacts.find((c) => c.id === groupId);
  if (!group?.memberIds) return [];
  return group.memberIds
    .map((id) => db.contacts.find((c) => c.id === id))
    .filter((c): c is Contact => c !== undefined);
}

/** 添加成员到群聊（仅群主/管理员可操作） */
export function addGroupMember(
  groupId: string,
  operatorId: string,
  newMemberIds: string[],
): Conversation | { error: string } {
  const group = db.contacts.find((c) => c.id === groupId);
  if (!group?.isGroup) return { error: "Group not found" };

  // 权限检查
  const isAdmin =
    group.groupOwnerId === operatorId ||
    group.groupAdminIds?.includes(operatorId);
  if (!isAdmin) return { error: "Only admins can add members" };

  const currentMembers = new Set(group.memberIds ?? []);
  const added: string[] = [];
  for (const id of newMemberIds) {
    if (!currentMembers.has(id)) {
      currentMembers.add(id);
      added.push(id);
    }
  }
  if (added.length === 0) return { error: "All users are already members" };

  // 更新群组 Contact
  const newMemberList = Array.from(currentMembers);
  group.memberIds = newMemberList;
  group.memberCount = newMemberList.length;
  group.lastSeen = `${newMemberList.length} members`;

  // 为新成员创建会话副本
  for (const memberId of added) {
    const existingConv = db.conversations.find(
      (c) => c.ownerId === memberId && c.contactId === groupId,
    );
    if (existingConv) continue; // 已有会话（曾退出但会话保留）
    const conv: Conversation = {
      id: `${groupId}__${memberId}`,
      name: group.name,
      initials: group.initials,
      color: group.color,
      lastMessage: "",
      lastTime: "",
      unreadCount: 0,
      isOnline: false,
      isGroup: true,
      ownerId: memberId,
      contactId: groupId,
      memberIds: newMemberList,
      groupOwnerId: group.groupOwnerId,
      groupAdminIds: group.groupAdminIds ?? [],
    };
    db.conversations.push(conv);

    // 自动加入好友列表
    if (!db.friendsByUser.has(memberId)) {
      db.friendsByUser.set(memberId, new Set());
    }
    db.friendsByUser.get(memberId)!.add(groupId);
  }

  // 同步所有现有成员会话的 memberIds 和 memberCount
  for (const conv of db.conversations) {
    if (conv.contactId === groupId && conv.isGroup) {
      conv.memberIds = newMemberList;
    }
  }

  persistDb();

  // 通知所有在线成员刷新
  const groupConv = getGroup(groupId);
  if (groupConv) {
    for (const memberId of newMemberList) {
      emitToUser(memberId, "group:members:updated", {
        groupId,
        conversation: groupConv,
      });
    }
  }

  return groupConv ?? { error: "Group update failed" };
}

/** 移除群成员（仅群主/管理员可操作） */
export function removeGroupMember(
  groupId: string,
  operatorId: string,
  targetUserId: string,
): Conversation | { error: string } {
  const group = db.contacts.find((c) => c.id === groupId);
  if (!group?.isGroup) return { error: "Group not found" };

  const isAdmin =
    group.groupOwnerId === operatorId ||
    group.groupAdminIds?.includes(operatorId);
  if (!isAdmin) return { error: "Only admins can remove members" };
  if (group.groupOwnerId === targetUserId) {
    return { error: "Cannot remove the group owner" };
  }

  const currentMembers = new Set(group.memberIds ?? []);
  if (!currentMembers.has(targetUserId)) {
    return { error: "User is not a member" };
  }
  currentMembers.delete(targetUserId);

  const newMemberList = Array.from(currentMembers);
  group.memberIds = newMemberList;
  group.memberCount = newMemberList.length;
  group.lastSeen = `${newMemberList.length} members`;

  // 从管理员列表中移除（如果是管理员）
  if (group.groupAdminIds) {
    group.groupAdminIds = group.groupAdminIds.filter((id) => id !== targetUserId);
  }

  // 同步所有成员会话的 memberIds
  for (const conv of db.conversations) {
    if (conv.contactId === groupId && conv.isGroup) {
      conv.memberIds = newMemberList;
      conv.groupAdminIds = group.groupAdminIds ?? [];
    }
  }

  persistDb();

  // 通知所有在线成员（含被移除者）刷新
  const groupConv = getGroup(groupId);
  if (groupConv) {
    for (const memberId of [...newMemberList, targetUserId]) {
      emitToUser(memberId, "group:members:updated", {
        groupId,
        conversation: groupConv,
      });
    }
  }

  return groupConv ?? { error: "Group update failed" };
}

/** 退出群聊（非群主可退出，群主须先转让） */
export function leaveGroup(
  groupId: string,
  userId: string,
): { ok: true } | { error: string } {
  const group = db.contacts.find((c) => c.id === groupId);
  if (!group?.isGroup) return { error: "Group not found" };
  if (group.groupOwnerId === userId) {
    return { error: "Group owner cannot leave; transfer ownership first" };
  }
  if (!group.memberIds?.includes(userId)) {
    return { error: "You are not a member" };
  }

  // 从成员列表移除
  group.memberIds = group.memberIds.filter((id) => id !== userId);
  group.memberCount = group.memberIds.length;
  group.lastSeen = `${group.memberIds.length} members`;

  // 从管理员列表移除
  if (group.groupAdminIds) {
    group.groupAdminIds = group.groupAdminIds.filter((id) => id !== userId);
  }

  // 同步所有成员会话
  for (const conv of db.conversations) {
    if (conv.contactId === groupId && conv.isGroup) {
      conv.memberIds = group.memberIds;
      conv.groupAdminIds = group.groupAdminIds ?? [];
    }
  }

  persistDb();

  // 通知所有在线成员刷新
  const groupConv = getGroup(groupId);
  if (groupConv) {
    for (const memberId of [...(group.memberIds ?? []), userId]) {
      emitToUser(memberId, "group:members:updated", {
        groupId,
        conversation: groupConv,
      });
    }
  }

  return { ok: true };
}

/** 更新群聊信息（名称等，仅群主/管理员可操作） */
export function updateGroupInfo(
  groupId: string,
  operatorId: string,
  patch: { name?: string },
): Conversation | { error: string } {
  const group = db.contacts.find((c) => c.id === groupId);
  if (!group?.isGroup) return { error: "Group not found" };

  const isAdmin =
    group.groupOwnerId === operatorId ||
    group.groupAdminIds?.includes(operatorId);
  if (!isAdmin) return { error: "Only admins can update group info" };

  if (patch.name) {
    const trimmed = patch.name.trim();
    if (!trimmed) return { error: "Group name cannot be empty" };
    group.name = trimmed;
    group.initials = trimmed.slice(0, 2).toUpperCase();
  }

  // 同步所有成员会话的名称
  for (const conv of db.conversations) {
    if (conv.contactId === groupId && conv.isGroup) {
      if (patch.name) {
        conv.name = group.name;
        conv.initials = group.initials;
      }
    }
  }

  persistDb();

  // 通知所有成员刷新
  const groupConv = getGroup(groupId);
  if (groupConv) {
    for (const memberId of group.memberIds ?? []) {
      emitToUser(memberId, "group:members:updated", {
        groupId,
        conversation: groupConv,
      });
    }
  }

  return groupConv ?? { error: "Update failed" };
}

