import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  onBack?: () => void;
  backIcon?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/** 页面头部 — 返回按钮 + 标题 + 右侧操作 */
export function PageHeader({
  title,
  onBack,
  backIcon,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex items-center justify-between h-14 px-5 border-b border-border-neutral flex-shrink-0",
        className,
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center justify-center w-8 h-8 rounded-[var(--radius-6)] text-text-secondary hover:bg-[var(--bg-overlay-l2)] hover:text-text-default cursor-pointer transition-colors duration-150 flex-shrink-0"
            aria-label="返回"
          >
            {backIcon ?? <ArrowLeft size={18} />}
          </button>
        )}
        <h1 className="text-[15px] font-semibold font-heading text-text-default truncate">
          {title}
        </h1>
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </header>
  );
}
