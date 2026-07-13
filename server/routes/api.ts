import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "../data/store.js";
import * as svc from "../services/chatService.js";
import { updateAccount } from "../data/authStore.js";
import { getRequestUserId } from "../middleware/auth.js";
import type { Server } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  AuthUser,
  Contact,
  Message,
} from "../../shared/types.js";

/** 已认证请求类型 */
type AuthedRequest = Request & { userId?: string; authUser?: AuthUser };

/**
 * REST API 路由工厂 — 提供初始数据拉取与写操作。
 * 注入 io 实例以便在 REST 路由中也能广播实时事件（如模拟对方回复）。
 */
export function createApiRouter(
  io?: Server<ClientToServerEvents, ServerToClientEvents>,
) {
  const apiRouter = Router();

  // 所有 API 响应禁用缓存 — 防止浏览器（特别是 Edge）缓存 API 响应导致刷新后数据丢失
  apiRouter.use((req, res, next) => {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    next();
  });

  // 当前用户（从认证上下文取）
  apiRouter.get("/me", (req: AuthedRequest, res: Response) => {
    res.json(req.authUser);
  });

  apiRouter.patch("/me", (req: AuthedRequest, res: Response) => {
    const userId = getRequestUserId(req)!;
    const updated = updateAccount(userId, req.body as Partial<AuthUser>);
    // 同步账号资料到 Contact/Conversation 表，并通知所有对话方刷新
    svc.syncAccountProfile(userId);
    res.json(updated);
  });

  // 会话列表（按 ownerId 隔离）
  apiRouter.get("/conversations", (req: AuthedRequest, res: Response) => {
    const userId = getRequestUserId(req)!;
    res.json(db.conversations.filter((c) => c.ownerId === userId));
  });

  apiRouter.delete("/conversations/:id", (req, res) => {
    svc.deleteConversation(req.params.id);
    res.json({ ok: true });
  });

  apiRouter.post("/conversations/:id/pin", (req, res) => {
    const conv = svc.togglePinned(req.params.id);
    res.json(conv);
  });

  apiRouter.post("/conversations/:id/mute", (req, res) => {
    const conv = svc.toggleMuted(req.params.id);
    res.json(conv);
  });

  // 获取或创建与会话（按联系人 id）— 防止向不存在的会话发消息被丢弃
  apiRouter.post("/conversations/ensure/:contactId", (req: AuthedRequest, res: Response) => {
    const userId = getRequestUserId(req)!;
    const conv = svc.ensureConversation(req.params.contactId as string, userId);
    res.json(conv);
  });

  // 某会话的消息 — 合并双方会话副本中的消息（历史数据兼容），根据请求者 ID 修正 isSent
  apiRouter.get("/messages/:conversationId", (req: AuthedRequest, res: Response) => {
    const userId = getRequestUserId(req)!;
    const conv = db.conversations.find((c) => c.id === req.params.conversationId);
    // 收集本会话消息，并记录其在 db.messages 中的原始索引
    // （旧数据没有 seq，用原始索引作为稳定排序回退，因为消息按创建时间追加，索引即全局时间顺序）
    type IndexedMessage = Message & { _origIndex: number };
    const indexedDb = db.messages.map((m, i) => ({ m, i }));
    let msgs: IndexedMessage[] = indexedDb
      .filter(({ m }) => m.conversationId === req.params.conversationId)
      .map(({ m, i }) => ({ ...m, _origIndex: i }));
    // 若有对端会话（接收方/发送方各自的副本），合并对端消息以兼容历史数据
    if (conv?.contactId && conv?.ownerId) {
      const otherConv = db.conversations.find(
        (c) => c.ownerId === conv.contactId && c.contactId === conv.ownerId,
      );
      if (otherConv) {
        const otherMsgs: IndexedMessage[] = indexedDb
          .filter(({ m }) => m.conversationId === otherConv.id)
          .map(({ m, i }) => ({ ...m, _origIndex: i }));
        // 合并并去重：
        // - 有 seq 的消息按 seq 去重（发送方副本和接收方副本 seq 相同）
        // - 无 seq 的旧数据按 senderId+text+timestamp 去重
        const seenSeq = new Set<number>();
        const seenKey = new Set<string>();
        for (const m of msgs) {
          if (m.seq && m.seq > 0) seenSeq.add(m.seq);
          else seenKey.add(`${m.senderId}|${m.text}|${m.timestamp}`);
        }
        for (const m of otherMsgs) {
          if (m.seq && m.seq > 0) {
            if (!seenSeq.has(m.seq)) {
              seenSeq.add(m.seq);
              msgs.push(m);
            }
          } else {
            const key = `${m.senderId}|${m.text}|${m.timestamp}`;
            if (!seenKey.has(key)) {
              seenKey.add(key);
              msgs.push(m);
            }
          }
        }
      }
    }
    // 排序：seq 升序优先；seq 相同（含均为 0 的旧数据）按 db.messages 原始索引升序
    msgs.sort((a, b) => {
      const seqA = a.seq ?? 0;
      const seqB = b.seq ?? 0;
      if (seqA !== seqB) return seqA - seqB;
      return a._origIndex - b._origIndex;
    });
    // 根据请求者 ID 修正 isSent 和 conversationId（剥离内部排序字段 _origIndex）
    const list = msgs.map(({ _origIndex: _ignored, ...m }) => ({
      ...m,
      conversationId: req.params.conversationId,
      isSent: m.senderId === userId,
    }));
    res.json(list);
  });

  // 标记会话已读（REST 兜底，实时走 socket）
  apiRouter.post("/messages/:conversationId/read", (req, res) => {
    const ids = svc.markConversationRead(req.params.conversationId);
    res.json({ updated: ids });
  });

  // 模拟对方回复 — 演示双向实时通信
  apiRouter.post("/messages/:conversationId/reply", (req: AuthedRequest, res: Response) => {
    const { text } = req.body as { text: string; senderId?: string };
    const currentUserId = getRequestUserId(req)!;
    const conversationId = req.params.conversationId as string;
    // 从会话中取 contactId 作为回复者 id
    const conv = db.conversations.find((c) => c.id === conversationId);
    if (!conv) {
      res.status(404).json({ error: "conversation not found" });
      return;
    }
    const senderId = conv.contactId ?? conv.id;
    const result = svc.createMessage(conversationId, senderId, text, currentUserId);
    if (!result) {
      res.status(404).json({ error: "conversation not found" });
      return;
    }
    // 广播给该会话房间的所有客户端
    io?.to(`conv:${conversationId}`).emit(
      "message:new",
      result.message,
    );
    // 仅推送给会话归属用户
    io?.to(`user:${currentUserId}`).emit("conversation:updated", result.conversation);
    res.json({ ok: true });
  });

  // 联系人（好友列表 — 按 ownerId 隔离）
  apiRouter.get("/contacts", (req: AuthedRequest, res: Response) => {
    const userId = getRequestUserId(req)!;
    res.json(svc.getFriends(userId));
  });

  // 通知（按 ownerId 隔离）
  apiRouter.get("/notifications", (req: AuthedRequest, res: Response) => {
    const userId = getRequestUserId(req)!;
    res.json(db.notifications.filter((n) => n.ownerId === userId));
  });

  apiRouter.post("/notifications/read-all", (req: AuthedRequest, res: Response) => {
    const userId = getRequestUserId(req)!;
    svc.markAllNotificationsRead(userId);
    res.json({ ok: true });
  });

  apiRouter.post("/notifications/:id/read", (req: AuthedRequest, res: Response) => {
    const userId = getRequestUserId(req)!;
    svc.markNotificationRead(req.params.id as string, userId);
    res.json({ ok: true });
  });

  // ── 搜索 ──
  // 搜索可添加的联系人（按显示名/邮箱模糊匹配，排除自己、已加好友、群组）
  apiRouter.get("/users/search", (req: AuthedRequest, res: Response) => {
    const q = (req.query.q as string | undefined)?.trim().toLowerCase();
    const myId = getRequestUserId(req)!;
    if (!q || q.length < 1) {
      res.json([]);
      return;
    }
    // 排除已是好友的、群组（群组无需好友请求）
    const results: Contact[] = db.contacts
      .filter((c) => c.id !== myId)
      .filter((c) => !c.isGroup)
      .filter((c) => !svc.areFriends(myId, c.id))
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.email && c.email.toLowerCase().includes(q)),
      )
      .slice(0, 10);
    res.json(results);
  });

  // ── 会话消息清理 ──
  // 清空某个会话的消息
  apiRouter.delete("/messages/:conversationId/clear", (req, res) => {
    const ok = svc.clearConversationMessages(req.params.conversationId);
    if (!ok) {
      res.status(404).json({ error: "conversation not found" });
      return;
    }
    const clearedConv = db.conversations.find((c) => c.id === req.params.conversationId);
    if (clearedConv?.ownerId) {
      io?.to(`user:${clearedConv.ownerId}`).emit("conversation:updated", { ...clearedConv });
    }
    res.json({ ok: true });
  });

  // 清空所有消息（危险操作，按用户隔离）
  apiRouter.delete("/messages", (req: AuthedRequest, res: Response) => {
    const userId = getRequestUserId(req)!;
    svc.clearAllMessages(userId);
    db.conversations
      .filter((c) => c.ownerId === userId)
      .forEach((c) => io?.to(`user:${userId}`).emit("conversation:updated", c));
    res.json({ ok: true });
  });

  // ── 屏蔽联系人（按用户隔离）──
  apiRouter.get("/contacts/blocked", (req: AuthedRequest, res: Response) => {
    const userId = getRequestUserId(req)!;
    res.json(svc.getBlockedContacts(userId));
  });

  apiRouter.post("/contacts/:id/block", (req: AuthedRequest, res: Response) => {
    const userId = getRequestUserId(req)!;
    const ok = svc.blockContact(req.params.id as string, userId);
    if (!ok) {
      res.status(404).json({ error: "contact not found" });
      return;
    }
    res.json({ ok: true });
  });

  apiRouter.post("/contacts/:id/unblock", (req: AuthedRequest, res: Response) => {
    const userId = getRequestUserId(req)!;
    const ok = svc.unblockContact(req.params.id as string, userId);
    if (!ok) {
      res.status(404).json({ error: "contact not found" });
      return;
    }
    res.json({ ok: true });
  });

  // ── 好友请求 ──
  // 发送好友请求
  apiRouter.post("/friends/request/:contactId", (req: AuthedRequest, res: Response) => {
    const userId = getRequestUserId(req)!;
    const result = svc.sendFriendRequest(userId, req.params.contactId as string);
    if ("error" in result) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json(result);
  });

  // 接受好友请求
  apiRouter.post("/friends/accept/:requestId", (req: AuthedRequest, res: Response) => {
    const userId = getRequestUserId(req)!;
    const req_ = svc.acceptFriendRequest(req.params.requestId as string, userId);
    if (!req_) {
      res.status(404).json({ error: "Request not found or cannot accept" });
      return;
    }
    res.json({ ok: true, request: req_ });
  });

  // 拒绝好友请求
  apiRouter.post("/friends/reject/:requestId", (req: AuthedRequest, res: Response) => {
    const userId = getRequestUserId(req)!;
    const req_ = svc.rejectFriendRequest(req.params.requestId as string, userId);
    if (!req_) {
      res.status(404).json({ error: "Request not found or cannot reject" });
      return;
    }
    res.json({ ok: true });
  });

  // 获取好友请求列表（incoming + outgoing）
  apiRouter.get("/friends/requests", (req: AuthedRequest, res: Response) => {
    const userId = getRequestUserId(req)!;
    const incoming = svc.getIncomingRequests(userId);
    const outgoing = svc.getOutgoingRequests(userId);
    res.json({ incoming, outgoing });
  });

  // ── 删除账号 ──
  apiRouter.delete("/me", (req: AuthedRequest, res) => {
    const userId = getRequestUserId(req);
    // 演示：仅返回成功，实际不真正删除 seed 账号
    void userId;
    res.json({ ok: true });
  });

  // ── 版本信息 ──
  apiRouter.get("/version", (_req, res) => {
    res.json({ version: "2.1.0" });
  });

  // ── 群聊管理 ──
  // 创建群聊
  apiRouter.post("/groups", (req: AuthedRequest, res: Response) => {
    const userId = getRequestUserId(req)!;
    const { name, memberIds } = req.body as { name: string; memberIds: string[] };
    const result = svc.createGroup(userId, name, memberIds);
    if ("error" in result) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json(result);
  });

  // 获取群聊信息
  apiRouter.get("/groups/:id", (req, res) => {
    const group = svc.getGroup(req.params.id);
    if (!group) {
      res.status(404).json({ error: "Group not found" });
      return;
    }
    res.json(group);
  });

  // 获取群成员列表
  apiRouter.get("/groups/:id/members", (req, res) => {
    const members = svc.getGroupMembers(req.params.id);
    res.json(members);
  });

  // 添加群成员
  apiRouter.post("/groups/:id/members", (req: AuthedRequest, res: Response) => {
    const userId = getRequestUserId(req)!;
    const { memberIds } = req.body as { memberIds: string[] };
    const result = svc.addGroupMember(req.params.id, userId, memberIds);
    if ("error" in result) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json(result);
  });

  // 移除群成员
  apiRouter.delete("/groups/:id/members/:userId", (req: AuthedRequest, res: Response) => {
    const operatorId = getRequestUserId(req)!;
    const result = svc.removeGroupMember(req.params.id, operatorId, req.params.userId);
    if ("error" in result) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json(result);
  });

  // 退出群聊
  apiRouter.post("/groups/:id/leave", (req: AuthedRequest, res: Response) => {
    const userId = getRequestUserId(req)!;
    const result = svc.leaveGroup(req.params.id, userId);
    if ("error" in result) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json(result);
  });

  // 更新群聊信息
  apiRouter.patch("/groups/:id", (req: AuthedRequest, res: Response) => {
    const userId = getRequestUserId(req)!;
    const { name } = req.body as { name?: string };
    const result = svc.updateGroupInfo(req.params.id, userId, { name });
    if ("error" in result) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json(result);
  });

  return apiRouter;
}
