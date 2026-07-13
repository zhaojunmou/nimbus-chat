// 前后端共享类型定义

/** 头像配色循环 */
export type AvatarColor =
  | "brand"
  | "violet"
  | "coral"
  | "amber"
  | "cyan"
  | "teal";

/** 会话（侧边栏列表项 + 对话详情） */
export interface Conversation {
  id: string;
  name: string;
  initials: string;
  color: AvatarColor;
  lastMessage: string;
  lastTime: string;
  unreadCount: number;
  isOnline: boolean;
  isPinned?: boolean;
  isMuted?: boolean;
  isGroup?: boolean;
  /** 会话归属用户（数据隔离用） */
  ownerId?: string;
  /** 关联的联系人 id（View profile 跳转用，种子数据中 = id） */
  contactId?: string;
  /** 对方头像图片 data URL（存在时优先于首字母渲染） */
  avatarUrl?: string;
  /** 群聊成员 id 列表（仅 isGroup 时有效） */
  memberIds?: string[];
  /** 群主 id（仅 isGroup 时有效） */
  groupOwnerId?: string;
  /** 群管理员 id 列表（仅 isGroup 时有效） */
  groupAdminIds?: string[];
}

/** 单条消息 */
export interface Message {
  id: string;
  conversationId: string;
  senderId: string; // "you" 或联系人 id
  text: string;
  isSent: boolean; // 是否为当前用户发送
  timestamp: string;
  isRead?: boolean;
  /** 全局自增序列号 — 用于跨会话副本合并后的稳定排序 */
  seq?: number;
  /** 图片附件（base64 data URL）— 存在时渲染为图片消息 */
  imageUrl?: string;
  /** 文件名（图片消息的原始文件名，用于下载/提示） */
  fileName?: string;
}

/** 联系人 */
export interface Contact {
  id: string;
  name: string;
  initials: string;
  color: AvatarColor;
  isOnline: boolean;
  lastSeen: string;
  isGroup?: boolean;
  memberCount?: number;
  email?: string;
  phone?: string;
  location?: string;
  bio?: string;
  role?: string;
  /** 头像图片 data URL（存在时优先于首字母渲染） */
  avatarUrl?: string;
  /** 群聊成员 id 列表（仅 isGroup 时有效） */
  memberIds?: string[];
  /** 群主 id（仅 isGroup 时有效） */
  groupOwnerId?: string;
  /** 群管理员 id 列表（仅 isGroup 时有效） */
  groupAdminIds?: string[];
}

/** 好友请求 */
export interface FriendRequest {
  id: string;
  fromUserId: string;
  fromName: string;
  fromInitials: string;
  fromColor: AvatarColor;
  fromAvatarUrl?: string;
  toUserId: string;
  toName: string;
  toInitials: string;
  toColor: AvatarColor;
  status: "pending" | "accepted" | "rejected";
  timestamp: string;
}

/** 通知 */
export interface NotificationItem {
  id: string;
  actorName: string;
  actorInitials: string;
  actorColor: AvatarColor;
  action: string;
  content: string;
  timestamp: string;
  isRead: boolean;
  type: "message" | "mention" | "reaction" | "group" | "system";
  /** 通知归属用户（数据隔离用） */
  ownerId?: string;
}

/** 当前用户 */
export interface User {
  id: string;
  displayName: string;
  email: string;
  initials: string;
  color: AvatarColor;
  statusMessage: string;
  bio: string;
  phone: string;
}

/** CSS 变量配色取值映射 */
export const colorVarMap: Record<AvatarColor, string> = {
  brand: "var(--bg-brand)",
  violet: "var(--accent-violet)",
  coral: "var(--accent-coral)",
  amber: "var(--accent-amber)",
  cyan: "var(--accent-cyan)",
  teal: "var(--accent-teal)",
};

/* ── 认证相关类型 ── */

/** 注册请求体 */
export interface RegisterPayload {
  email: string;
  password: string;
  displayName: string;
}

