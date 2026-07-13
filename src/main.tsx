import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ToastProvider } from "@/components/Toast";
import { useAppStore } from "./store";
import { initTheme } from "@/lib/theme";
import "./i18n"; // 初始化 i18next
import "./index.css";

// 应用启动时恢复保存的主题（避免刷新后闪烁回 dark）
initTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
);

// 应用启动时拉取后端数据并建立 socket 连接
useAppStore.getState().init();
