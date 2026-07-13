import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Check, Loader2, Search, Users } from "lucide-react";
import { AppLayout, PageScroll } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Avatar } from "@/components/Avatar";
import { useToast } from "@/components/Toast";
import { api } from "@/api/client";
import { useAppStore } from "@/store";
import type { Contact } from "@/types";

/** 创建群聊 / 邀请成员 — 输入群名 + 多选好友
 *  通过 query string 切换模式：?mode=invite&groupId=xxx
 */
export default function CreateGroup() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  const mode: "create" | "invite" =
    searchParams.get("mode") === "invite" ? "invite" : "create";
  const inviteGroupId = searchParams.get("groupId") ?? undefined;

  const createGroup = useAppStore((s) => s.createGroup);
  const addGroupMembers = useAppStore((s) => s.addGroupMembers);
  const setActive = useAppStore((s) => s.setActiveConversation);
  const conversations = useAppStore((s) => s.conversations);

  // 邀请模式下，从本地会话获取已在群内的成员 id 列表
  const existingMemberIds =
    mode === "invite" && inviteGroupId
      ? (conversations.find(
          (c) => c.contactId === inviteGroupId || c.id === inviteGroupId,
        )?.memberIds ?? [])
      : [];

  const [groupName, setGroupName] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    api
      .getContacts()
      .then((list) => {
        // 邀请模式下排除已在群内的成员；创建模式下排除群组联系人
        const filtered = list.filter((c) => {
          if (c.isGroup) return false;
          if (existingMemberIds.includes(c.id)) return false;
          return true;
        });
        setContacts(filtered);
      })
      .catch(() => toast(t("addContact.searchFailed"), "error"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingMemberIds.join(",")]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredContacts = query.trim()
    ? contacts.filter((c) =>
        c.name.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : contacts;

  const selectedCount = selected.size;
  const canSubmit =
    !submitting &&
    selectedCount > 0 &&
    (mode === "invite" || groupName.trim().length > 0);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const memberIds = Array.from(selected);
    setSubmitting(true);
    try {
      if (mode === "invite" && inviteGroupId) {
        const ok = await addGroupMembers(inviteGroupId, memberIds);
        if (ok) {
          toast(t("group.added", { count: memberIds.length }), "success");
          navigate(-1);
        } else {
          toast(t("group.addFailed", { error: "" }), "error");
        }
      } else {
        const name = groupName.trim();
        const conv = await createGroup(name, memberIds);
        if (conv) {
          toast(t("group.created", { name }), "success");
          setActive(conv.id);
          navigate(`/chat/${conv.id}`, { replace: true });
        } else {
          toast(t("group.createFailed", { error: "" }), "error");
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const title = mode === "invite" ? t("group.inviteMembers") : t("group.createGroup");

  return (
    <AppLayout>
      <PageHeader
        title={title}
        onBack={() => navigate(-1)}
        actions={
          <Button
            variant="primary"
            size="md"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {submitting
              ? t("group.creating")
              : mode === "invite"
                ? t("group.addMembers")
                : t("group.create")}
          </Button>
        }
      />
      <PageScroll className="px-6 py-6" maxWidth={640}>
        <div className="mx-auto" style={{ maxWidth: 480 }}>
          {/* 群名输入（仅创建模式） */}
          {mode === "create" && (
            <div className="mb-6">
              <label className="block text-[12px] font-medium text-text-secondary mb-2">
                {t("group.groupName")}
              </label>
              <Input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder={t("group.groupNamePlaceholder")}
                maxLength={50}
                className="w-full"
                autoFocus
              />
            </div>
          )}

          {/* 已选计数 */}
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading text-[14px] font-semibold text-text-default">
              {t("group.selectMembers")}
            </h2>
            {selectedCount > 0 && (
              <span className="text-[11px] text-brand bg-brand-soft px-2.5 py-1 rounded-full">
                {t("group.selected", { count: selectedCount })}
              </span>
            )}
          </div>

          {/* 搜索 */}
          <div className="mb-3">
            <Input
              icon={<Search size={16} />}
              placeholder={t("addContact.enterNameOrEmail")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full"
            />
          </div>

          {/* 好友列表 */}
          {loading ? (
            <div className="flex items-center justify-center py-8 text-text-tertiary">
              <Loader2 size={18} className="animate-spin mr-2" />
              {t("common.loading")}
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="text-center text-text-tertiary py-8 text-[12px] bg-bg-surface rounded-[var(--radius-10)] border border-border-neutral">
              {mode === "invite"
                ? t("group.noMoreUsers")
                : t("sidebar.noContactsAvailable")}
            </div>
          ) : (
            <div className="bg-bg-surface rounded-[var(--radius-10)] border border-border-neutral">
              {filteredContacts.map((c, i) => {
                const isSelected = selected.has(c.id);
                return (
                  <div key={c.id}>
                    {i > 0 && <div className="h-px bg-border-neutral mx-5" />}
                    <button
                      type="button"
                      onClick={() => toggleSelect(c.id)}
                      className="flex items-center gap-3 w-full px-5 py-3.5 hover:bg-[var(--bg-overlay-l2)] transition-colors duration-100 cursor-pointer text-left"
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
                        <div className="text-[11px] text-text-tertiary truncate">
                          {c.email || c.lastSeen}
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center justify-center w-5 h-5 rounded-full border transition-colors duration-150 flex-shrink-0 ${
                          isSelected
                            ? "bg-brand border-brand text-text-onbrand"
                            : "border-border-neutral-2 text-transparent"
                        }`}
                      >
                        <Check size={12} />
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* 提示 */}
          {!loading && contacts.length === 0 && mode === "create" && (
            <div className="mt-6 flex flex-col items-center text-center py-8 text-text-tertiary">
              <Users size={32} className="opacity-40 mb-2" />
              <p className="text-[12px]">{t("sidebar.noContactsAvailable")}</p>
            </div>
          )}
        </div>
      </PageScroll>
    </AppLayout>
  );
}
