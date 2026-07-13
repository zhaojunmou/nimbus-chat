import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Menu } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { useAppStore } from "@/store";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: ReactNode;
  /** 是否隐藏侧边栏（如全屏通话页） */
  hideSidebar?: boolean;
}

/** 应用主布局 — 桌面双栏 + 移动端抽屉式侧边栏 */
export function AppLayout({ children, hideSidebar = false }: AppLayoutProps) {
  const { t } = useTranslation();
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);
  const location = useLocation();

  if (hideSidebar) {
    return <div className="h-screen overflow-hidden">{children}</div>;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* 桌面侧边栏 */}
      <Sidebar />

      {/* 移动端抽屉 */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 flex lg:hidden animate-fade-in">
            <Sidebar showOnMobile />
          </div>
        </>
      )}

      {/* 主内容区 */}
      <main className="flex-1 flex flex-col min-w-0 bg-bg-base relative">
        {/* 移动端顶部栏 */}
        <div className="lg:hidden flex items-center gap-3 h-12 px-3 border-b border-border-neutral bg-bg-surface flex-shrink-0">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="inline-flex items-center justify-center w-8 h-8 rounded-[var(--radius-6)] text-text-secondary hover:bg-[var(--bg-overlay-l2)] cursor-pointer"
            aria-label={t("sidebar.openMenu")}
          >
            <Menu size={18} />
          </button>
          <span className="font-heading text-[13px] font-semibold text-text-default">
            {getPageTitle(location.pathname, t)}
          </span>
        </div>
        {children}
      </main>
    </div>
  );
}

function getPageTitle(path: string, t: (k: string) => string): string {
  if (path === "/") return t("nav.nimbusChat");
  if (path.startsWith("/chat/")) return t("nav.chat");
  if (path.startsWith("/call/")) return t("nav.voiceCall");
  if (path === "/contacts") return t("nav.contacts");
  if (path === "/contacts/add") return t("nav.addContact");
  if (path.startsWith("/contacts/")) return t("nav.contact");
  if (path === "/notifications") return t("nav.notifications");
  if (path === "/settings") return t("nav.settings");
  if (path === "/settings/profile") return t("nav.editProfile");
  if (path === "/settings/privacy") return t("nav.privacySecurity");
  if (path === "/settings/storage") return t("nav.storageData");
  return t("nav.nimbusChat");
}

/** 移动端遮罩判断 — 仅当需要时显示移动顶栏 */
export function useIsMobile() {
  return typeof window !== "undefined" && window.innerWidth < 1024;
}

/** 给主区域容器加统一的滚动与最大宽度 */
export function PageScroll({
  children,
  className,
  maxWidth,
}: {
  children: ReactNode;
  className?: string;
  maxWidth?: number;
}) {
  return (
    <div
      className={cn("flex-1 overflow-y-auto thin-scrollbar", className)}
    >
      <div className="mx-auto w-full" style={maxWidth ? { maxWidth } : undefined}>
        {children}
      </div>
    </div>
  );
}
