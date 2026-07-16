import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Trash, Download, Minimize2 } from "lucide-react";
import { AppLayout, PageScroll } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Switch } from "@/components/Switch";
import { SectionTitle } from "@/components/SettingRow";
import { useToast } from "@/components/Toast";
import { ConfirmDialog } from "@/components/Modal";
import { useAppStore } from "@/store";
import { getPreferences, savePreferences } from "@/lib/preferences";

/** 存储与数据 — 环形进度 + 分类明细 + 自动下载 + 危险区 */
export default function StorageData() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();

  // 自动下载开关从持久化偏好初始化
  const [photos, setPhotos] = useState(() => getPreferences().autoDlPhotos);
  const [videos, setVideos] = useState(() => getPreferences().autoDlVideos);
  const [documents, setDocuments] = useState(
    () => getPreferences().autoDlDocuments,
  );
  const [wifiOnly, setWifiOnly] = useState(
    () => getPreferences().autoDlWifiOnly,
  );
  // 删除全部聊天记录的确认弹窗
  const [deleteOpen, setDeleteOpen] = useState(false);

  const used = 2.4;
  const total = 10;
  const percent = (used / total) * 100;

  const categories = [
    { label: t("storage.imagesFiles"), size: "1.2 GB", percent: 48, muted: false },
    { label: t("storage.messages"), size: "0.8 GB", percent: 32, muted: false },
    { label: t("storage.cache"), size: "0.4 GB", percent: 16, muted: true },
  ];

  // 各管理项的点击行为
  const manageItems = [
    {
      icon: Trash,
      label: t("storage.clearCache"),
      value: t("storage.clearCacheValue"),
      action: "Clear",
      onClick: () => toast(t("storage.cacheClearedFreed"), "success"),
    },
    {
      icon: Download,
      label: t("storage.downloadAllData"),
      value: null,
      action: t("storage.download"),
      onClick: () => toast(t("storage.preparingExport"), "info"),
    },
    {
      icon: Minimize2,
      label: t("storage.reviewLargeFiles"),
      value: null,
      action: t("storage.review"),
      onClick: () => navigate("/files"),
    },
  ];

  // 自动下载开关切换：持久化
  const handlePhotos = (v: boolean) => {
    setPhotos(v);
    savePreferences({ autoDlPhotos: v });
  };
  const handleVideos = (v: boolean) => {
    setVideos(v);
    savePreferences({ autoDlVideos: v });
  };
  const handleDocuments = (v: boolean) => {
    setDocuments(v);
    savePreferences({ autoDlDocuments: v });
  };
  const handleWifiOnly = (v: boolean) => {
    setWifiOnly(v);
    savePreferences({ autoDlWifiOnly: v });
  };

  // 确认删除全部聊天历史
  const handleConfirmDelete = async () => {
    setDeleteOpen(false);
    try {
      await useAppStore.getState().clearAllMessages();
      toast(t("storage.allChatHistoryDeleted"), "success");
    } catch {
      toast(t("storage.deleteFailed"), "error");
    }
  };

  return (
    <AppLayout>
      <PageHeader title={t("storage.title")} onBack={() => navigate("/settings")} />
      <PageScroll className="px-6 py-6" maxWidth={960}>
        {/* Storage Usage 环形图 */}
        <Card className="mb-4">
          <SectionTitle>{t("storage.storageUsage")}</SectionTitle>
          <div className="flex flex-col items-center py-4">
            <div
              className="relative rounded-full"
              style={{
                width: 120,
                height: 120,
                background: `conic-gradient(var(--bg-brand) 0% ${percent}%, var(--bg-overlay-l3) ${percent}% 100%)`,
              }}
            >
              <div
                className="absolute rounded-full bg-bg-surface flex flex-col items-center justify-center"
                style={{ inset: 12 }}
              >
                <span className="font-heading text-[18px] font-semibold text-text-default">
                  {used} GB
                </span>
                <span className="text-[10px] text-text-tertiary">
                  of {total} GB
                </span>
              </div>
            </div>
            {/* 分类明细 */}
            <div className="w-full max-w-[320px] mt-6 flex flex-col gap-3">
              {categories.map((c) => (
                <div key={c.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] text-text-default">{c.label}</span>
                    <span className="text-[11px] text-text-tertiary">
                      {c.size} · {c.percent}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--bg-overlay-l3)] overflow-hidden">
                    <div
                      className={c.muted ? "h-full bg-text-tertiary" : "h-full bg-brand"}
                      style={{ width: `${c.percent}%`, borderRadius: "var(--radius-full)" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Manage Storage */}
        <Card className="mb-4">
          <SectionTitle>{t("storage.manageStorage")}</SectionTitle>
          {manageItems.map((item, i) => (
            <div key={i}>
              {i > 0 && <div className="h-px bg-border-neutral my-1" />}
              <div className="flex items-center gap-3 py-2.5">
                <item.icon size={16} className="text-text-secondary flex-shrink-0" />
                <div className="flex-1">
                  <span className="text-[13px] text-text-default">{item.label}</span>
                  {item.value && (
                    <span className="text-[11px] text-text-tertiary ml-2">
                      {item.value}
                    </span>
                  )}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={item.onClick}
                >
                  {item.action}
                </Button>
              </div>
            </div>
          ))}
        </Card>

        {/* Media Auto-Download */}
        <Card className="mb-4">
          <SectionTitle>{t("storage.mediaAutoDownload")}</SectionTitle>
          <div className="flex items-center justify-between py-2.5">
            <span className="text-[13px] text-text-default">{t("storage.photos")}</span>
            <Switch checked={photos} onChange={handlePhotos} />
          </div>
          <div className="h-px bg-border-neutral" />
          <div className="flex items-center justify-between py-2.5">
            <span className="text-[13px] text-text-default">{t("storage.videos")}</span>
            <Switch checked={videos} onChange={handleVideos} />
          </div>
          <div className="h-px bg-border-neutral" />
          <div className="flex items-center justify-between py-2.5">
            <span className="text-[13px] text-text-default">{t("storage.documents")}</span>
            <Switch checked={documents} onChange={handleDocuments} />
          </div>
          <div className="h-px bg-border-neutral" />
          <div className="flex items-center justify-between py-2.5">
            <span className="text-[13px] text-text-default">{t("storage.wifiOnly")}</span>
            <Switch checked={wifiOnly} onChange={handleWifiOnly} />
          </div>
        </Card>

        {/* Danger Zone */}
        <Card danger>
          <SectionTitle>{t("storage.dangerZone")}</SectionTitle>
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-[13px] text-status-error">
                {t("storage.deleteAllChatHistory")}
              </span>
              <span className="text-[11px] text-text-tertiary">
                {t("storage.deleteAllChatHistoryHint")}
              </span>
            </div>
            <Button
              variant="danger"
              size="md"
              icon={<Trash size={14} />}
              onClick={() => setDeleteOpen(true)}
            >
              Delete
            </Button>
          </div>
        </Card>
      </PageScroll>

      {/* 删除全部聊天历史确认弹窗 */}
      <ConfirmDialog
        open={deleteOpen}
        title={t("storage.deleteAllTitle")}
        message={t("storage.deleteAllMsg")}
        confirmLabel={t("storage.deleteAll")}
        danger
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </AppLayout>
  );
}
