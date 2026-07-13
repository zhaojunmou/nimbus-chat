import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { CheckCircle, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 1;

/** Toast 提供者 — 挂在应用根部，子组件通过 useToast() 触发提示 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, type: ToastType = "info") => {
    const id = nextId++;
    setItems((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 2800);
  }, []);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {createPortal(
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 pointer-events-none">
          {items.map((t) => (
            <div
              key={t.id}
              className={cn(
                "flex items-center gap-2.5 px-4 py-2.5 rounded-[var(--radius-8)] border shadow-[0_4px_24px_rgba(0,0,0,0.4)] animate-fade-in pointer-events-auto max-w-[90vw]",
                t.type === "success" &&
                  "bg-bg-menu border-brand/40 text-text-default",
                t.type === "error" &&
                  "bg-bg-menu border-border-error text-text-default",
                t.type === "info" &&
                  "bg-bg-menu border-border-neutral text-text-default",
              )}
            >
              {t.type === "success" && (
                <CheckCircle size={16} className="text-brand flex-shrink-0" />
              )}
              {t.type === "error" && (
                <AlertCircle size={16} className="text-status-error flex-shrink-0" />
              )}
              {t.type === "info" && (
                <Info size={16} className="text-text-secondary flex-shrink-0" />
              )}
              <span className="text-[13px]">{t.message}</span>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="text-text-tertiary hover:text-text-default cursor-pointer flex-shrink-0"
                aria-label="关闭"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

/** 在任意组件中触发 toast 提示 */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // 不在 Provider 内时给出 no-op 兜底，避免崩溃
    return { toast: (_msg: string, _type?: ToastType) => {} };
  }
  return ctx;
}
