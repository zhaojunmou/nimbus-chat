import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Trash2, AlertCircle, Check, Megaphone } from "lucide-react";
import { AdminNav } from "./AdminNav";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Modal, ConfirmDialog } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { api } from "@/api/client";
import type { NotificationItem } from "@/types";
import { cn } from "@/lib/utils";

/** 管理后台 — 通知管理表格（删除 + 广播系统通知） */
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

  // 广播弹窗状态
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [bcTitle, setBcTitle] = useState("");
  const [bcContent, setBcContent] = useState("");
  const [broadcasting, setBroadcasting] = useState(false);

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

  const openBroadcast = () => {
    setBcTitle("");
    setBcContent("");
    setBroadcastOpen(true);
  };

  const handleBroadcast = () => {
    const content = bcContent.trim();
    if (!content) {
      toast(t("admin.broadcastContentRequired"), "error");
      return;
    }
    setBroadcasting(true);
    api.admin
      .broadcastNotification(bcTitle.trim(), content)
      .then((res) => {
        toast(t("admin.broadcastSuccess", { count: res.count }), "success");
        setBroadcastOpen(false);
        load();
      })
      .catch(() => toast(t("admin.broadcastFailed"), "error"))
      .finally(() => setBroadcasting(false));
  };

  return (
    <div className="h-screen flex bg-bg-base overflow-hidden">
      <AdminNav />
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* 头部 — 固定不滚动 */}
        <div className="flex-shrink-0 px-8 pt-6 pb-4 border-b border-border-neutral">
          <div className="flex items-center justify-between gap-4" style={{ maxWidth: 1200 }}>
            <h1 className="text-[14px] font-semibold font-heading text-text-default">
              {t("admin.notifications")}
            </h1>
            <Button
              size="sm"
              variant="primary"
              icon={<Megaphone size={14} />}
              onClick={openBroadcast}
            >
              {t("admin.broadcast")}
            </Button>
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
            ) : notifications.length === 0 ? (
              <div className="text-center py-16 text-[13px] text-text-tertiary">
                {t("admin.noData")}
              </div>
            ) : (
              <div className="rounded-[var(--radius-10)] border border-border-neutral overflow-hidden bg-bg-surface">
                <table className="w-full">
                  <thead className="sticky top-0 z-10">
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

      {/* 广播系统通知弹窗 */}
      <Modal
        open={broadcastOpen}
        onClose={() => (broadcasting ? undefined : setBroadcastOpen(false))}
        title={t("admin.broadcastTitle")}
        className="max-w-[480px]"
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] text-text-secondary">
              {t("admin.broadcastTitleLabel")}
            </label>
            <Input
              placeholder={t("admin.broadcastTitlePlaceholder")}
              value={bcTitle}
              onChange={(e) => setBcTitle(e.target.value)}
              maxLength={50}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] text-text-secondary">
              {t("admin.broadcastContentLabel")}
            </label>
            <textarea
              placeholder={t("admin.broadcastContentPlaceholder")}
              value={bcContent}
              onChange={(e) => setBcContent(e.target.value)}
              maxLength={500}
              rows={4}
              className="w-full px-3 py-2 rounded-[var(--radius-8)] border border-border-neutral bg-bg-tertiary text-text-default text-[13px] outline-none focus:border-brand resize-none transition-colors duration-150"
            />
            <span className="text-[11px] text-text-tertiary text-right">
              {bcContent.length}/500
            </span>
          </div>
          <p className="text-[11px] text-text-tertiary">
            {t("admin.broadcastHint")}
          </p>
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              variant="ghost"
              onClick={() => setBroadcastOpen(false)}
              disabled={broadcasting}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="primary"
              icon={<Megaphone size={14} />}
              onClick={handleBroadcast}
              disabled={broadcasting || !bcContent.trim()}
            >
              {broadcasting ? t("admin.broadcasting") : t("admin.broadcast")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
