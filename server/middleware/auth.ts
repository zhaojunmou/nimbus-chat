import type { Request, Response, NextFunction } from "express";
import { verifyToken, getAuthUserById, isAdmin } from "../data/authStore.js";

/** 扩展 Request 类型，附加已认证用户 */
declare global {
  // eslint-disable-next-line no-var
  var __authUserId: string | undefined;
}

/** JWT 认证中间件 — 校验 Authorization: Bearer <token> */
export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const token = header.slice(7);
  const userId = verifyToken(token);
  if (!userId) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
  const user = getAuthUserById(userId);
  if (!user) {
    res.status(401).json({ error: "Account not found" });
    return;
  }
  // 将 userId 挂到 req 上供后续路由使用
  (req as Request & { userId?: string }).userId = userId;
  (req as Request & { authUser?: typeof user }).authUser = user;
  next();
}

/** 管理员权限中间件 — 必须在 authMiddleware 之后使用 */
export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const userId = getRequestUserId(req);
  if (!userId || !isAdmin(userId)) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

/** 从请求中取已认证的 userId */
export function getRequestUserId(req: Request): string | undefined {
  return (req as Request & { userId?: string }).userId;
}
