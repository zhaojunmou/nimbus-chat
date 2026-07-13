import type {
  Conversation,
  Message,
  Contact,
  NotificationItem,
  FriendRequest,
  AuthUser,
  AuthResponse,
  RegisterPayload,
  LoginPayload,
} from "../../shared/types";
import { getToken, clearToken } from "./token";
import { disconnectSocket } from "./socket";

/**
 * REST API 客户端 — 通过 Vite 代理转发到后端 :3001
 * 业务接口（/api/me, /api/conversations 等）需携带 JWT token。
 * 认证接口（/api/auth/register, /api/auth/login）无需 token。
 */

/** 构建带 Authorization 头的请求配置 */
function authHeaders(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// 延迟引用 store，避免循环依赖（store.ts 导入 api/client.ts）
let logoutFn: (() => void) | null = null;
export function registerLogoutHandler(fn: () => void) {
  logoutFn = fn;
}

/** 401 时清理认证状态：清 token + 断开 socket + 触发 store 登出 */
function handleUnauthorized() {
  clearToken();
  disconnectSocket();
  logoutFn?.();
}

/** 统一请求封装 — 401 时清理认证状态让路由守卫跳转登录 */
async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...options,
    // 禁用浏览器缓存 — 防止 Edge 等浏览器缓存 API 响应导致刷新后数据丢失
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...options.headers,
    },
  });
  if (res.status === 401) {
    handleUnauthorized();
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error ||
        `${options.method ?? "GET"} ${path} failed: ${res.status}`,
    );
  }
  return res.json() as Promise<T>;
}

function get<T>(path: string): Promise<T> {
  return request<T>(path);
}

function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
}

function patchReq<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

function del<T>(path: string): Promise<T> {
  return request<T>(path, { method: "DELETE" });
}

export const api = {
  // ── 认证（无需 token） ──
  register: (payload: RegisterPayload) =>
    post<AuthResponse>("/auth/register", payload),
  login: (payload: LoginPayload) =>
    post<AuthResponse>("/auth/login", payload),

  // ── 当前用户 ──
  getMe: () => get<AuthUser>("/me"),
  updateMe: (patch: Partial<AuthUser>) => patchReq<AuthUser>("/me", patch),

  // ── 会话 ──
  getConversations: () => get<Conversation[]>("/conversations"),
  deleteConversation: (id: string) => del<{ ok: boolean }>(`/conversations/${id}`),
  pinConversation: (id: string) => post<Conversation>(`/conversations/${id}/pin`),
  muteConversation: (id: string) => post<Conversation>(`/conversations/${id}/mute`),
  ensureConversation: (contactId: string) =>
    post<Conversation>(`/conversations/ensure/${contactId}`),

  // ── 消息 ──
  getMessages: (conversationId: string) =>
    get<Message[]>(`/messages/${conversationId}`),
  markRead: (conversationId: string) =>
    post<{ updated: string[] }>(`/messages/${conversationId}/read`),

  // ── 联系人 ──
  getContacts: () => get<Contact[]>("/contacts"),

  // ── 通知 ──
  getNotifications: () => get<NotificationItem[]>("/notifications"),
  markAllNotificationsRead: () => post<{ ok: boolean }>("/notifications/read-all"),
  markNotificationRead: (id: string) =>
    post<{ ok: boolean }>(`/notifications/${id}/read`),

  // ── 搜索 ──
  searchUsers: (q: string) =>
    get<Contact[]>(`/users/search?q=${encodeURIComponent(q)}`),

  // ── 消息清理 ──
  clearConversationMessages: (conversationId: string) =>
    del<{ ok: boolean }>(`/messages/${conversationId}/clear`),
  clearAllMessages: () => del<{ ok: boolean }>("/messages"),

  // ── 屏蔽联系人 ──
  getBlockedContacts: () => get<Contact[]>("/contacts/blocked"),
  blockContact: (id: string) => post<{ ok: boolean }>(`/contacts/${id}/block`),
  unblockContact: (id: string) =>
    post<{ ok: boolean }>(`/contacts/${id}/unblock`),

  // ── 好友请求 ──
  sendFriendRequest: (contactId: string) =>
    post<{ request: FriendRequest; autoAccepted: boolean }>(
      `/friends/request/${contactId}`,
    ),
  acceptFriendRequest: (requestId: string) =>
    post<{ ok: boolean; request: FriendRequest }>(
      `/friends/accept/${requestId}`,
    ),
  rejectFriendRequest: (requestId: string) =>
    post<{ ok: boolean }>(`/friends/reject/${requestId}`),
  getFriendRequests: () =>
    get<{ incoming: FriendRequest[]; outgoing: FriendRequest[] }>(
      "/friends/requests",
    ),

  // ── 账号 ──
  deleteAccount: () => del<{ ok: boolean }>("/me"),

  // ── 版本 ──
  getVersion: () => get<{ version: string }>("/version"),

  // ── 管理后台 ──
  admin: {
    getStats: () =>
      get<{
        users: number;
        conversations: number;
        messages: number;
        contacts: number;
        notifications: number;
        friendRequests: number;
        onlineUsers: number;
      }>("/admin/stats"),
    getUsers: () => get<AuthUser[]>("/admin/users"),
    updateUser: (id: string, patch: Partial<AuthUser>) =>
      patchReq<AuthUser>(`/admin/users/${id}`, patch),
    deleteUser: (id: string) => del<{ ok: boolean }>(`/admin/users/${id}`),
    getConversations: () => get<Conversation[]>("/admin/conversations"),
    deleteConversation: (id: string) =>
      del<{ ok: boolean }>(`/admin/conversations/${id}`),
    getMessages: (conversationId?: string) =>
      get<Message[]>(
        `/admin/messages${conversationId ? `?conversationId=${conversationId}` : ""}`,
      ),
    deleteMessage: (id: string) => del<{ ok: boolean }>(`/admin/messages/${id}`),
    getContacts: () => get<Contact[]>("/admin/contacts"),
    deleteContact: (id: string) => del<{ ok: boolean }>(`/admin/contacts/${id}`),
    getNotifications: () => get<NotificationItem[]>("/admin/notifications"),
    deleteNotification: (id: string) =>
      del<{ ok: boolean }>(`/admin/notifications/${id}`),
    getFriendRequests: () => get<FriendRequest[]>("/admin/friend-requests"),
    deleteFriendRequest: (id: string) =>
      del<{ ok: boolean }>(`/admin/friend-requests/${id}`),
  },
};
