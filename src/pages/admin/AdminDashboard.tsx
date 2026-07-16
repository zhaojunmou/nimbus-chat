import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Users,
  MessageSquare,
  Mail,
  UserPlus,
  Loader2,
  AlertCircle,
  Activity,
  TrendingUp,
} from "lucide-react";
import type { ReactNode } from "react";
import { AdminNav } from "./AdminNav";
import { Avatar } from "@/components/Avatar";
import { api } from "@/api/client";
import type { AvatarColor } from "@/types";
import { cn } from "@/lib/utils";

interface AdminStats {
  users: number;
  conversations: number;
  messages: number;
  contacts: number;
  notifications: number;
  friendRequests: number;
  onlineUsers: number;
  activeUsers7d: number;
  newUsers7d: number;
  disabledUsers: number;
  adminUsers: number;
}

interface DayPoint {
  date: string;
  count: number;
}

interface RecentUser {
  id: string;
  displayName: string;
  email: string;
  initials: string;
  color: AvatarColor;
  avatarUrl?: string;
  role: "user" | "admin";
  disabled?: boolean;
  createdAt?: string;
}

interface Analytics {
  newUsersByDay: DayPoint[];
  messagesByDay: DayPoint[];
  activeUsers7d: number;
  totalUsers: number;
  recentUsers: RecentUser[];
}

/** 迷你柱状图 — 纯 SVG 实现，无外部图表库依赖 */
function BarChart({
  data,
  color = "var(--bg-brand)",
  height = 120,
}: {
  data: DayPoint[];
  color?: string;
  height?: number;
}) {
  const { t } = useTranslation();
  const max = Math.max(1, ...data.map((d) => d.count));
  const barGap = 4;
  const barWidth = data.length > 0 ? `calc((100% - ${(data.length - 1) * barGap}px) / ${data.length})` : "0";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-1" style={{ height }}>
        {data.map((d, i) => {
          const h = (d.count / max) * height;
          return (
            <div
              key={i}
              className="flex-1 flex flex-col items-center justify-end group relative"
              style={{ minWidth: 0 }}
            >
              {/* 悬浮提示 */}
              {d.count > 0 && (
                <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-bg-menu border border-border-neutral rounded-[var(--radius-4)] px-1.5 py-0.5 text-[10px] text-text-default whitespace-nowrap pointer-events-none z-10">
                  {d.count}
                </div>
              )}
              <div
                className="w-full rounded-t-[3px] transition-all duration-200"
                style={{
                  height: Math.max(d.count > 0 ? 3 : 0, h),
                  backgroundColor: d.count > 0 ? color : "var(--bg-overlay-l2)",
                }}
              />
            </div>
          );
        })}
      </div>
      {/* X 轴日期标签 — 隔点显示避免拥挤 */}
      <div className="flex gap-1">
        {data.map((d, i) => (
          <div
            key={i}
            className="flex-1 text-center text-[9px] text-text-tertiary"
            style={{ minWidth: 0 }}
          >
            {i % 2 === 0 ? d.date : ""}
          </div>
        ))}
      </div>
      {data.every((d) => d.count === 0) && (
        <div className="text-center text-[11px] text-text-tertiary -mt-1">
          {t("admin.noData")}
        </div>
      )}
    </div>
  );
}

interface StatCard {
  key: string;
  value: number;
  icon: ReactNode;
  /** 强调色：brand/violet/amber/cyan — 不同指标用不同配色增加视觉层次 */
  tone?: "brand" | "violet" | "amber" | "cyan";
  hint?: string;
}

/** 图标背景 + 文字配色映射 */
const toneCls: Record<NonNullable<StatCard["tone"]>, string> = {
  brand: "bg-brand-soft text-brand",
  violet: "bg-[var(--accent-violet-soft,rgba(139,92,246,0.12))] text-[var(--accent-violet)]",
  amber: "bg-[var(--accent-amber-soft,rgba(245,158,11,0.12))] text-[var(--accent-amber)]",
  cyan: "bg-[var(--accent-cyan-soft,rgba(6,182,212,0.12))] text-[var(--accent-cyan)]",
};

