import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ToastProvider } from "@/components/Toast";
import { useAppStore } from "./store";
import { initTheme } from "@/lib/theme";
import { unlockAudio } from "@/lib/sound";
import { initVisibilityListener } from "@/lib/notify";
import "./i18n"; // 初始化 i18next
import "./index.css";

// 应用启动时恢复保存的主题（避免刷新后闪烁回 dark）
initTheme();
// 注册音频解锁（浏览器自动播放策略要求用户交互后才能播放声音）
unlockAudio();
// 注册页面可见性监听（控制 title 闪烁）
initVisibilityListener();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
);

// 应用启动时拉取后端数据并建立 socket 连接
useAppStore.getState().init();
