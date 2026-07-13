import { useEffect, useState } from "react";
import { colorVarMap, type AvatarColor } from "@/types";
import { cn } from "@/lib/utils";

interface AvatarProps {
  initials: string;
  color: AvatarColor;
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  online?: boolean;
  square?: boolean;
  className?: string;
  /** 头像图片 URL（存在时优先于首字母渲染） */
  imageUrl?: string;
}

const sizeMap = {
  sm: { w: 28, h: 28, fs: 10 },
  md: { w: 32, h: 32, fs: 11 },
  lg: { w: 40, h: 40, fs: 13 },
  xl: { w: 64, h: 64, fs: 22 },
  "2xl": { w: 80, h: 80, fs: 28 },
};

/** 头像：圆形/方形，背景色循环 + 首字母 + 在线蓝点；有 imageUrl 时渲染图片 */
export function Avatar({
  initials,
  color,
  size = "lg",
  online = false,
  square = false,
  className,
  imageUrl,
}: AvatarProps) {
  const s = sizeMap[size];
  // 跟踪图片加载失败状态 — 某些浏览器（如 Trae 内置浏览器）可能无法渲染 base64 data URL
  // 失败时回退到首字母渲染，确保头像始终可见
  const [imgFailed, setImgFailed] = useState(false);
  // imageUrl 变化时重置失败状态（例如切换会话）
  useEffect(() => {
    setImgFailed(false);
  }, [imageUrl]);
  const showImage = imageUrl && !imgFailed;
  return (
    <div className={cn("relative inline-flex flex-shrink-0", className)}>
      {showImage ? (
        <img
          src={imageUrl}
          alt={initials}
          width={s.w}
          height={s.h}
          style={{
            width: s.w,
            height: s.h,
            borderRadius: square ? "var(--radius-8)" : "50%",
            objectFit: "cover",
          }}
          className="select-none"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span
          style={{
            width: s.w,
            height: s.h,
            background: colorVarMap[color],
            color: "var(--text-onbrand)",
            fontSize: s.fs,
            fontWeight: 600,
            borderRadius: square ? "var(--radius-8)" : "50%",
          }}
          className="inline-flex items-center justify-center select-none"
        >
          {initials}
        </span>
      )}
      {online && (
        <span
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            width: size === "2xl" || size === "xl" ? 14 : 10,
            height: size === "2xl" || size === "xl" ? 14 : 10,
            borderRadius: "50%",
            background: "var(--status-primary-default)",
            border: `2px solid var(--bg-base-secondary)`,
          }}
        />
      )}
    </div>
  );
}
