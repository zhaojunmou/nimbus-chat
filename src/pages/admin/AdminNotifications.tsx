import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Trash2, AlertCircle, Check } from "lucide-react";
import { AdminNav } from "./AdminNav";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { ConfirmDialog } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { api } from "@/api/client";
import type { NotificationItem } from "@/types";
import { cn } from "@/lib/utils";

/** 管理后台 — 通知管理表格（删除） */
export default function AdminNotifications() {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NotificationItem | null>(
    null,
  );
  const [deleting, setDeleting] = useState<boolean>(false);

  const load = useCallback(() => {
    setLoading(true);
    api.admin
      .getNotifications()
      .then((data) => {
        setNotifications(data);
        setError(null);
      })
      .catch(() => setError(t("admin.loadFailed")))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    setDeleting(true);
    api.admin
      .deleteNotification(deleteTarget.id)
      .then(() => {
        toast(t("admin.deleteSuccess"), "success");
        setDeleteTarget(null);
        load();
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
              {t("admin.notifications")}
            </h1>
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
          ) : notifications.length === 0 ? (
            <div className="text-center py-16 text-[13px] text-text-tertiary">
              {t("admin.noData")}
            </div>
          ) : (
            <div className="rounded-[var(--radius-10)] border border-border-neutral overflow-hidden bg-bg-surface">
              <table className="w-full">
                <thead>
                  <tr className="bg-bg-tertiary">
                    <th className="text-left text-[11px] uppercase font-semibold text-text-tertiary px-4 py-3">
                      {t("admin.actorName")}
                    </th>
                    <th className="text-left text-[11px] uppercase font-semibold text-text-tertiary px-4 py-3">
                      {t("admin.action")}
                    </th>
                    <th className="text-left text-[11px] uppercase font-semibold text-text-tertiary px-4 py-3">
                      {t("admin.content")}
                    </th>
                    <th className="text-left text-[11px] uppercase font-semibold text-text-tertiary px-4 py-3">
                      {t("admin.type")}
                    </th>
                    <th className="text-left text-[11px] uppercase font-semibold text-text-tertiary px-4 py-3">
                      {t("admin.timestamp")}
                    </th>
                    <th className="text-left text-[11px] uppercase font-semibold text-text-tertiary px-4 py-3">
                      {t("admin.isRead")}
                    </th>
                    <th className="text-right text-[11px] uppercase font-semibold text-text-tertiary px-4 py-3">
                      {t("admin.actions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {notifications.map((n) => (
                    <tr
                      key={n.id}
                      className="border-b border-border-neutral last:border-b-0 hover:bg-bg-tertiary transition-colors duration-150"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar
                            initials={n.actorInitials}
                            color={n.actorColor}
                            size="sm"
                          />
                          <span className="text-[13px] font-medium text-text-default">
                            {n.actorName}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-text-secondary">
                        {n.action || "—"}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-text-secondary max-w-[240px] truncate">
                        {n.content || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 h-6 rounded-[var(--radius-6)] bg-bg-tertiary text-text-secondary text-[11px] font-medium">
                          {n.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-text-tertiary whitespace-nowrap">
                        {n.timestamp}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center px-2 h-6 rounded-[var(--radius-6)] text-[11px] font-medium",
                            n.isRead
                              ? "bg-brand-soft text-brand"
                              : "bg-status-error/10 text-status-error",
                          )}
                        >
                          {n.isRead && <Check size={12} className="mr-1" />}
                          {n.isRead ? t("admin.isRead") : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-status-error hover:bg-status-error/10 hover:text-status-error"
                            icon={<Trash2 size={13} />}
                            onClick={() => setDeleteTarget(n)}
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
        title={t("admin.deleteNotification")}
        message={t("admin.deleteNotificationConfirm")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        danger
        onConfirm={handleConfirmDelete}
        onCancel={() => (deleting ? undefined : setDeleteTarget(null))}
      />
    </div>
  );
}
