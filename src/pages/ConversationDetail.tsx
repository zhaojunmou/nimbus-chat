import { useEffect, useRef, useState, type ChangeEvent, type MouseEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Mic,
  Users,
  MoreHorizontal,
  Plus,
  Link as LinkIcon,
  Image as ImageIcon,
  Send,
  CheckCheck,
  Pin,
  BellOff,
  Bell,
  Trash,
  Eraser,
  UserCircle,
  Smile,
  X,
  Phone,
  PhoneMissed,
  PhoneIncoming,
  PhoneOutgoing,
  Forward,
  Download,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Avatar } from "@/components/Avatar";
import { IconButton } from "@/components/IconButton";
import { Modal, ConfirmDialog } from "@/components/Modal";
import { ImagePreview } from "@/components/ImagePreview";
import { useToast } from "@/components/Toast";
import { EmojiPicker } from "@/components/EmojiPicker";
import { useAppStore } from "@/store";
import { startTyping, stopTyping, sendMessage } from "@/api/socket";
import { api } from "@/api/client";
import { conversations as fallbackConvs } from "@/mockData";
import { cn } from "@/lib/utils";
import {
  loadCustomEmojis,
  saveCustomEmojis,
  addCustomEmoji,
} from "@/lib/emojiPresets";
import type { Contact } from "@/types";

