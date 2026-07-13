import { Router } from "express";
import type { Request, Response } from "express";
import { db, persistDb } from "../data/store.js";
import {
  listAccounts,
  adminUpdateAccount,
  deleteAccount,
} from "../data/authStore.js";
import * as svc from "../services/chatService.js";
import type { AuthUser } from "../../shared/types.js";

/** 已认证请求类型 */
type AuthedRequest = Request & { userId?: string; authUser?: AuthUser };

/**
 * 管理后台 API 路由 — 需 authMiddleware + requireAdmin 前置
 * 提供对所有数据的查看与管理能力。
 */
export function createAdminRouter() {
  const adminRouter = Router();

  // ── 仪表盘统计 ──
  adminRouter.get("/stats", (_req: AuthedRequest, res: Response) => {
    res.json({
      users: listAccounts().length,
      conversations: db.conversations.length,
      messages: db.messages.length,
      contacts: db.contacts.length,
      notifications: db.notifications.length,
      friendRequests: db.friendRequests.length,
      onlineUsers: db.onlineSockets.size,
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
    const ok = deleteAccount(req.params.id as string);
    if (!ok) {
      res.status(404).json({ error: "User not found" });
      return;
    }
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
    // 同时清理关联会话
    db.conversations = db.conversations.filter((c) => c.contactId !== id);
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

  return adminRouter;
}
