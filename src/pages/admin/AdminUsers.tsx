import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Search,
  Loader2,
  Trash2,
  ShieldCheck,
  Shield,
  AlertCircle,
  Ban,
  CheckCircle,
} from "lucide-react";
import { AdminNav } from "./AdminNav";
import { Avatar } from "@/components/Avatar";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { ConfirmDialog } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { api } from "@/api/client";
import type { AuthUser } from "@/types";
import { cn } from "@/lib/utils";

/** 管理后台 — 用户管理表格（搜索 / 角色切换 / 删除） */
export default function AdminUsers() {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState<string>("");
  const [deleteTarget, setDeleteTarget] = useState<AuthUser | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  const loadUsers = useCallback(() => {
    setLoading(true);
    api.admin
      .getUsers()
      .then((data) => {
        setUsers(data);
        setError(null);
      })
      .catch(() => setError(t("admin.loadFailed")))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q),
    );
  }, [users, query]);

  const handleToggleRole = (user: AuthUser) => {
    const newRole: "user" | "admin" = user.role === "admin" ? "user" : "admin";
    api.admin
      .updateUser(user.id, { role: newRole })
      .then(() => {
        toast(t("admin.updateSuccess"), "success");
        loadUsers();
      })
      .catch(() => toast(t("admin.updateFailed"), "error"));
  };

  const handleToggleDisabled = (user: AuthUser) => {
    // 管理员自身不允许被禁用
    if (user.role === "admin") {
      toast(t("admin.cannotDisableAdmin"), "error");
      return;
    }
    api.admin
      .updateUser(user.id, { disabled: !user.disabled })
      .then(() => {
        toast(t("admin.updateSuccess"), "success");
        loadUsers();
      })
      .catch(() => toast(t("admin.updateFailed"), "error"));
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    setDeleting(true);
    api.admin
      .deleteUser(deleteTarget.id)
      .then(() => {
        toast(t("admin.deleteSuccess"), "success");
        setDeleteTarget(null);
        loadUsers();
      })
      .catch(() => toast(t("admin.deleteFailed"), "error"))
      .finally(() => setDeleting(false));
  };

  return (
    <div className="h-screen flex bg-bg-base overflow-hidden">
      <AdminNav />
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* 头部 — 固定不滚动 */}
        <div className="flex-shrink-0 px-8 pt-6 pb-4 border-b border-border-neutral">
          <div className="flex items-center justify-between gap-4" style={{ maxWidth: 1200 }}>
            <h1 className="text-[14px] font-semibold font-heading text-text-default">
              {t("admin.users")}
            </h1>
            <div className="w-[280px]">
              <Input
                icon={<Search size={16} />}
                placeholder={t("common.search")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* 列表区 — 仅此区域滚动 */}
        <div className="flex-1 overflow-y-auto px-8 py-4">
          <div style={{ maxWidth: 1200 }}>
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 size={24} className="text-brand animate-spin" />
              </div>
            ) : error ? (
              <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-status-error">
                <AlertCircle size={16} />
                {error}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-[13px] text-text-tertiary">
                {t("admin.noData")}
              </div>
            ) : (
              <div className="rounded-[var(--radius-10)] border border-border-neutral overflow-hidden bg-bg-surface">
                <table className="w-full">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-bg-tertiary">
                      <th className="text-left text-[11px] uppercase font-semibold text-text-tertiary px-4 py-3">
                        {t("admin.displayName")}
                      </th>
                      <th className="text-left text-[11px] uppercase font-semibold text-text-tertiary px-4 py-3">
                        {t("admin.email")}
                      </th>
                      <th className="text-left text-[11px] uppercase font-semibold text-text-tertiary px-4 py-3">
                        {t("admin.role")}
                      </th>
                      <th className="text-left text-[11px] uppercase font-semibold text-text-tertiary px-4 py-3">
                        {t("admin.accountStatus")}
                      </th>
                      <th className="text-right text-[11px] uppercase font-semibold text-text-tertiary px-4 py-3">
                        {t("admin.actions")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((u) => (
                      <tr
                        key={u.id}
                        className="border-b border-border-neutral last:border-b-0 hover:bg-bg-tertiary transition-colors duration-150"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <Avatar
                              initials={u.initials}
                              color={u.color}
                              size="sm"
                              imageUrl={u.avatarUrl}
                            />
                            <div className="flex flex-col min-w-0">
                              <span className="text-[13px] font-medium text-text-default truncate">
                                {u.displayName}
                              </span>
                              <span className="text-[11px] text-text-tertiary truncate">
                                {u.id}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[13px] text-text-secondary">
                          {u.email}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "inline-flex items-center px-2 h-6 rounded-[var(--radius-6)] text-[11px] font-medium",
                              u.role === "admin"
                                ? "bg-brand-soft text-brand"
                                : "bg-bg-tertiary text-text-secondary",
                            )}
                          >
                            {u.role === "admin"
                              ? t("admin.admin")
                              : t("admin.user")}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "inline-flex items-center px-2 h-6 rounded-[var(--radius-6)] text-[11px] font-medium",
                              u.disabled
                                ? "bg-status-error/10 text-status-error"
                                : "bg-brand-soft text-brand",
                            )}
                          >
                            {u.disabled
                              ? t("admin.disabled")
                              : t("admin.active")}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              icon={
                                u.role === "admin" ? (
                                  <Shield size={13} />
                                ) : (
                                  <ShieldCheck size={13} />
                                )
                              }
                              onClick={() => handleToggleRole(u)}
                            >
                              {u.role === "admin"
                                ? t("admin.makeUser")
                                : t("admin.makeAdmin")}
                            </Button>
                            {u.role !== "admin" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className={cn(
                                  u.disabled
                                    ? "text-brand hover:bg-brand-soft hover:text-brand"
                                    : "text-status-error hover:bg-status-error/10 hover:text-status-error",
                                )}
                                icon={
                                  u.disabled ? (
                                    <CheckCircle size={13} />
                                  ) : (
                                    <Ban size={13} />
                                  )
                                }
                                onClick={() => handleToggleDisabled(u)}
                              >
                                {u.disabled
                                  ? t("admin.enable")
                                  : t("admin.disable")}
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-status-error hover:bg-status-error/10 hover:text-status-error"
                              icon={<Trash2 size={13} />}
                              onClick={() => setDeleteTarget(u)}
                            >
                              {t("common.delete")}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      <ConfirmDialog
        open={deleteTarget !== null}
        title={t("admin.deleteUser")}
        message={t("admin.deleteUserConfirm")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        danger
        onConfirm={handleConfirmDelete}
        onCancel={() => (deleting ? undefined : setDeleteTarget(null))}
      />
    </div>
  );
}
