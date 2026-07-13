/**
 * 音效模块 — 使用 Web Audio API 合成提示音，无需外部音频文件。
 *
 * 三种事件音效：
 * - message: 收到新消息（短促的双音"叮咚"）
 * - friendRequest: 收到好友申请（上行音阶）
 * - friendAccepted: 好友申请被同意（欢快的三音）
 *
 * 浏览器自动播放策略：AudioContext 必须在用户交互后才能 resume，
 * 因此在首次用户交互（点击/按键）时延迟初始化 AudioContext。
 */

import { getPreferences } from "./preferences";

let audioCtx: AudioContext | null = null;

/** 懒初始化 AudioContext（需用户交互后才能正常播放） */
function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (audioCtx) return audioCtx;
  try {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = new Ctor();
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * 用户首次交互时解锁音频播放。
 * 在 main.tsx 启动时注册一次性监听器。
 */
export function unlockAudio(): void {
  if (typeof window === "undefined") return;
  const unlock = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(() => {
        /* ignore */
      });
    }
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
}

/**
 * 合成单音 — oscillator + gain envelope
 */
function playTone(
  ctx: AudioContext,
  freq: number,
  startAt: number,
  duration: number,
  volume = 0.18,
  type: OscillatorType = "sine",
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startAt);
  // ADSR 简化版：快速起音 + 指数衰减
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.02);
}

/** 播放指定类型音效（受 soundNoti 偏好控制） */
export function playSound(
  kind: "message" | "friendRequest" | "friendAccepted",
): void {
  // 偏好关闭 → 不播放
  if (!getPreferences().soundNoti) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  // 仍处于 suspended 状态（用户未交互）→ 跳过
  if (ctx.state === "suspended") return;
  const now = ctx.currentTime;

  switch (kind) {
    case "message":
      // 双音"叮咚"：880Hz → 660Hz
      playTone(ctx, 880, now, 0.12);
      playTone(ctx, 660, now + 0.1, 0.16);
      break;
    case "friendRequest":
      // 上行音阶：523 → 659 → 784
      playTone(ctx, 523.25, now, 0.12);
      playTone(ctx, 659.25, now + 0.1, 0.12);
      playTone(ctx, 783.99, now + 0.2, 0.18);
      break;
    case "friendAccepted":
      // 欢快三音：659 → 880 → 1047
      playTone(ctx, 659.25, now, 0.1);
      playTone(ctx, 880, now + 0.09, 0.1);
      playTone(ctx, 1046.5, now + 0.18, 0.2);
      break;
  }
}
