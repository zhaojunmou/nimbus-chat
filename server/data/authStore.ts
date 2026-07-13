import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { nanoid } from "nanoid";
import type {
  AuthUser,
  AvatarColor,
  RegisterPayload,
  LoginPayload,
} from "../../shared/types.js";
import { loadState } from "./persist.js";

/**
 * 用户账号存储 — 内存存储 + 文件持久化
 * 进程重启后从 store.json 恢复，无文件时使用种子数据。
 */

const JWT_SECRET = "nimbus-chat-dev-secret-change-in-production";
const JWT_EXPIRES_IN = "7d";

export interface AccountRecord extends AuthUser {
  passwordHash: string;
}

// 头像配色循环 — 注册时按序分配
const colorCycle: AvatarColor[] = [
  "brand",
  "violet",
  "coral",
  "amber",
  "cyan",
  "teal",
];

/** 种子账号 */
const seedAccounts: AccountRecord[] = [
  {
    id: "you",
    email: "you@nimbus.chat",
    displayName: "You",
    initials: "Y",
    color: "brand",
    statusMessage: "Available",
    bio: "Hey there! I'm using Nimbus Chat.",
    phone: "+1 (555) 0123",
    role: "admin",
    passwordHash: bcrypt.hashSync("demo1234", 10),
  },
  {
    id: "alex",
    email: "alex.chen@techcorp.com",
    displayName: "Alex Chen",
    initials: "AC",
    color: "brand",
    statusMessage: "Designing",
    bio: "Building beautiful interfaces.",
    phone: "+1 (555) 0456",
    role: "user",
    passwordHash: bcrypt.hashSync("demo1234", 10),
  },
];

/** 已注册账号列表 — 从持久化文件加载，无文件时使用种子数据 */
const accounts: AccountRecord[] = (() => {
  const persisted = loadState();
  if (persisted?.accounts?.length) {
    return persisted.accounts as AccountRecord[];
  }
  return [...seedAccounts];
})();

/** 持久化回调 — 由 store.ts 注册，账号变更时触发保存 */
let persistFn: (() => void) | null = null;
export function registerPersistCallback(fn: () => void): void {
  persistFn = fn;
}

/** 触发防抖保存 */
function persist(): void {
  persistFn?.();
}

/** 获取账号列表（供 store.ts 持久化使用） */
export function getAccounts(): AccountRecord[] {
  return accounts;
}

/** 取姓名首字母作为头像缩写 */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** 注册新账号 */
export function registerAccount(
  payload: RegisterPayload,
): { user: AuthUser; token: string } | { error: string } {
  if (!payload?.email || !payload?.password || !payload?.displayName) {
    return { error: "All fields are required" };
  }
  const email = payload.email.trim().toLowerCase();
  if (!email || !payload.password || !payload.displayName.trim()) {
    return { error: "All fields are required" };
  }
  if (payload.password.length < 6) {
    return { error: "Password must be at least 6 characters" };
  }
  if (accounts.some((a) => a.email === email)) {
    return { error: "Email already registered" };
  }
  const id = nanoid(8);
  const color =
    colorCycle[accounts.length % colorCycle.length];
  const record: AccountRecord = {
    id,
    email,
    displayName: payload.displayName.trim(),
    initials: initialsOf(payload.displayName),
    color,
    statusMessage: "Available",
    bio: "",
    phone: "",
    role: "user",
    passwordHash: bcrypt.hashSync(payload.password, 10),
  };
  accounts.push(record);
  persist();
  const token = signToken(record.id);
  return { user: toAuthUser(record), token };
}

/** 登录 */
export function loginAccount(
  payload: LoginPayload,
): { user: AuthUser; token: string } | { error: string } {
  if (!payload?.email || !payload?.password) {
    return { error: "Email and password are required" };
  }
  const email = payload.email.trim().toLowerCase();
  const record = accounts.find((a) => a.email === email);
  if (!record) return { error: "Account not found" };
  if (!bcrypt.compareSync(payload.password, record.passwordHash)) {
    return { error: "Incorrect password" };
  }
  const token = signToken(record.id);
  return { user: toAuthUser(record), token };
}

/** 根据 id 取账号 */
export function getAccountById(id: string): AccountRecord | undefined {
  return accounts.find((a) => a.id === id);
}

/** 根据 id 取认证用户（去除密码） */
export function getAuthUserById(id: string): AuthUser | null {
  const r = accounts.find((a) => a.id === id);
  return r ? toAuthUser(r) : null;
}

/** 更新账号资料 — 字段白名单，拒绝 id/email/passwordHash 等敏感字段 */
export function updateAccount(
  id: string,
  patch: Partial<AuthUser>,
): AuthUser | null {
  const r = accounts.find((a) => a.id === id);
  if (!r) return null;
  // 仅允许安全字段被更新
  const allowed: (keyof AuthUser)[] = [
    "displayName",
    "statusMessage",
    "bio",
    "phone",
    "color",
    "avatarUrl",
  ];
  const safePatch: Partial<AuthUser> = {};
  for (const key of allowed) {
    if (key in patch && patch[key] !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (safePatch as Record<string, unknown>)[key] = patch[key];
    }
  }
  Object.assign(r, {
    ...safePatch,
    id: r.id,
    email: r.email,
    passwordHash: r.passwordHash,
    initials: safePatch.displayName
      ? initialsOf(safePatch.displayName)
      : r.initials,
  });
  persist();
  return toAuthUser(r);
}

/** 签发 JWT */
export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

/** 验证 JWT，返回 userId 或 null */
export function verifyToken(token: string): string | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { sub: string };
    return decoded.sub ?? null;
  } catch {
    return null;
  }
}

function toAuthUser(r: AccountRecord): AuthUser {
  const { passwordHash, ...user } = r;
  return user;
}

// ── 管理员功能 ──

/** 列出所有账号（去除密码） */
export function listAccounts(): AuthUser[] {
  return accounts.map(toAuthUser);
}

/** 管理员更新账号 — 允许更多字段（含 role），但拒绝 id/email/passwordHash */
export function adminUpdateAccount(
  id: string,
  patch: Partial<AuthUser>,
): AuthUser | null {
  const r = accounts.find((a) => a.id === id);
  if (!r) return null;
  const allowed: (keyof AuthUser)[] = [
    "displayName",
    "statusMessage",
    "bio",
    "phone",
    "color",
    "role",
    "avatarUrl",
  ];
  const safePatch: Partial<AuthUser> = {};
  for (const key of allowed) {
    if (key in patch && patch[key] !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (safePatch as Record<string, unknown>)[key] = patch[key];
    }
  }
  Object.assign(r, {
    ...safePatch,
    id: r.id,
    email: r.email,
    passwordHash: r.passwordHash,
    initials: safePatch.displayName
      ? initialsOf(safePatch.displayName)
      : r.initials,
  });
  persist();
  return toAuthUser(r);
}

/** 删除账号 — 返回是否成功 */
export function deleteAccount(id: string): boolean {
  const idx = accounts.findIndex((a) => a.id === id);
  if (idx === -1) return false;
  accounts.splice(idx, 1);
  persist();
  return true;
}

/** 检查是否为管理员 */
export function isAdmin(userId: string): boolean {
  const r = accounts.find((a) => a.id === userId);
  return r?.role === "admin";
}
