import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, MessageCircle, Phone, Pencil } from "lucide-react";
import { AppLayout, PageScroll } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { FilterPill } from "@/components/FilterPill";
import { Input } from "@/components/Input";
import { useToast } from "@/components/Toast";
import { api } from "@/api/client";
import { useAppStore } from "@/store";
import type { Contact } from "@/types";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

type Filter = "all" | "online" | "groups";

/** 联系人管理 — 字母分组 + 过滤标签 + 搜索 */
export default function ContactsManagement() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const ensureConversation = useAppStore((s) => s.ensureConversation);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);

  useEffect(() => {
    let cancelled = false;
    api
      .getContacts()
      .then((data) => {
        if (!cancelled) setContacts(data);
      })
      .catch(() => {
        if (!cancelled) toast(t("contacts.failedToLoad"), "error");
      });
    return () => {
      cancelled = true;
    };
  }, [toast, t]);

  const filtered = useMemo(() => {
    return contacts.filter((c) => {
      if (filter === "online" && !c.isOnline) return false;
      if (filter === "groups" && !c.isGroup) return false;
      if (query && !c.name.toLowerCase().includes(query.toLowerCase()))
        return false;
      return true;
    });
  }, [contacts, filter, query]);

  // 按首字母分组
  const groups = useMemo(() => {
    const map = new Map<string, typeof contacts>();
    filtered.forEach((c) => {
      const letter = c.name[0].toUpperCase();
      if (!map.has(letter)) map.set(letter, []);
      map.get(letter)!.push(c);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const counts = {
    all: contacts.length,
    online: contacts.filter((c) => c.isOnline).length,
    groups: contacts.filter((c) => c.isGroup).length,
  };

  return (
    <AppLayout>
      <PageHeader
        title={t("contacts.title")}
        onBack={() => navigate("/")}
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={14} />}
            onClick={() => navigate("/contacts/add")}
          >
            {t("nav.addContact")}
          </Button>
        }
      />
      <div className="px-6 py-4 border-b border-border-neutral flex flex-col gap-3 flex-shrink-0">
        <Input
          icon={<Search size={16} />}
          placeholder={t("contacts.searchContacts")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="flex items-center gap-2">
          <FilterPill
            active={filter === "all"}
            label={t("contacts.all")}
            count={counts.all}
            onClick={() => setFilter("all")}
          />
          <FilterPill
            active={filter === "online"}
            label={t("contacts.online")}
            count={counts.online}
            onClick={() => setFilter("online")}
          />
          <FilterPill
            active={filter === "groups"}
            label={t("contacts.groups")}
            count={counts.groups}
            onClick={() => setFilter("groups")}
          />
        </div>
      </div>
      <PageScroll className="px-6 py-4">
        {groups.map(([letter, items]) => (
          <div key={letter} className="mb-5">
            <h3 className="text-[11px] font-semibold text-text-tertiary px-2 mb-1">
              {letter}
            </h3>
            {items.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => navigate(c.isGroup ? `/groups/${c.id}` : `/contacts/${c.id}`)}
                className="flex items-center gap-3 w-full px-2 py-2.5 rounded-[var(--radius-8)] hover:bg-[var(--bg-overlay-l2)] cursor-pointer transition-colors duration-100 text-left"
              >
                <Avatar
                  initials={c.initials}
                  color={c.color}
                  size="lg"
                  online={c.isOnline}
                  square={c.isGroup}
                  imageUrl={c.avatarUrl}
                />
                <div className="flex-1 min-w-0">
                  <span
                    className={cn(
                      "text-[13px] font-medium text-text-default block",
                      !c.isOnline && !c.isGroup && "opacity-50",
                    )}
                  >
                    {c.name}
                  </span>
                  <span
                    className={cn(
                      "text-[11px]",
                      c.isOnline ? "text-brand" : "text-text-tertiary",
                    )}
                  >
                    {c.lastSeen}
                  </span>
                </div>
                {/* 操作按钮组：编辑 / 通话 / 发消息 */}
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(c.isGroup ? `/groups/${c.id}` : `/contacts/${c.id}`);
                    }}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-[var(--radius-6)] text-text-tertiary hover:bg-[var(--bg-overlay-l3)] hover:text-brand cursor-pointer transition-colors duration-150"
                    aria-label={t("contacts.edit")}
                    title={t("contacts.edit")}
                  >
                    <Pencil size={15} />
                  </span>
                  {!c.isGroup && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        ensureConversation(c.id).then((conv) =>
                          navigate(`/call/${conv.id}`),
                        );
                      }}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-[var(--radius-6)] text-text-tertiary hover:bg-[var(--bg-overlay-l3)] hover:text-brand cursor-pointer transition-colors duration-150"
                      aria-label={t("call.call")}
                      title={t("call.call")}
                    >
                      <Phone size={15} />
                    </span>
                  )}
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      ensureConversation(c.id).then((conv) =>
                        navigate(`/chat/${conv.id}`),
                      );
                    }}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-[var(--radius-6)] text-text-tertiary hover:bg-[var(--bg-overlay-l3)] hover:text-brand cursor-pointer transition-colors duration-150"
                    aria-label={t("contacts.sendMessage")}
                    title={t("contacts.sendMessage")}
                  >
                    <MessageCircle size={16} />
                  </span>
                </div>
              </button>
            ))}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center text-text-tertiary py-12 text-[13px]">
            {t("contacts.noContactsFound")}
          </div>
        )}
      </PageScroll>
    </AppLayout>
  );
}
