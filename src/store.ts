import { create } from "zustand";
import type {
  Conversation,
  Message,
  NotificationItem,
  FriendRequest,
  AuthUser,
  RegisterPayload,
  LoginPayload,
  AvatarColor,
} from "../shared/types";
import { api, registerLogoutHandler } from "./api/client";
import {
  connectSocket,
  disconnectSocket,
  joinConversation,
  leaveConversation,
  sendMessage as socketSend,
  emitRead,
  onNewMessage,
  onConversationUpdated,
  onTyping,
  onPresence,
  onMessageRead,
  onFriendRequestNew,
  onFriendRequestUpdate,
  onProfileUpdated,
  registerSocketAuthFailedHandler,
  setActiveConversationForReconnect,
  getSocket,
} from "./api/socket";
import { getToken, setToken, setStoredUser, clearToken } from "./api/token";

interface AppState {
  // 认证状态
  isAuthenticated: boolean;
  authReady: boolean; // 认证初始化完成（无论成功失败）
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;

  // 应用数据初始化（登录后）
  initialized: boolean;
  init: () => Promise<void>;

  // 当前选中的会话
  activeConversationId: string | null;
  setActiveConversation: (id: string | null) => void;

  // 会话列表
  conversations: Conversation[];
  markConversationRead: (id: string) => void;
  deleteConversation: (id: string) => Promise<void>;
  togglePin: (id: string) => Promise<void>;
  toggleMute: (id: string) => Promise<void>;
  ensureConversation: (contactId: string) => Promise<Conversation>;

  // 消息（按会话 id 分组缓存）
  messagesByConv: Record<string, Message[]>;
  loadMessages: (conversationId: string) => Promise<void>;
  sendText: (conversationId: string, text: string) => boolean;
  sendImage: (conversationId: string, file: File) => Promise<boolean>;
  clearMessages: (conversationId: string) => Promise<void>;
  clearAllMessages: () => Promise<void>;

  // 通知
  notifications: NotificationItem[];
  markAllNotificationsRead: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;

  // 好友请求
  incomingRequests: FriendRequest[];
  outgoingRequests: FriendRequest[];
  loadFriendRequests: () => Promise<void>;
  sendFriendRequest: (contactId: string) => Promise<{ autoAccepted: boolean }>;
  acceptFriendRequest: (requestId: string) => Promise<void>;
  rejectFriendRequest: (requestId: string) => Promise<void>;

  // 移动端侧边栏抽屉
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;

  // 用户资料
  user: AuthUser | null;
  updateUser: (patch: Partial<AuthUser>) => Promise<void>;

  // 输入指示：conversationId → 是否对方正在输入
  typingMap: Record<string, boolean>;
}

// 对方联系人 → 模拟自动回复（演示实时双向通信）
const autoReplies: Record<string, string[]> = {
  alex: ["Got it, thanks!", "Sounds good to me 👍", "Let me check and get back to you.", "Perfect, talk soon!"],
  maya: ["Nice work!", "I'll review it shortly.", "Agreed.", "👍"],
  liam: ["Sure thing.", "On it.", "Will do."],
  "design-team": ["Sarah: Looks great!", "Sarah: Pushing the update now."],
  engineering: ["Build #4522 started.", "Tests passing ✅"],
  "project-alpha": ["Noted, thanks for the update."],
};

// 防止重复订阅实时事件（login/register 多次调用时）
let realtimeSubscribed = false;

// 正在加载消息的会话集合 — 防止 StrictMode 双调用导致重复请求
const loadingConvs = new Set<string>();

