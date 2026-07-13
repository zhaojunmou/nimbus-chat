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
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Avatar } from "@/components/Avatar";
import { IconButton } from "@/components/IconButton";
import { ConfirmDialog } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { EmojiPicker } from "@/components/EmojiPicker";
import { useAppStore } from "@/store";
import { startTyping, stopTyping } from "@/api/socket";
import { conversations as fallbackConvs } from "@/mockData";
import { cn } from "@/lib/utils";

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
            className="lg:hidden inline-flex items-center justify-center w-8 h-8 rounded-[var(--radius-6)] text-text-secondary hover:bg-[var(--bg-overlay-l2)] cursor-pointer"
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
          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/contacts/${conv.contactId ?? conv.id}`)}>
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
            onClick={() => navigate(`/contacts/${conv.contactId ?? conv.id}`)}
            aria-label="联系人"
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
          <MenuItem icon={UserCircle} label={t("chat.viewProfile")} onClick={() => { setMenu(null); navigate(`/contacts/${conv.contactId ?? conv.id}`); }} />
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

      {/* 图片预览 lightbox */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 animate-fade-in"
          onClick={() => setPreviewImage(null)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 cursor-pointer transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setPreviewImage(null);
            }}
            aria-label={t("common.close")}
          >
            <X size={20} />
          </button>
          <img
            src={previewImage}
            alt="preview"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-[var(--radius-8)]"
            onClick={(e) => e.stopPropagation()}
          />
          <a
            href={previewImage}
            download={previewImage.startsWith("data:") ? "image.jpg" : undefined}
            className="absolute bottom-5 px-4 py-2 rounded-[var(--radius-8)] bg-white/15 text-white text-[13px] hover:bg-white/25 cursor-pointer transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {t("conversation.download")}
          </a>
        </div>
      )}
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
