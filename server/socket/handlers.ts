import type { Server, Socket } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "../../shared/types.js";
import * as svc from "../services/chatService.js";
import { db } from "../data/store.js";
import { verifyToken } from "../data/authStore.js";

type IO = Server<ClientToServerEvents, ServerToClientEvents>;
type Sock = Socket<ClientToServerEvents, ServerToClientEvents>;

// 每个 socket 当前正在查看的会话（用于 typing 通知范围）
const socketConv = new Map<string, string>();
// 会话 → 正在输入的用户集合
const typingMap = new Map<string, Set<string>>();

/** Socket 连接认证 — 校验 token，失败则拒绝连接 */
export function socketAuthMiddleware(
  socket: Sock,
  next: (err?: Error) => void,
) {
  const token = socket.handshake.auth.token as string | undefined;
  if (!token) {
    return next(new Error("Authentication required"));
  }
  const userId = verifyToken(token);
  if (!userId) {
    return next(new Error("Invalid or expired token"));
  }
  // 将 userId 注入 socket 供后续使用
  (socket as Sock & { userId: string }).userId = userId;
  next();
}

/** 注册 Socket.IO 实时事件 */
export function registerSocketHandlers(io: IO) {
  // 连接认证
  io.use(socketAuthMiddleware);

  io.on("connection", (socket: Sock) => {
    const userId = (socket as Sock & { userId: string }).userId;
    svc.setOnline(socket.id, userId);
    svc.userWentOnline(userId);

    // 加入以 userId 命名的房间，便于按用户精准推送事件（如好友请求）
    socket.join(`user:${userId}`);

    // 广播上线
    io.emit("presence:update", { userId, isOnline: true });
    console.log(`[socket] connected ${socket.id} as ${userId}`);

    // 加入会话房间
    socket.on("conversation:join", (conversationId) => {
      socket.join(`conv:${conversationId}`);
      socketConv.set(socket.id, conversationId);
    });

    // 离开会话房间
    socket.on("conversation:leave", (conversationId) => {
      socket.leave(`conv:${conversationId}`);
      if (socketConv.get(socket.id) === conversationId) {
        socketConv.delete(socket.id);
      }
      clearTyping(io, socket, conversationId, userId);
    });

    // 发送消息 → 持久化并广播给房间
    socket.on("message:send", ({ conversationId, text, imageUrl, fileName }) => {
      const result = svc.createMessage(conversationId, userId, text, userId, imageUrl, fileName);
      if (!result) return;
      const senderMsg = result.message;
      const senderConv = result.conversation;
      const recipientId = senderConv.contactId;

      // 1) 广播给发送方的会话房间（含发送方其它端的回灌）
      io.to(`conv:${conversationId}`).emit("message:new", senderMsg);
      // 2) 更新发送方的会话列表
      io.to(`user:${userId}`).emit("conversation:updated", senderConv);

      // 3) 为接收方创建消息副本（在接收方自己的会话中，isSent: false）
      //    这样接收方刷新页面后 GET /conversations 和 GET /messages 都能拿到正确数据
      if (recipientId && recipientId !== userId && !senderConv.isGroup) {
        // 确保发送方在联系人表中存在（接收方可能尚无此联系人条目）
        svc.ensureContactForAccount(userId);
        // 查找或创建接收方的会话（ownerId = 接收方, contactId = 发送方）
        let recipientConv = svc.findConversationByContact(recipientId, userId);
        if (!recipientConv) {
          recipientConv = svc.ensureConversation(userId, recipientId);
        }
        // 在接收方会话中创建消息副本（含图片附件）
        const recipientResult = svc.createRecipientMessage(
          recipientConv.id,
          userId,
          recipientConv.name,
          text,
          senderMsg.timestamp,
          senderMsg.seq ?? 0,
          imageUrl,
          fileName,
        );
        if (recipientResult) {
          io.to(`user:${recipientId}`).emit("message:new", recipientResult.message);
          io.to(`user:${recipientId}`).emit("conversation:updated", recipientResult.conversation);
        }
      }

      // 发送方停止输入
      clearTyping(io, socket, conversationId, userId);
    });

    // 标记已读 → 广播回执
    socket.on("message:read", (conversationId) => {
      const ids = svc.markConversationRead(conversationId);
      const conv = db.conversations.find((c) => c.id === conversationId);
      // 仅推送给会话归属用户，避免污染其他用户的会话列表
      if (conv?.ownerId) io.to(`user:${conv.ownerId}`).emit("conversation:updated", conv);
      if (ids.length > 0) {
        io.to(`conv:${conversationId}`).emit("message:read", {
          conversationId,
          messageIds: ids,
        });
      }
    });

    // 正在输入
    socket.on("typing:start", (conversationId) => {
      addTyping(conversationId, userId);
      socket.to(`conv:${conversationId}`).emit("typing:update", {
        conversationId,
        userId,
        isTyping: true,
      });
    });

    // 停止输入
    socket.on("typing:stop", (conversationId) => {
      clearTyping(io, socket, conversationId, userId);
    });

    // 断开连接 → 清理在线状态与输入
    socket.on("disconnect", () => {
      const conv = socketConv.get(socket.id);
      if (conv) clearTyping(io, socket, conv, userId);
      const offlineUser = svc.setOffline(socket.id);
      if (offlineUser) {
        io.emit("presence:update", { userId: offlineUser, isOnline: false });
      }
      console.log(`[socket] disconnected ${socket.id}`);
    });
  });

  function addTyping(conversationId: string, userId: string) {
    if (!typingMap.has(conversationId)) typingMap.set(conversationId, new Set());
    typingMap.get(conversationId)!.add(userId);
  }

  function clearTyping(
    io: IO,
    _socket: Sock,
    conversationId: string,
    userId: string,
  ) {
    const set = typingMap.get(conversationId);
    if (!set || !set.has(userId)) return;
    set.delete(userId);
    io.to(`conv:${conversationId}`).emit("typing:update", {
      conversationId,
      userId,
      isTyping: false,
    });
  }
}