/** 对话详情 — 消息流 + 输入区 + 通话入口（接入实时 socket） */
export default function ConversationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  // 优先用 store 中的实时会话，回退到本地兜底
  const storeConv = useAppStore((s) =>
    s.conversations.find((c) => c.id === id),
  );
  const conv = storeConv ?? fallbackConvs.find((c) => c.id === id);

  const messagesByConv = useAppStore((s) => s.messagesByConv);
  const loadMessages = useAppStore((s) => s.loadMessages);
  const sendText = useAppStore((s) => s.sendText);
  const sendImage = useAppStore((s) => s.sendImage);
  const ensureConversation = useAppStore((s) => s.ensureConversation);
  const setActive = useAppStore((s) => s.setActiveConversation);
  const typingMap = useAppStore((s) => s.typingMap);
  const togglePin = useAppStore((s) => s.togglePin);
  const toggleMute = useAppStore((s) => s.toggleMute);
  const deleteConv = useAppStore((s) => s.deleteConversation);
  const clearMsgs = useAppStore((s) => s.clearMessages);

  const { t } = useTranslation();

  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingSent = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 更多菜单
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // 清空/删除确认
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // 表情面板
  const [showEmoji, setShowEmoji] = useState(false);

  // 图片预览（lightbox）
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  // 转发图片：选会话弹框
  const [forwardOpen, setForwardOpen] = useState(false);
  const [forwardContacts, setForwardContacts] = useState<Contact[]>([]);

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

  // 进入会话：设置激活 + 加载消息
  useEffect(() => {
    if (id) {
      setActive(id);
      loadMessages(id);
    }
    return () => {
      if (id) stopTyping(id);
      // 离开会话：清除活动会话，断开 socket 房间订阅
      setActive(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // 新消息到达自动滚动到底部
  const convMessages = id ? messagesByConv[id] ?? [] : [];
  const messagesLoaded = id ? id in messagesByConv : false;
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [convMessages.length]);

  if (!conv) {
    return (
      <AppLayout>
        <div className="flex-1 flex items-center justify-center text-text-secondary">
          {t("chat.conversationNotFound")}
        </div>
      </AppLayout>
    );
  }

  const handleSend = () => {
    const text = draft.trim();
    if (!text) return;
    const ok = sendText(conv.id, text);
    if (!ok) {
      // socket 断连，保留 draft 以便重试
      toast(t("conversation.disconnected"), "error");
      return;
    }
    setDraft("");
    setShowEmoji(false);
    if (id) stopTyping(id);
    isTypingSent.current = false;
  };

  const handleDraftChange = (v: string) => {
    setDraft(v);
    if (!id) return;
    // 输入非空 → 发送 typing:start（节流）
    if (v.trim() && !isTypingSent.current) {
      startTyping(id);
      isTypingSent.current = true;
    }
    // 重置停止计时
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      stopTyping(id);
      isTypingSent.current = false;
    }, 1500);
  };

  const insertEmoji = (content: string, isImage: boolean) => {
    if (isImage) {
      // 图片自定义表情 → 作为图片消息发送
      sendImage(conv.id, dataUrlToFile(content, "emoji.jpg")).catch(() => {});
    } else {
      // 文本表情 → 插入输入框
      setDraft((prev) => prev + content);
    }
  };

  // 打开转发弹框 — 拉取联系人列表
  const openForward = () => {
    api.getContacts().then(setForwardContacts).catch(() => {});
    setForwardOpen(true);
  };

  // 转发当前预览图片到指定联系人（对应的会话）
  const handleForwardTo = async (contact: Contact) => {
    if (!previewImage) return;
    try {
      const target = await ensureConversation(contact.id);
      // 直接通过 socket 发送图片 data URL，避免二次压缩
      sendMessage(target.id, "", previewImage, "forwarded.jpg");
      setForwardOpen(false);
      toast(t("conversation.forwardedTo", { name: contact.name }), "success");
    } catch {
      toast(t("conversation.forwardFailed"), "error");
    }
  };

  // 把当前预览图片添加为自定义表情
  const handleAddAsEmoji = () => {
    if (!previewImage) return;
    const list = loadCustomEmojis();
    const { list: newList } = addCustomEmoji(list, previewImage);
    saveCustomEmojis(newList);
    toast(t("emoji.added"), "success");
  };

  // 文件选择：图片走 sendImage 真正发送图片消息，非图片作为文本发送文件名
  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isImage = file.type.startsWith("image/");
    if (isImage) {
      const ok = await sendImage(conv.id, file);
      if (!ok) {
        toast(t("conversation.disconnected"), "error");
      }
    } else {
      const prefix = "📎";
      sendText(conv.id, `${prefix} ${file.name}`);
      toast(`${t("conversation.fileSent")}: ${file.name}`, "success");
    }
    // 重置 input 以便重复选择同一文件
    e.target.value = "";
  };

  const handlePin = async () => {
    setMenu(null);
    await togglePin(conv.id);
    toast(conv.isPinned ? t("toast.unpinned") : t("toast.pinned"), "success");
  };

  const handleMute = async () => {
    setMenu(null);
    await toggleMute(conv.id);
    toast(conv.isMuted ? t("toast.unmuted") : t("toast.muted"), "success");
  };

  const handleClear = async () => {
    setConfirmClear(false);
    await clearMsgs(conv.id);
    toast(t("toast.messagesCleared"), "success");
  };

  const handleDelete = async () => {
    setConfirmDelete(false);
    await deleteConv(conv.id);
    toast(t("toast.conversationDeleted"), "success");
    navigate("/");
  };

  const handleMoreClick = (e: MouseEvent) => {
    e.preventDefault();
    // 菜单边界检查 — 防止超出视口右侧/下侧
    const MENU_W = 180;
    const MENU_H = 220;
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
    setMenu({ x, y });
  };

  const isTyping = !!typingMap[conv.id];

  return (
    <AppLayout>
      <div className="flex-1 flex flex-col min-h-0">
        {/* 聊天头部 */}
        <header className="flex items-center gap-3 h-14 px-4 border-b border-border-neutral flex-shrink-0">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="md:hidden inline-flex items-center justify-center w-8 h-8 rounded-[var(--radius-6)] text-text-secondary hover:bg-[var(--bg-overlay-l2)] cursor-pointer"
            aria-label={t("conversation.backLabel")}
          >
            <ArrowLeft size={18} />
          </button>
          <Avatar
            initials={conv.initials}
            color={conv.color}
            size="md"
            online={conv.isOnline}
            imageUrl={conv.avatarUrl}
          />
          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(conv.isGroup ? `/groups/${conv.contactId ?? conv.id}` : `/contacts/${conv.contactId ?? conv.id}`)}>
            <div className="flex items-center gap-2">
              <span className="text-[14px] font-semibold text-text-default truncate">
                {conv.name}
              </span>
              {conv.isOnline && (
                <span className="text-[11px] text-status-online">Online</span>
              )}
            </div>
            {isTyping && (
              <span className="text-[11px] text-brand">{t("chat.typing")}</span>
            )}
          </div>
          <IconButton
            icon={<Mic size={18} />}
            onClick={() => navigate(`/call/${conv.id}`)}
            aria-label={t("conversation.micLabel")}
          />
          <IconButton
            icon={<Users size={18} />}
            onClick={() => navigate(conv.isGroup ? `/groups/${conv.contactId ?? conv.id}` : `/contacts/${conv.contactId ?? conv.id}`)}
            aria-label={conv.isGroup ? t("group.groupInfo") : t("sidebar.viewProfile")}
          />
          <IconButton
            icon={<MoreHorizontal size={18} />}
            onClick={handleMoreClick}
            aria-label={t("conversation.moreLabel")}
          />
        </header>

        {/* 消息流 */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto thin-scrollbar px-4 py-5"
        >
          {/* 日期分隔 */}
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-border-neutral" />
            <span className="text-[10px] text-text-tertiary px-2">{t("common.today")}</span>
            <div className="flex-1 h-px bg-border-neutral" />
          </div>

          <div className="flex flex-col gap-3">
            {convMessages.map((m, i) => {
              const prevSame =
                i > 0 && convMessages[i - 1].isSent === m.isSent;
              // 图片消息渲染
              const isImageMsg = !!m.imageUrl;
              // 通话记录渲染 — 跟普通消息一样按 isSent 左右对齐
              if (m.call) {
                const call = m.call;
                const isMissed = call.status === "missed";
                const isRejected = call.status === "rejected";
                const isFailed = call.status === "failed";
                const isCompleted = call.status === "completed";
                // 图标选择
                const CallIcon = isMissed || isFailed
                  ? PhoneMissed
                  : call.isCaller
                    ? PhoneOutgoing
                    : PhoneIncoming;
                // 状态文案
                const statusText = (() => {
                  switch (call.status) {
                    case "completed":
                      return call.isCaller
                        ? t("call.recordOutgoing")
                        : t("call.recordIncoming");
                    case "rejected":
                      return t("call.recordRejected");
                    case "missed":
                      return t("call.recordMissed");
                    case "failed":
                      return t("call.recordFailed");
                    case "busy":
                      return t("call.recordBusy");
                    default:
                      return t("call.recordMissed");
                  }
                })();
                // 时长格式化
                const formatDuration = (sec?: number) => {
                  if (!sec) return "";
                  const mm = String(Math.floor(sec / 60)).padStart(2, "0");
                  const ss = String(sec % 60).padStart(2, "0");
                  return `${mm}:${ss}`;
                };
                // 卡片内容
                const card = (
                  <button
                    type="button"
                    onClick={() => conv && navigate(`/call/${conv.id}`)}
                    className="group flex items-center gap-2.5 px-3.5 py-2 rounded-[var(--radius-10)] border border-border-neutral-2 bg-bg-surface hover:bg-[var(--bg-overlay-l2)] cursor-pointer transition-colors duration-150 max-w-[80%]"
                    aria-label={t("call.redial")}
                  >
                    <span
                      className={cn(
                        "inline-flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0",
                        isMissed || isFailed
                          ? "bg-status-error/15 text-status-error"
                          : isRejected
                            ? "bg-amber-500/15 text-amber-500"
                            : "bg-brand/15 text-brand",
                      )}
                    >
                      <CallIcon size={15} />
                    </span>
                    <div className="flex flex-col items-start min-w-0">
                      <span
                        className={cn(
                          "text-[12px] font-medium truncate",
                          isMissed || isFailed
                            ? "text-status-error"
                            : isRejected
                              ? "text-amber-500"
                              : "text-text-default",
                        )}
                      >
                        {statusText}
                      </span>
                      <span className="text-[10px] text-text-tertiary flex items-center gap-1.5">
                        {isCompleted && call.duration ? (
                          <span className="font-mono tnum">{formatDuration(call.duration)}</span>
                        ) : null}
                        <span>{m.timestamp}</span>
                      </span>
                    </div>
                    <Phone
                      size={14}
                      className="text-text-tertiary group-hover:text-brand transition-colors flex-shrink-0"
                    />
                  </button>
                );
                // 发送方 → 右对齐
                if (m.isSent) {
                  return (
                    <div
                      key={m.id}
                      className={cn(
                        "flex flex-row-reverse items-start gap-2 animate-fade-in",
                        prevSame ? "mt-1" : "mt-3",
                      )}
                    >
                      {card}
                    </div>
                  );
                }
                // 接收方 → 左对齐 + 头像
                return (
                  <div
                    key={m.id}
                    className={cn(
                      "flex items-start gap-2 animate-fade-in",
                      prevSame ? "mt-1" : "mt-3",
                    )}
                  >
                    <div className="w-8 flex-shrink-0">
                      {!prevSame && (
                        <Avatar
                          initials={conv.initials}
                          color={conv.color}
                          size="md"
                          imageUrl={conv.avatarUrl}
                        />
                      )}
                    </div>
                    {card}
                  </div>
                );
              }
              if (m.isSent) {
                return (
                  <div
                    key={m.id}
                    className={cn(
                      "flex flex-row-reverse items-start gap-2 animate-fade-in",
                      prevSame ? "mt-1" : "mt-3",
                    )}
                  >
                    <div
                      className="max-w-[65%] px-3.5 py-2 text-[13px] leading-[20px] text-text-onbrand break-words [overflow-wrap:anywhere]"
                      style={{
                        background: "var(--bg-brand)",
                        borderRadius:
                          "var(--radius-10) var(--radius-10) var(--radius-4) var(--radius-10)",
                      }}
                    >
                      {isImageMsg ? (
                        <button
                          type="button"
                          onClick={() => setPreviewImage(m.imageUrl!)}
                          className="block cursor-zoom-in -m-1 p-1"
                          aria-label={t("conversation.viewImage")}
                        >
                          <img
                            src={m.imageUrl}
                            alt={m.fileName ?? "image"}
                            className="max-w-full max-h-[280px] rounded-[var(--radius-8)] object-cover"
                          />
                        </button>
                      ) : (
                        m.text
                      )}
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <span className="text-[10px] text-text-onbrand/70">
                          {m.timestamp}
                        </span>
                        <CheckCheck
                          size={13}
                          className={
                            m.isRead
                              ? "text-text-onbrand"
                              : "text-text-onbrand/50"
                          }
                        />
                      </div>
                    </div>
                  </div>
                );
              }
              return (
                <div
                  key={m.id}
                  className={cn(
                    "flex items-start gap-2 animate-fade-in",
                    prevSame ? "mt-1" : "mt-3",
                  )}
                >
                  <div className="w-8 flex-shrink-0">
                    {!prevSame && (
                      <Avatar
                        initials={conv.initials}
                        color={conv.color}
                        size="md"
                        imageUrl={conv.avatarUrl}
                      />
                    )}
                  </div>
                  <div
                    className="max-w-[65%] px-3.5 py-2 text-[13px] leading-[20px] text-text-default break-words [overflow-wrap:anywhere]"
                    style={{
                      background: "var(--bg-base-tertiary)",
                      borderRadius:
                        "var(--radius-10) var(--radius-10) var(--radius-10) var(--radius-4)",
                    }}
                  >
                    {isImageMsg ? (
                      <button
                        type="button"
                        onClick={() => setPreviewImage(m.imageUrl!)}
                        className="block cursor-zoom-in -m-1 p-1"
                        aria-label={t("conversation.viewImage")}
                      >
                        <img
                          src={m.imageUrl}
                          alt={m.fileName ?? "image"}
                          className="max-w-full max-h-[280px] rounded-[var(--radius-8)] object-cover"
                        />
                      </button>
                    ) : (
                      m.text
                    )}
                    <div className="mt-1">
                      <span className="text-[10px] text-text-tertiary">
                        {m.timestamp}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            {convMessages.length === 0 && !messagesLoaded && (
              <div className="text-center text-text-tertiary py-8">
                <button
                  type="button"
                  onClick={() => id && loadMessages(id)}
                  className="text-[12px] text-brand hover:underline cursor-pointer"
                >
                  {t("common.retry")}
                </button>
              </div>
            )}
            {convMessages.length === 0 && messagesLoaded && (
              <div className="text-center text-text-tertiary py-8 text-[12px]">
                {t("chat.noMessagesYet")}
              </div>
            )}
          </div>
        </div>

        {/* 表情面板 */}
        {showEmoji && (
          <EmojiPicker
            onPick={insertEmoji}
            onClose={() => setShowEmoji(false)}
          />
        )}

        {/* 输入区 */}
        <div className="px-4 py-3 border-t border-border-neutral flex-shrink-0">
          <div className="bg-bg-tertiary rounded-[var(--radius-10)] border border-border-neutral">
            <textarea
              value={draft}
              onChange={(e) => handleDraftChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={t("chat.typeMessage")}
              rows={1}
              className="w-full bg-transparent border-none outline-none resize-none px-3.5 pt-2.5 pb-1 text-[13px] text-text-default placeholder:text-text-tertiary font-sans max-h-32"
            />
            <div className="flex items-center gap-1 px-2 pb-2">
              <IconButton
                icon={<Smile size={18} />}
                size="sm"
                active={showEmoji}
                onClick={() => setShowEmoji((v) => !v)}
                aria-label={t("conversation.emojiLabel")}
              />
              <IconButton
                icon={<Plus size={18} />}
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                aria-label={t("conversation.attachmentsLabel")}
              />
              <IconButton
                icon={<ImageIcon size={16} />}
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                aria-label={t("conversation.imageLabel")}
              />
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileSelect}
              />
              <IconButton
                icon={<LinkIcon size={16} />}
                size="sm"
                onClick={() => {
                  const url = window.prompt(t("conversation.enterLinkUrl"));
                  if (url) handleDraftChange(draft + " " + url + " ");
                }}
                aria-label={t("conversation.linkLabel")}
              />
              <div className="flex-1" />
              <IconButton
                icon={<Mic size={18} />}
                size="sm"
                onClick={() => navigate(`/call/${conv.id}`)}
                aria-label={t("conversation.micLabel")}
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!draft.trim()}
                className="inline-flex items-center justify-center w-8 h-8 rounded-[var(--radius-6)] bg-brand text-text-onbrand hover:bg-brand-hover disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors duration-150"
                aria-label={t("conversation.sendLabel")}
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 更多菜单 */}
      {menu && (
        <div
          ref={menuRef}
          className="fixed z-50 min-w-[180px] bg-bg-menu border border-border-neutral-2 rounded-[var(--radius-8)] py-1 shadow-menu animate-menu-in"
          style={{ left: menu.x, top: menu.y }}
        >
          <MenuItem icon={conv.isPinned ? Pin : Pin} label={conv.isPinned ? t("chat.unpin") : t("chat.pin")} onClick={handlePin} />
          <MenuItem icon={conv.isMuted ? Bell : BellOff} label={conv.isMuted ? t("chat.unmute") : t("chat.mute")} onClick={handleMute} />
          <div className="h-px bg-border-neutral my-1" />
          <MenuItem icon={UserCircle} label={conv.isGroup ? t("group.groupInfo") : t("chat.viewProfile")} onClick={() => { setMenu(null); navigate(conv.isGroup ? `/groups/${conv.contactId ?? conv.id}` : `/contacts/${conv.contactId ?? conv.id}`); }} />
          <MenuItem icon={Eraser} label={t("chat.clearMessages")} onClick={() => { setMenu(null); setConfirmClear(true); }} />
          <div className="h-px bg-border-neutral my-1" />
          <MenuItem icon={Trash} label={t("chat.deleteChat")} danger onClick={() => { setMenu(null); setConfirmDelete(true); }} />
        </div>
      )}

      {/* 确认弹窗 */}
      <ConfirmDialog
        open={confirmClear}
        title={t("chat.clearMessagesTitle")}
        message={t("chat.clearMessagesMsg")}
        confirmLabel={t("common.clear")}
        danger
        onConfirm={handleClear}
        onCancel={() => setConfirmClear(false)}
      />
      <ConfirmDialog
        open={confirmDelete}
        title={t("chat.deleteChatTitle")}
        message={t("chat.deleteChatMsg")}
        confirmLabel={t("common.delete")}
        danger
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />

      {/* 图片预览 lightbox — 支持滚轮缩放、拖动平移 */}
      {previewImage && (
        <ImagePreview
          src={previewImage}
          onClose={() => setPreviewImage(null)}
          closeLabel={t("common.close")}
          actions={
            <>
              <button
                type="button"
                onClick={openForward}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[var(--radius-8)] bg-white/15 text-white text-[12px] hover:bg-white/25 cursor-pointer transition-colors"
              >
                <Forward size={14} />
                {t("conversation.forward")}
              </button>
              <button
                type="button"
                onClick={handleAddAsEmoji}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[var(--radius-8)] bg-white/15 text-white text-[12px] hover:bg-white/25 cursor-pointer transition-colors"
              >
                <Smile size={14} />
                {t("conversation.addAsEmoji")}
              </button>
              <a
                href={previewImage}
                download={previewImage.startsWith("data:") ? "image.jpg" : undefined}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[var(--radius-8)] bg-white/15 text-white text-[12px] hover:bg-white/25 cursor-pointer transition-colors"
              >
                <Download size={14} />
                {t("conversation.download")}
              </a>
            </>
          }
        />
      )}

      {/* 转发选会话弹框 */}
      <Modal
        open={forwardOpen}
        onClose={() => setForwardOpen(false)}
        title={t("conversation.forwardTo")}
        className="max-w-[360px]"
      >
        <div className="flex flex-col gap-1 max-h-[360px] overflow-y-auto thin-scrollbar">
          {forwardContacts.length === 0 ? (
            <div className="text-center text-text-tertiary py-8 text-[12px]">
              {t("conversation.noContactsToForward")}
            </div>
          ) : (
            forwardContacts.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleForwardTo(c)}
                className="flex items-center gap-3 w-full px-2 py-2 rounded-[var(--radius-8)] hover:bg-[var(--bg-overlay-l1)] cursor-pointer transition-colors duration-100 text-left"
              >
                <Avatar
                  initials={c.initials}
                  color={c.color}
                  size="md"
                  imageUrl={c.avatarUrl}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-text-default truncate">
                    {c.name}
                  </div>
                  {c.isGroup ? (
                    <div className="text-[11px] text-text-tertiary truncate">
                      {t("common.members", { count: c.memberCount ?? 0 })}
                    </div>
                  ) : (
                    <div className="text-[11px] text-text-tertiary truncate">
                      {c.lastSeen}
                    </div>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </Modal>
    </AppLayout>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: typeof Pin;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 py-2 mx-1 rounded-[var(--radius-4)] cursor-pointer transition-colors duration-100 w-[calc(100%-8px)] text-[13px]",
        danger
          ? "text-status-error hover:bg-status-error/10"
          : "text-text-default hover:bg-[var(--bg-overlay-l2)]",
      )}
    >
      <Icon size={16} className="flex-shrink-0" />
      {label}
    </button>
  );
}

/** 将 data URL 转换为 File 对象（用于图片表情发送） */
function dataUrlToFile(dataUrl: string, filename: string): File {
  const arr = dataUrl.split(",");
  const mime = arr[0].match(/:(.*?);/)?.[1] ?? "image/jpeg";
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}
