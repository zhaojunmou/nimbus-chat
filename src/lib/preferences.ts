/**
 * 用户偏好持久化 — 基于 localStorage
 * 用于通知开关、主题、媒体自动下载等设置项。
 */

const PREF_KEY = "nimbus_chat_prefs";

export interface UserPreferences {
  // 通知
  msgNoti: boolean;
  soundNoti: boolean;
  showPreview: boolean;
  // 外观
  theme: "dark" | "light";
  accentColor: string;
  // 媒体自动下载
  autoDlPhotos: boolean;
  autoDlVideos: boolean;
  autoDlDocuments: boolean;
  autoDlWifiOnly: boolean;
}

const defaults: UserPreferences = {
  msgNoti: true,
  soundNoti: true,
  showPreview: false,
  theme: "dark",
  accentColor: "brand",
  autoDlPhotos: true,
  autoDlVideos: false,
  autoDlDocuments: true,
  autoDlWifiOnly: true,
};

/** 读取全部偏好（合并默认值，容错） */
export function getPreferences(): UserPreferences {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (!raw) return defaults;
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return defaults;
  }
}

/** 持久化偏好 */
export function savePreferences(prefs: Partial<UserPreferences>): UserPreferences {
  const merged = { ...getPreferences(), ...prefs };
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(merged));
  } catch {
    /* ignore */
  }
  return merged;
}
