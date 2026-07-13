import { cn } from "@/lib/utils";

interface FilterPillProps {
  active: boolean;
  label: string;
  count?: number;
  onClick?: () => void;
}

/** 过滤胶囊 — 激活绿底黑字，未激活灰底灰字 */
export function FilterPill({ active, label, count, onClick }: FilterPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] font-medium cursor-pointer transition-colors duration-150 border",
        active
          ? "bg-brand text-text-onbrand border-transparent"
          : "bg-bg-tertiary text-text-secondary border-border-neutral hover:bg-[var(--bg-overlay-l3)] hover:text-text-default",
      )}
    >
      {label}
      {count !== undefined && (
        <span
          className={cn(
            "text-[10px]",
            active ? "text-text-onbrand/70" : "text-text-tertiary",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}
