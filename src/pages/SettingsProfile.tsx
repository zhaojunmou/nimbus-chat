import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  UserCircle,
  Bell,
  Shield,
  Palette,
  Sliders,
  Info,
  Edit3,
  LogOut,
  Check,
} from "lucide-react";
import { AppLayout, PageScroll } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { SettingRow, SectionTitle } from "@/components/SettingRow";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { useAppStore, avatarColors, refreshBadge } from "@/store";
import { api } from "@/api/client";
import { getPreferences, savePreferences } from "@/lib/preferences";
import { colorVarMap, type AvatarColor } from "@/types";
import { changeLanguage, availableLanguages, type AppLanguage } from "@/i18n";
import { getSavedTheme, setTheme, type AppTheme } from "@/lib/theme";

/** 设置中心 — 账号/通知/隐私/外观/高级/关于 */
export default function SettingsProfile() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const user = useAppStore((s) => s.user);
  const logout = useAppStore((s) => s.logout);

  // 通知开关从持久化偏好初始化
  const [msgNoti, setMsgNoti] = useState(() => getPreferences().msgNoti);
  const [soundNoti, setSoundNoti] = useState(() => getPreferences().soundNoti);
  const [showPreview, setShowPreview] = useState(
    () => getPreferences().showPreview,
  );
  // 外观偏好
  const [theme, setThemeState] = useState<AppTheme>(() => getSavedTheme());
  const [accentColor, setAccentColor] = useState<string>(
    () => getPreferences().accentColor,
  );
  // 版本号：加载前用兜底值，useEffect 中拉取后覆盖
  const [version, setVersion] = useState("2.1.0");
  // 屏蔽联系人数：从后端拉取
  const [blockedCount, setBlockedCount] = useState(0);

  // 选择弹框开关：language / theme / accent
  const [langOpen, setLangOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [accentOpen, setAccentOpen] = useState(false);

  // 拉取后端版本号 + 屏蔽联系人数
  useEffect(() => {
    let active = true;
    api
      .getVersion()
      .then((res) => {
        if (active && res?.version) setVersion(res.version);
      })
      .catch(() => {
        /* 拉取失败保留兜底值 */
      });
    api
      .getBlockedContacts()
      .then((list) => {
        if (active) setBlockedCount(list.length);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // 通知开关切换：持久化 + toast 提示
  const handleMsgNoti = (v: boolean) => {
    setMsgNoti(v);
    savePreferences({ msgNoti: v });
    // 立即同步浏览器标签页徽章（关闭时清除，开启时恢复）
    refreshBadge();
    toast(v ? t("settings.msgNotiOn") : t("settings.msgNotiOff"), "success");
  };
  const handleSoundNoti = (v: boolean) => {
    setSoundNoti(v);
    savePreferences({ soundNoti: v });
    toast(v ? t("settings.soundOn") : t("settings.soundOff"), "success");
  };
  const handleShowPreview = (v: boolean) => {
    setShowPreview(v);
    savePreferences({ showPreview: v });
    toast(v ? t("settings.previewOn") : t("settings.previewOff"), "success");
  };

  // 应用已保存的强调色到 CSS 变量（挂载时 + 切换时）
  useEffect(() => {
    if (accentColor !== "brand") {
      document.documentElement.style.setProperty(
        "--bg-brand",
        colorVarMap[accentColor as keyof typeof colorVarMap],
      );
    }
  }, [accentColor]);

  // 主题切换：应用 + 持久化 + toast
  const handleThemeSelect = (next: AppTheme) => {
    setTheme(next);
    setThemeState(next);
    savePreferences({ theme: next });
    setThemeOpen(false);
    toast(
      t("settings.themeChanged", {
        theme: next === "dark" ? t("settings.themeDark") : t("settings.themeLight"),
      }),
      "success",
    );
  };

  // 强调色切换：应用 CSS 变量 + 持久化 + toast
  const handleAccentSelect = (next: AvatarColor) => {
    setAccentColor(next);
    savePreferences({ accentColor: next });
    document.documentElement.style.setProperty("--bg-brand", colorVarMap[next]);
    setAccentOpen(false);
    toast(t("settings.accentChanged", { color: t(`settings.color_${next}` as `settings.color_${AvatarColor}`) }), "success");
  };

  // 语言切换：持久化 + toast
  const handleLangSelect = (lang: AppLanguage) => {
    changeLanguage(lang);
    setLangOpen(false);
    toast(
      t("settings.languageChanged", {
        lang: lang === "zh" ? "中文" : "English",
      }),
      "success",
    );
  };

  // 清除缓存：清理本地缓存数据 + toast
  const handleClearCache = () => {
    try {
      // 清理非关键 localStorage（保留认证、语言、主题、偏好）
      const keep = new Set([
        "nimbus_chat_token",
        "nimbus_chat_user",
        "nimbus_chat_lang",
        "nimbus_chat_theme",
        "nimbus_chat_prefs",
        "nimbus.customEmojis",
      ]);
      const toRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && !keep.has(key)) toRemove.push(key);
      }
      toRemove.forEach((k) => localStorage.removeItem(k));
      toast(t("settings.cacheCleared"), "success");
    } catch {
      toast(t("settings.cacheCleared"), "success");
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  // 当前语言的展示名
  const currentLangLabel =
    availableLanguages.find((l) => l.code === i18n.language)?.label ?? "English";

  return (
    <AppLayout>
      <PageHeader title={t("settings.title")} onBack={() => navigate("/")} />
      <PageScroll className="px-6 pt-6 pb-10" maxWidth={960}>
        {/* 资料卡 */}
        <div className="flex flex-col items-center text-center mb-8">
          <div
            className="mb-4"
            style={{
              padding: 3,
              width: 76,
              height: 76,
              background: "var(--bg-brand)",
              borderRadius: "50%",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                padding: 3,
                width: 70,
                height: 70,
                background: "var(--bg-base-default)",
                borderRadius: "50%",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Avatar
                initials={user?.initials ?? "Y"}
                color={user?.color ?? "brand"}
                size="xl"
                imageUrl={user?.avatarUrl}
              />
            </div>
          </div>
          <h1 className="font-heading text-[18px] font-semibold text-text-default">
            {user?.displayName ?? "You"}
          </h1>
          <p className="text-[12px] text-text-secondary mt-0.5">
            {user?.email ?? "you@nimbus.chat"}
          </p>
          <Button
            variant="primary"
            size="md"
            icon={<Edit3 size={14} />}
            className="mt-4"
            onClick={() => navigate("/settings/profile")}
          >
            {t("settings.editProfile")}
          </Button>
        </div>

        {/* Account */}
        <Card className="mb-4">
          <SectionTitle icon={<UserCircle size={18} />}>{t("settings.account")}</SectionTitle>
          <SettingRow label={t("settings.displayName")} value={user?.displayName ?? "You"} />
          <div className="h-px bg-border-neutral" />
          <SettingRow label={t("settings.email")} value={user?.email ?? "—"} />
          <div className="h-px bg-border-neutral" />
          <SettingRow label={t("settings.phone")} value={user?.phone ?? "—"} />
        </Card>

        {/* Notifications */}
        <Card className="mb-4">
          <SectionTitle icon={<Bell size={18} />}>{t("settings.notifications")}</SectionTitle>
          <SettingRow
            label={t("settings.messageNotifications")}
            hint={t("settings.messageNotificationsHint")}
            toggle={{ checked: msgNoti, onChange: handleMsgNoti }}
          />
          <div className="h-px bg-border-neutral" />
          <SettingRow
            label={t("settings.soundAlerts")}
            hint={t("settings.soundAlertsHint")}
            toggle={{ checked: soundNoti, onChange: handleSoundNoti }}
          />
          <div className="h-px bg-border-neutral" />
          <SettingRow
            label={t("settings.showPreview")}
            hint={t("settings.showPreviewHint")}
            toggle={{ checked: showPreview, onChange: handleShowPreview }}
          />
        </Card>

        {/* Privacy & Security */}
        <Card className="mb-4">
          <SectionTitle icon={<Shield size={18} />}>{t("settings.privacySecurity")}</SectionTitle>
          <SettingRow label={t("settings.twoFactor")} value={t("settings.twoFactorEnabled")} onClick={() => navigate("/settings/privacy")} />
          <div className="h-px bg-border-neutral" />
          <SettingRow label={t("settings.blockedContacts")} value={String(blockedCount)} onClick={() => navigate("/settings/privacy")} />
          <div className="h-px bg-border-neutral" />
          <SettingRow label={t("settings.lastLogin")} value={t("settings.lastLoginValue")} onClick={() => navigate("/settings/privacy")} />
        </Card>

        {/* Appearance */}
        <Card className="mb-4">
          <SectionTitle icon={<Palette size={18} />}>{t("settings.appearance")}</SectionTitle>
          <SettingRow
            label={t("settings.theme")}
            value={theme === "dark" ? t("settings.themeDark") : t("settings.themeLight")}
            onClick={() => setThemeOpen(true)}
          />
          <div className="h-px bg-border-neutral" />
          <SettingRow
            label={t("settings.language")}
            value={currentLangLabel}
            onClick={() => setLangOpen(true)}
          />
          <div className="h-px bg-border-neutral" />
          <SettingRow
            label={t("settings.accentColor")}
            value={t(`settings.color_${accentColor}` as const)}
            onClick={() => setAccentOpen(true)}
          />
        </Card>

        {/* Advanced */}
        <Card className="mb-4">
          <SectionTitle icon={<Sliders size={18} />}>{t("settings.advanced")}</SectionTitle>
          <SettingRow
            label={t("settings.storageUsage")}
            value={t("settings.storageValue")}
            onClick={() => navigate("/settings/storage")}
          />
          <div className="h-px bg-border-neutral" />
          <SettingRow
            label={t("nav.files")}
            onClick={() => navigate("/files")}
          />
          <div className="h-px bg-border-neutral" />
          <SettingRow
            label={t("settings.clearCache")}
            onClick={handleClearCache}
          />
        </Card>

        {/* About */}
        <Card className="mb-4">
          <SectionTitle icon={<Info size={18} />}>{t("settings.about")}</SectionTitle>
          <SettingRow label={t("settings.version")} value={version} />
          <div className="h-px bg-border-neutral" />
          <SettingRow
            label={t("settings.termsOfService")}
            onClick={() => window.open("https://nimbus.chat/terms", "_blank")}
          />
          <div className="h-px bg-border-neutral" />
          <SettingRow
            label={t("settings.privacyPolicy")}
            onClick={() => window.open("https://nimbus.chat/privacy", "_blank")}
          />
        </Card>

        {/* Sign out */}
        <button
          type="button"
          onClick={handleLogout}
          className="w-full h-11 rounded-[var(--radius-8)] bg-bg-menu border border-border-neutral text-status-error text-[13px] font-medium inline-flex items-center justify-center gap-2 hover:bg-[var(--bg-overlay-l2)] transition-colors duration-150 cursor-pointer"
        >
          <LogOut size={15} />
          {t("settings.signOut")}
        </button>
      </PageScroll>

      {/* 语言选择弹框 */}
      <Modal
        open={langOpen}
        onClose={() => setLangOpen(false)}
        title={t("settings.selectLanguage")}
        className="max-w-[320px]"
      >
        <div className="flex flex-col gap-1">
          {availableLanguages.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => handleLangSelect(lang.code)}
              className="flex items-center justify-between w-full h-11 px-3 rounded-[var(--radius-8)] hover:bg-[var(--bg-overlay-l1)] text-left cursor-pointer transition-colors duration-100"
            >
              <span className="text-[13px] text-text-default">{lang.label}</span>
              {i18n.language === lang.code && (
                <Check size={16} className="text-brand" />
              )}
            </button>
          ))}
        </div>
      </Modal>

      {/* 主题选择弹框 */}
      <Modal
        open={themeOpen}
        onClose={() => setThemeOpen(false)}
        title={t("settings.selectTheme")}
        className="max-w-[320px]"
      >
        <div className="flex flex-col gap-1">
          {(["dark", "light"] as AppTheme[]).map((th) => (
            <button
              key={th}
              type="button"
              onClick={() => handleThemeSelect(th)}
              className="flex items-center justify-between w-full h-11 px-3 rounded-[var(--radius-8)] hover:bg-[var(--bg-overlay-l1)] text-left cursor-pointer transition-colors duration-100"
            >
              <span className="text-[13px] text-text-default">
                {th === "dark" ? t("settings.themeDark") : t("settings.themeLight")}
              </span>
              {theme === th && (
                <Check size={16} className="text-brand" />
              )}
            </button>
          ))}
        </div>
      </Modal>

      {/* 强调色选择弹框 */}
      <Modal
        open={accentOpen}
        onClose={() => setAccentOpen(false)}
        title={t("settings.selectAccent")}
        className="max-w-[320px]"
      >
        <div className="grid grid-cols-3 gap-2">
          {avatarColors.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => handleAccentSelect(color)}
              className="flex flex-col items-center gap-2 py-3 rounded-[var(--radius-8)] hover:bg-[var(--bg-overlay-l1)] cursor-pointer transition-colors duration-100"
            >
              <span
                className="w-8 h-8 rounded-full inline-flex items-center justify-center"
                style={{ background: colorVarMap[color] }}
              >
                {accentColor === color && (
                  <Check size={16} className="text-white" />
                )}
              </span>
              <span className="text-[11px] text-text-secondary">
                {t(`settings.color_${color}` as const)}
              </span>
            </button>
          ))}
        </div>
      </Modal>
    </AppLayout>
  );
}
