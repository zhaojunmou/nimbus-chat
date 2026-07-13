import { MessageCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppLayout } from "@/components/AppLayout";

/** 聊天主页 — 空状态占位（侧边栏会话列表由 Sidebar 渲染） */
export default function ChatMain() {
  const { t } = useTranslation();
  return (
    <AppLayout>
      <section className="flex-1 flex flex-col items-center justify-center bg-bg-base p-10">
        <MessageCircle
          size={64}
          className="text-text-tertiary mb-6"
          style={{ opacity: 0.35 }}
        />
        <h1 className="font-heading text-[16px] font-semibold text-text-default mb-2">
          {t("chat.selectConversation")}
        </h1>
        <p className="text-[12px] text-text-secondary text-center max-w-[320px]">
          {t("chat.selectConversationHint")}
        </p>
      </section>
    </AppLayout>
  );
}