export const useAppStore = create<AppState>((set, get) => ({
  isAuthenticated: !!getToken(),
  authReady: false,

  login: async (payload) => {
    const { token, user } = await api.login(payload);
    setToken(token);
    setStoredUser(user);
    set({ user, isAuthenticated: true });
    await bootstrapAppData(set, get);
  },

  register: async (payload) => {
    const { token, user } = await api.register(payload);
    setToken(token);
    setStoredUser(user);
    set({ user, isAuthenticated: true });
    await bootstrapAppData(set, get);
  },

  logout: () => {
    clearToken();
    disconnectSocket();
    realtimeSubscribed = false;
    set({
      isAuthenticated: false,
      authReady: true,
      initialized: false,
      user: null,
      conversations: [],
      notifications: [],
      messagesByConv: {},
      activeConversationId: null,
      typingMap: {},
      sidebarOpen: false,
      incomingRequests: [],
      outgoingRequests: [],
    });
  },

  initialized: false,

  init: async () => {
    if (get().authReady) return;
    const token = getToken();
    if (!token) {
      // 未登录 — 等待用户在登录页提交
      set({ authReady: true });
      return;
    }
    try {
      const user = await api.getMe();
      // 注意：不在此处设置 authReady: true，等 bootstrapAppData 完成后再设置
      // 否则 RequireAuth 会提前渲染子组件，此时 conversations 还是空的
      set({ user, isAuthenticated: true });
    } catch {
      // getMe 失败 = token 失效 — 清除并等待重新登录
      clearToken();
      set({ isAuthenticated: false, authReady: true });
      return;
    }
    // bootstrapAppData 失败不等于 token 失效 — 保留认证状态，允许后续重试
    try {
      await bootstrapAppData(set, get);
    } catch (err) {
      console.error("[init] bootstrapAppData failed, retrying:", err);
      // 重试一次（可能是服务端刚重启导致的暂时性失败）
      try {
        await new Promise((r) => setTimeout(r, 500));
        await bootstrapAppData(set, get);
      } catch (err2) {
        console.error("[init] bootstrapAppData retry failed:", err2);
        // 保留认证状态，允许用户手动刷新重试
        set({ authReady: true });
      }
    }
  },

  activeConversationId: null,
  setActiveConversation: (id) => {
    const prev = get().activeConversationId;
    if (prev && prev !== id) leaveConversation(prev);
    if (id) {
      joinConversation(id);
      get().markConversationRead(id);
    }
    // 记录当前活动会话，供 socket 重连后重新加入房间
    setActiveConversationForReconnect(id);
    set({ activeConversationId: id });
  },

  conversations: [],
  markConversationRead: (id) => {
    emitRead(id);
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === id ? { ...c, unreadCount: 0 } : c,
      ),
      // 本地同步已读状态，避免等待 socket 回执导致已读对勾延迟
      messagesByConv: s.messagesByConv[id]
        ? {
            ...s.messagesByConv,
            [id]: s.messagesByConv[id].map((m) =>
              m.isSent && !m.isRead ? { ...m, isRead: true } : m,
            ),
          }
        : s.messagesByConv,
    }));
  },
  deleteConversation: async (id) => {
    await api.deleteConversation(id);
    set((s) => ({
      conversations: s.conversations.filter((c) => c.id !== id),
      activeConversationId:
        s.activeConversationId === id ? null : s.activeConversationId,
    }));
  },
  togglePin: async (id) => {
    await api.pinConversation(id);
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === id ? { ...c, isPinned: !c.isPinned } : c,
      ),
    }));
  },
  toggleMute: async (id) => {
    await api.muteConversation(id);
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === id ? { ...c, isMuted: !c.isMuted } : c,
      ),
    }));
  },
  ensureConversation: async (contactId) => {
    const conv = await api.ensureConversation(contactId);
    set((s) => ({
      conversations: s.conversations.some((c) => c.id === conv.id)
        ? s.conversations.map((c) => (c.id === conv.id ? { ...c, ...conv } : c))
        : [conv, ...s.conversations],
    }));
    return conv;
  },

  messagesByConv: {},
  loadMessages: async (conversationId) => {
    if (get().messagesByConv[conversationId]) return;
    if (loadingConvs.has(conversationId)) return;
    loadingConvs.add(conversationId);
    try {
      const list = await api.getMessages(conversationId);
      set((s) => ({
        messagesByConv: { ...s.messagesByConv, [conversationId]: list },
      }));
    } catch (err) {
      console.error("[loadMessages] failed for", conversationId, err);
    } finally {
      loadingConvs.delete(conversationId);
    }
  },
  sendText: (conversationId, text) => {
    // 检查 socket 连接状态，断开时拒绝发送并提示
    const sock = getSocket();
    if (!sock || !sock.connected) {
      return false;
    }
    // 通过 socket 发送，消息会经服务端广播后回灌
    socketSend(conversationId, text);
    // 演示：1.5s 后让对方自动回复（仅非群组且有预设回复时）
    triggerAutoReply(conversationId);
    return true;
  },
  sendImage: async (conversationId, file) => {
    const sock = getSocket();
    if (!sock || !sock.connected) {
      return false;
    }
    // 压缩图片为 data URL（控制大小，避免 store.json 膨胀）
    const dataUrl = await compressImage(file, 1280, 0.85);
    // 通过 socket 发送图片消息
    socketSend(conversationId, "", dataUrl, file.name);
    return true;
  },
  clearMessages: async (conversationId) => {
    await api.clearConversationMessages(conversationId);
    set((s) => ({
      messagesByConv: { ...s.messagesByConv, [conversationId]: [] },
      conversations: s.conversations.map((c) =>
        c.id === conversationId
          ? { ...c, lastMessage: "", lastTime: "" }
          : c,
      ),
    }));
  },
  clearAllMessages: async () => {
    await api.clearAllMessages();
    set((s) => ({
      messagesByConv: {},
      conversations: s.conversations.map((c) => ({
        ...c,
        lastMessage: "",
        lastTime: "",
        unreadCount: 0,
      })),
    }));
  },

  notifications: [],
  markAllNotificationsRead: async () => {
    await api.markAllNotificationsRead();
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, isRead: true })),
    }));
  },
  markNotificationRead: async (id) => {
    await api.markNotificationRead(id);
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n,
      ),
    }));
  },

  incomingRequests: [],
  outgoingRequests: [],
  loadFriendRequests: async () => {
    const { incoming, outgoing } = await api.getFriendRequests();
    set({ incomingRequests: incoming, outgoingRequests: outgoing });
  },
  sendFriendRequest: async (contactId) => {
    const { autoAccepted } = await api.sendFriendRequest(contactId);
    // 刷新好友请求列表
    const { incoming, outgoing } = await api.getFriendRequests();
    set({ incomingRequests: incoming, outgoingRequests: outgoing });
    return { autoAccepted };
  },
  acceptFriendRequest: async (requestId) => {
    await api.acceptFriendRequest(requestId);
    // 刷新好友请求列表
    const { incoming, outgoing } = await api.getFriendRequests();
    set({ incomingRequests: incoming, outgoingRequests: outgoing });
  },
  rejectFriendRequest: async (requestId) => {
    await api.rejectFriendRequest(requestId);
    // 刷新好友请求列表
    const { incoming, outgoing } = await api.getFriendRequests();
    set({ incomingRequests: incoming, outgoingRequests: outgoing });
  },

  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  user: null,
  updateUser: async (patch) => {
    const updated = await api.updateMe(patch);
    setStoredUser(updated);
    set({ user: updated });
  },

  typingMap: {},
}));

