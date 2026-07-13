import { type ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
  /** 是否显示右上角关闭按钮 */
  showClose?: boolean;
}

/** 模态弹窗 — 居中遮罩 + 卡片，ESC 关闭，含焦点管理 */
export function Modal({
  open,
  onClose,
  title,
  children,
  className,
  showClose = true,
}: ModalProps) {
  const { t } = useTranslation();
  // 记录打开前的焦点元素，关闭后恢复
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  // 弹窗容器，用于焦点陷阱
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    // 记录当前焦点
    restoreFocusRef.current = document.activeElement as HTMLElement;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      // Tab 键焦点陷阱：在弹窗内循环
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    // 打开时聚焦首个可交互元素
    requestAnimationFrame(() => {
      const first = dialogRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      first?.focus();
    });
    return () => {
      document.removeEventListener("keydown", onKey);
      // 恢复焦点
      restoreFocusRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 animate-fade-in"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          "relative w-full max-w-[420px] bg-bg-menu border border-border-neutral rounded-[var(--radius-10)] shadow-[0_12px_48px_rgba(0,0,0,0.5)] animate-menu-in outline-none",
          className,
        )}
      >
        {(title || showClose) && (
          <div className="flex items-center justify-between px-5 pt-4 pb-3">
            {title && (
              <h2 className="font-heading text-[15px] font-semibold text-text-default">
                {title}
              </h2>
            )}
            {showClose && (
              <button
                type="button"
                onClick={onClose}
                className="text-text-tertiary hover:text-text-default cursor-pointer transition-colors duration-150"
                aria-label={t("common.close")}
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}
        <div className="px-5 pb-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** 确认弹窗 — 用于删除等危险操作的二次确认 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onCancel} showClose={false} className="max-w-[360px]">
      <h2 className="font-heading text-[15px] font-semibold text-text-default mb-2">
        {title}
      </h2>
      <p className="text-[13px] text-text-secondary mb-5 leading-[20px]">
        {message}
      </p>
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="h-9 px-4 rounded-[var(--radius-8)] bg-bg-tertiary border border-border-neutral text-text-default text-[12px] font-medium hover:bg-[var(--bg-overlay-l2)] cursor-pointer transition-colors duration-150"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={cn(
            "h-9 px-4 rounded-[var(--radius-8)] text-[12px] font-medium cursor-pointer transition-colors duration-150",
            danger
              ? "bg-status-error text-white hover:brightness-110"
              : "bg-brand text-text-onbrand hover:bg-brand-hover",
          )}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
