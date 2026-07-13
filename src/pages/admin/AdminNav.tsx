import type { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Shield,
  LayoutDashboard,
  Users,
  MessageSquare,
  Mail,
  Bell,
  ArrowLeft,
  Contact,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  key: string;
  path: string;
  icon: ReactNode;
}

const navItems: NavItem[] = [
  { key: "admin.dashboard", path: "/admin", icon: <LayoutDashboard size={16} /> },
  { key: "admin.users", path: "/admin/users", icon: <Users size={16} /> },
  {
    key: "admin.conversations",
    path: "/admin/conversations",
    icon: <MessageSquare size={16} />,
  },
  { key: "admin.messages", path: "/admin/messages", icon: <Mail size={16} /> },
  { key: "admin.contacts", path: "/admin/contacts", icon: <Contact size={16} /> },
  {
    key: "admin.notifications",
    path: "/admin/notifications",
    icon: <Bell size={16} />,
  },
];

/** 管理后台左侧导航 — 固定 220px 宽度，根据当前路径高亮 */
export function AdminNav() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === "/admin") return location.pathname === "/admin";
    return location.pathname.startsWith(path);
  };

  return (
    <aside className="w-[220px] flex-shrink-0 border-r border-border-neutral bg-bg-surface flex flex-col">
      <div className="flex items-center gap-2 px-5 h-14 border-b border-border-neutral">
        <Shield size={18} className="text-brand flex-shrink-0" />
        <span className="font-heading text-[14px] font-semibold text-text-default truncate">
          {t("admin.title")}
        </span>
      </div>

      <nav className="flex-1 py-3 px-2 flex flex-col gap-1">
        {navItems.map((item) => {
          const active = isActive(item.path);
          return (
            <button
              key={item.path}
              type="button"
              onClick={() => navigate(item.path)}
              className={cn(
                "flex items-center gap-2.5 px-3 h-9 rounded-[var(--radius-8)] text-[13px] cursor-pointer transition-colors duration-150 text-left",
                active
                  ? "bg-brand-soft text-brand font-medium"
                  : "text-text-secondary hover:bg-bg-tertiary hover:text-text-default",
              )}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              <span className="truncate">{t(item.key)}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-2 border-t border-border-neutral">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="flex items-center gap-2.5 px-3 h-9 w-full rounded-[var(--radius-8)] text-[13px] cursor-pointer transition-colors duration-150 text-text-secondary hover:bg-bg-tertiary hover:text-text-default"
        >
          <ArrowLeft size={16} className="flex-shrink-0" />
          <span>{t("admin.backToChat")}</span>
        </button>
      </div>
    </aside>
  );
}
