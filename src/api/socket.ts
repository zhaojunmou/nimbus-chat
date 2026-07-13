import { io, type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  Message,
  Conversation,
  FriendRequest,
  AvatarColor,
} from "../../shared/types";
import { getToken, clearToken } from "./token";

/**
 * Socket.IO 实时客户端
 * 通过 Vite 代理转发到后端 :3001。
 * 单例连接，应用启动时 connect()，组件按需订阅事件。
 * 认证：握手阶段携带 JWT token，由服务端 socketAuthMiddleware 校验。
 */

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppSocket | null = null;

// 待重连时需要重新加入的会话房间
let lastActiveConversationId: string | null = null;
// 401 登出回调（由 store 注册，避免循环依赖）
let onAuthFailed: (() => void) | null = null;

export function registerSocketAuthFailedHandler(fn: () => void) {
  onAuthFailed = fn;
}

/** 记录当前活动会话，供重连后重新加入房间 */
export function setActiveConversationForReconnect(id: string | null) {
  lastActiveConversationId = id;
}

/** 建立（或返回已存在的）socket 连接 — 需先登录拿到 token */
export function connectSocket(): AppSocket {
  if (socket) return socket;
  const token = getToken();
  if (!token) {
    throw new Error("Cannot connect socket without auth token");
  }
  socket = io({
    auth: { token },
    transports: ["websocket", "polling"],
  });
  socket.on("connect", () => {
    console.log("[socket] connected", socket?.id);
    // 重连后重新加入之前的会话房间
    if (lastActiveConversationId) {
      socket?.emit("conversation:join", lastActiveConversationId);
    }
  });
  socket.on("disconnect", (reason) => {
    console.log("[socket] disconnected", reason);
  });
  socket.on("connect_error", (err) => {
    console.warn("[socket] connect error", err.message);
    // 仅在明确鉴权失败（token 过期/无效）时触发登出
    // 避免一般性网络错误误清空已加载的会话数据
    const isAuthError =
      (err as Error & { data?: { code?: string } }).data?.code === "INVALID_TOKEN" ||
      err.message.includes("Invalid or expired token");
    if (isAuthError) {
      clearToken();
      onAuthFailed?.();
    }
  });
  return socket;
}

/** 主动断开并清理 socket（登出时调用） */
export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}

/** 获取当前 socket（未连接时返回 null） */
export function getSocket(): AppSocket | null {
  return socket;
}

// ── 事件订阅辅助函数 ──

export function onNewMessage(cb: (m: Message) => void): () => void {
  const s = connectSocket();
  s.on("message:new", cb);
  return () => s.off("message:new", cb);
}

export function onConversationUpdated(
  cb: (c: Conversation) => void,
): () => void {
  const s = connectSocket();
  s.on("conversation:updated", cb);
  return () => s.off("conversation:updated", cb);
}

export function onTyping(
  cb: (p: { conversationId: string; userId: string; isTyping: boolean }) => void,
): () => void {
  const s = connectSocket();
  s.on("typing:update", cb);
  return () => s.off("typing:update", cb);
}

export function onPresence(
  cb: (p: { userId: string; isOnline: boolean }) => void,
): () => void {
  const s = connectSocket();
  s.on("presence:update", cb);
  return () => s.off("presence:update", cb);
}

export function onMessageRead(
  cb: (p: { conversationId: string; messageIds: string[] }) => void,
): () => void {
  const s = connectSocket();
  s.on("message:read", cb);
  return () => s.off("message:read", cb);
}

export function onFriendRequestNew(
  cb: (r: FriendRequest) => void,
): () => void {
  const s = connectSocket();
  s.on("friend:request:new", cb);
  return () => s.off("friend:request:new", cb);
}

export function onFriendRequestUpdate(
  cb: (r: FriendRequest) => void,
): () => void {
  const s = connectSocket();
  s.on("friend:request:update", cb);
  return () => s.off("friend:request:update", cb);
}

/** 订阅联系人资料变更（头像/昵称等）— 通知对方刷新会话/联系人 */
export function onProfileUpdated(
  cb: (p: {
    userId: string;
    name: string;
    initials: string;
    color: AvatarColor;
    avatarUrl?: string;
  }) => void,
): () => void {
  const s = connectSocket();
  s.on("profile:updated", cb);
  return () => s.off("profile:updated", cb);
}

// ── 主动发送事件 ──

export function joinConversation(conversationId: string) {
  connectSocket().emit("conversation:join", conversationId);
}

export function leaveConversation(conversationId: string) {
  connectSocket().emit("conversation:leave", conversationId);
}

export function sendMessage(
  conversationId: string,
  text: string,
  imageUrl?: string,
  fileName?: string,
) {
  connectSocket().emit("message:send", { conversationId, text, imageUrl, fileName });
}

export function emitRead(conversationId: string) {
  connectSocket().emit("message:read", conversationId);
}

export function startTyping(conversationId: string) {
  connectSocket().emit("typing:start", conversationId);
}

export function stopTyping(conversationId: string) {
  connectSocket().emit("typing:stop", conversationId);
}
