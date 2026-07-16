import { Router } from "express";
import type { Request, Response } from "express";
import type { Server } from "socket.io";
import { db, persistDb } from "../data/store.js";
import {
  listAccounts,
  adminUpdateAccount,
  deleteAccount,
} from "../data/authStore.js";
import * as svc from "../services/chatService.js";
import type {
  AuthUser,
  AvatarColor,
  NotificationItem,
  ClientToServerEvents,
  ServerToClientEvents,
} from "../../shared/types.js";
import { nanoid } from "nanoid";

/** 已认证请求类型 */
type AuthedRequest = Request & { userId?: string; authUser?: AuthUser };
type IO = Server<ClientToServerEvents, ServerToClientEvents>;

/**
 * 管理后台 API 路由 — 需 authMiddleware + requireAdmin 前置
 * 提供对所有数据的查看与管理能力。
 * 注入 io 实例以便广播系统通知等实时事件。
 */
export function createAdminRouter(io?: IO) {
  const adminRouter = Router();

  // ── 仪表盘统计 ──
  adminRouter.get("/stats", (_req: AuthedRequest, res: Response) => {
    const accounts = listAccounts();
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const activeUserIds = new Set<string>();
    for (const m of db.messages) {
      if (m.createdAt) {
        const age = now - new Date(m.createdAt).getTime();
        if (age <= 7 * dayMs) activeUserIds.add(m.senderId);
      }
    }
    const newUsersThisWeek = accounts.filter((a) =>
      a.createdAt && now - new Date(a.createdAt).getTime() <= 7 * dayMs,
    ).length;
    res.json({
      users: accounts.length,
      conversations: db.conversations.length,
      messages: db.messages.length,
      contacts: db.contacts.length,
      notifications: db.notifications.length,
      friendRequests: db.friendRequests.length,
      onlineUsers: db.onlineSockets.size,
      activeUsers7d: activeUserIds.size,
      newUsers7d: newUsersThisWeek,
      disabledUsers: accounts.filter((a) => a.disabled).length,
      adminUsers: accounts.filter((a) => a.role === "admin").length,
    });
  });

  // ── 仪表盘分析数据（图表用） ──
  adminRouter.get("/analytics", (_req: AuthedRequest, res: Response) => {
    const days = 14;
    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;
    // 以"今天 00:00"为终点往前推 14 天
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const accounts = listAccounts();
    const messages = db.messages;

    // 每天的新增用户数
    const newUsersByDay: { date: string; count: number }[] = [];
    // 每天的消息数
    const messagesByDay: { date: string; count: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const dayStart = todayStart - i * dayMs;
      const dayEnd = dayStart + dayMs;
      const dateLabel = new Date(dayStart).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      const userCount = accounts.filter((a) => {
        if (!a.createdAt) return false;
        const t = new Date(a.createdAt).getTime();
        return t >= dayStart && t < dayEnd;
      }).length;
      const msgCount = messages.filter((m) => {
        if (!m.createdAt) return false;
        const t = new Date(m.createdAt).getTime();
        return t >= dayStart && t < dayEnd;
      }).length;
      newUsersByDay.push({ date: dateLabel, count: userCount });
      messagesByDay.push({ date: dateLabel, count: msgCount });
    }

    // 活跃用户（7 天内发过消息）
    const activeUserIds = new Set<string>();
    for (const m of messages) {
      if (m.createdAt && now.getTime() - new Date(m.createdAt).getTime() <= 7 * dayMs) {
        activeUserIds.add(m.senderId);
      }
    }

    // 最近注册的 5 个用户
    const recentUsers = accounts
      .slice()
      .sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      })
      .slice(0, 5)
      .map((u) => ({
        id: u.id,
        displayName: u.displayName,
        email: u.email,
        initials: u.initials,
        color: u.color,
        avatarUrl: u.avatarUrl,
        role: u.role,
        disabled: u.disabled,
        createdAt: u.createdAt,
      }));

    res.json({
      newUsersByDay,
      messagesByDay,
      activeUsers7d: activeUserIds.size,
      totalUsers: accounts.length,
      recentUsers,
    });
  });

  // ── 用户管理 ──
  adminRouter.get("/users", (_req: AuthedRequest, res: Response) => {
    res.json(listAccounts());
  });

  adminRouter.patch("/users/:id", (req: AuthedRequest, res: Response) => {
    const updated = adminUpdateAccount(
      req.params.id as string,
      req.body as Partial<AuthUser>,
    );
    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    // 同步账号资料到 Contact/Conversation 表，并通知所有对话方刷新
    svc.syncAccountProfile(req.params.id as string);
    res.json(updated);
  });

  adminRouter.delete("/users/:id", (req: AuthedRequest, res: Response) => {
    const id = req.params.id as string;
    const ok = deleteAccount(id);
    if (!ok) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    // 级联清理该用户的所有数据
    const removedConvIds = new Set(
      db.conversations.filter((c) => c.ownerId === id || c.contactId === id).map((c) => c.id),
    );
    db.conversations = db.conversations.filter((c) => c.ownerId !== id && c.contactId !== id);
    db.contacts = db.contacts.filter((c) => c.id !== id);
    if (removedConvIds.size > 0) {
      db.messages = db.messages.filter((m) => !removedConvIds.has(m.conversationId));
    }
    db.notifications = db.notifications.filter((n) => n.ownerId !== id);
    db.friendRequests = db.friendRequests.filter(
      (r) => r.fromUserId !== id && r.toUserId !== id,
    );
    persistDb();
    res.json({ ok: true });
  });

  // ── 会话管理 ──
  adminRouter.get("/conversations", (_req: AuthedRequest, res: Response) => {
    res.json(db.conversations);
  });

  adminRouter.delete("/conversations/:id", (req: AuthedRequest, res: Response) => {
    const id = req.params.id as string;
    db.conversations = db.conversations.filter((c) => c.id !== id);
    db.messages = db.messages.filter((m) => m.conversationId !== id);
    persistDb();
    res.json({ ok: true });
  });

  // ── 消息管理 ──
  adminRouter.get("/messages", (req: AuthedRequest, res: Response) => {
    const convId = req.query.conversationId as string | undefined;
    const list = convId
      ? db.messages.filter((m) => m.conversationId === convId)
      : db.messages;
    res.json(list);
  });

  adminRouter.delete("/messages/:id", (req: AuthedRequest, res: Response) => {
    const id = req.params.id as string;
    db.messages = db.messages.filter((m) => m.id !== id);
    persistDb();
    res.json({ ok: true });
  });

  // ── 联系人管理 ──
  adminRouter.get("/contacts", (_req: AuthedRequest, res: Response) => {
    res.json(db.contacts);
  });

  adminRouter.delete("/contacts/:id", (req: AuthedRequest, res: Response) => {
    const id = req.params.id as string;
    db.contacts = db.contacts.filter((c) => c.id !== id);
    // 级联清理：关联会话 + 这些会话的消息
    const removedConvIds = new Set(
      db.conversations.filter((c) => c.contactId === id).map((c) => c.id),
    );
    db.conversations = db.conversations.filter((c) => c.contactId !== id);
    if (removedConvIds.size > 0) {
      db.messages = db.messages.filter((m) => !removedConvIds.has(m.conversationId));
    }
    persistDb();
    res.json({ ok: true });
  });

  // ── 通知管理 ──
  adminRouter.get("/notifications", (_req: AuthedRequest, res: Response) => {
    res.json(db.notifications);
  });

  adminRouter.delete("/notifications/:id", (req: AuthedRequest, res: Response) => {
    const id = req.params.id as string;
    db.notifications = db.notifications.filter((n) => n.id !== id);
    persistDb();
    res.json({ ok: true });
  });

  // ── 好友请求管理 ──
  adminRouter.get("/friend-requests", (_req: AuthedRequest, res: Response) => {
    res.json(db.friendRequests);
  });

  adminRouter.delete("/friend-requests/:id", (req: AuthedRequest, res: Response) => {
    const id = req.params.id as string;
    db.friendRequests = db.friendRequests.filter((r) => r.id !== id);
    persistDb();
    res.json({ ok: true });
  });

  // ── 广播系统通知 ──
  // 为所有已注册用户创建一条 system 类型的通知，并向在线用户实时推送
  adminRouter.post("/notifications/broadcast", (req: AuthedRequest, res: Response) => {
    const { title, content } = (req.body ?? {}) as {
      title?: string;
      content?: string;
    };
    const text = (content || "").trim();
    if (!text) {
      res.status(400).json({ error: "Content is required" });
      return;
    }
    const actorName = (title || "System").trim();
    const now = new Date();
    const timestamp = now.toLocaleString();

    const accounts = listAccounts();
    const created: NotificationItem[] = accounts.map((u) => ({
      id: nanoid(10),
      actorName,
      actorInitials: actorName.slice(0, 2).toUpperCase(),
      actorColor: "brand" as AvatarColor,
      action: "broadcast",
      content: text,
      timestamp,
      isRead: false,
      type: "system",
      ownerId: u.id,
    }));

    db.notifications.push(...created);
    persistDb();

    // 向所有在线用户实时推送（每个用户收到归属自己的那条）
    if (io) {
      for (const n of created) {
        io.to(`user:${n.ownerId}`).emit("notification:broadcast", n);
      }
    }

    res.json({ ok: true, count: created.length });
  });

  return adminRouter;
}
