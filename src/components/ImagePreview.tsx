import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { X, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

interface ImagePreviewProps {
  /** 图片 URL（data URL 或 http URL） */
  src: string;
  /** 关闭回调 */
  onClose: () => void;
  /** 关闭按钮的 aria-label */
  closeLabel?: string;
  /** 底部操作栏（转发/下载等按钮） */
  actions?: ReactNode;
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 5;
// 拖动位移小于此阈值（px）视为点击，用于区分"点击关闭"和"拖动图片"
const CLICK_THRESHOLD = 5;

/**
 * 图片预览 Lightbox — 支持滚轮缩放、拖动平移、双击复位
 * 底部操作栏由调用方通过 actions 传入（转发/添加表情/下载等）
 */
export function ImagePreview({ src, onClose, closeLabel = "Close", actions }: ImagePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // 缩放倍率（1 = 原始适配大小）
  const [scale, setScale] = useState(1);
  // 平移偏移（px）
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  // 是否正在拖动（用于切换 cursor）
  const [isDragging, setIsDragging] = useState(false);
  // 拖动状态 ref — 避免 useEffect 依赖频繁重建监听器
  const dragging = useRef(false);
  // 拖动起点（屏幕坐标 + 当时的 offset）
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  // mousedown 起始坐标 — 用于 mouseup 时判断是点击还是拖动
  const mouseDownPos = useRef<{ x: number; y: number } | null>(null);

  // 切换图片时复位变换
  useEffect(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, [src]);

  // ESC 关闭
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // 原生 wheel 监听 — React onWheel 是 passive 的，无法 preventDefault 阻止页面滚动
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const delta = -e.deltaY;
      const step = delta > 0 ? 0.15 : -0.15;
      setScale((prev) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev + step)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // 全局 mousemove/mouseup — 拖动开始后才挂载，拖动结束即卸载
  // onUp 中同时处理"拖动结束"和"点击复位"（位移 < 阈值则复位）
  const startDrag = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    dragging.current = true;
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      ox: offset.x,
      oy: offset.y,
    };
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - dragStart.current.x;
      const dy = ev.clientY - dragStart.current.y;
      setOffset({ x: dragStart.current.ox + dx, y: dragStart.current.oy + dy });
    };
    const onUp = (ev: MouseEvent) => {
      dragging.current = false;
      setIsDragging(false);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      // 位移很小 → 视为点击 → 复位变换
      const dx = Math.abs(ev.clientX - dragStart.current.x);
      const dy = Math.abs(ev.clientY - dragStart.current.y);
      if (dx < CLICK_THRESHOLD && dy < CLICK_THRESHOLD) {
        setScale(1);
        setOffset({ x: 0, y: 0 });
      }
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [offset]);

  // 图片 mousedown — 开启拖动（onUp 中统一处理点击 vs 拖动判断）
  const onImageMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    startDrag(e);
  }, [startDrag]);

  // 遮罩 mousedown — 记录起点，用于 mouseup 时判断是否点击空白关闭
  const onBackdropMouseDown = useCallback((e: React.MouseEvent) => {
    // 仅当点击遮罩本身（非图片/按钮）时记录
    if (e.target !== e.currentTarget) return;
    mouseDownPos.current = { x: e.clientX, y: e.clientY };
  }, []);

  // 遮罩 mouseup — 若起点也在遮罩且位移很小，则关闭
  const onBackdropMouseUp = useCallback((e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return;
    const start = mouseDownPos.current;
    mouseDownPos.current = null;
    if (!start) return;
    const dx = Math.abs(e.clientX - start.x);
    const dy = Math.abs(e.clientY - start.y);
    if (dx < CLICK_THRESHOLD && dy < CLICK_THRESHOLD) {
      onClose();
    }
  }, [onClose]);

  // 双击复位
  const onDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const zoomIn = () => setScale((s) => Math.min(MAX_SCALE, s + 0.25));
  const zoomOut = () => setScale((s) => Math.max(MIN_SCALE, s - 0.25));
  const reset = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 animate-fade-in overflow-hidden select-none"
      onMouseDown={onBackdropMouseDown}
      onMouseUp={onBackdropMouseUp}
    >
      {/* 关闭按钮 */}
      <button
        type="button"
        className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 cursor-pointer transition-colors z-10"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label={closeLabel}
      >
        <X size={20} />
      </button>

      {/* 左上角缩放控制 */}
      <div
        className="absolute top-4 left-4 flex items-center gap-1 z-10"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={zoomOut}
          disabled={scale <= MIN_SCALE}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Zoom out"
        >
          <ZoomOut size={18} />
        </button>
        <span className="text-white text-[11px] font-mono min-w-[44px] text-center">
          {Math.round(scale * 100)}%
        </span>
        <button
          type="button"
          onClick={zoomIn}
          disabled={scale >= MAX_SCALE}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Zoom in"
        >
          <ZoomIn size={18} />
        </button>
        <button
          type="button"
          onClick={reset}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 cursor-pointer transition-colors"
          aria-label="Reset"
        >
          <RotateCcw size={16} />
        </button>
      </div>

      {/* 图片 — transform 控制缩放和平移 */}
      <img
        src={src}
        alt="preview"
        draggable={false}
        className="max-w-[90vw] max-h-[80vh] object-contain rounded-[var(--radius-8)]"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          cursor: isDragging ? "grabbing" : "grab",
          transition: isDragging ? "none" : "transform 0.15s ease-out",
        }}
        onMouseDown={onImageMouseDown}
        onDoubleClick={onDoubleClick}
      />

      {/* 底部操作栏 */}
      {actions && (
        <div
          className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {actions}
        </div>
      )}
    </div>
  );
}
