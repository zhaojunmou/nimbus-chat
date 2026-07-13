import { Router } from "express";
import type {
  RegisterPayload,
  LoginPayload,
  AuthUser,
} from "../../shared/types.js";
import {
  registerAccount,
  loginAccount,
  getAuthUserById,
  updateAccount,
} from "../data/authStore.js";
import { authMiddleware, getRequestUserId } from "../middleware/auth.js";
import { ensureContactForAccount } from "../services/chatService.js";

/** 认证路由 — 注册/登录/获取当前用户 */
export function createAuthRouter() {
  const router = Router();

  // 注册
  router.post("/register", (req, res) => {
    const payload = req.body as RegisterPayload;
    const result = registerAccount(payload);
    if ("error" in result) {
      res.status(400).json({ error: result.error });
      return;
    }
    // 在联系人表中创建对应条目，使其可被搜索与添加好友
    ensureContactForAccount(result.user.id);
    res.json({ token: result.token, user: result.user });
  });

  // 登录
  router.post("/login", (req, res) => {
    const payload = req.body as LoginPayload;
    const result = loginAccount(payload);
    if ("error" in result) {
      res.status(401).json({ error: result.error });
      return;
    }
    res.json({ token: result.token, user: result.user });
  });

  // 获取当前登录用户（需 token）
  router.get("/me", authMiddleware, (req, res) => {
    const userId = getRequestUserId(req)!;
    const user = getAuthUserById(userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(user);
  });

  // 更新当前用户资料（需 token）
  router.patch("/me", authMiddleware, (req, res) => {
    const userId = getRequestUserId(req)!;
    const updated = updateAccount(userId, req.body as Partial<AuthUser>);
    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(updated);
  });

  return router;
}
