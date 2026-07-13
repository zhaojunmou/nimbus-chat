import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CardProps {
  title?: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  danger?: boolean;
  actions?: ReactNode;
}

/** 通用卡片 — bg-surface + radius-10，可选标题图标行与右侧操作 */
export function Card({
  title,
  icon,
  children,
  className,
  danger = false,
  actions,
}: CardProps) {
  return (
    <section
      className={cn(
        "bg-bg-surface rounded-[var(--radius-10)] border",
        danger ? "border-border-error" : "border-border-neutral",
        className,
      )}
    >
      {(title || actions) && (
        <header className="flex items-center justify-between px-5 pt-4 pb-3">
          <div className="flex items-center gap-2.5">
            {icon && <span className="text-text-secondary">{icon}</span>}
            {title && (
              <h2 className="text-[13px] font-semibold font-heading text-text-default">
                {title}
              </h2>
            )}
          </div>
          {actions}
        </header>
      )}
      <div className={title ? "px-5 pb-5" : "p-5"}>{children}</div>
    </section>
  );
}