// 注册 401 处理器 — API 返回 401 时触发登出（跳转登录页）
registerLogoutHandler(() => {
  console.warn("[auth] 401 logout triggered — clearing state");
  useAppStore.setState({
    isAuthenticated: false,
    authReady: true,
    initialized: false,
    user: null,
    conversations: [],
    notifications: [],
    messagesByConv: {},
    activeConversationId: null,
    typingMap: {},
    sidebarOpen: false,
  });
  realtimeSubscribed = false;
});

// socket 鉴权失败（token 过期）→ 同样触发登出
registerSocketAuthFailedHandler(() => {
  console.warn("[auth] socket auth failed triggered — clearing state");
  useAppStore.setState({
    isAuthenticated: false,
    authReady: true,
    initialized: false,
    user: null,
    conversations: [],
    notifications: [],
    messagesByConv: {},
    activeConversationId: null,
    typingMap: {},
    sidebarOpen: false,
  });
  realtimeSubscribed = false;
});

// ── 登录后加载应用数据 + 建立实时连接 ──

type SetFn = (
  partial: Partial<AppState> | ((s: AppState) => Partial<AppState>),
) => void;

async function bootstrapAppData(
  set: SetFn,
  get: () => AppState,
) {
  console.log("[bootstrap] loading app data...");
  // 使用 allSettled 容错 — 某个 API 失败不影响其他数据加载
  const results = await Promise.allSettled([
    api.getConversations(),
    api.getNotifications(),
    api.getFriendRequests(),
  ]);

  const conversations = results[0].status === "fulfilled" ? results[0].value : [];
  const notifications = results[1].status === "fulfilled" ? results[1].value : [];
  const friendReqs = results[2].status === "fulfilled"
    ? results[2].value
    : { incoming: [] as FriendRequest[], outgoing: [] as FriendRequest[] };

  const errors = results
    .map((r, i) => (r.status === "rejected" ? `[${i}] ${r.reason?.message}` : null))
    .filter(Boolean);
  if (errors.length > 0) {
    console.warn("[bootstrap] some APIs failed:", errors);
  }
  console.log("[bootstrap] loaded:", {
    conversations: conversations.length,
    notifications: notifications.length,
    friendReqs: friendReqs.incoming.length + friendReqs.outgoing.length,
  });

  // 先建立 socket 连接和订阅实时事件，再设置 authReady
  // 这样子组件渲染时 socket 已创建、订阅已完成
  try {
    connectSocket();
    if (!realtimeSubscribed) {
      subscribeRealtime(set, get);
      realtimeSubscribed = true;
    }
  } catch (err) {
    console.error("[bootstrap] socket setup failed:", err);
  }

  // 最后设置数据和 authReady — 触发子组件渲染
  set({
    conversations,
    notifications,
    incomingRequests: friendReqs.incoming,
    outgoingRequests: friendReqs.outgoing,
    initialized: true,
    authReady: true,
  });
}

