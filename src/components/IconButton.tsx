import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  size?: "sm" | "md" | "lg";
  active?: boolean;
  danger?: boolean;
}

const sizeCls = {
  sm: "w-7 h-7",
  md: "w-8 h-8",
  lg: "w-10 h-10",
};

/** 图标按钮 — 透明背景方形按钮，悬停高亮，支持激活/危险态 */
export function IconButton({
  icon,
  size = "md",
  active = false,
  danger = false,
  className,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center rounded-[var(--radius-6)] cursor-pointer transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
        sizeCls[size],
        danger
          ? "text-status-error hover:bg-status-error/10"
          : active
            ? "bg-brand-soft text-brand"
            : "text-text-tertiary hover:bg-[var(--bg-overlay-l2)] hover:text-text-default",
        className,
      )}
      {...rest}
    >
      {icon}
    </button>
  );
}
