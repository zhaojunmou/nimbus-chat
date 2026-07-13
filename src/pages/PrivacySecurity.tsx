import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Shield,
  Lock,
  Globe,
  Clock,
  CheckCircle,
  RefreshCw,
} from "lucide-react";
import { AppLayout, PageScroll } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { SectionTitle } from "@/components/SettingRow";
import { useToast } from "@/components/Toast";
import { api } from "@/api/client";
import type { Contact } from "@/types";

/** 隐私与安全 — 双因素/屏蔽/活动会话/登录历史 */
export default function PrivacySecurity() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [codes, setCodes] = useState([
    "ABC1-23DE",
    "FGH4-56IJ",
    "KLM7-89NO",
    "PQR0-12ST",
  ]);
  const [regenerated, setRegenerated] = useState(false);

  // 屏蔽联系人列表：从后端拉取
  const [blocked, setBlocked] = useState<Contact[]>([]);

  // 活动会话：后端无此接口，保留为本地 mock state（Revoke 时移除）
  const [sessions, setSessions] = useState([
    { browser: "Chrome on macOS", location: "San Francisco, CA", current: true, time: t("privacy.currentSession") },
    { browser: "Firefox on Windows", location: "New York, NY", current: false, time: "2 hours ago" },
  ]);

  // 登录历史：后端无此接口，保留为本地 mock
  const loginActivity = [
    { browser: "Chrome on macOS", location: "San Francisco, CA", time: "2 hours ago" },
    { browser: "Safari on iOS", location: "San Francisco, CA", time: "Yesterday" },
    { browser: "Chrome on macOS", location: "San Francisco, CA", time: "3 days ago" },
  ];

  // 拉取屏蔽联系人列表
  const loadBlocked = () => {
    api
      .getBlockedContacts()
      .then((list) => setBlocked(list))
      .catch(() => {
        /* 拉取失败保留空列表 */
      });
  };

  useEffect(() => {
    loadBlocked();
  }, []);

  // 解除屏蔽：调用后端 → 重新拉取 → toast
  const handleUnblock = async (id: string) => {
    try {
      await api.unblockContact(id);
      loadBlocked();
      toast(t("privacy.contactUnblocked"), "success");
    } catch {
      toast(t("privacy.unblockFailed"), "error");
    }
  };

  // 撤销会话：从本地 state 移除 + toast
  const handleRevoke = (index: number) => {
    setSessions((prev) => prev.filter((_, i) => i !== index));
    toast(t("privacy.sessionRevoked"), "success");
  };

  const regenerate = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const gen = () =>
      Array.from({ length: 2 }, () =>
        Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join(""),
      ).join("-");
    setCodes(Array.from({ length: 4 }, gen));
    setRegenerated(true);
    setTimeout(() => setRegenerated(false), 1500);
  };

  return (
    <AppLayout>
      <PageHeader title={t("privacy.title")} onBack={() => navigate("/settings")} />
      <PageScroll className="px-6 py-6" maxWidth={960}>
        {/* Two-Factor Authentication */}
        <Card className="mb-4">
          <SectionTitle
            icon={<Shield size={18} />}
            badge={
              <span className="text-[10px] font-semibold text-brand bg-brand-soft px-2 py-0.5 rounded-full">
                {t("privacy.enabled")}
              </span>
            }
          >
            {t("privacy.twoFactor")}
          </SectionTitle>
          <p className="text-[12px] text-text-secondary mb-4">
            {t("privacy.twoFactorDesc")}
          </p>
          <Button
            variant="secondary"
            size="md"
            className="mb-5"
            onClick={() => toast(t("privacy.manage2faComingSoon"), "info")}
          >
            {t("privacy.manage2fa")}
          </Button>

          {/* Recovery Codes */}
          <div className="border-t border-border-neutral pt-4">
            <h3 className="text-[12px] font-semibold text-text-default mb-1">
              {t("privacy.recoveryCodes")}
            </h3>
            <p className="text-[11px] text-text-tertiary mb-3">
              {t("privacy.recoveryCodesDesc")}
            </p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {codes.map((code, i) => (
                <div
                  key={i}
                  className="bg-bg-tertiary rounded-[var(--radius-6)] border border-border-neutral px-3 py-2 font-mono text-[12px] text-text-default text-center"
                >
                  {code}
                </div>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              icon={<RefreshCw size={14} />}
              onClick={regenerate}
            >
              {regenerated ? t("privacy.codesRegenerated") : t("privacy.generateNewCodes")}
            </Button>
          </div>
        </Card>

        {/* Blocked Contacts */}
        <Card className="mb-4">
          <SectionTitle icon={<Lock size={18} />}>{t("privacy.blockedContacts")}</SectionTitle>
          <p className="text-[11px] text-text-tertiary mb-3">
            {t("privacy.blockedCount", { count: blocked.length })}
          </p>
          {blocked.length === 0 ? (
            <div className="py-4 text-center text-[12px] text-text-tertiary">
              {t("privacy.noBlockedContacts")}
            </div>
          ) : (
            blocked.map((b, i) => (
              <div key={b.id}>
                {i > 0 && <div className="h-px bg-border-neutral my-1" />}
                <div className="flex items-center gap-3 py-2">
                  <Avatar initials={b.initials} color={b.color} size="md" imageUrl={b.avatarUrl} />
                  <div className="flex-1">
                    <div className="text-[13px] text-text-default">{b.name}</div>
                    <div className="text-[11px] text-text-tertiary">
                      {b.lastSeen ? `${t("privacy.blocked")} · ${b.lastSeen}` : t("privacy.blocked")}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleUnblock(b.id)}
                  >
                    {t("privacy.unblock")}
                  </Button>
                </div>
              </div>
            ))
          )}
        </Card>

        {/* Active Sessions */}
        <Card className="mb-4">
          <SectionTitle icon={<Globe size={18} />}>{t("privacy.activeSessions")}</SectionTitle>
          {sessions.map((s, i) => (
            <div key={i}>
              {i > 0 && <div className="h-px bg-border-neutral my-1" />}
              <div className="flex items-center gap-3 py-2">
                <Globe size={16} className="text-text-secondary flex-shrink-0" />
                <div className="flex-1">
                  <div className="text-[13px] text-text-default flex items-center gap-1.5">
                    {s.browser}
                    {s.current && (
                      <CheckCircle size={14} className="text-brand" />
                    )}
                  </div>
                  <div className="text-[11px] text-text-tertiary">
                    {s.location} · {s.time}
                  </div>
                </div>
                {!s.current && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRevoke(i)}
                  >
                    {t("privacy.revoke")}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </Card>

        {/* Recent Login Activity */}
        <Card>
          <SectionTitle icon={<Clock size={18} />}>{t("privacy.recentLoginActivity")}</SectionTitle>
          {loginActivity.map((a, i) => (
            <div key={i}>
              {i > 0 && <div className="h-px bg-border-neutral my-1" />}
              <div className="flex items-center justify-between gap-3 py-2">
                <div>
                  <div className="text-[13px] text-text-default">{a.browser}</div>
                  <div className="text-[11px] text-text-tertiary">{a.location}</div>
                </div>
                <span className="text-[11px] text-text-tertiary">{a.time}</span>
              </div>
            </div>
          ))}
        </Card>
      </PageScroll>
    </AppLayout>
  );
}
