import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  MessageCircle,
  MoreHorizontal,
  Phone,
  Edit3,
  Mail,
  Globe,
  Users,
  ChevronRight,
  Image as ImageIcon,
  Ban,
  Trash,
} from "lucide-react";
import { AppLayout, PageScroll } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { IconButton } from "@/components/IconButton";
import { ConfirmDialog } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { api } from "@/api/client";
import { useAppStore } from "@/store";
import type { Contact } from "@/types";
import { useTranslation } from "react-i18next";

/** 联系人资料 — 头卡 + 联系信息 + 共享群组 + 共享媒体 */
export default function ContactProfile() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const conversations = useAppStore((s) => s.conversations);
  const deleteConv = useAppStore((s) => s.deleteConversation);
  const ensureConversation = useAppStore((s) => s.ensureConversation);
  const [contact, setContact] = useState<Contact | null>(null);
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  // 更多菜单
  const [menu, setMenu] = useState<{ x: number; y: number; ready: boolean } | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

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

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api
      .getContacts()
      .then((list) => {
        setAllContacts(list);
        setContact(list.find((c) => c.id === id) ?? null);
      })
      .catch(() => setContact(null))
      .finally(() => setLoading(false));
  }, [id]);

  const handleMoreClick = (e: MouseEvent) => {
    e.preventDefault();
    // 用按钮位置定位：菜单右边缘对齐按钮右边缘，顶部在按钮下方
    // 实际尺寸校正交由下方 useLayoutEffect 处理，避免不同语言/内容宽度估算不准导致超出视口
    const btn = e.currentTarget as HTMLButtonElement;
    const r = btn.getBoundingClientRect();
    const margin = 8;
    const gap = 4;
    const x = Math.max(margin, r.right - 200);
    const y = r.bottom + gap;
    setMenu({ x, y, ready: false });
  };

  // 菜单挂载后按实际尺寸做边界校正，校正完成才显示（ready=true）
  // 用 offsetWidth/offsetHeight 测量原始尺寸，避免受到入场动画 transform: scale() 影响
  useLayoutEffect(() => {
    if (!menu || menu.ready) return;
    const el = menuRef.current;
    if (!el) return;
    const margin = 8;
    const gap = 4;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    let x = menu.x;
    let y = menu.y;
    if (x + w > window.innerWidth - margin) {
      x = window.innerWidth - w - margin;
    }
    if (x < margin) x = margin;
    if (y + h > window.innerHeight - margin) {
      // 下方放不下 → 放按钮上方
      const btnH = 32;
      y = y - gap - h - btnH - gap;
      if (y < margin) y = Math.max(margin, window.innerHeight - h - margin);
    }
    if (y < margin) y = margin;
    setMenu({ x, y, ready: true });
  }, [menu]);

  const handleBlock = async () => {
    setConfirmBlock(false);
    if (!contact) return;
    try {
      await api.blockContact(contact.id);
      toast(t("contactProfile.blockedToast", { name: contact.name }), "success");
      navigate("/contacts");
    } catch {
      toast(t("contactProfile.blockFailed"), "error");
    }
  };

  const handleDeleteContact = async () => {
    setConfirmDelete(false);
    if (!contact) return;
    try {
      // 新会话 id 为 nanoid，需按 contactId 查找真实会话 id
      const conv = conversations.find((c) => c.contactId === contact.id);
      if (conv) await deleteConv(conv.id);
      toast(t("contactProfile.deletedToast"), "success");
      navigate("/contacts");
    } catch {
      toast(t("contactProfile.deleteFailed"), "error");
    }
  };

  // 发消息：确保会话存在后跳转（新会话 id 为 nanoid）
  const handleSendMessage = async () => {
    if (!contact) return;
    const conv = await ensureConversation(contact.id);
    navigate(`/chat/${conv.id}`);
  };

  // 通话：确保会话存在后跳转
  const handleCall = async () => {
    if (!contact) return;
    const conv = await ensureConversation(contact.id);
    navigate(`/call/${conv.id}`);
  };

  // 打开共享群组会话：确保会话存在后跳转
  const handleOpenGroup = async (groupId: string) => {
    const conv = await ensureConversation(groupId);
    navigate(`/chat/${conv.id}`);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex-1 flex items-center justify-center text-text-secondary">
          {t("common.loading")}
        </div>
      </AppLayout>
    );
  }

  if (!contact) {
    return (
      <AppLayout>
        <div className="flex-1 flex items-center justify-center text-text-secondary">
          {t("contactProfile.contactNotFound")}
        </div>
      </AppLayout>
    );
  }

  // 共享群组：当前会话列表中的群组，memberCount 从 contacts 数据获取
  const sharedGroups = conversations
    .filter((c) => c.isGroup)
    .map((c) => {
      const contactInfo = allContacts.find((ct) => ct.id === c.id);
      return { ...c, memberCount: contactInfo?.memberCount };
    });

  const infoRows = [
    contact.email && { icon: Mail, label: t("contactProfile.email"), value: contact.email },
    contact.phone && { icon: MessageCircle, label: t("contactProfile.phone"), value: contact.phone },
    contact.location && { icon: Globe, label: t("contactProfile.location"), value: contact.location },
  ].filter(Boolean) as { icon: typeof Mail; label: string; value: string }[];

  return (
    <AppLayout>
      <PageHeader
        title={contact.name}
        onBack={() => navigate("/contacts")}
        actions={
          <>
            <IconButton
              icon={<MessageCircle size={18} />}
              onClick={handleSendMessage}
              aria-label={t("contactProfile.sendMessage")}
            />
            <IconButton
              icon={<MoreHorizontal size={18} />}
              onClick={handleMoreClick}
              aria-label="更多"
            />
          </>
        }
      />
      <PageScroll className="px-6 py-6" maxWidth={960}>
        {/* 资料头卡 */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="mb-4 inline-block leading-[0]" style={{ padding: 3, background: "var(--bg-brand)", borderRadius: "50%" }}>
            <div className="inline-block leading-[0]" style={{ padding: 3, background: "var(--bg-base-default)", borderRadius: "50%" }}>
              <Avatar
                initials={contact.initials}
                color={contact.color}
                size="2xl"
                online={contact.isOnline}
                imageUrl={contact.avatarUrl}
              />
            </div>
          </div>
          <h1 className="font-heading text-[20px] font-semibold text-text-default">
            {contact.name}
          </h1>
          {contact.isOnline && (
            <span className="text-[12px] text-brand mt-0.5">{t("contactProfile.online")}</span>
          )}
          {contact.role && (
            <p className="text-[12px] text-text-secondary mt-1">{contact.role}</p>
          )}
          {contact.bio && (
            <p className="text-[12px] text-text-tertiary mt-1.5 max-w-[360px]">
              {contact.bio}
            </p>
          )}
          {/* 操作按钮 */}
          <div className="flex items-center gap-2 mt-5">
            <Button
              variant="primary"
              size="lg"
              icon={<MessageCircle size={16} />}
              onClick={handleSendMessage}
            >
              {t("contactProfile.message")}
            </Button>
            <Button
              variant="secondary"
              size="lg"
              icon={<Phone size={16} />}
              onClick={handleCall}
            >
              {t("contactProfile.call")}
            </Button>
            <Button
              variant="outline"
              size="lg"
              icon={<Edit3 size={16} />}
              onClick={() => toast(t("contactProfile.editComingSoon"), "info")}
            >
              {t("contactProfile.edit")}
            </Button>
          </div>
        </div>

        {/* 联系信息 */}
        {infoRows.length > 0 && (
          <section className="bg-bg-surface rounded-[var(--radius-10)] border border-border-neutral mb-4">
            <h2 className="font-heading text-[13px] font-semibold text-text-default px-5 pt-4 pb-2">
              {t("contactProfile.contactInfo")}
            </h2>
            <div className="px-5 pb-4">
              {infoRows.map((row, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 py-2.5"
                >
                  <row.icon size={16} className="text-text-secondary flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-[11px] text-text-tertiary">{row.label}</div>
                    <div className="text-[13px] text-text-default">{row.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 共享群组 */}
        <section className="bg-bg-surface rounded-[var(--radius-10)] border border-border-neutral mb-4">
          <h2 className="font-heading text-[13px] font-semibold text-text-default px-5 pt-4 pb-2">
            {t("contactProfile.sharedGroups")}
          </h2>
          <div className="px-5 pb-3">
            {sharedGroups.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => handleOpenGroup(g.id)}
                className="flex items-center gap-3 w-full py-2.5 rounded-[var(--radius-6)] hover:bg-[var(--bg-overlay-l2)] cursor-pointer transition-colors duration-100 text-left"
              >
                <Users size={16} className="text-text-secondary flex-shrink-0" />
                <span className="flex-1 text-[13px] text-text-default">{g.name}</span>
                <span className="text-[11px] text-text-tertiary">
                  {g.memberCount ? t("common.members", { count: g.memberCount }) : "—"}
                </span>
                <ChevronRight size={16} className="text-text-tertiary" />
              </button>
            ))}
            {sharedGroups.length === 0 && (
              <div className="text-center text-text-tertiary py-4 text-[12px]">
                {t("contactProfile.noSharedGroups")}
              </div>
            )}
          </div>
        </section>

        {/* 共享媒体 */}
        <section className="bg-bg-surface rounded-[var(--radius-10)] border border-border-neutral">
          <h2 className="font-heading text-[13px] font-semibold text-text-default px-5 pt-4 pb-3">
            {t("contactProfile.sharedMedia")}
          </h2>
          <div className="px-5 pb-5">
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <ImageIcon size={24} className="text-text-tertiary opacity-40 mb-2" />
              <p className="text-[12px] text-text-tertiary">
                {t("contactProfile.noSharedMedia")}
              </p>
            </div>
          </div>
        </section>
      </PageScroll>

      {/* 更多菜单 */}
      {menu && (
        <div
          ref={menuRef}
          className="fixed z-50 min-w-[180px] bg-bg-menu border border-border-neutral-2 rounded-[var(--radius-8)] py-1 shadow-menu animate-menu-in"
          style={{ left: menu.x, top: menu.y, visibility: menu.ready ? "visible" : "hidden" }}
        >
          <button
            type="button"
            onClick={() => { setMenu(null); handleSendMessage(); }}
            className="flex items-center gap-2 px-3 py-2 mx-1 rounded-[var(--radius-4)] cursor-pointer transition-colors duration-100 w-[calc(100%-8px)] text-[13px] text-text-default hover:bg-[var(--bg-overlay-l2)]"
          >
            <MessageCircle size={16} className="flex-shrink-0" />
            {t("contactProfile.sendMessage")}
          </button>
          <button
            type="button"
            onClick={() => { setMenu(null); setConfirmBlock(true); }}
            className="flex items-center gap-2 px-3 py-2 mx-1 rounded-[var(--radius-4)] cursor-pointer transition-colors duration-100 w-[calc(100%-8px)] text-[13px] text-status-error hover:bg-status-error/10"
          >
            <Ban size={16} className="flex-shrink-0" />
            {t("contactProfile.block")}
          </button>
          <div className="h-px bg-border-neutral my-1" />
          <button
            type="button"
            onClick={() => { setMenu(null); setConfirmDelete(true); }}
            className="flex items-center gap-2 px-3 py-2 mx-1 rounded-[var(--radius-4)] cursor-pointer transition-colors duration-100 w-[calc(100%-8px)] text-[13px] text-status-error hover:bg-status-error/10"
          >
            <Trash size={16} className="flex-shrink-0" />
            {t("contactProfile.deleteContact")}
          </button>
        </div>
      )}

      {/* 确认弹窗 */}
      <ConfirmDialog
        open={confirmBlock}
        title={t("contactProfile.blockTitle", { name: contact.name })}
        message={t("contactProfile.blockMsg")}
        confirmLabel={t("contactProfile.block")}
        danger
        onConfirm={handleBlock}
        onCancel={() => setConfirmBlock(false)}
      />
      <ConfirmDialog
        open={confirmDelete}
        title={t("contactProfile.deleteTitle", { name: contact.name })}
        message={t("contactProfile.deleteMsg")}
        confirmLabel={t("common.delete")}
        danger
        onConfirm={handleDeleteContact}
        onCancel={() => setConfirmDelete(false)}
      />
    </AppLayout>
  );
}
