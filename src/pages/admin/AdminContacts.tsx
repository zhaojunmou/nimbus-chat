import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search, Loader2, Trash2, AlertCircle } from "lucide-react";
import { AdminNav } from "./AdminNav";
import { Avatar } from "@/components/Avatar";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { ConfirmDialog } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { api } from "@/api/client";
import type { Contact } from "@/types";
import { cn } from "@/lib/utils";

/** 管理后台 — 联系人管理表格（搜索 / 删除） */
export default function AdminContacts() {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState<string>("");
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  const load = useCallback(() => {
    setLoading(true);
    api.admin
      .getContacts()
      .then((data) => {
        setContacts(data);
        setError(null);
      })
      .catch(() => setError(t("admin.loadFailed")))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q),
    );
  }, [contacts, query]);

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    setDeleting(true);
    api.admin
      .deleteContact(deleteTarget.id)
      .then(() => {
        toast(t("admin.deleteSuccess"), "success");
        setDeleteTarget(null);
        load();
      })
      .catch(() => toast(t("admin.deleteFailed"), "error"))
      .finally(() => setDeleting(false));
  };

  return (
    <div className="min-h-screen flex bg-bg-base">
      <AdminNav />
      <main className="flex-1 overflow-y-auto">
        <div className="px-8 py-6" style={{ maxWidth: 1200 }}>
          <div className="flex items-center justify-between gap-4 mb-5">
            <h1 className="text-[14px] font-semibold font-heading text-text-default">
              {t("admin.contacts")}
            </h1>
            <div className="w-[280px]">
              <Input
                icon={<Search size={16} />}
                placeholder={t("common.search")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="text-brand animate-spin" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-status-error">
              <AlertCircle size={16} />
              {error}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-[13px] text-text-tertiary">
              {t("admin.noData")}
            </div>
          ) : (
            <div className="rounded-[var(--radius-10)] border border-border-neutral overflow-hidden bg-bg-surface">
              <table className="w-full">
                <thead>
                  <tr className="bg-bg-tertiary">
                    <th className="text-left text-[11px] uppercase font-semibold text-text-tertiary px-4 py-3">
                      {t("admin.name")}
                    </th>
                    <th className="text-left text-[11px] uppercase font-semibold text-text-tertiary px-4 py-3">
                      {t("admin.contactId")}
                    </th>
                    <th className="text-left text-[11px] uppercase font-semibold text-text-tertiary px-4 py-3">
                      {t("admin.isOnline")}
                    </th>
                    <th className="text-left text-[11px] uppercase font-semibold text-text-tertiary px-4 py-3">
                      {t("admin.group")}
                    </th>
                    <th className="text-left text-[11px] uppercase font-semibold text-text-tertiary px-4 py-3">
                      {t("admin.memberCount")}
                    </th>
                    <th className="text-left text-[11px] uppercase font-semibold text-text-tertiary px-4 py-3">
                      {t("admin.email")}
                    </th>
                    <th className="text-right text-[11px] uppercase font-semibold text-text-tertiary px-4 py-3">
                      {t("admin.actions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-border-neutral last:border-b-0 hover:bg-bg-tertiary transition-colors duration-150"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar
                            initials={c.initials}
                            color={c.color}
                            size="sm"
                            online={c.isOnline}
                            imageUrl={c.avatarUrl}
                          />
                          <span className="text-[13px] font-medium text-text-default">
                            {c.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-text-tertiary font-mono max-w-[140px] truncate">
                        {c.id}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 text-[13px]",
                            c.isOnline
                              ? "text-status-online"
                              : "text-text-tertiary",
                          )}
                        >
                          <span
                            className={cn(
                              "inline-block w-2 h-2 rounded-full",
                              c.isOnline ? "bg-status-online" : "bg-text-tertiary",
                            )}
                          />
                          {c.isOnline ? t("common.online") : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-text-secondary">
                        {c.isGroup ? t("admin.group") : "—"}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-text-secondary">
                        {c.isGroup ? c.memberCount ?? "—" : "—"}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-text-secondary max-w-[180px] truncate">
                        {c.email ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-status-error hover:bg-status-error/10 hover:text-status-error"
                            icon={<Trash2 size={13} />}
                            onClick={() => setDeleteTarget(c)}
                          >
                            {t("common.delete")}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      <ConfirmDialog
        open={deleteTarget !== null}
        title={t("admin.deleteContact")}
        message={t("admin.deleteContactConfirm")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        danger
        onConfirm={handleConfirmDelete}
        onCancel={() => (deleting ? undefined : setDeleteTarget(null))}
      />
    </div>
  );
}