/** 登录请求体 */
export interface LoginPayload {
  email: string;
  password: string;
}

/** 认证响应 */
export interface AuthResponse {
  token: string;
  user: AuthUser;
}

/** 认证用户（含账号字段，区别于聊天 User） */
export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  initials: string;
  color: AvatarColor;
  statusMessage: string;
  bio: string;
  phone: string;
  /** 账号角色：普通用户 / 管理员 */
  role: "user" | "admin";
  /** 头像图片 data URL（存在时优先于首字母渲染） */
  avatarUrl?: string;
}

/* ── Socket.IO 事件定义 ── */

/** 客户端 → 服务端 */
export interface ClientToServerEvents {
  // 加入会话房间（查看某个对话）
  "conversation:join": (conversationId: string) => void;
  // 离开会话房间
  "conversation:leave": (conversationId: string) => void;
  // 发送消息
  "message:send": (payload: {
    conversationId: string;
    text: string;
    imageUrl?: string;
    fileName?: string;
  }) => void;
  // 标记已读
  "message:read": (conversationId: string) => void;
  // 正在输入
  "typing:start": (conversationId: string) => void;
  "typing:stop": (conversationId: string) => void;
  // ── WebRTC 语音通话信令 ──
  // 发起通话邀请（offer）
  "call:offer": (payload: {
    to: string;
    conversationId: string;
    offer: RTCSessionDescriptionInit;
  }) => void;
  // 接受通话（回复 answer）
  "call:answer": (payload: {
    to: string;
    answer: RTCSessionDescriptionInit;
  }) => void;
  // 交换 ICE 候选
  "call:ice-candidate": (payload: {
    to: string;
    candidate: RTCIceCandidateInit;
  }) => void;
  // 拒绝来电
  "call:reject": (payload: { to: string }) => void;
  // 结束通话（挂断）
  "call:end": (payload: { to: string }) => void;
}

/** 服务端 → 客户端 */
export interface ServerToClientEvents {
  // 新消息到达
  "message:new": (message: Message) => void;
  // 会话列表更新（最后消息/未读数变化）
  "conversation:updated": (conversation: Conversation) => void;
  // 对方正在输入
  "typing:update": (payload: {
    conversationId: string;
    userId: string;
    isTyping: boolean;
  }) => void;
  // 在线状态变化
  "presence:update": (payload: {
    userId: string;
    isOnline: boolean;
  }) => void;
  // 消息已读回执
  "message:read": (payload: {
    conversationId: string;
    messageIds: string[];
  }) => void;
  // 收到新的好友请求
  "friend:request:new": (request: FriendRequest) => void;
  // 好友请求状态变更（接受/拒绝）
  "friend:request:update": (request: FriendRequest) => void;
  // 联系人资料变更（头像/昵称等）— 通知对方刷新会话/联系人
  "profile:updated": (payload: {
    userId: string;
    name: string;
    initials: string;
    color: AvatarColor;
    avatarUrl?: string;
  }) => void;
  // 群聊成员变更（加入/退出/被移除）— 通知相关成员刷新群信息
  "group:members:updated": (payload: {
    groupId: string;
    conversation: Conversation;
  }) => void;
  // ── WebRTC 语音通话信令 ──
  // 收到通话邀请
  "call:offer": (payload: {
    from: string;
    fromName: string;
    conversationId: string;
    offer: RTCSessionDescriptionInit;
  }) => void;
  // 通话被接受（收到 answer）
  "call:answer": (payload: {
    from: string;
    answer: RTCSessionDescriptionInit;
  }) => void;
  // 收到 ICE 候选
  "call:ice-candidate": (payload: {
    from: string;
    candidate: RTCIceCandidateInit;
  }) => void;
  // 通话被拒绝
  "call:reject": (payload: { from: string }) => void;
  // 通话被对方挂断
  "call:end": (payload: { from: string }) => void;
}
