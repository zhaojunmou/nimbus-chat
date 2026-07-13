import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  iconRight?: ReactNode;
  children?: ReactNode;
}

const variantCls: Record<Variant, string> = {
  primary:
    "bg-brand text-text-onbrand hover:bg-brand-hover border border-transparent",
  secondary:
    "bg-bg-tertiary text-text-default hover:bg-[var(--bg-overlay-l3)] border border-border-neutral",
  ghost:
    "bg-transparent text-text-secondary hover:bg-[var(--bg-overlay-l2)] hover:text-text-default border border-transparent",
  danger:
    "bg-status-error text-white hover:brightness-110 border border-transparent",
  outline:
    "bg-transparent text-text-default border border-border-neutral-2 hover:bg-[var(--bg-overlay-l2)]",
};

const sizeCls: Record<Size, string> = {
  sm: "h-7 px-2.5 text-[11px] gap-1 rounded-[var(--radius-6)]",
  md: "h-8 px-3 text-[12px] gap-1.5 rounded-[var(--radius-6)]",
  lg: "h-10 px-4 text-[13px] gap-2 rounded-[var(--radius-8)]",
};

/** 通用按钮 — 主/次/幽灵/危险/描边 五种变体 */
export function Button({
  variant = "secondary",
  size = "md",
  icon,
  iconRight,
  children,
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center font-medium whitespace-nowrap cursor-pointer transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-50 disabled:cursor-not-allowed",
        variantCls[variant],
        sizeCls[size],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
      {iconRight}
    </button>
  );
}
