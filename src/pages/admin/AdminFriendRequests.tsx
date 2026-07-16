import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search, Loader2, Trash2, AlertCircle, Check, X } from "lucide-react";
import { AdminNav } from "./AdminNav";
import { Avatar } from "@/components/Avatar";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { ConfirmDialog } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { api } from "@/api/client";
import type { FriendRequest } from "@/types";
import { cn } from "@/lib/utils";

/** 管理后台 — 好友请求管理表格（搜索 / 状态筛选 / 删除） */
export default function AdminFriendRequests() {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "accepted" | "rejected">("all");
  const [deleteTarget, setDeleteTarget] = useState<FriendRequest | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  const load = useCallback(() => {
    setLoading(true);
    api.admin
      .getFriendRequests()
      .then((data) => {
        setRequests(data);
        setError(null);
      })
      .catch(() => setError(t("admin.loadFailed")))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return requests.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        r.fromName.toLowerCase().includes(q) ||
        r.toName.toLowerCase().includes(q) ||
        r.fromUserId.toLowerCase().includes(q) ||
        r.toUserId.toLowerCase().includes(q)
      );
    });
  }, [requests, query, statusFilter]);

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    setDeleting(true);
    api.admin
      .deleteFriendRequest(deleteTarget.id)
      .then(() => {
        toast(t("admin.deleteSuccess"), "success");
        setDeleteTarget(null);
        load();
      })
      .catch(() => toast(t("admin.deleteFailed"), "error"))
      .finally(() => setDeleting(false));
  };

  const statusBadge = (status: FriendRequest["status"]) => {
    const map: Record<FriendRequest["status"], { cls: string; icon?: React.ReactNode }> = {
      pending: { cls: "bg-amber-soft text-amber", icon: undefined },
      accepted: { cls: "bg-brand-soft text-brand", icon: <Check size={12} className="mr-1" /> },
      rejected: { cls: "bg-status-error/10 text-status-error", icon: <X size={12} className="mr-1" /> },
    };
    const cfg = map[status];
    return (
      <span className={cn("inline-flex items-center px-2 h-6 rounded-[var(--radius-6)] text-[11px] font-medium", cfg.cls)}>
        {cfg.icon}
        {t(`admin.status_${status}`)}
      </span>
    );
  };

  return (
    <div className="h-screen flex bg-bg-base overflow-hidden">
      <AdminNav />
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* 头部 — 固定不滚动 */}
        <div className="flex-shrink-0 px-8 pt-6 pb-4 border-b border-border-neutral">
          <div className="flex items-center justify-between gap-4" style={{ maxWidth: 1200 }}>
            <h1 className="text-[14px] font-semibold font-heading text-text-default">
              {t("admin.friendRequests")}
            </h1>
            <div className="flex items-center gap-3">
              {/* 状态筛选 */}
              <div className="flex items-center gap-1 bg-bg-tertiary rounded-[var(--radius-8)] p-1">
                {(["all", "pending", "accepted", "rejected"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatusFilter(s)}
                    className={cn(
                      "px-2.5 h-7 rounded-[var(--radius-6)] text-[11px] font-medium cursor-pointer transition-colors",
                      statusFilter === s
                        ? "bg-bg-surface text-text-default shadow-sm"
                        : "text-text-secondary hover:text-text-default",
                    )}
                  >
                    {s === "all" ? t("admin.filterAll") : t(`admin.status_${s}`)}
                  </button>
                ))}
              </div>
              <div className="w-[260px]">
                <Input
                  icon={<Search size={16} />}
                  placeholder={t("common.search")}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
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
                      {t("admin.fromUser")}
                    </th>
                    <th className="text-left text-[11px] uppercase font-semibold text-text-tertiary px-4 py-3">
                      {t("admin.toUser")}
                    </th>
                    <th className="text-left text-[11px] uppercase font-semibold text-text-tertiary px-4 py-3">
                      {t("admin.status")}
                    </th>
                    <th className="text-left text-[11px] uppercase font-semibold text-text-tertiary px-4 py-3">
                      {t("admin.timestamp")}
                    </th>
                    <th className="text-right text-[11px] uppercase font-semibold text-text-tertiary px-4 py-3">
                      {t("admin.actions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-border-neutral last:border-b-0 hover:bg-bg-tertiary transition-colors duration-150"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar
                            initials={r.fromInitials}
                            color={r.fromColor}
                            size="sm"
                            imageUrl={r.fromAvatarUrl}
                          />
                          <div className="flex flex-col min-w-0">
                            <span className="text-[13px] font-medium text-text-default truncate">
                              {r.fromName}
                            </span>
                            <span className="text-[11px] text-text-tertiary truncate">
                              {r.fromUserId}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar
                            initials={r.toInitials}
                            color={r.toColor}
                            size="sm"
                          />
                          <span className="text-[13px] font-medium text-text-default truncate">
                            {r.toName}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">{statusBadge(r.status)}</td>
                      <td className="px-4 py-3 text-[13px] text-text-tertiary whitespace-nowrap">
                        {r.timestamp}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-status-error hover:bg-status-error/10 hover:text-status-error"
                            icon={<Trash2 size={13} />}
                            onClick={() => setDeleteTarget(r)}
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
        title={t("admin.deleteFriendRequest")}
        message={t("admin.deleteFriendRequestConfirm")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        danger
        onConfirm={handleConfirmDelete}
        onCancel={() => (deleting ? undefined : setDeleteTarget(null))}
      />
    </div>
  );
}
