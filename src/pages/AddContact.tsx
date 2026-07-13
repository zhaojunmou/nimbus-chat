import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Link as LinkIcon,
  Grid2x2,
  UserCircle,
  Loader2,
  UserPlus,
  Check,
  X,
} from "lucide-react";
import { AppLayout, PageScroll } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Avatar } from "@/components/Avatar";
import { useToast } from "@/components/Toast";
import { api } from "@/api/client";
import { useAppStore } from "@/store";
import type { Contact } from "@/types";
import { useTranslation } from "react-i18next";

/** 添加联系人 — 搜索/邀请链接/二维码/导入 + 好友请求管理 */
export default function AddContact() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();

  const incomingRequests = useAppStore((s) => s.incomingRequests);
  const outgoingRequests = useAppStore((s) => s.outgoingRequests);
  const loadFriendRequests = useAppStore((s) => s.loadFriendRequests);
  const sendFriendRequest = useAppStore((s) => s.sendFriendRequest);
  const acceptFriendRequest = useAppStore((s) => s.acceptFriendRequest);
  const rejectFriendRequest = useAppStore((s) => s.rejectFriendRequest);

  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Contact[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  // 正在发送请求的联系人 id（防重复点击）
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  // 已发送请求的联系人 id（本地标记，用于 UI 状态切换）
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());

  // 页面加载时刷新好友请求
  useEffect(() => {
    loadFriendRequests().catch(() => {});
  }, [loadFriendRequests]);

  const inviteOptions = [
    { icon: LinkIcon, titleKey: "addContact.copyInviteLink", descKey: "addContact.shareUniqueLink", action: "Copy" },
    { icon: Grid2x2, titleKey: "addContact.showQrCode", descKey: "addContact.scanToAdd", action: "QR" },
    { icon: UserCircle, titleKey: "addContact.importFromDevice", descKey: "addContact.syncContacts", action: "Import" },
  ];

  const handleCopy = () => {
    navigator.clipboard?.writeText("https://nimbus.chat/i/you-x7f2a");
    setCopied(true);
    toast(t("addContact.inviteLinkCopied"), "success");
    setTimeout(() => setCopied(false), 1500);
  };

  const handleSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setHasSearched(true);
    try {
      const list = await api.searchUsers(q);
      setResults(list);
    } catch {
      toast(t("addContact.searchFailed"), "error");
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  // 发送好友请求
  const handleAddFriend = async (contact: Contact) => {
    setSendingTo(contact.id);
    try {
      const { autoAccepted } = await sendFriendRequest(contact.id);
      setSentTo((prev) => new Set(prev).add(contact.id));
      if (autoAccepted) {
        toast(t("addContact.requestAutoAccepted", { name: contact.name }), "success");
      } else {
        toast(t("addContact.requestSent", { name: contact.name }), "success");
      }
    } catch (err) {
      toast(
        t("addContact.requestFailed", { error: (err as Error).message }),
        "error",
      );
    } finally {
      setSendingTo(null);
    }
  };

  // 接受好友请求
  const handleAccept = async (requestId: string, name: string) => {
    try {
      await acceptFriendRequest(requestId);
      toast(t("addContact.requestAccepted", { name }), "success");
    } catch {
      toast(t("addContact.acceptFailed"), "error");
    }
  };

  // 拒绝好友请求
  const handleReject = async (requestId: string) => {
    try {
      await rejectFriendRequest(requestId);
      toast(t("addContact.requestRejected"), "success");
    } catch {
      toast(t("addContact.rejectFailed"), "error");
    }
  };

  // 判断联系人是否已有发出的 pending 请求
  const hasOutgoingTo = (contactId: string) =>
    outgoingRequests.some((r) => r.toUserId === contactId) ||
    sentTo.has(contactId);

  return (
    <AppLayout>
      <PageHeader
        title={t("addContact.title")}
        onBack={() => navigate("/contacts")}
      />
      <PageScroll className="px-6 py-6" maxWidth={960}>
        <div style={{ maxWidth: 480 }} className="mx-auto">
          {/* 搜索区 */}
          <h2 className="font-heading text-[14px] font-semibold text-text-default mb-3">
            {t("addContact.addByUsername")}
          </h2>
          <div className="flex gap-2 mb-4">
            <Input
              icon={<Search size={16} />}
              placeholder={t("addContact.enterNameOrEmail")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch();
              }}
              className="flex-1"
            />
            <Button
              variant="primary"
              size="lg"
              onClick={handleSearch}
              disabled={searching}
            >
              {searching ? "..." : t("common.search")}
            </Button>
          </div>

          {/* 搜索结果 */}
          {hasSearched && (
            <div className="mb-6">
              {searching && (
                <div className="flex items-center justify-center py-6 text-text-tertiary">
                  <Loader2 size={18} className="animate-spin mr-2" />
                  {t("addContact.searching")}
                </div>
              )}
              {!searching && results.length > 0 && (
                <div className="bg-bg-surface rounded-[var(--radius-10)] border border-border-neutral">
                  {results.map((c, i) => {
                    const sent = hasOutgoingTo(c.id);
                    return (
                      <div key={c.id}>
                        {i > 0 && <div className="h-px bg-border-neutral mx-5" />}
                        <div className="flex items-center gap-3 px-5 py-3.5">
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
                            <div className="text-[11px] text-text-tertiary truncate">
                              {c.email || c.lastSeen}
                            </div>
                          </div>
                          {sent ? (
                            <span className="text-[10px] text-brand bg-brand-soft px-2.5 py-1 rounded-full flex items-center gap-1">
                              <Check size={11} />
                              {t("addContact.pending")}
                            </span>
                          ) : (
                            <Button
                              variant="secondary"
                              size="sm"
                              icon={<UserPlus size={13} />}
                              onClick={() => handleAddFriend(c)}
                              disabled={sendingTo === c.id}
                            >
                              {sendingTo === c.id ? "..." : t("addContact.addFriend")}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {!searching && results.length === 0 && (
                <div className="text-center text-text-tertiary py-6 text-[12px] bg-bg-surface rounded-[var(--radius-10)] border border-border-neutral">
                  {t("addContact.noUsersFound")}
                </div>
              )}
            </div>
          )}

          {/* 分隔符 */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-border-neutral" />
            <span className="text-[11px] text-text-tertiary">{t("addContact.or")}</span>
            <div className="flex-1 h-px bg-border-neutral" />
          </div>

          {/* 邀请选项卡 */}
          <div className="bg-bg-surface rounded-[var(--radius-10)] border border-border-neutral">
            {inviteOptions.map((opt, i) => (
              <div key={i}>
                {i > 0 && <div className="h-px bg-border-neutral mx-5" />}
                <div className="flex items-center gap-3 px-5 py-4">
                  <opt.icon size={20} className="text-text-secondary flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-[13px] font-medium text-text-default">
                      {t(opt.titleKey)}
                    </div>
                    <div className="text-[11px] text-text-tertiary">{t(opt.descKey)}</div>
                  </div>
                  {opt.action === "Copy" ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleCopy}
                    >
                      {copied ? t("addContact.copied") : t("addContact.copy")}
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        opt.action === "QR"
                          ? toast(t("addContact.qrComingSoon"), "info")
                          : toast(t("addContact.importComingSoon"), "info")
                      }
                    >
                      {opt.action === "QR" ? t("addContact.qr") : t("addContact.import")}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* 收到的好友请求 */}
          <div className="flex items-center gap-2 mt-8 mb-3">
            <h2 className="font-heading text-[14px] font-semibold text-text-default">
              {t("addContact.incomingRequests")}
            </h2>
            {incomingRequests.length > 0 && (
              <span className="min-w-[20px] h-5 px-1 rounded-full bg-brand text-text-onbrand text-[10px] font-semibold flex items-center justify-center">
                {incomingRequests.length}
              </span>
            )}
          </div>
          {incomingRequests.length > 0 ? (
            <div className="bg-bg-surface rounded-[var(--radius-10)] border border-border-neutral">
              {incomingRequests.map((r, i) => (
                <div key={r.id}>
                  {i > 0 && <div className="h-px bg-border-neutral mx-5" />}
                  <div className="flex items-center gap-3 px-5 py-3.5">
                    <Avatar initials={r.fromInitials} color={r.fromColor} size="md" imageUrl={r.fromAvatarUrl} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-text-default truncate">
                        {r.fromName}
                      </div>
                      <div className="text-[11px] text-text-tertiary truncate">
                        {t("addContact.wantsToBeFriend")}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAccept(r.id, r.fromName)}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-[var(--radius-6)] text-brand hover:bg-brand-soft cursor-pointer transition-colors duration-150"
                      aria-label={t("addContact.accept")}
                    >
                      <Check size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReject(r.id)}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-[var(--radius-6)] text-status-error hover:bg-status-error/10 cursor-pointer transition-colors duration-150"
                      aria-label={t("addContact.reject")}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-text-tertiary py-4 text-[12px] bg-bg-surface rounded-[var(--radius-10)] border border-border-neutral">
              {t("addContact.noRequests")}
            </div>
          )}

          {/* 发出的好友请求 */}
          <div className="flex items-center gap-2 mt-6 mb-3">
            <h2 className="font-heading text-[14px] font-semibold text-text-default">
              {t("addContact.outgoingRequests")}
            </h2>
            {outgoingRequests.length > 0 && (
              <span className="min-w-[20px] h-5 px-1 rounded-full bg-text-tertiary text-text-onbrand text-[10px] font-semibold flex items-center justify-center" style={{ color: "var(--text-onbrand)" }}>
                {outgoingRequests.length}
              </span>
            )}
          </div>
          {outgoingRequests.length > 0 ? (
            <div className="bg-bg-surface rounded-[var(--radius-10)] border border-border-neutral">
              {outgoingRequests.map((r, i) => (
                <div key={r.id}>
                  {i > 0 && <div className="h-px bg-border-neutral mx-5" />}
                  <div className="flex items-center gap-3 px-5 py-3.5">
                    <Avatar initials={r.toInitials} color={r.toColor} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-text-default truncate">
                        {r.toName}
                      </div>
                      <div className="text-[11px] text-text-tertiary">
                        {r.timestamp}
                      </div>
                    </div>
                    <span className="text-[10px] text-brand bg-brand-soft px-2 py-0.5 rounded-full">
                      {t("addContact.pending")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-text-tertiary py-4 text-[12px] bg-bg-surface rounded-[var(--radius-10)] border border-border-neutral">
              {t("addContact.noRequests")}
            </div>
          )}
        </div>
      </PageScroll>
    </AppLayout>
  );
}
