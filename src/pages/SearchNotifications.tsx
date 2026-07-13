import { useTranslation } from "react-i18next";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { AppLayout, PageScroll } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Avatar } from "@/components/Avatar";
import { Input } from "@/components/Input";
import { FilterPill } from "@/components/FilterPill";
import { useAppStore } from "@/store";
import type { NotificationItem } from "@/types";
import { cn } from "@/lib/utils";

type Filter = "all" | "unread" | "mentions" | "reactions";

/** 搜索与通知 — 过滤标签 + 时间分组 + 未读高亮 */
export default function SearchNotifications() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const notifications = useAppStore((s) => s.notifications);
  const conversations = useAppStore((s) => s.conversations);
  const markAll = useAppStore((s) => s.markAllNotificationsRead);
  const markRead = useAppStore((s) => s.markNotificationRead);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  // 点击通知 → 标记已读并跳转到对应会话（按 actorName 匹配）
  const handleNotificationClick = (n: NotificationItem) => {
    markRead(n.id);
    const conv = conversations.find((c) => c.name === n.actorName);
    if (conv) {
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
