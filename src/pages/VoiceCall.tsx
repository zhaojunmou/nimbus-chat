import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  MoreHorizontal,
  Mic,
  BarChart3,
  Users,
  XCircle,
  MessageSquare,
  PanelBottom,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { useToast } from "@/components/Toast";
import { useAppStore } from "@/store";
import { conversations as fallbackConvs } from "@/mockData";
import { cn } from "@/lib/utils";

/** 语音通话 — 全屏单栏，径向光晕背景 + 计时器 + 6 控制按钮 */
export default function VoiceCall() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const storeConv = useAppStore((s) => s.conversations.find((c) => c.id === id));
  const conv = storeConv ?? fallbackConvs.find((c) => c.id === id);
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(false);
  const [chat, setChat] = useState(false);
  const [share, setShare] = useState(false);
  const [connected, setConnected] = useState(false);

  // 2 秒后"接通"
  useEffect(() => {
    const connectTimer = setTimeout(() => setConnected(true), 2000);
    return () => clearTimeout(connectTimer);
  }, []);

  // 计时器仅在接通后启动
  useEffect(() => {
    if (!connected) return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [connected]);

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  if (!conv) {
    return (
      <div className="h-screen flex items-center justify-center text-text-secondary">
        {t("call.callTargetNotFound")}
      </div>
    );
  }

  const controls = [
    {
      icon: Mic,
      label: muted ? t("call.unmute") : t("call.mute"),
      active: muted,
      onClick: () => setMuted((v) => !v),
    },
    {
      icon: BarChart3,
      label: t("call.speaker"),
      active: speaker,
      onClick: () => setSpeaker((v) => !v),
    },
    {
      icon: Users,
      label: t("call.add"),
      active: false,
      onClick: () => toast(t("call.addComingSoon"), "info"),
    },
    {
      icon: MessageSquare,
      label: t("call.chat"),
      active: chat,
      onClick: () => {
        setChat(true);
        navigate(`/chat/${conv.id}`);
      },
    },
    {
      icon: PanelBottom,
      label: t("call.share"),
      active: share,
      onClick: () => {
        setShare((v) => !v);
        if (!share) toast(t("call.shareComingSoon"), "info");
      },
    },
  ];

  return (
    <div className="call-glow h-screen flex flex-col relative overflow-hidden">
      {/* 顶部栏 */}
      <div className="flex items-center justify-between p-4 flex-shrink-0">
        <button
          type="button"
          onClick={() => navigate(`/chat/${conv.id}`)}
          className="inline-flex items-center justify-center w-9 h-9 rounded-[var(--radius-6)] text-text-secondary hover:bg-[var(--bg-overlay-l2)] hover:text-text-default cursor-pointer transition-colors duration-150"
          aria-label={t("conversation.backLabel")}
        >
          <ArrowLeft size={20} />
        </button>
        <button
          type="button"
          onClick={() => toast(t("call.optionsComingSoon"), "info")}
          className="inline-flex items-center justify-center w-9 h-9 rounded-[var(--radius-6)] text-text-secondary hover:bg-[var(--bg-overlay-l2)] hover:text-text-default cursor-pointer transition-colors duration-150"
          aria-label={t("call.more")}
        >
          <MoreHorizontal size={20} />
        </button>
      </div>

      {/* 中央区 */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 -mt-10">
        <div className="relative mb-6">
          {/* 双环边框 */}
          <div
            className="rounded-full"
            style={{ padding: 3, background: "var(--bg-base-default)" }}
          >
            <div
              className="rounded-full"
              style={{ padding: 3, background: "var(--bg-brand)" }}
            >
              <Avatar
                initials={conv.initials}
                color={conv.color}
                size="2xl"
                online={conv.isOnline}
                imageUrl={conv.avatarUrl}
              />
            </div>
          </div>
        </div>
        <h1 className="font-heading text-[20px] font-semibold text-text-default mb-1">
          {conv.name}
        </h1>
        <p className="text-[13px] text-text-secondary mb-3">
          {connected ? t("call.connected") : t("call.calling")}
        </p>
        <p className="font-mono text-[22px] font-medium text-text-default tnum mb-4">
          {mm}:{ss}
        </p>
        {/* 信号条 */}
        <div className="flex items-end gap-1">
          {[5, 9, 14].map((h, i) => (
            <span
              key={i}
              className="bg-brand rounded-full"
              style={{ width: 3, height: h }}
            />
          ))}
        </div>
      </div>

      {/* 底部控制栏 */}
      <div className="absolute bottom-10 left-0 right-0 flex items-center justify-center gap-6 px-6">
        {controls.map((c, i) => (
          <button
            key={i}
            type="button"
            onClick={c.onClick}
            className={cn(
              "inline-flex items-center justify-center rounded-full cursor-pointer transition-all duration-150",
              c.active
                ? "bg-brand-soft text-brand"
                : "bg-bg-tertiary text-text-default hover:bg-[var(--bg-overlay-l3)]",
            )}
            style={{ width: 56, height: 56 }}
            aria-label={c.label}
          >
            <c.icon size={22} />
          </button>
        ))}
        {/* 挂断按钮 */}
        <button
          type="button"
          onClick={() => navigate(`/chat/${conv.id}`)}
          className="inline-flex items-center justify-center rounded-full bg-status-error text-white hover:brightness-110 cursor-pointer transition-all duration-150"
          style={{ width: 64, height: 64 }}
          aria-label={t("call.hangup")}
        >
          <XCircle size={26} />
        </button>
      </div>
    </div>
  );
}
