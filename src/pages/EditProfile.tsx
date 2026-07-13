import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Camera, Trash } from "lucide-react";
import { AppLayout, PageScroll } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { SectionTitle } from "@/components/SettingRow";
import { useToast } from "@/components/Toast";
import { ConfirmDialog } from "@/components/Modal";
import { useAppStore } from "@/store";
import { api } from "@/api/client";

/** 压缩图片文件为方形 JPEG data URL（头像专用） */
function compressAvatar(file: File, size: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Failed to load image"));
      img.onload = () => {
        // 居中裁剪为正方形
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
        // 白底（防止 PNG 透明通道转 JPEG 变黑）
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

/** 编辑资料 — 头像 + 基本信息 + 联系方式 + 危险区 */
export default function EditProfile() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const user = useAppStore((s) => s.user);
  const updateUser = useAppStore((s) => s.updateUser);
  const logout = useAppStore((s) => s.logout);

  const [displayName, setDisplayName] = useState(user?.displayName ?? "You");
  const [statusMessage, setStatusMessage] = useState(
    user?.statusMessage ?? "Available",
  );
  const [bio, setBio] = useState(user?.bio ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  // 头像预览（本地 data URL，保存时随 updateUser 提交）
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(user?.avatarUrl);
  // 删除账号确认弹窗
  const [deleteOpen, setDeleteOpen] = useState(false);
  // 头像上传中（压缩 + 请求中）
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 选择头像文件 → 压缩 → 立即上传保存
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
      setAvatarUrl(dataUrl);
      await updateUser({ avatarUrl: dataUrl });
      toast(t("editProfile.avatarUpdated"), "success");
    } catch {
      toast(t("editProfile.avatarUpdateFailed"), "error");
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSave = async () => {
    // 前端邮箱格式校验
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast(t("editProfile.invalidEmail"), "error");
      return;
    }
    try {
      await updateUser({ displayName, statusMessage, bio, email, phone });
      navigate("/settings");
    } catch {
      toast(t("editProfile.saveFailed"), "error");
    }
  };

  // 确认删除账号：调用后端删除接口 → 登出 → 跳转登录页
  const handleConfirmDelete = async () => {
    setDeleteOpen(false);
    try {
      await api.deleteAccount();
      logout();
      navigate("/login", { replace: true });
    } catch {
      toast(t("editProfile.deleteAccountFailed"), "error");
    }
  };

  const inputCls =
    "w-full h-10 px-3 bg-bg-tertiary rounded-[var(--radius-8)] border border-border-neutral text-[13px] text-text-default placeholder:text-text-tertiary outline-none focus:border-brand transition-colors duration-150";

  return (
    <AppLayout>
      <PageHeader
        title={t("editProfile.title")}
        onBack={() => navigate("/settings")}
        actions={
          <Button variant="primary" size="sm" onClick={handleSave}>
            {t("common.save")}
          </Button>
        }
      />
      <PageScroll className="px-6 py-6" maxWidth={960}>
        {/* 头像区 */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-3">
            <Avatar
              initials={user?.initials ?? "Y"}
              color={user?.color ?? "brand"}
              size="2xl"
              imageUrl={avatarUrl}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarUploading}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-bg-tertiary border-2 border-bg-surface inline-flex items-center justify-center text-text-default hover:text-brand cursor-pointer transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
              aria-label={t("editProfile.changeAvatar")}
            >
              <Camera size={14} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={avatarUploading}
            className="text-[12px] text-brand hover:text-brand-hover cursor-pointer font-medium disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {avatarUploading ? t("common.loading") : t("editProfile.changeAvatar")}
          </button>
        </div>

        {/* Basic Info */}
        <Card className="mb-4">
          <SectionTitle>{t("editProfile.basicInfo")}</SectionTitle>
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-[11px] text-text-tertiary block mb-1.5">
                {t("settings.displayName")}
              </label>
              <input
                className={inputCls}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[11px] text-text-tertiary block mb-1.5">
                {t("editProfile.statusMessage")}
              </label>
              <input
                className={inputCls}
                value={statusMessage}
                onChange={(e) => setStatusMessage(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[11px] text-text-tertiary block mb-1.5">
                {t("editProfile.bio")}
              </label>
              <textarea
                className={`${inputCls} h-auto py-2.5 resize-none`}
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
            </div>
          </div>
        </Card>

        {/* Contact Details */}
        <Card className="mb-4">
          <SectionTitle>{t("editProfile.contactDetails")}</SectionTitle>
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-[11px] text-text-tertiary block mb-1.5">
                {t("settings.email")}
              </label>
              <input
                className={inputCls}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[11px] text-text-tertiary block mb-1.5">
                {t("settings.phone")}
              </label>
              <input
                className={inputCls}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>
        </Card>

        {/* Danger Zone */}
        <Card danger>
          <SectionTitle>{t("editProfile.dangerZone")}</SectionTitle>
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-[13px] text-status-error">{t("editProfile.deleteAccount")}</span>
              <span className="text-[11px] text-text-tertiary">
                {t("editProfile.deleteAccountHint")}
              </span>
            </div>
            <Button
              variant="danger"
              size="md"
              icon={<Trash size={14} />}
              onClick={() => setDeleteOpen(true)}
            >
              {t("common.delete")}
            </Button>
          </div>
        </Card>
      </PageScroll>

      {/* 删除账号确认弹窗 */}
      <ConfirmDialog
        open={deleteOpen}
        title={t("editProfile.deleteAccountTitle")}
        message={t("editProfile.deleteAccountMsg")}
        confirmLabel={t("common.delete")}
        danger
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </AppLayout>
  );
}
