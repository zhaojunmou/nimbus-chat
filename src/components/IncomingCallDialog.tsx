import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Phone, PhoneOff } from "lucide-react";
import { useCallStore } from "@/callStore";
import { useAppStore } from "@/store";
import { Avatar } from "@/components/Avatar";

/** 来电弹窗 — 全局挂载，当 callStore.status === 'incoming' 时显示 */
export function IncomingCallDialog() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const status = useCallStore((s) => s.status);
  const peerName = useCallStore((s) => s.peerName);
  const peerId = useCallStore((s) => s.peerId);
  const conversationId = useCallStore((s) => s.conversationId);
  const acceptIncomingCall = useCallStore((s) => s.acceptIncomingCall);
  const rejectIncomingCall = useCallStore((s) => s.rejectIncomingCall);

  // 从会话列表查找对方头像信息
  const conversations = useAppStore((s) => s.conversations);
  const conv = conversations.find(
    (c) => c.contactId === peerId || c.id === conversationId,
  );

  if (status !== "incoming") return null;

  const handleAccept = async () => {
    await acceptIncomingCall();
    // 跳转到通话页面
    if (conversationId) {
      navigate(`/call/${conversationId}`);
    }
  };

  const handleReject = () => {
    rejectIncomingCall();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 animate-fade-in">
      <div className="bg-bg-surface rounded-[var(--radius-16)] border border-border-neutral-2 shadow-xl p-8 max-w-sm w-full mx-4 animate-scale-in">
        {/* 来电提示 */}
        <div className="flex flex-col items-center text-center">
          {/* 头像 + 呼叫动画 */}
          <div className="relative mb-4">
            {/* 脉冲环 */}
            <div className="absolute inset-0 rounded-full bg-brand/20 animate-ping-slow" />
            <div
              className="relative rounded-full"
              style={{ padding: 3, background: "var(--bg-brand)" }}
            >
              <div
                className="rounded-full"
                style={{ padding: 3, background: "var(--bg-base-default)" }}
              >
                <Avatar
                  initials={conv?.initials ?? peerName?.[0]?.toUpperCase() ?? "?"}
                  color={conv?.color ?? "brand"}
                  size="2xl"
                  imageUrl={conv?.avatarUrl}
                />
              </div>
            </div>
          </div>

          <p className="text-[11px] text-brand font-medium uppercase tracking-wide mb-1">
            {t("call.incomingCall")}
          </p>
          <h2 className="font-heading text-[20px] font-semibold text-text-default mb-1">
            {peerName ?? t("call.unknown")}
          </h2>
          <p className="text-[12px] text-text-tertiary mb-6">
            {t("call.incomingHint")}
          </p>

          {/* 操作按钮 */}
          <div className="flex items-center gap-8">
            <button
              type="button"
              onClick={handleReject}
              className="flex flex-col items-center gap-2 cursor-pointer group"
            >
              <span className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-status-error text-white group-hover:brightness-110 transition-all duration-150">
                <PhoneOff size={24} />
              </span>
              <span className="text-[11px] text-text-tertiary">
                {t("call.decline")}
              </span>
            </button>
            <button
              type="button"
              onClick={handleAccept}
              className="flex flex-col items-center gap-2 cursor-pointer group"
            >
              <span className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-status-success text-white group-hover:brightness-110 transition-all duration-150 animate-ring">
                <Phone size={24} />
              </span>
              <span className="text-[11px] text-text-tertiary">
                {t("call.accept")}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
