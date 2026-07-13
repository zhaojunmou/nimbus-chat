import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Search,
  Loader2,
  Trash2,
  ShieldCheck,
  Shield,
  AlertCircle,
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
    <div className="min-h-screen flex bg-bg-base">
      <AdminNav />
      <main className="flex-1 overflow-y-auto">
        <div className="px-8 py-6" style={{ maxWidth: 1200 }}>
          <div className="flex items-center justify-between gap-4 mb-5">
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
                <thead>
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
