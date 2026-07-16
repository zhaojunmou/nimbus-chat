import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Trash2, AlertCircle } from "lucide-react";
import { AdminNav } from "./AdminNav";
import { Button } from "@/components/Button";
import { ConfirmDialog } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { api } from "@/api/client";
import type { Conversation, Message } from "@/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 100;

/** 管理后台 — 消息管理表格（按会话筛选 / 删除） */
export default function AdminMessages() {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Message | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  // 先加载会话列表用于筛选下拉
  useEffect(() => {
    api.admin
      .getConversations()
      .then(setConversations)
      .catch(() => {
        /* 筛选项加载失败不阻塞主流程 */
      });
  }, []);

  const loadMessages = useCallback(() => {
    setLoading(true);
    api.admin
      .getMessages(conversationId || undefined)
      .then((data) => {
        setMessages(data);
        setError(null);
      })
      .catch(() => setError(t("admin.loadFailed")))
      .finally(() => setLoading(false));
  }, [conversationId, t]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // 分页 — 每页 100 条，避免一次性渲染大量 DOM
  const [page, setPage] = useState(1);
  useEffect(() => {
    setPage(1);
  }, [conversationId]);
  const visibleMessages = useMemo(
    () => messages.slice(0, page * PAGE_SIZE),
    [messages, page],
  );
  const hasMore = visibleMessages.length < messages.length;

  const conversationName = (id: string): string => {
    const c = conversations.find((x) => x.id === id);
    return c ? c.name : id;
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    setDeleting(true);
    api.admin
      .deleteMessage(deleteTarget.id)
      .then(() => {
        toast(t("admin.deleteSuccess"), "success");
        setDeleteTarget(null);
        loadMessages();
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
              {t("admin.messages")}
            </h1>
            <div className="flex items-center gap-2">
              <label className="text-[11px] text-text-tertiary">
                {t("admin.filterByConversation")}
              </label>
              <select
                value={conversationId}
                onChange={(e) => setConversationId(e.target.value)}
                className="h-9 px-3 rounded-[var(--radius-8)] border border-border-neutral bg-bg-tertiary text-text-default text-[13px] cursor-pointer transition-colors duration-150 outline-none focus:border-brand"
              >
                <option value="">{t("admin.all")}</option>
                {conversations.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
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
            ) : visibleMessages.length === 0 ? (
              <div className="text-center py-16 text-[13px] text-text-tertiary">
                {t("admin.noMessages")}
              </div>
            ) : (
              <>
                <div className="text-[11px] text-text-tertiary mb-2">
                  {t("admin.totalCount", { count: messages.length })} · {t("admin.showingCount", { count: visibleMessages.length })}
                </div>
                <div className="rounded-[var(--radius-10)] border border-border-neutral overflow-hidden bg-bg-surface">
                  <table className="w-full">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-bg-tertiary">
                        <th className="text-left text-[11px] uppercase font-semibold text-text-tertiary px-4 py-3">
                          {t("admin.messageId")}
                        </th>
                        <th className="text-left text-[11px] uppercase font-semibold text-text-tertiary px-4 py-3">
                          {t("admin.conversationId")}
                        </th>
                        <th className="text-left text-[11px] uppercase font-semibold text-text-tertiary px-4 py-3">
                          {t("admin.senderId")}
                        </th>
                        <th className="text-left text-[11px] uppercase font-semibold text-text-tertiary px-4 py-3">
                          {t("admin.text")}
                        </th>
                        <th className="text-left text-[11px] uppercase font-semibold text-text-tertiary px-4 py-3">
                          {t("admin.timestamp")}
                        </th>
                        <th className="text-left text-[11px] uppercase font-semibold text-text-tertiary px-4 py-3">
                          {t("admin.sent")}/{t("admin.received")}
                        </th>
                        <th className="text-right text-[11px] uppercase font-semibold text-text-tertiary px-4 py-3">
                          {t("admin.actions")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleMessages.map((m) => (
                        <tr
                          key={m.id}
                          className="border-b border-border-neutral last:border-b-0 hover:bg-bg-tertiary transition-colors duration-150"
                        >
                          <td className="px-4 py-3 text-[13px] text-text-tertiary font-mono max-w-[140px] truncate">
                            {m.id}
                          </td>
                          <td className="px-4 py-3 text-[13px] text-text-secondary max-w-[140px] truncate">
                            {conversationName(m.conversationId)}
                          </td>
                          <td className="px-4 py-3 text-[13px] text-text-tertiary font-mono max-w-[120px] truncate">
                            {m.senderId}
                          </td>
                          <td className="px-4 py-3 text-[13px] text-text-default max-w-[260px] truncate">
                            {m.text || "—"}
                          </td>
                          <td className="px-4 py-3 text-[13px] text-text-tertiary whitespace-nowrap">
                            {m.timestamp}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                "inline-flex items-center px-2 h-6 rounded-[var(--radius-6)] text-[11px] font-medium",
                                m.isSent
                                  ? "bg-brand-soft text-brand"
                                  : "bg-bg-tertiary text-text-secondary",
                              )}
                            >
                              {m.isSent ? t("admin.sent") : t("admin.received")}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-status-error hover:bg-status-error/10 hover:text-status-error"
                                icon={<Trash2 size={13} />}
                                onClick={() => setDeleteTarget(m)}
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
                {hasMore && (
                  <div className="flex justify-center mt-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPage((p) => p + 1)}
                    >
                      {t("admin.loadMore")} ({messages.length - visibleMessages.length})
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      <ConfirmDialog
        open={deleteTarget !== null}
        title={t("admin.deleteMessage")}
        message={t("admin.deleteMessageConfirm")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        danger
        onConfirm={handleConfirmDelete}
        onCancel={() => (deleting ? undefined : setDeleteTarget(null))}
      />
    </div>
  );
}