/** 管理后台仪表盘 — 统计卡片 + 趋势图表 + 最近注册用户 */
export default function AdminDashboard() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([api.admin.getStats(), api.admin.getAnalytics()])
      .then(([s, a]) => {
        if (cancelled) return;
        setStats(s);
        setAnalytics(a);
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError(t("admin.loadFailed"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  const formatTime = (iso?: string): string => {
    if (!iso) return "—";
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const day = 24 * 60 * 60 * 1000;
    if (diff < day) {
      return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    }
    if (diff < 7 * day) {
      const days = Math.floor(diff / day);
      return t("admin.daysAgo", { count: days });
    }
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const statCards: StatCard[] = stats
    ? [
        {
          key: "admin.totalUsers",
          value: stats.users,
          icon: <Users size={18} />,
          tone: "brand",
        },
        {
          key: "admin.onlineUsers",
          value: stats.onlineUsers,
          icon: <span className="inline-block w-[14px] h-[14px] rounded-full bg-status-online ring-2 ring-status-online/30" />,
          tone: "brand",
        },
        {
          key: "admin.activeUsers7d",
          value: stats.activeUsers7d,
          icon: <Activity size={18} />,
          tone: "violet",
          hint: t("admin.last7days"),
        },
        {
          key: "admin.newUsers7d",
          value: stats.newUsers7d,
          icon: <TrendingUp size={18} />,
          tone: "cyan",
          hint: t("admin.last7days"),
        },
        {
          key: "admin.totalMessages",
          value: stats.messages,
          icon: <Mail size={18} />,
          tone: "amber",
        },
        {
          key: "admin.totalConversations",
          value: stats.conversations,
          icon: <MessageSquare size={18} />,
          tone: "violet",
        },
      ]
    : [];

  // 活跃率 = 7 天活跃用户 / 总用户
  const activeRate = stats && stats.users > 0
    ? Math.round((stats.activeUsers7d / stats.users) * 100)
    : 0;

  return (
    <div className="h-screen flex bg-bg-base overflow-hidden">
      <AdminNav />
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* 头部 — 固定不滚动 */}
        <div className="flex-shrink-0 px-8 pt-6 pb-4 border-b border-border-neutral">
          <h1 className="text-[14px] font-semibold font-heading text-text-default" style={{ maxWidth: 1200 }}>
            {t("admin.dashboard")}
          </h1>
        </div>

        {/* 内容区 — 仅此区域滚动 */}
        <div className="flex-1 overflow-y-auto px-8 py-5">
          <div className="flex flex-col gap-5" style={{ maxWidth: 1200 }}>
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 size={24} className="text-brand animate-spin" />
              </div>
            ) : error ? (
              <div className="flex items-center justify-center gap-2 py-20 text-[13px] text-status-error">
                <AlertCircle size={16} />
                {error}
              </div>
            ) : (
              <>
                {/* 统计卡片网格 */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {statCards.map((card) => {
                    const tone = card.tone ?? "brand";
                    return (
                      <div
                        key={card.key}
                        className="bg-bg-surface border border-border-neutral rounded-[var(--radius-10)] p-4 flex flex-col gap-3 transition-all duration-150 hover:border-border-neutral-2 hover:shadow-sm"
                      >
                        <div
                          className={cn(
                            "w-9 h-9 rounded-[var(--radius-8)] flex items-center justify-center",
                            toneCls[tone],
                          )}
                        >
                          {card.icon}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[22px] font-semibold font-heading text-text-default leading-none">
                            {card.value}
                          </span>
                          <span className="text-[11px] text-text-secondary mt-1.5">
                            {t(card.key)}
                          </span>
                          {card.hint && (
                            <span className="text-[9px] text-text-tertiary mt-0.5">
                              {card.hint}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 图表区 — 两列 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* 新增用户趋势 */}
                  <div className="bg-bg-surface border border-border-neutral rounded-[var(--radius-10)] p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <UserPlus size={15} className="text-brand" />
                        <h3 className="text-[13px] font-semibold text-text-default">
                          {t("admin.newUsersTrend")}
                        </h3>
                      </div>
                      <span className="text-[10px] text-text-tertiary">
                        {t("admin.last14days")}
                      </span>
                    </div>
                    {analytics && (
                      <BarChart
                        data={analytics.newUsersByDay}
                        color="var(--bg-brand)"
                        height={100}
                      />
                    )}
                  </div>

                  {/* 消息活跃度趋势 */}
                  <div className="bg-bg-surface border border-border-neutral rounded-[var(--radius-10)] p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Activity size={15} className="text-brand" />
                        <h3 className="text-[13px] font-semibold text-text-default">
                          {t("admin.messageActivityTrend")}
                        </h3>
                      </div>
                      <span className="text-[10px] text-text-tertiary">
                        {t("admin.last14days")}
                      </span>
                    </div>
                    {analytics && (
                      <BarChart
                        data={analytics.messagesByDay}
                        color="var(--accent-violet)"
                        height={100}
                      />
                    )}
                  </div>
                </div>

                {/* 活跃度概览 + 最近注册用户 */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* 活跃度概览 */}
                  <div className="bg-bg-surface border border-border-neutral rounded-[var(--radius-10)] p-5 flex flex-col gap-4">
                    <h3 className="text-[13px] font-semibold text-text-default">
                      {t("admin.activityOverview")}
                    </h3>
                    {/* 活跃率环形进度 */}
                    <div className="flex items-center gap-4">
                      <div className="relative w-20 h-20 flex-shrink-0">
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
                          <circle
                            cx="40" cy="40" r="34"
                            fill="none"
                            stroke="var(--bg-overlay-l2)"
                            strokeWidth="8"
                          />
                          <circle
                            cx="40" cy="40" r="34"
                            fill="none"
                            stroke="var(--bg-brand)"
                            strokeWidth="8"
                            strokeLinecap="round"
                            strokeDasharray={`${(activeRate / 100) * 2 * Math.PI * 34} ${2 * Math.PI * 34}`}
                            className="transition-all duration-500"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-[16px] font-semibold font-heading text-text-default">
                            {activeRate}%
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[11px] text-text-tertiary">
                          {t("admin.activeRate")}
                        </span>
                        <span className="text-[12px] text-text-default">
                          {stats?.activeUsers7d ?? 0} / {stats?.users ?? 0}
                        </span>
                        <span className="text-[10px] text-text-tertiary">
                          {t("admin.last7days")}
                        </span>
                      </div>
                    </div>
                    {/* 小指标 */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border-neutral">
                      <div className="flex flex-col">
                        <span className="text-[18px] font-semibold font-heading text-text-default">
                          {stats?.onlineUsers ?? 0}
                        </span>
                        <span className="text-[10px] text-text-tertiary">
                          {t("admin.onlineUsers")}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[18px] font-semibold font-heading text-text-default">
                          {stats?.newUsers7d ?? 0}
                        </span>
                        <span className="text-[10px] text-text-tertiary">
                          {t("admin.newUsers7d")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 最近注册用户 */}
                  <div className="bg-bg-surface border border-border-neutral rounded-[var(--radius-10)] p-5 lg:col-span-2">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-[13px] font-semibold text-text-default">
                        {t("admin.recentUsers")}
                      </h3>
                    </div>
                    {analytics && analytics.recentUsers.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        {analytics.recentUsers.map((u) => (
                          <div
                            key={u.id}
                            className="flex items-center gap-3 px-2 py-2 rounded-[var(--radius-6)] hover:bg-bg-tertiary transition-colors"
                          >
                            <Avatar
                              initials={u.initials}
                              color={u.color}
                              size="sm"
                              imageUrl={u.avatarUrl}
                            />
                            <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                              <div className="flex flex-col min-w-0">
                                <span className="text-[13px] font-medium text-text-default truncate">
                                  {u.displayName}
                                </span>
                                <span className="text-[11px] text-text-tertiary truncate">
                                  {u.email}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {u.role === "admin" && (
                                  <span className="inline-flex items-center px-1.5 h-5 rounded-[var(--radius-4)] bg-brand-soft text-brand text-[10px] font-medium">
                                    {t("admin.admin")}
                                  </span>
                                )}
                                {u.disabled && (
                                  <span className="inline-flex items-center px-1.5 h-5 rounded-[var(--radius-4)] bg-status-error/10 text-status-error text-[10px] font-medium">
                                    {t("admin.disabled")}
                                  </span>
                                )}
                                <span className="text-[10px] text-text-tertiary whitespace-nowrap">
                                  {formatTime(u.createdAt)}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center text-[12px] text-text-tertiary py-8">
                        {t("admin.noData")}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
