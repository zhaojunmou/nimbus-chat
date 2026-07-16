import { useState, useRef, useEffect, type MouseEvent } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  MessageSquarePlus,
  Search,
  Bell,
  Users,
  Settings,
  Eye,
  Star,
  MessageSquare,
  UserCircle,
  Trash,
  X,
  Shield,
  ChevronDown,
  UserPlus,
} from "lucide-react";
import { Avatar } from "./Avatar";
import { Modal } from "./Modal";
import { useToast } from "./Toast";
import { api } from "@/api/client";
import { useAppStore } from "@/store";
import type { Contact } from "@/types";
import { cn } from "@/lib/utils";

/** 上下文菜单项 */
interface MenuItem {
  label: string;
  icon: typeof Eye;
  danger?: boolean;
  onClick: () => void;
}

/** 侧边栏 — 标题/搜索/会话列表/底部入口，含右键上下文菜单 */
export function Sidebar({ showOnMobile = false }: { showOnMobile?: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const conversations = useAppStore((s) => s.conversations);
  const activeId = useAppStore((s) => s.activeConversationId);
  const setActive = useAppStore((s) => s.setActiveConversation);
  const markRead = useAppStore((s) => s.markConversationRead);
  const del = useAppStore((s) => s.deleteConversation);
  const pin = useAppStore((s) => s.togglePin);
  const mute = useAppStore((s) => s.toggleMute);
  const ensureConversation = useAppStore((s) => s.ensureConversation);
  const user = useAppStore((s) => s.user);
  const myOnline = useAppStore((s) => s.myOnline);
  const incomingRequests = useAppStore((s) => s.incomingRequests);
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);
  const { toast } = useToast();

  // 会话搜索
  const [searchQuery, setSearchQuery] = useState("");
  // New Chat 选人弹窗
  const [showNewChat, setShowNewChat] = useState(false);
  // 新建菜单（新聊天 / 创建群聊）
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);

  // 右键菜单状态
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    convId: string;
  } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const newMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (e: globalThis.MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenu(null);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

  // 新建菜单点击外部关闭
  useEffect(() => {
    if (!showNewMenu) return;
    const close = (e: globalThis.MouseEvent) => {
      if (newMenuRef.current && !newMenuRef.current.contains(e.target as Node)) {
        setShowNewMenu(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [showNewMenu]);

  const handleConvClick = (id: string) => {
    setActive(id);
    navigate(`/chat/${id}`);
    setSidebarOpen(false);
  };

  const handleContext = (e: MouseEvent, id: string) => {
    e.preventDefault();
    // 菜单边界检查 — 防止超出视口右侧/下侧
    const MENU_W = 180;
    const MENU_H = 240;
    const margin = 8;
    let x = e.clientX;
    let y = e.clientY;
    if (x + MENU_W > window.innerWidth - margin) {
      x = window.innerWidth - MENU_W - margin;
    }
    if (y + MENU_H > window.innerHeight - margin) {
      y = window.innerHeight - MENU_H - margin;
    }
    if (x < margin) x = margin;
    if (y < margin) y = margin;
    setMenu({ x, y, convId: id });
  };

  // 搜索过滤会话
  const filteredConversations = searchQuery.trim()
    ? conversations.filter((c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase().trim()),
      )
    : conversations;

  // 打开 New Chat 弹窗时拉取联系人
  const openNewChat = () => {
    setShowNewMenu(false);
    setShowNewChat(true);
    api.getContacts().then(setContacts).catch(() => {});
  };

  // 跳转到创建群聊页
  const openCreateGroup = () => {
    setShowNewMenu(false);
    setSidebarOpen(false);
    navigate("/groups/new");
  };

  const startChatWith = async (contact: Contact) => {
    setShowNewChat(false);
    // 确保会话存在（联系人可能没有对应会话），防止消息被丢弃
    const conv = await ensureConversation(contact.id);
    setActive(conv.id);
    navigate(`/chat/${conv.id}`);
    setSidebarOpen(false);
    toast(t("addContact.startedChatWith", { name: contact.name }), "success");
  };

  const menuItems: MenuItem[] = menu
    ? (() => {
        const targetConv = conversations.find((c) => c.id === menu.convId);
        return [
          {
            label: t("sidebar.markAsRead"),
            icon: Eye,
            onClick: () => {
              markRead(menu.convId);
              setMenu(null);
            },
          },
          {
            label: targetConv?.isPinned ? t("chat.unpin") : t("sidebar.pinConversation"),
            icon: Star,
            onClick: async () => {
              try {
                await pin(menu.convId);
              } catch {
                toast(t("common.loading"), "error");
              }
              setMenu(null);
            },
          },
          {
            label: targetConv?.isMuted ? t("chat.unmute") : t("sidebar.mute"),
            icon: MessageSquare,
            onClick: async () => {
              try {
                await mute(menu.convId);
              } catch {
                toast(t("common.loading"), "error");
              }
              setMenu(null);
            },
          },
          {
            label: targetConv?.isGroup ? t("group.groupInfo") : t("sidebar.viewProfile"),
            icon: UserCircle,
            onClick: () => {
              const cid = targetConv?.contactId ?? menu.convId;
              navigate(targetConv?.isGroup ? `/groups/${cid}` : `/contacts/${cid}`);
              setMenu(null);
            },
          },
          {
            label: t("sidebar.deleteChat"),
            icon: Trash,
            danger: true,
            onClick: async () => {
              try {
                await del(menu.convId);
              } catch {
                toast(t("common.loading"), "error");
              }
              setMenu(null);
            },
          },
        ];
      })()
    : [];

  const navIcon = (path: string) =>
    location.pathname === path ||
    (path === "/notifications" && location.pathname === "/notifications");

  return (
    <aside
      className={cn(
        "w-[320px] flex-shrink-0 flex flex-col bg-bg-surface border-r border-border-neutral",
        showOnMobile
          ? "w-full"
          : "hidden lg:flex",
      )}
    >
      {/* 顶部 Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <span className="font-heading text-[13px] font-semibold text-text-default">
          {t("nav.nimbusChat")}
        </span>
        <div className="relative" ref={newMenuRef}>
          <button
            type="button"
            onClick={() => setShowNewMenu((v) => !v)}
            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-[var(--radius-6)] text-text-secondary hover:bg-[var(--bg-overlay-l2)] hover:text-text-default cursor-pointer transition-colors duration-150 text-[11px] font-medium"
            aria-expanded={showNewMenu}
            aria-haspopup="menu"
          >
            <MessageSquarePlus size={16} />
            {t("sidebar.newChat")}
            <ChevronDown size={12} className="opacity-70" />
          </button>
          {showNewMenu && (
            <div
              role="menu"
              className="absolute right-0 top-full mt-1 min-w-[160px] bg-bg-menu border border-border-neutral-2 rounded-[var(--radius-8)] py-1 shadow-menu animate-menu-in z-50"
            >
              <button
                type="button"
                role="menuitem"
                onClick={openNewChat}
                className="flex items-center gap-2 px-3 py-2 mx-1 rounded-[var(--radius-4)] cursor-pointer transition-colors duration-100 w-[calc(100%-8px)] text-[12px] text-text-default hover:bg-[var(--bg-overlay-l2)]"
              >
                <MessageSquarePlus size={14} className="flex-shrink-0" />
                {t("sidebar.newChat")}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={openCreateGroup}
                className="flex items-center gap-2 px-3 py-2 mx-1 rounded-[var(--radius-4)] cursor-pointer transition-colors duration-100 w-[calc(100%-8px)] text-[12px] text-text-default hover:bg-[var(--bg-overlay-l2)]"
              >
                <UserPlus size={14} className="flex-shrink-0" />
                {t("group.createGroup")}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 搜索栏 */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-2 px-3 py-2 bg-bg-tertiary rounded-[var(--radius-8)] border border-border-neutral focus-within:border-brand transition-colors duration-150">
          <Search size={16} className="text-text-tertiary flex-shrink-0" />
          <input
            placeholder={t("sidebar.searchConversations")}
            className="border-none outline-none bg-transparent text-text-default text-[11px] font-sans w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="text-text-tertiary hover:text-text-default cursor-pointer"
              aria-label={t("sidebar.clearSearch")}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* 会话列表 */}
      <div className="flex-1 overflow-y-auto thin-scrollbar px-2">
        {filteredConversations.length === 0 && searchQuery && (
          <div className="text-center text-text-tertiary py-8 text-[11px]">
            {t("sidebar.noConversationsFound")}
          </div>
        )}
        {filteredConversations.map((c) => {
          const isActive = activeId === c.id;
          return (
            <div
              key={c.id}
              onClick={() => handleConvClick(c.id)}
              onContextMenu={(e) => handleContext(e, c.id)}
              className={cn(
                "flex items-center gap-3 px-2 py-3 rounded-[var(--radius-8)] cursor-pointer transition-colors duration-100 relative",
                isActive
                  ? "bg-[var(--bg-overlay-l3)]"
                  : "hover:bg-[var(--bg-overlay-l2)]",
              )}
              style={
                isActive
                  ? { boxShadow: "inset 3px 0 0 0 var(--bg-brand)" }
                  : undefined
              }
            >
              <Avatar
                initials={c.initials}
                color={c.color}
                size="lg"
                online={c.isOnline}
                imageUrl={c.avatarUrl}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[13px] font-medium text-text-default truncate">
                    {c.name}
                  </span>
                  <span className="text-[10px] text-text-tertiary flex-shrink-0 ml-2">
                    {c.lastTime}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-text-secondary truncate">
                    {c.lastMessage}
                  </span>
                  {c.unreadCount > 0 && (
                    <span className="min-w-[20px] h-5 rounded-full bg-brand text-text-onbrand text-[10px] font-semibold flex items-center justify-center px-1 flex-shrink-0 ml-2">
                      {c.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 底部操作栏 */}
      <div className="flex items-center gap-3 px-4 py-3 border-t border-border-neutral">
        <Avatar
          initials={user?.initials ?? "Y"}
          color={user?.color ?? "brand"}
          size="md"
          imageUrl={user?.avatarUrl}
          status={myOnline ? "online" : "offline"}
        />
        <span className="flex-1 text-[13px] font-medium text-text-default truncate">
          {user?.displayName ?? t("common.you")}
        </span>
        <button
          type="button"
          onClick={() => {
            navigate("/notifications");
            setSidebarOpen(false);
          }}
          className={cn(
            "p-1 rounded-[var(--radius-6)] cursor-pointer transition-colors duration-150",
            navIcon("/notifications")
              ? "text-brand"
              : "text-text-tertiary hover:text-text-default",
          )}
          aria-label={t("sidebar.notifications")}
        >
          <Bell size={18} />
        </button>
        <button
          type="button"
          onClick={() => {
            navigate(incomingRequests.length > 0 ? "/contacts/add" : "/contacts");
            setSidebarOpen(false);
          }}
          className={cn(
            "relative p-1 rounded-[var(--radius-6)] cursor-pointer transition-colors duration-150",
            location.pathname.startsWith("/contacts")
              ? "text-brand"
              : "text-text-tertiary hover:text-text-default",
          )}
          aria-label={t("sidebar.contacts")}
        >
          <Users size={18} />
          {incomingRequests.length > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-brand text-text-onbrand text-[9px] font-semibold flex items-center justify-center">
              {incomingRequests.length}
            </span>
          )}
        </button>
        {user?.role === "admin" && (
          <button
            type="button"
            onClick={() => {
              navigate("/admin");
              setSidebarOpen(false);
            }}
            className={cn(
              "p-1 rounded-[var(--radius-6)] cursor-pointer transition-colors duration-150",
              location.pathname.startsWith("/admin")
                ? "text-brand"
                : "text-text-tertiary hover:text-text-default",
            )}
            aria-label={t("admin.title")}
            title={t("admin.title")}
          >
            <Shield size={18} />
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            navigate("/settings");
            setSidebarOpen(false);
          }}
          className={cn(
            "p-1 rounded-[var(--radius-6)] cursor-pointer transition-colors duration-150",
            location.pathname.startsWith("/settings")
              ? "text-brand"
              : "text-text-tertiary hover:text-text-default",
          )}
          aria-label={t("sidebar.settings")}
        >
          <Settings size={18} />
        </button>
      </div>

      {/* 右键上下文菜单 */}
      {menu && (
        <div
          ref={menuRef}
          className="fixed z-50 min-w-[180px] bg-bg-menu border border-border-neutral-2 rounded-[var(--radius-8)] py-1 shadow-menu animate-menu-in"
          style={{ left: menu.x, top: menu.y }}
        >
          {menuItems.map((item, i) => (
            <div key={i}>
              {(i === 3 || i === 4) && (
                <div className="h-px bg-border-neutral my-1" />
              )}
              <button
                type="button"
                onClick={item.onClick}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 mx-1 rounded-[var(--radius-4)] cursor-pointer transition-colors duration-100 w-[calc(100%-8px)] text-[13px]",
                  item.danger
                    ? "text-status-error hover:bg-status-error/10"
                    : "text-text-default hover:bg-[var(--bg-overlay-l2)]",
                )}
              >
                <item.icon size={16} className="flex-shrink-0" />
                {item.label}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* New Chat 选人弹窗 */}
      <Modal
        open={showNewChat}
        onClose={() => setShowNewChat(false)}
        title={t("sidebar.newChatTitle")}
        className="max-w-[360px]"
      >
        <p className="text-[12px] text-text-tertiary mb-3">
          {t("sidebar.selectContactHint")}
        </p>
        <div className="max-h-[360px] overflow-y-auto thin-scrollbar -mx-1">
          {contacts.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => startChatWith(c)}
              className="flex items-center gap-3 w-full px-2 py-2.5 rounded-[var(--radius-8)] cursor-pointer hover:bg-[var(--bg-overlay-l2)] transition-colors duration-100 text-left"
            >
              <Avatar
                initials={c.initials}
                color={c.color}
                size="md"
                online={c.isOnline}
                imageUrl={c.avatarUrl}
              />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-text-default truncate">
                  {c.name}
                </div>
                <div className="text-[11px] text-text-tertiary">
                  {c.isGroup ? t("common.members", { count: c.memberCount }) : c.lastSeen}
                </div>
              </div>
            </button>
          ))}
          {contacts.length === 0 && (
            <div className="text-center text-text-tertiary py-8 text-[12px]">
              {t("sidebar.noContactsAvailable")}
            </div>
          )}
        </div>
      </Modal>
    </aside>
  );
}
