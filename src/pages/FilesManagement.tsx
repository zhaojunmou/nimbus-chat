import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Image as ImageIcon,
  FileText,
  Phone,
  Download,
  X,
  Search,
  Folder,
  Forward,
  Smile,
} from "lucide-react";
import { AppLayout, PageScroll } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { SectionTitle } from "@/components/SettingRow";
import { Modal } from "@/components/Modal";
import { ImagePreview } from "@/components/ImagePreview";
import { Avatar } from "@/components/Avatar";
import { useToast } from "@/components/Toast";
import { useAppStore } from "@/store";
import { sendMessage } from "@/api/socket";
import { api } from "@/api/client";
import { cn } from "@/lib/utils";
import {
  loadCustomEmojis,
  saveCustomEmojis,
  addCustomEmoji,
} from "@/lib/emojiPresets";
import type { Message } from "../../shared/types";
import type { Contact } from "@/types";

type FilterType = "all" | "image" | "file" | "call";

/** 文件项统一视图 — 从消息聚合而来 */
interface FileItem {
  message: Message;
  type: "image" | "file" | "call";
  conversationId: string;
  conversationName: string;
}

/** 聊天文件管理 — 聚合所有会话中的图片/文件/通话记录，支持筛选、预览、下载、跳转 */
export default function FilesManagement() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const conversations = useAppStore((s) => s.conversations);
  const messagesByConv = useAppStore((s) => s.messagesByConv);
  const loadMessages = useAppStore((s) => s.loadMessages);
  const ensureConversation = useAppStore((s) => s.ensureConversation);
  const setActiveConversation = useAppStore((s) => s.setActiveConversation);

  const [filter, setFilter] = useState<FilterType>("all");
  const [convFilter, setConvFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  // 转发图片：选会话弹框
  const [forwardOpen, setForwardOpen] = useState(false);
  const [forwardContacts, setForwardContacts] = useState<Contact[]>([]);

  // 挂载时批量加载所有会话的消息 — 解决刷新后无数据问题
  // loadMessages 内部有缓存检查，已加载的会话会跳过
  useEffect(() => {
    for (const conv of conversations) {
      loadMessages(conv.id);
    }
  }, [conversations, loadMessages]);

  // 聚合所有会话中的文件类消息
  const allItems = useMemo<FileItem[]>(() => {
    const items: FileItem[] = [];
    for (const conv of conversations) {
      const msgs = messagesByConv[conv.id];
      if (!msgs) continue;
      for (const m of msgs) {
        if (m.imageUrl) {
          items.push({
            message: m,
            type: "image",
            conversationId: conv.id,
            conversationName: conv.name,
          });
        } else if (m.fileName) {
          items.push({
            message: m,
            type: "file",
            conversationId: conv.id,
            conversationName: conv.name,
          });
        } else if (m.call) {
          items.push({
            message: m,
            type: "call",
            conversationId: conv.id,
            conversationName: conv.name,
          });
        }
      }
    }
    // 按时间倒序
    items.sort(
      (a, b) =>
        new Date(b.message.timestamp).getTime() -
        new Date(a.message.timestamp).getTime(),
    );
    return items;
  }, [conversations, messagesByConv]);

  // 统计计数
  const counts = useMemo(() => {
    const c = { all: allItems.length, image: 0, file: 0, call: 0 };
    for (const item of allItems) c[item.type]++;
    return c;
  }, [allItems]);

  // 应用筛选
  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      if (filter !== "all" && item.type !== filter) return false;
      if (convFilter !== "all" && item.conversationId !== convFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const name = item.message.fileName ?? item.conversationName;
        if (!name.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [allItems, filter, convFilter, searchQuery]);

  // 有文件的会话列表（用于会话筛选下拉）
  const convsWithFiles = useMemo(() => {
    const ids = new Set(allItems.map((i) => i.conversationId));
    return conversations.filter((c) => ids.has(c.id));
  }, [allItems, conversations]);

  // 跳转到对应会话
  const goToConversation = async (conversationId: string) => {
    await loadMessages(conversationId);
    setActiveConversation(conversationId);
    navigate(`/chat/${conversationId}`);
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

  // 格式化时间
  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    } catch {
      return "";
    }
  };

  // 通话状态文案 — 与 ConversationDetail 通话记录卡片逻辑保持一致
  const callLabel = (m: Message) => {
    if (!m.call) return "";
    const call = m.call;
    switch (call.status) {
      case "completed":
        return call.isCaller ? t("call.recordOutgoing") : t("call.recordIncoming");
      case "rejected":
        return t("call.recordRejected");
      case "missed":
        return t("call.recordMissed");
      case "failed":
        return t("call.recordFailed");
      case "busy":
        return t("call.recordBusy");
      case "cancelled":
        // 呼叫方视角：已取消；被叫方视角：未接来电
        return call.isCaller
          ? t("call.recordCancelled")
          : t("call.recordMissed");
      default:
        return t("call.recordMissed");
    }
  };

  const filterTabs: { key: FilterType; label: string; count: number }[] = [
    { key: "all", label: t("files.all"), count: counts.all },
    { key: "image", label: t("files.images"), count: counts.image },
    { key: "file", label: t("files.files"), count: counts.file },
    { key: "call", label: t("files.calls"), count: counts.call },
  ];

  // 空状态
  const isEmpty = filteredItems.length === 0;

  return (
    <AppLayout>
      <PageHeader title={t("files.title")} onBack={() => navigate("/")} />
      <PageScroll className="px-6 py-6" maxWidth={960}>
        {/* 筛选与搜索 */}
        <Card className="mb-4">
          {/* 类型筛选 Tab */}
          <div className="flex items-center gap-1 mb-3 flex-wrap">
            {filterTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                className={cn(
                  "px-3 py-1.5 rounded-[var(--radius-6)] text-[12px] font-medium cursor-pointer transition-colors duration-150",
                  filter === tab.key
                    ? "bg-brand text-text-onbrand"
                    : "bg-bg-tertiary text-text-secondary hover:text-text-default",
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    "ml-1.5 text-[10px]",
                    filter === tab.key ? "opacity-80" : "opacity-60",
                  )}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* 会话筛选 + 搜索 */}
          <div className="flex items-center gap-3">
            <select
              value={convFilter}
              onChange={(e) => setConvFilter(e.target.value)}
              className="h-9 px-3 rounded-[var(--radius-6)] bg-bg-tertiary border border-border-neutral text-[12px] text-text-default outline-none cursor-pointer flex-shrink-0"
            >
              <option value="all">{t("files.allConversations")}</option>
              {convsWithFiles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-bg-tertiary rounded-[var(--radius-6)] border border-border-neutral">
              <Search size={14} className="text-text-tertiary flex-shrink-0" />
              <input
                placeholder={t("files.searchPlaceholder")}
                className="border-none outline-none bg-transparent text-text-default text-[12px] w-full"
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
        </Card>

        {/* 空状态 */}
        {isEmpty ? (
          <Card>
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Folder size={40} className="text-text-tertiary mb-3" />
              <p className="text-[13px] text-text-secondary mb-1">
                {t("files.empty")}
              </p>
              <p className="text-[11px] text-text-tertiary">
                {t("files.emptyHint")}
              </p>
            </div>
          </Card>
        ) : (
          <>
            {/* 图片网格 */}
            {(filter === "all" || filter === "image") && (
              <Card className="mb-4">
                <SectionTitle icon={<ImageIcon size={18} />}>
                  {t("files.images")} ({counts.image})
                </SectionTitle>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                  {filteredItems
                    .filter((i) => i.type === "image")
                    .map((item) => (
                      <button
                        key={item.message.id}
                        type="button"
                        onClick={() => setPreviewImage(item.message.imageUrl!)}
                        className="group relative aspect-square rounded-[var(--radius-8)] overflow-hidden bg-bg-tertiary cursor-pointer"
                        title={item.conversationName}
                      >
                        <img
                          src={item.message.imageUrl}
                          alt={item.message.fileName ?? "image"}
                          className="w-full h-full object-cover transition-transform duration-150 group-hover:scale-105"
                          loading="lazy"
                        />
                        {/* 悬浮信息 */}
                        <div className="absolute inset-x-0 bottom-0 px-2 py-1 bg-black/60 text-white text-[10px] truncate opacity-0 group-hover:opacity-100 transition-opacity">
                          {item.conversationName}
                        </div>
                      </button>
                    ))}
                </div>
              </Card>
            )}

            {/* 文件列表 */}
            {(filter === "all" || filter === "file") && (
              <Card className="mb-4">
                <SectionTitle icon={<FileText size={18} />}>
                  {t("files.files")} ({counts.file})
                </SectionTitle>
                <div className="flex flex-col">
                  {filteredItems
                    .filter((i) => i.type === "file")
                    .map((item, idx) => (
                      <div key={item.message.id}>
                        {idx > 0 && <div className="h-px bg-border-neutral" />}
                        <button
                          type="button"
                          onClick={() => goToConversation(item.conversationId)}
                          className="w-full flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-[var(--radius-6)] hover:bg-[var(--bg-overlay-l1)] cursor-pointer transition-colors duration-100 text-left"
                        >
                          <div className="w-9 h-9 rounded-[var(--radius-6)] bg-bg-tertiary inline-flex items-center justify-center flex-shrink-0">
                            <FileText size={16} className="text-text-secondary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] text-text-default truncate">
                              {item.message.fileName ?? t("files.unknownFile")}
                            </div>
                            <div className="text-[11px] text-text-tertiary truncate">
                              {item.conversationName} ·{" "}
                              {formatTime(item.message.timestamp)}
                            </div>
                          </div>
                        </button>
                      </div>
                    ))}
                </div>
              </Card>
            )}

            {/* 通话记录列表 */}
            {(filter === "all" || filter === "call") && (
              <Card className="mb-4">
                <SectionTitle icon={<Phone size={18} />}>
                  {t("files.calls")} ({counts.call})
                </SectionTitle>
                <div className="flex flex-col">
                  {filteredItems
                    .filter((i) => i.type === "call")
                    .map((item, idx) => (
                      <div key={item.message.id}>
                        {idx > 0 && <div className="h-px bg-border-neutral" />}
                        <button
                          type="button"
                          onClick={() => goToConversation(item.conversationId)}
                          className="w-full flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-[var(--radius-6)] hover:bg-[var(--bg-overlay-l1)] cursor-pointer transition-colors duration-100 text-left"
                        >
                          <div className="w-9 h-9 rounded-[var(--radius-6)] bg-bg-tertiary inline-flex items-center justify-center flex-shrink-0">
                            <Phone size={16} className="text-text-secondary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] text-text-default truncate">
                              {callLabel(item.message)}
                            </div>
                            <div className="text-[11px] text-text-tertiary truncate">
                              {item.conversationName} ·{" "}
                              {formatTime(item.message.timestamp)}
                              {item.message.call?.duration
                                ? ` · ${Math.floor(item.message.call.duration / 60)}:${String(item.message.call.duration % 60).padStart(2, "0")}`
                                : ""}
                            </div>
                          </div>
                        </button>
                      </div>
                    ))}
                </div>
              </Card>
            )}
          </>
        )}
      </PageScroll>

      {/* 图片预览 Lightbox — 支持滚轮缩放、拖动平移 */}
      {previewImage && (
        <ImagePreview
          src={previewImage}
          onClose={() => setPreviewImage(null)}
          closeLabel={t("common.cancel")}
          actions={
            <>
              <button
                type="button"
                onClick={openForward}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-[12px] cursor-pointer transition-colors"
              >
                <Forward size={14} />
                {t("conversation.forward")}
              </button>
              <button
                type="button"
                onClick={handleAddAsEmoji}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-[12px] cursor-pointer transition-colors"
              >
                <Smile size={14} />
                {t("conversation.addAsEmoji")}
              </button>
              <a
                href={previewImage}
                download={
                  previewImage.startsWith("data:") ? "image.jpg" : undefined
                }
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-[12px] cursor-pointer transition-colors"
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