// ── 实时事件订阅 ──

function subscribeRealtime(
  set: SetFn,
  get: () => AppState,
) {
  const currentUserId = get().user?.id;

  // 新消息到达 → 追加到对应会话的消息列表
  onNewMessage((msg) => {
    // 根据当前用户修正 isSent（服务端按发送者设置，接收方需要翻转）
    const myId = get().user?.id;
    const correctedMsg = myId && msg.senderId !== myId
      ? { ...msg, isSent: false }
      : msg;
    set((s) => {
      const list = s.messagesByConv[correctedMsg.conversationId] ?? [];
      // 去重（多端会收到自己发出的消息回灌）
      if (list.some((m) => m.id === correctedMsg.id)) return {};
      return {
        messagesByConv: {
          ...s.messagesByConv,
          [correctedMsg.conversationId]: [...list, correctedMsg],
        },
      };
    });
    // 未读数由 conversation:updated 事件携带（服务端已 +1），此处不重复累加
    // 若消息来自对方且用户正在查看该会话 → 标记已读（重置未读数）
    const active = get().activeConversationId;
    if (!correctedMsg.isSent && active === correctedMsg.conversationId) {
      get().markConversationRead(correctedMsg.conversationId);
    }
  });

  // 会话列表更新（最后消息/未读数变化）— 若本地没有该会话则添加
  onConversationUpdated((conv) => {
    const myId = get().user?.id;
    // 忽略不属于当前用户的会话（防止发送方视角的会话数据污染接收方列表）
    if (myId && conv.ownerId && conv.ownerId !== myId) return;
    const active = get().activeConversationId;
    set((s) => {
      const exists = s.conversations.some((c) => c.id === conv.id);
      if (exists) {
        // 仅更新消息相关字段，不覆盖 ownerId/contactId 等归属字段
        // 若用户正在查看该会话 → 未读数保持 0（不覆盖）
        return {
          conversations: s.conversations.map((c) =>
            c.id === conv.id
              ? {
                  ...c,
                  lastMessage: conv.lastMessage,
                  lastTime: conv.lastTime,
                  unreadCount: active === conv.id ? 0 : conv.unreadCount,
                  isOnline: conv.isOnline,
                  isPinned: conv.isPinned ?? c.isPinned,
                  isMuted: conv.isMuted ?? c.isMuted,
                  // 同步对方资料字段（头像/昵称/首字母/配色）
                  name: conv.name,
                  initials: conv.initials,
                  color: conv.color,
                  avatarUrl: conv.avatarUrl,
                }
              : c,
          ),
        };
      }
      // 新会话（如对方发来的消息触发）— 添加到列表
      // 若用户正在查看该会话 → 未读数为 0
      return {
        conversations: [
          ...s.conversations,
          active === conv.id ? { ...conv, unreadCount: 0 } : conv,
        ],
      };
    });
  });

  // 输入指示
  onTyping(({ conversationId, userId, isTyping }) => {
    if (currentUserId && userId === currentUserId) return; // 忽略自己
    set((s) => ({
      typingMap: { ...s.typingMap, [conversationId]: isTyping },
    }));
    if (isTyping) {
      // 3s 后自动清除
      setTimeout(() => {
        if (get().typingMap[conversationId]) {
          set((s) => ({
            typingMap: { ...s.typingMap, [conversationId]: false },
          }));
        }
      }, 3000);
    }
  });

  // 在线状态变化 → 按 contactId 匹配会话（新会话 id 为 nanoid，需用 contactId）
  onPresence(({ userId, isOnline }) => {
    set((s) => ({
      conversations: s.conversations.map((c) =>
        (c.contactId ?? c.id) === userId ? { ...c, isOnline } : c,
      ),
    }));
  });

  // 已读回执
  onMessageRead(({ conversationId, messageIds }) => {
    set((s) => {
      const list = s.messagesByConv[conversationId];
      if (!list) return {};
      return {
        messagesByConv: {
          ...s.messagesByConv,
          [conversationId]: list.map((m) =>
            messageIds.includes(m.id) ? { ...m, isRead: true } : m,
          ),
        },
      };
    });
  });

  // 收到新的好友请求 → 刷新请求列表
  onFriendRequestNew(() => {
    get().loadFriendRequests();
  });

  // 好友请求状态变更（对方接受/拒绝）→ 刷新请求列表
  onFriendRequestUpdate(() => {
    get().loadFriendRequests();
  });

  // 联系人资料变更（对方更新了头像/昵称等）→ 更新会话列表 + 刷新好友请求
  onProfileUpdated(({ userId, name, initials, color, avatarUrl }) => {
    set((s) => ({
      conversations: s.conversations.map((c) =>
        (c.contactId ?? c.id) === userId
          ? { ...c, name, initials, color, avatarUrl }
          : c,
      ),
    }));
    // 好友请求列表中发起方资料也需刷新（头像/昵称可能已变）
    get().loadFriendRequests();
  });
}

