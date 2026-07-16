import http from "node:http";
import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "../shared/types.js";
import { createApiRouter } from "./routes/api.js";
import { createAuthRouter } from "./routes/auth.js";
import { createAdminRouter } from "./routes/admin.js";
import { authMiddleware, requireAdmin } from "./middleware/auth.js";
import { registerSocketHandlers } from "./socket/handlers.js";
import { initRealtime } from "./services/chatService.js";
import { persistDbNow } from "./data/store.js";

const PORT = Number(process.env.PORT) || 3001;

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: { origin: "*" },
});

// 认证路由（注册/登录无需 token）
app.use("/api/auth", createAuthRouter());

// 业务 API 路由（需 token）— 注入 io 用于模拟对方回复广播
app.use("/api", authMiddleware, createApiRouter(io));

// 管理后台 API 路由（需 token + 管理员权限）— 注入 io 用于广播系统通知
app.use("/api/admin", authMiddleware, requireAdmin, createAdminRouter(io));

// 健康检查
app.get("/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));

registerSocketHandlers(io);

// 注入 io 到 chatService，供好友请求等业务逻辑推送实时事件
initRealtime(io);

server.listen(PORT, () => {
  console.log(
    `[nimbus-chat] API + Socket.IO listening on http://localhost:${PORT}`,
  );
});

// 进程退出时同步保存数据，防止丢失
function shutdown() {
  console.log("[nimbus-chat] 正在保存数据...");
  persistDbNow();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
