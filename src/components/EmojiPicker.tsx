import { useState, useRef, useEffect, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { ImagePlus, Trash, X } from "lucide-react";
import {
  defaultCategories,
  loadCustomEmojis,
  saveCustomEmojis,
  addCustomEmoji,
  removeCustomEmoji,
  type CustomEmoji,
} from "@/lib/emojiPresets";
import { useToast } from "./Toast";
import { cn } from "@/lib/utils";

interface EmojiPickerProps {
  /** 选择表情（文本 emoji 或图片 data URL）时的回调 */
  onPick: (content: string, isImage: boolean) => void;
  /** 关闭面板回调 */
  onClose: () => void;
}

/**
 * 表情选择面板
 * - 预设分类 tab 切换（6 类）
 * - 自定义分类：仅支持图片表情，可添加/删除
 * - 点击面板外部关闭
 * - 限制最大宽度 360px
 */
export function EmojiPicker({ onPick, onClose }: EmojiPickerProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const panelRef = useRef<HTMLDivElement>(null);

  // 当前激活的分类 tab — 末尾 "custom" 为自定义分类
  const [activeTab, setActiveTab] = useState<string>(defaultCategories[0].id);
  // 自定义表情列表
  const [customEmojis, setCustomEmojis] = useState<CustomEmoji[]>(() => loadCustomEmojis());
  // 删除模式（点击自定义表情时删除而非发送）
  const [deleteMode, setDeleteMode] = useState(false);

  // 图片上传 input ref
  const imageInputRef = useRef<HTMLInputElement>(null);

  // 点击面板外部关闭
  useEffect(() => {
    const handlePointerDown = (e: globalThis.PointerEvent | globalThis.MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // 用 mousedown 捕获阶段，先于面板内按钮的 click 触发
    document.addEventListener("mousedown", handlePointerDown, true);
    return () => document.removeEventListener("mousedown", handlePointerDown, true);
  }, [onClose]);

  // 持久化自定义表情
  const persistCustom = (list: CustomEmoji[]) => {
    setCustomEmojis(list);
    saveCustomEmojis(list);
  };

  const handlePickEmoji = (emoji: string) => {
    onPick(emoji, false);
  };

  const handlePickCustom = (item: CustomEmoji) => {
    if (deleteMode) {
      persistCustom(removeCustomEmoji(customEmojis, item.id));
      toast(t("emoji.removed"), "success");
      return;
    }
    onPick(item.content, item.isImage);
  };

  // 添加图片自定义表情
  // 规则：大小未超过阈值（默认 512KB）时不压缩，直接保留原 data URL；
  //      超过阈值时静态图压缩并提示，动图（GIF/WebP/APNG）拒绝并提示使用更小文件。
  const handleImageSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast(t("emoji.imageOnly"), "error");
      e.target.value = "";
      return;
    }
    const SIZE_LIMIT = 512 * 1024; // 512KB
    const isAnimated =
      file.type === "image/gif" ||
      file.type === "image/webp" ||
      file.type === "image/apng";
    try {
      let dataUrl: string;
      if (file.size <= SIZE_LIMIT) {
        // 未超限：所有图片类型直接保留原始 data URL（保留动画帧、原图质量）
        dataUrl = await readFileAsDataUrl(file);
      } else if (isAnimated) {
        // 动图超限：canvas 压缩会丢动画帧，直接拒绝
        toast(t("emoji.animatedTooLarge", { limit: 512 }), "error");
        e.target.value = "";
        return;
      } else {
        // 静态图超限：压缩并提示
        dataUrl = await compressImage(file, 96, 0.8);
        toast(t("emoji.imageCompressed", { limit: 512 }), "info");
      }
      const { list } = addCustomEmoji(customEmojis, dataUrl, file.name);
      persistCustom(list);
      toast(t("emoji.added"), "success");
    } catch {
      toast(t("emoji.imageTooLarge"), "error");
    }
    e.target.value = "";
  };

  const tabs = [
    ...defaultCategories.map((c) => ({ id: c.id, icon: c.icon, label: t(`emoji.cat_${c.id}`) })),
    { id: "custom", icon: "⭐", label: t("emoji.cat_custom") },
  ];

  return (
    <div className="px-4 pb-1 flex-shrink-0">
      <div
        ref={panelRef}
        className="bg-bg-tertiary rounded-[var(--radius-8)] border border-border-neutral animate-menu-in overflow-hidden max-w-[360px]"
      >
        {/* 顶栏：分类 tab + 关闭按钮 */}
        <div className="flex items-center border-b border-border-neutral">
          <div className="flex-1 flex items-center overflow-x-auto thin-scrollbar">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                title={tab.label}
                className={cn(
                  "flex-shrink-0 px-3 py-2 text-[18px] cursor-pointer transition-colors duration-100 relative",
                  activeTab === tab.id
                    ? "text-text-default"
                    : "text-text-tertiary hover:text-text-secondary opacity-70 hover:opacity-100",
                )}
              >
                {tab.icon}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-brand rounded-full" />
                )}
                {tab.id === "custom" && customEmojis.length > 0 && (
                  <span className="absolute top-1 right-1 min-w-[14px] h-3.5 px-1 rounded-full bg-brand text-text-onbrand text-[9px] font-semibold flex items-center justify-center">
                    {customEmojis.length}
                  </span>
                )}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 p-2 mr-1 text-text-tertiary hover:text-text-default cursor-pointer rounded-[var(--radius-4)] hover:bg-[var(--bg-overlay-l2)] transition-colors"
            aria-label={t("common.close")}
          >
            <X size={16} />
          </button>
        </div>

        {/* 内容区 */}
        <div className="p-2">
          {activeTab !== "custom" ? (
            <div className="flex flex-wrap gap-px max-h-[200px] overflow-y-auto thin-scrollbar">
              {defaultCategories.find((c) => c.id === activeTab)?.emojis.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => handlePickEmoji(e)}
                  className="w-7 h-7 flex items-center justify-center rounded-[var(--radius-4)] hover:bg-[var(--bg-overlay-l2)] active:bg-[var(--bg-overlay-l3)] cursor-pointer text-[18px] leading-none transition-colors duration-100"
                >
                  {e}
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {/* 操作栏：添加图片 / 删除模式 */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-[var(--radius-6)] text-[11px] text-text-secondary hover:text-text-default bg-bg-base hover:bg-[var(--bg-overlay-l2)] cursor-pointer transition-colors"
                >
                  <ImagePlus size={13} />
                  {t("emoji.addImage")}
                </button>
                {customEmojis.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setDeleteMode((v) => !v)}
                    title={deleteMode ? t("emoji.exitDelete") : t("emoji.deleteMode")}
                    className={cn(
                      "flex items-center justify-center w-8 h-8 rounded-[var(--radius-6)] cursor-pointer transition-colors",
                      deleteMode
                        ? "bg-status-error/15 text-status-error"
                        : "text-text-tertiary hover:text-text-default bg-bg-base hover:bg-[var(--bg-overlay-l2)]",
                    )}
                  >
                    <Trash size={13} />
                  </button>
                )}
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageSelect}
                />
              </div>

              {/* 自定义表情计数 */}
              {customEmojis.length > 0 && (
                <div className="px-1 text-[10px] text-text-tertiary">
                  {t("emoji.customCount", { count: customEmojis.length })}
                </div>
              )}

              {/* 自定义表情列表 */}
              {customEmojis.length === 0 ? (
                <div className="text-center text-text-tertiary py-6 text-[11px]">
                  {t("emoji.empty")}
                </div>
              ) : (
                <div className="grid grid-cols-5 gap-1 max-h-[200px] overflow-y-auto thin-scrollbar">
                  {customEmojis.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handlePickCustom(item)}
                      title={deleteMode ? t("emoji.clickToDelete") : item.name}
                      className={cn(
                        "aspect-square flex items-center justify-center rounded-[var(--radius-6)] cursor-pointer transition-colors duration-100 relative p-1",
                        deleteMode
                          ? "hover:bg-status-error/15"
                          : "hover:bg-[var(--bg-overlay-l2)] active:bg-[var(--bg-overlay-l3)]",
                      )}
                    >
                      {item.isImage ? (
                        <img
                          src={item.content}
                          alt={item.name || "custom"}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <span className="text-[24px] leading-none">{item.content}</span>
                      )}
                      {deleteMode && (
                        <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-status-error text-white flex items-center justify-center">
                          <X size={10} />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** 压缩图片为小尺寸 data URL（用于自定义表情缩略图） */
function compressImage(file: File, size: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("load failed"));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("canvas unsupported"));
          return;
        }
        // 居中裁剪为正方形
        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/** 读取文件为 data URL（不经过 canvas，保留动画帧） */
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}
