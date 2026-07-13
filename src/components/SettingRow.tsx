import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { Switch } from "./Switch";
import { cn } from "@/lib/utils";

interface SettingRowProps {
  label: string;
  value?: string;
  onClick?: () => void;
  toggle?: { checked: boolean; onChange: (v: boolean) => void };
  hint?: string;
  danger?: boolean;
}

/** 设置项行 — 键值展示 / 可点击 / 开关 三种模式 */
export function SettingRow({
  label,
  value,
  onClick,
  toggle,
  hint,
  danger,
}: SettingRowProps) {
  const clickable = onClick && !toggle;
  return (
    <div
      onClick={clickable ? onClick : undefined}
      className={cn(
        "flex items-center justify-between gap-4 py-3",
        clickable && "cursor-pointer hover:bg-[var(--bg-overlay-l1)] -mx-5 px-5 rounded-[var(--radius-6)]",
      )}
    >
      <div className="flex flex-col gap-0.5 min-w-0">
        <span
          className={cn(
            "text-[13px]",
            danger ? "text-status-error" : "text-text-default",
          )}
        >
          {label}
        </span>
        {hint && <span className="text-[11px] text-text-tertiary">{hint}</span>}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {value && (
          <span className="text-[12px] text-text-secondary">{value}</span>
        )}
        {toggle && (
          <Switch checked={toggle.checked} onChange={toggle.onChange} />
        )}
        {clickable && (
          <ChevronRight size={16} className="text-text-tertiary" />
        )}
      </div>
    </div>
  );
}

/** 分区标题 — 图标 + 标题 */
export function SectionTitle({
  icon,
  children,
  badge,
}: {
  icon?: ReactNode;
  children: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      {icon && <span className="text-text-secondary">{icon}</span>}
      <h2 className="font-heading text-[13px] font-semibold text-text-default">
        {children}
      </h2>
      {badge}
    </div>
  );
}
