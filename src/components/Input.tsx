import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: ReactNode;
  variant?: "default" | "filled";
}

/** 文本输入框 — 支持前置图标，聚焦时绿色边框 */
export function Input({
  icon,
  variant = "default",
  className,
  ...rest
}: InputProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 h-10 px-3 rounded-[var(--radius-8)] border transition-colors duration-150",
        variant === "default"
          ? "bg-bg-tertiary border-border-neutral focus-within:border-brand"
          : "bg-[var(--bg-overlay-l1)] border-border-neutral focus-within:border-brand",
        className,
      )}
    >
      {icon && <span className="text-text-tertiary flex-shrink-0">{icon}</span>}
      <input
        className="flex-1 bg-transparent border-none outline-none text-text-default placeholder:text-text-tertiary text-[13px] font-sans"
        {...rest}
      />
    </div>
  );
}
