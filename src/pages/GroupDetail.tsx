import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Camera,
  Check,
  ChevronRight,
  Crown,
  Loader2,
  LogOut,
  MessageCircle,
  Pencil,
  Trash2,
  UserMinus,
  UserPlus,
  X,
} from "lucide-react";
import { AppLayout, PageScroll } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { IconButton } from "@/components/IconButton";
import { Input } from "@/components/Input";
import { ConfirmDialog } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { useAppStore } from "@/store";
import type { Contact } from "@/types";

/** 压缩图片为方形 JPEG data URL（头像专用） */
function compressAvatar(file: File, size: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Failed to load image"));
      img.onload = () => {
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas not supported"));
          return;
        }
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/** 群聊详情 — 群信息头卡 + 成员列表 + 邀请/退出/移除/改名 */
export default function GroupDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();

  const conversations = useAppStore((s) => s.conversations);
  const user = useAppStore((s) => s.user);
  const getGroupMembers = useAppStore((s) => s.getGroupMembers);
  const leaveGroup = useAppStore((s) => s.leaveGroup);
  const removeGroupMember = useAppStore((s) => s.removeGroupMember);
  const updateGroupName = useAppStore((s) => s.updateGroupName);
  const updateGroupAvatar = useAppStore((s) => s.updateGroupAvatar);
  const setActive = useAppStore((s) => s.setActiveConversation);

  // 本地会话副本（实时同步 memberIds/groupOwnerId 等）
  const conv = conversations.find((c) => c.contactId === id || c.id === id);

  const [members, setMembers] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<Contact | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);
  // 群头像上传
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [confirmRemoveAvatar, setConfirmRemoveAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const groupId = conv?.contactId ?? id ?? "";

  // 拉取群成员
  const reloadMembers = async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      const list = await getGroupMembers(groupId);
      setMembers(list);
    } catch (err) {
      console.error("[GroupDetail] load members failed:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reloadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  // 当前用户在群内的身份判断
  const myId = user?.id ?? "";
  const isMember = conv?.memberIds?.includes(myId) ?? true;
  const isOwner = conv?.groupOwnerId === myId;
  const isAdmin =
    isOwner || (conv?.groupAdminIds?.includes(myId) ?? false);

  // 打开群聊会话
  const handleOpenChat = async () => {
    if (!conv) return;
    setActive(conv.id);
    navigate(`/chat/${conv.id}`);
  };

  // 邀请成员 — 跳转到 CreateGroup 的 invite 模式
  const handleInvite = () => {
    navigate(`/groups/new?mode=invite&groupId=${encodeURIComponent(groupId)}`);
  };

  // 退出群聊
  const handleLeave = async () => {
    setConfirmLeave(false);
    const ok = await leaveGroup(groupId);
    if (ok) {
      toast(t("group.left"), "success");
      navigate("/", { replace: true });
    } else {
      toast(t("group.leaveFailed", { error: "" }), "error");
    }
  };

  // 移除成员
  const handleRemove = async () => {
    if (!confirmRemove) return;
    const target = confirmRemove;
    setConfirmRemove(null);
    const ok = await removeGroupMember(groupId, target.id);
    if (ok) {
      toast(t("group.removed", { name: target.name }), "success");
      setMembers((prev) => prev.filter((m) => m.id !== target.id));
    } else {
      toast(t("group.removeFailed", { error: "" }), "error");
    }
  };

  // 编辑群名
  const openEditName = () => {
    setNameDraft(conv?.name ?? "");
    setEditingName(true);
  };

  const handleSaveName = async () => {
    const name = nameDraft.trim();
    if (!name || name === conv?.name) {
      setEditingName(false);
      return;
    }
    setSavingName(true);
    const ok = await updateGroupName(groupId, name);
    setSavingName(false);
    if (ok) {
      toast(t("group.nameUpdated"), "success");
      setEditingName(false);
    } else {
      toast(t("group.updateFailed", { error: "" }), "error");
    }
  };

  // 选择群头像文件 → 压缩 → 上传
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // 允许重复选同一文件
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast(t("editProfile.avatarImageOnly"), "error");
      return;
    }
    setAvatarUploading(true);
    try {
      const dataUrl = await compressAvatar(file, 256, 0.85);
      const ok = await updateGroupAvatar(groupId, dataUrl);
      if (ok) {
        toast(t("group.avatarUpdated"), "success");
      } else {
        toast(t("group.updateFailed", { error: "" }), "error");
      }
    } catch {
      toast(t("editProfile.avatarUpdateFailed"), "error");
    } finally {
      setAvatarUploading(false);
    }
  };

  // 移除群头像
  const handleRemoveAvatar = async () => {
    setConfirmRemoveAvatar(false);
    const ok = await updateGroupAvatar(groupId, null);
    if (ok) {
      toast(t("group.avatarRemoved"), "success");
    } else {
      toast(t("group.updateFailed", { error: "" }), "error");
    }
  };

  if (!conv) {
    return (
      <AppLayout>
        <PageHeader title={t("group.groupInfo")} onBack={() => navigate(-1)} />
        <div className="flex-1 flex items-center justify-center text-text-secondary">
          {t("group.groupNotFound")}
        </div>
      </AppLayout>
    );
  }

  const memberCount = conv.memberIds?.length ?? members.length;

  return (
    <AppLayout>
      <PageHeader
        title={t("group.groupInfo")}
        onBack={() => navigate(-1)}
        actions={
          <IconButton
            icon={<MessageCircle size={18} />}
            onClick={handleOpenChat}
            aria-label={t("contactProfile.message")}
          />
        }
      />
      <PageScroll className="px-6 py-6" maxWidth={960}>
        {/* 群信息头卡 */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="mb-4 relative inline-block leading-[0]">
            <div
              className="inline-block leading-[0]"
              style={{ padding: 3, background: "var(--bg-brand)", borderRadius: "50%" }}
            >
              <div
                className="inline-block leading-[0]"
                style={{
                  padding: 3,
                  background: "var(--bg-base-default)",
                  borderRadius: "50%",
                }}
              >
                <Avatar
                  initials={conv.initials}
                  color={conv.color}
                  size="2xl"
                  imageUrl={conv.avatarUrl}
                />
              </div>
            </div>
            {/* 群主可点击修改头像 — 相机角标 */}
            {isOwner && (
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarUploading}
                className="absolute bottom-1 right-1 inline-flex items-center justify-center w-7 h-7 rounded-full bg-bg-surface border border-border-neutral text-text-secondary hover:text-brand hover:border-brand cursor-pointer transition-colors duration-150 disabled:opacity-50"
                aria-label={t("group.changeAvatar")}
                title={t("group.changeAvatar")}
              >
                {avatarUploading ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Camera size={13} />
                )}
              </button>
            )}
            {/* 群主且已有自定义头像 — 移除按钮 */}
            {isOwner && conv.avatarUrl && !avatarUploading && (
              <button
                type="button"
                onClick={() => setConfirmRemoveAvatar(true)}
                className="absolute top-0 right-0 inline-flex items-center justify-center w-6 h-6 rounded-full bg-bg-surface border border-border-neutral text-status-error hover:bg-status-error/10 cursor-pointer transition-colors duration-150"
                aria-label={t("group.removeAvatar")}
                title={t("group.removeAvatar")}
              >
                <Trash2 size={11} />
              </button>
            )}
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>

          {editingName ? (
            <div className="flex items-center gap-2 max-w-[320px] w-full">
              <Input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                maxLength={50}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveName();
                  if (e.key === "Escape") setEditingName(false);
                }}
                className="flex-1"
              />
              <IconButton
                icon={
                  savingName ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Check size={16} />
                  )
                }
                size="sm"
                onClick={handleSaveName}
                disabled={savingName}
                aria-label={t("group.save")}
              />
              <IconButton
                icon={<X size={16} />}
                size="sm"
                onClick={() => setEditingName(false)}
                aria-label={t("common.cancel")}
              />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="font-heading text-[20px] font-semibold text-text-default">
                {conv.name}
              </h1>
              {isAdmin && (
                <button
                  type="button"
                  onClick={openEditName}
                  className="text-text-tertiary hover:text-text-default cursor-pointer transition-colors duration-150"
                  aria-label={t("group.editName")}
                >
                  <Pencil size={14} />
                </button>
              )}
            </div>
          )}

          <p className="text-[12px] text-text-tertiary mt-1.5">
            {t("common.members", { count: memberCount })}
          </p>

          {/* 操作按钮 */}
          <div className="flex items-center gap-2 mt-5">
            <Button
              variant="primary"
              size="lg"
              icon={<MessageCircle size={16} />}
              onClick={handleOpenChat}
            >
              {t("contactProfile.message")}
            </Button>
            {isMember && (
              <Button
                variant="outline"
                size="lg"
                icon={<UserPlus size={16} />}
                onClick={handleInvite}
                disabled={!isAdmin}
                title={!isAdmin ? t("group.admin") : undefined}
              >
                {t("group.addMembers")}
              </Button>
            )}
            {isMember && !isOwner && (
              <Button
                variant="outline"
                size="lg"
                icon={<LogOut size={16} />}
                onClick={() => setConfirmLeave(true)}
              >
                {t("group.leaveGroup")}
              </Button>
            )}
          </div>
        </div>

        {/* 成员列表 */}
        <section className="bg-bg-surface rounded-[var(--radius-10)] border border-border-neutral">
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <h2 className="font-heading text-[13px] font-semibold text-text-default">
              {t("group.members")}
            </h2>
            <span className="text-[11px] text-text-tertiary">
              {t("common.members", { count: memberCount })}
            </span>
          </div>
          <div className="px-5 pb-3">
            {loading ? (
              <div className="flex items-center justify-center py-6 text-text-tertiary">
                <Loader2 size={16} className="animate-spin mr-2" />
                {t("common.loading")}
              </div>
            ) : members.length === 0 ? (
              <div className="text-center text-text-tertiary py-6 text-[12px]">
                {t("group.emptyMembers")}
              </div>
            ) : (
              members.map((m, i) => {
                const isMOwner = conv.groupOwnerId === m.id;
                const isMAdmin =
                  isMOwner || (conv.groupAdminIds?.includes(m.id) ?? false);
                const isMe = m.id === myId;
                const canRemove =
                  isAdmin && !isMOwner && !isMe;
                return (
                  <div key={m.id}>
                    {i > 0 && <div className="h-px bg-border-neutral" />}
                    <div className="flex items-center gap-3 py-2.5 group">
                      <Avatar
                        initials={m.initials}
                        color={m.color}
                        size="md"
                        online={m.isOnline}
                        imageUrl={m.avatarUrl}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-medium text-text-default truncate">
                            {m.name}
                          </span>
                          {isMe && (
                            <span className="text-[10px] text-text-tertiary">
                              ({t("group.you")})
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-text-tertiary truncate">
                          {m.email || (m.isOnline ? t("common.online") : m.lastSeen)}
                        </div>
                      </div>
                      {isMOwner && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-amber bg-amber/10 px-2 py-1 rounded-full">
                          <Crown size={11} />
                          {t("group.owner")}
                        </span>
                      )}
                      {!isMOwner && isMAdmin && (
                        <span className="text-[10px] text-brand bg-brand-soft px-2 py-1 rounded-full">
                          {t("group.admin")}
                        </span>
                      )}
                      {canRemove && (
                        <button
                          type="button"
                          onClick={() => setConfirmRemove(m)}
                          className="opacity-0 group-hover:opacity-100 inline-flex items-center justify-center w-7 h-7 rounded-[var(--radius-6)] text-status-error hover:bg-status-error/10 cursor-pointer transition-all duration-150"
                          aria-label={t("group.removeMember")}
                          title={t("group.removeMember")}
                        >
                          <UserMinus size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* 邀请入口（管理员可见，列表底部快捷入口） */}
          {isAdmin && isMember && !loading && (
            <div className="h-px bg-border-neutral mx-5" />
          )}
          {isAdmin && isMember && (
            <button
              type="button"
              onClick={handleInvite}
              className="flex items-center gap-3 w-full px-5 py-3 hover:bg-[var(--bg-overlay-l2)] transition-colors duration-100 cursor-pointer text-left"
            >
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-brand-soft text-brand">
                <UserPlus size={16} />
              </span>
              <span className="flex-1 text-[13px] font-medium text-brand">
                {t("group.inviteMembers")}
              </span>
              <ChevronRight size={16} className="text-text-tertiary" />
            </button>
          )}
        </section>

        {/* 退出群聊（危险区，仅非群主成员显示） */}
        {isMember && !isOwner && (
          <section className="mt-4 bg-bg-surface rounded-[var(--radius-10)] border border-border-neutral">
            <button
              type="button"
              onClick={() => setConfirmLeave(true)}
              className="flex items-center gap-3 w-full px-5 py-3.5 hover:bg-status-error/5 transition-colors duration-100 cursor-pointer text-left"
            >
              <LogOut size={16} className="text-status-error flex-shrink-0" />
              <span className="flex-1 text-[13px] font-medium text-status-error">
                {t("group.leaveGroup")}
              </span>
            </button>
          </section>
        )}

        {/* 占位说明 — 群主无法退出 */}
        {isOwner && (
          <p className="text-center text-[11px] text-text-tertiary mt-4">
            {t("group.ownerCannotLeave")}
          </p>
        )}
      </PageScroll>

      {/* 退出群聊确认 */}
      <ConfirmDialog
        open={confirmLeave}
        title={t("group.leaveGroup")}
        message={t("group.leaveConfirm")}
        confirmLabel={t("group.leaveGroup")}
        danger
        onConfirm={handleLeave}
        onCancel={() => setConfirmLeave(false)}
      />

      {/* 移除成员确认 */}
      <ConfirmDialog
        open={!!confirmRemove}
        title={t("group.removeMember")}
        message={t("group.removeConfirm", { name: confirmRemove?.name ?? "" })}
        confirmLabel={t("group.removeMember")}
        danger
        onConfirm={handleRemove}
        onCancel={() => setConfirmRemove(null)}
      />

      {/* 移除群头像确认 */}
      <ConfirmDialog
        open={confirmRemoveAvatar}
        title={t("group.removeAvatar")}
        message={t("group.removeAvatarConfirm")}
        confirmLabel={t("common.delete")}
        danger
        onConfirm={handleRemoveAvatar}
        onCancel={() => setConfirmRemoveAvatar(false)}
      />
    </AppLayout>
  );
}
