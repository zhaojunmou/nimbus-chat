import { cn } from "@/lib/utils";

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  size?: "sm" | "md";
  id?: string;
}

/** 胶囊开关 — ON 绿色右滑黑圆点，OFF 灰色左滑灰圆点 */
export function Switch({ checked, onChange, size = "md", id }: SwitchProps) {
  const isSm = size === "sm";
  const w = isSm ? 26 : 32;
  const h = isSm ? 14 : 18;
  const thumb = isSm ? 10 : 12;
  const offset = isSm ? 12 : 16;
  return (
    <label
      htmlFor={id}
      className={cn(
        "relative inline-flex cursor-pointer transition-colors duration-150 border",
        checked
          ? "bg-brand border-brand"
          : "bg-[var(--bg-overlay-l3)] border-border-neutral",
      )}
      style={{
        width: w,
        height: h,
        borderRadius: "var(--radius-full)",
      }}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span
        className="absolute top-1/2 -translate-y-1/2 rounded-full transition-all duration-150"
        style={{
          width: thumb,
          height: thumb,
          left: 2,
          background: checked ? "var(--text-onbrand)" : "var(--text-default)",
          transform: `translateY(-50%) translateX(${checked ? offset : 0}px)`,
        }}
      />
    </label>
  );
}
