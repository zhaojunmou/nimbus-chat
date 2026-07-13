import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Users,
  MessageSquare,
  Mail,
  Contact,
  Bell,
  UserPlus,
  Loader2,
  AlertCircle,
} from "lucide-react";
import type { ReactNode } from "react";
import { AdminNav } from "./AdminNav";
import { api } from "@/api/client";

interface AdminStats {
  users: number;
  conversations: number;
  messages: number;
  contacts: number;
  notifications: number;
  friendRequests: number;
  onlineUsers: number;
}

interface StatCard {
  key: string;
  value: number;
  icon: ReactNode;
}

/** 管理后台仪表盘 — 统计卡片网格 */
export default function AdminDashboard() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.admin
      .getStats()
      .then((data) => {
        if (!cancelled) {
          setStats(data);
          setError(null);
        }
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

  const statCards: StatCard[] = stats
    ? [
        { key: "admin.totalUsers", value: stats.users, icon: <Users size={18} /> },
        {
          key: "admin.totalConversations",
          value: stats.conversations,
          icon: <MessageSquare size={18} />,
        },
        {
          key: "admin.totalMessages",
          value: stats.messages,
          icon: <Mail size={18} />,
        },
        {
          key: "admin.totalContacts",
          value: stats.contacts,
          icon: <Contact size={18} />,
        },
        {
          key: "admin.totalNotifications",
          value: stats.notifications,
          icon: <Bell size={18} />,
        },
        {
          key: "admin.totalFriendRequests",
          value: stats.friendRequests,
          icon: <UserPlus size={18} />,
        },
        {
          key: "admin.onlineUsers",
          value: stats.onlineUsers,
          icon: (
            <span className="inline-block w-[18px] h-[18px] rounded-full bg-status-online" />
          ),
        },
      ]
    : [];

  return (
    <div className="min-h-screen flex bg-bg-base">
      <AdminNav />
      <main className="flex-1 overflow-y-auto">
        <div className="px-8 py-6" style={{ maxWidth: 1200 }}>
          <h1 className="text-[14px] font-semibold font-heading text-text-default mb-5">
            {t("admin.dashboard")}
          </h1>

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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {statCards.map((card) => (
                <div
                  key={card.key}
                  className="bg-bg-surface border border-border-neutral rounded-[var(--radius-10)] p-4 flex flex-col gap-3"
                >
                  <div className="w-9 h-9 rounded-[var(--radius-8)] bg-brand-soft text-brand flex items-center justify-center">
                    {card.icon}
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[22px] font-semibold font-heading text-text-default leading-none">
                      {card.value}
                    </span>
                    <span className="text-[11px] text-text-tertiary">
                      {t(card.key)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