// ── 演示：自动回复 ──

function triggerAutoReply(conversationId: string) {
  // 新会话 id 为 nanoid，需通过 contactId 查 autoReplies
  const conv = useAppStore.getState().conversations.find((c) => c.id === conversationId);
  const contactId = conv?.contactId ?? conversationId;
  const replies = autoReplies[contactId];
  if (!replies) return;
  setTimeout(() => {
    // 通过 socket 触发对方回复（模拟对方发消息）
    const text = replies[Math.floor(Math.random() * replies.length)];
    // 这里走 socket 的 message:send 会被当作当前用户发送，所以用 fetch 直接触发服务端创建对方消息
    // senderId 由服务端从 conv.contactId 取，无需前端传
    const token = getToken();
    fetch(`/api/messages/${conversationId}/reply`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ text }),
    }).catch(() => {});
  }, 1500);
}

// ── 图片压缩 — 将 File 压缩为 base64 data URL ──

/**
 * 压缩图片文件为 JPEG data URL。
 * 使用 canvas 缩放到 maxSize 以内，控制质量和体积。
 */
function compressImage(file: File, maxSize: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Failed to load image"));
      img.onload = () => {
        // 保持宽高比缩放
        let { width, height } = img;
        if (width > height && width > maxSize) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else if (height > maxSize) {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas not supported"));
          return;
        }
        // 白底（防止 PNG 透明通道转 JPEG 变黑）
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// 头像配色（供组件按需引用）
export const avatarColors: AvatarColor[] = [
  "brand",
  "violet",
  "coral",
  "amber",
  "cyan",
  "teal",
];
