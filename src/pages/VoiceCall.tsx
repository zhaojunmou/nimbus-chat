import { useTranslation } from "react-i18next";
import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  MoreHorizontal,
  Mic,
  MicOff,
  MessageSquare,
  XCircle,
  Loader2,
  PhoneOff,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { useToast } from "@/components/Toast";
import { useAppStore } from "@/store";
import { useCallStore, type CallStatus } from "@/callStore";
import { cn } from "@/lib/utils";

/**
 * 语音通话页 — 接入真实 WebRTC
 *
 * 两种进入方式：
 * 1. 主动呼叫：从会话页点通话按钮 → startOutgoingCall → navigate /call/:id
 * 2. 接听来电：IncomingCallDialog accept → navigate /call/:id（此时 callStore 已在 connecting）
 *
 * 如果进入页面时 callStore.status === 'idle'（如直接访问 URL），自动发起呼叫
 */
export default function VoiceCall() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const storeConv = useAppStore((s) =>
    s.conversations.find((c) => c.id === id),
  );

  const callStatus = useCallStore((s) => s.status);
  const peerName = useCallStore((s) => s.peerName);
  const peerId = useCallStore((s) => s.peerId);
  const muted = useCallStore((s) => s.muted);
  const callConvId = useCallStore((s) => s.conversationId);
  const micAvailable = useCallStore((s) => s.micAvailable);
  const startOutgoingCall = useCallStore((s) => s.startOutgoingCall);
  const endCall = useCallStore((s) => s.endCall);
  const toggleMute = useCallStore((s) => s.toggleMute);
  const resetCallState = useCallStore((s) => s.resetCallState);

  const [seconds, setSeconds] = useState(0);
  const startedRef = useRef(false);

  // 页面挂载时：如果 callStore 处于 idle，说明是主动发起呼叫
  useEffect(() => {
    if (!id || startedRef.current) return;
    if (callStatus === "idle") {
      startedRef.current = true;
      const conv = useAppStore
        .getState()
        .conversations.find((c) => c.id === id);
      if (!conv) {
        toast(t("call.callTargetNotFound"), "error");
        navigate(-1);
        return;
      }
      // 群聊暂不支持语音通话
      if (conv.isGroup) {
        toast(t("call.groupNotSupported"), "info");
        navigate(`/chat/${conv.id}`);
        return;
      }
      const targetId = conv.contactId ?? conv.id;
      const targetName = conv.name;
      startOutgoingCall(targetId, targetName, conv.id);
    } else {
      // 已经在通话中（接听来电后跳转过来）— 标记已启动
      startedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // 计时器仅在 connected 状态下启动
  useEffect(() => {
    if (callStatus !== "connected") {
      setSeconds(0);
      return;
    }
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [callStatus]);

  // 通话结束/拒绝/失败 → 自动返回聊天页
  // 用 ref 防止重复导航（callStatus 变化不会重新触发已完成的导航）
  const navTriggeredRef = useRef(false);
  useEffect(() => {
    if (
      (callStatus === "ended" ||
        callStatus === "rejected" ||
        callStatus === "failed") &&
      !navTriggeredRef.current
    ) {
      navTriggeredRef.current = true;
      const targetConvId = id ?? callConvId ?? "";
      const timer = setTimeout(() => {
        // 先重置通话状态，再导航
        resetCallState();
        if (targetConvId) {
          navigate(`/chat/${targetConvId}`, { replace: true });
        } else {
          navigate("/", { replace: true });
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [callStatus, id, callConvId, navigate, resetCallState]);

  const conv = storeConv;
  const displayName = peerName ?? conv?.name ?? t("call.unknown");

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  if (!conv && callStatus === "idle") {
    return (
      <div className="h-screen flex items-center justify-center text-text-secondary">
        {t("call.callTargetNotFound")}
      </div>
    );
  }

  // 状态文案
  const statusText = (() => {
    switch (callStatus) {
      case "calling":
        return t("call.calling");
      case "connecting":
        return t("call.connecting");
      case "connected":
        return t("call.connected");
      case "ended":
        return t("call.ended");
      case "rejected":
        return t("call.rejected");
      case "failed":
        return t("call.failed");
      default:
        return t("call.calling");
    }
  })();

  const handleHangup = () => {
    endCall();
  };

  const handleBack = () => {
    // 返回聊天页 — 如果通话已结束/拒绝/失败，重置状态
    const inactiveStates: CallStatus[] = ["ended", "rejected", "failed", "idle"];
    if (inactiveStates.includes(callStatus)) {
      resetCallState();
    }
    if (id) navigate(`/chat/${id}`);
    else navigate("/", { replace: true });
  };

  return (
    <div className="call-glow h-screen flex flex-col relative overflow-hidden">
      {/* 顶部栏 */}
      <div className="flex items-center justify-between p-4 flex-shrink-0">
        <button
          type="button"
          onClick={handleBack}
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
          {/* 呼叫中脉冲动画 */}
          {(callStatus === "calling" || callStatus === "connecting") && (
            <div className="absolute inset-0 rounded-full bg-brand/20 animate-ping-slow" />
          )}
          {/* 双环边框 */}
          <div
            className="relative rounded-full"
            style={{ padding: 3, background: "var(--bg-base-default)" }}
          >
            <div
              className="rounded-full"
              style={{ padding: 3, background: "var(--bg-brand)" }}
            >
              <Avatar
                initials={conv?.initials ?? displayName[0]?.toUpperCase() ?? "?"}
                color={conv?.color ?? "brand"}
                size="2xl"
                online={conv?.isOnline}
                imageUrl={conv?.avatarUrl}
              />
            </div>
          </div>
        </div>
        <h1 className="font-heading text-[20px] font-semibold text-text-default mb-1">
          {displayName}
        </h1>
        <p className="text-[13px] text-text-secondary mb-3 flex items-center gap-1.5">
          {(callStatus === "calling" || callStatus === "connecting") && (
            <Loader2 size={12} className="animate-spin" />
          )}
          {statusText}
        </p>
        {!micAvailable && callStatus !== "idle" && (
          <p className="text-[11px] text-status-error bg-status-error/10 px-3 py-1.5 rounded-[var(--radius-6)] mb-3 max-w-[320px]">
            {t("call.micUnavailable")}
          </p>
        )}
        {callStatus === "connected" && (
          <p className="font-mono text-[22px] font-medium text-text-default tnum mb-4">
            {mm}:{ss}
          </p>
        )}
        {/* 信号条 — 仅接通后显示 */}
        {callStatus === "connected" && (
          <div className="flex items-end gap-1">
            {[5, 9, 14].map((h, i) => (
              <span
                key={i}
                className="bg-brand rounded-full animate-pulse"
                style={{ width: 3, height: h, animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </div>
        )}
      </div>

      {/* 底部控制栏 */}
      <div className="absolute bottom-10 left-0 right-0 flex items-center justify-center gap-6 px-6">
        {/* 静音按钮 */}
        <button
          type="button"
          onClick={toggleMute}
          disabled={callStatus !== "connected" || !micAvailable}
          className={cn(
            "inline-flex items-center justify-center rounded-full cursor-pointer transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed",
            muted
              ? "bg-brand-soft text-brand"
              : "bg-bg-tertiary text-text-default hover:bg-[var(--bg-overlay-l3)]",
          )}
          style={{ width: 56, height: 56 }}
          aria-label={muted ? t("call.unmute") : t("call.mute")}
        >
          {muted ? <MicOff size={22} /> : <Mic size={22} />}
        </button>

        {/* 聊天按钮 — 返回聊天页（不挂断） */}
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center justify-center rounded-full bg-bg-tertiary text-text-default hover:bg-[var(--bg-overlay-l3)] cursor-pointer transition-all duration-150"
          style={{ width: 56, height: 56 }}
          aria-label={t("call.chat")}
        >
          <MessageSquare size={22} />
        </button>

        {/* 挂断按钮 */}
        <button
          type="button"
          onClick={handleHangup}
          className="inline-flex items-center justify-center rounded-full bg-status-error text-white hover:brightness-110 cursor-pointer transition-all duration-150"
          style={{ width: 64, height: 64 }}
          aria-label={t("call.hangup")}
        >
          {callStatus === "ended" ? (
            <PhoneOff size={26} />
          ) : (
            <XCircle size={26} />
          )}
        </button>
      </div>
    </div>
  );
}
