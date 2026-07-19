import { useTranslation } from "react-i18next";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, MessageSquare } from "lucide-react";
import { AppLayout, PageScroll } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Avatar } from "@/components/Avatar";
import { Input } from "@/components/Input";
import { FilterPill } from "@/components/FilterPill";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/Button";
import { useAppStore } from "@/store";
import type { NotificationItem } from "@/types";
import { cn } from "@/lib/utils";

type Filter = "all" | "unread" | "mentions" | "reactions";

/** 通知类型标签文案映射 */
const typeLabelKey: Record<NotificationItem["type"], string> = {
  message: "notifications.typeMessage",
  mention: "notifications.typeMention",
  reaction: "notifications.typeReaction",
  group: "notifications.typeGroup",
  system: "notifications.typeSystem",
};

/** 搜索与通知 — 过滤标签 + 时间分组 + 未读高亮 + 点击查看详情 */
export default function SearchNotifications() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const notifications = useAppStore((s) => s.notifications);
  const conversations = useAppStore((s) => s.conversations);
  const markAll = useAppStore((s) => s.markAllNotificationsRead);
  const markRead = useAppStore((s) => s.markNotificationRead);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  // 当前展开详情的通知
  const [detail, setDetail] = useState<NotificationItem | null>(null);

  // 点击通知 → 标记已读 + 打开详情弹窗
  const handleNotificationClick = (n: NotificationItem) => {
    markRead(n.id);
    setDetail(n);
  };

  // 跳转到对应会话（按 actorName 匹配）— 仅消息/提及/回复类型可用
  const handleGoToConversation = () => {
    if (!detail) return;
    const conv = conversations.find((c) => c.name === detail.actorName);
    if (conv) {
      setDetail(null);
      navigate(`/chat/${conv.id}`);
    }
  };

  const filtered = useMemo(() => {
    return notifications.filter((n) => {
      if (filter === "unread" && n.isRead) return false;
      if (filter === "mentions" && n.type !== "mention") return false;
      if (filter === "reactions" && n.type !== "reaction") return false;
      if (
        query &&
        !n.actorName.toLowerCase().includes(query.toLowerCase()) &&
        !n.content.toLowerCase().includes(query.toLowerCase())
      )
        return false;
      return true;
    });
  }, [notifications, filter, query]);

  // 按时间分组
  const groups = useMemo(() => {
    const today: typeof filtered = [];
    const yesterday: typeof filtered = [];
    filtered.forEach((n) => {
      if (n.timestamp.includes("Yesterday")) yesterday.push(n);
      else today.push(n);
    });
    return { today, yesterday };
  }, [filtered]);

  return (
    <AppLayout>
      <PageHeader
        title={t("notifications.title")}
        onBack={() => navigate("/")}
        actions={
          <button
            type="button"
            onClick={markAll}
            className="text-[12px] text-brand hover:text-brand-hover cursor-pointer font-medium"
          >
            {t("notifications.markAllRead")}
          </button>
        }
      />
      <div className="px-6 py-4 border-b border-border-neutral flex flex-col gap-3 flex-shrink-0">
        <Input
          icon={<Search size={16} />}
          placeholder={t("notifications.searchPlaceholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="flex items-center gap-2 flex-wrap">
          <FilterPill active={filter === "all"} label={t("notifications.all")} onClick={() => setFilter("all")} />
          <FilterPill active={filter === "unread"} label={t("notifications.unread")} onClick={() => setFilter("unread")} />
          <FilterPill active={filter === "mentions"} label={t("notifications.mentions")} onClick={() => setFilter("mentions")} />
          <FilterPill active={filter === "reactions"} label={t("notifications.reactions")} onClick={() => setFilter("reactions")} />
        </div>
      </div>
      <PageScroll className="px-4 py-4">
        {(["today", "yesterday"] as const).map((label) => {
          const items = groups[label];
          if (items.length === 0) return null;
          return (
            <div key={label} className="mb-5">
              <h3 className="text-[11px] font-semibold text-text-tertiary px-3 mb-1.5">
                {t(`common.${label}`)}
              </h3>
              {items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleNotificationClick(n)}
                  className={cn(
                    "flex items-start gap-3 w-full px-3 py-3 mb-1.5 rounded-[var(--radius-8)] cursor-pointer transition-colors duration-100 text-left relative",
                    n.isRead
                      ? "bg-bg-surface opacity-60 hover:opacity-100"
                      : "bg-[var(--bg-overlay-l2)]",
                  )}
                  style={!n.isRead ? { boxShadow: "inset 3px 0 0 0 var(--bg-brand)" } : undefined}
                >
                  <Avatar
                    initials={n.actorInitials}
                    color={n.actorColor}
                    size="md"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-[13px] font-medium text-text-default truncate">
                        {n.actorName}{" "}
                        <span className="font-normal text-text-secondary">
                          {n.action}
                        </span>
                      </span>
                      <span className="text-[10px] text-text-tertiary flex-shrink-0">
                        {n.timestamp}
                      </span>
                    </div>
                    <p className="text-[12px] text-text-secondary line-clamp-2">
                      {renderContent(n.content)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center text-text-tertiary py-12 text-[13px]">
            {t("notifications.noNotifications")}
          </div>
        )}
      </PageScroll>

      {/* 通知详情弹窗 */}
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={t("notifications.detailTitle")}
        className="max-w-[480px]"
      >
        {detail && (
          <div className="flex flex-col gap-4">
            {/* 头部：头像 + 类型徽章 + 时间 */}
            <div className="flex items-start gap-3">
              <Avatar
                initials={detail.actorInitials}
                color={detail.actorColor}
                size="lg"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[14px] font-semibold text-text-default truncate">
                    {detail.actorName}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-soft text-brand font-medium flex-shrink-0">
                    {t(typeLabelKey[detail.type])}
                  </span>
                </div>
                <div className="text-[11px] text-text-tertiary">
                  {detail.timestamp}
                </div>
              </div>
            </div>

            {/* 分隔线 */}
            <div className="h-px bg-border-neutral" />

            {/* 完整内容 */}
            <div className="text-[13px] text-text-default leading-relaxed whitespace-pre-wrap break-words">
              {renderContent(detail.content)}
            </div>

            {/* 操作按钮 */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setDetail(null)}>
                {t("common.close")}
              </Button>
              {["message", "mention", "reaction"].includes(detail.type) &&
                conversations.some((c) => c.name === detail.actorName) && (
                  <Button
                    variant="primary"
                    icon={<MessageSquare size={14} />}
                    onClick={handleGoToConversation}
                  >
                    {t("notifications.goToConversation")}
                  </Button>
                )}
            </div>
          </div>
        )}
      </Modal>
    </AppLayout>
  );
}

/** 渲染通知内容 — 将 @You 与 emoji 高亮 */
function renderContent(content: string) {
  const parts = content.split(/(@\w+|👍)/g);
  return parts.map((p, i) => {
    if (p.startsWith("@")) {
      return (
        <span key={i} className="text-brand font-medium">
          {p}
        </span>
      );
    }
    return <span key={i}>{p}</span>;
  });
}
