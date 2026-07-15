import { create } from "zustand";
import {
  emitCallOffer,
  emitCallAnswer,
  emitCallIceCandidate,
  emitCallReject,
  emitCallEnd,
  sendMessage,
} from "./api/socket";

/**
 * 语音通话状态管理 + WebRTC 信令封装
 *
 * 设计要点：
 * - RTCPeerConnection / MediaStream 不放 zustand state（不可序列化），用模块级变量持有
 * - zustand 仅保存 UI 响应式状态（status / peerId / peerName / conversationId / muted）
 * - 信令事件订阅在 store.ts 的 subscribeRealtime 中注册，调用本 store 的方法
 */

export type CallStatus =
  | "idle" // 无通话
  | "calling" // 正在呼叫对方（outgoing，等待对方接听）
  | "incoming" // 收到来电（等待用户操作）
  | "connecting" // 信令已交换，正在建立 P2P 连接
  | "connected" // 通话已接通
  | "ended" // 通话已结束（对方挂断或自己挂断）
  | "rejected" // 通话被拒接
  | "failed" // 通话失败（设备不可用 / 连接失败）
  | "busy"; // 对方忙线（通话中）

interface IncomingCallData {
  from: string;
  fromName: string;
  conversationId: string;
  offer: RTCSessionDescriptionInit;
}

interface CallState {
  status: CallStatus;
  peerId: string | null;
  peerName: string | null;
  conversationId: string | null;
  muted: boolean;
  /** 来电暂存的 offer 数据（accept 时使用） */
  incomingOffer: IncomingCallData | null;
  /** 远端音频就绪标志 — 用于触发 UI 更新 */
  remoteReady: boolean;
  /** 麦克风是否可用（不可用时进入只收听模式） */
  micAvailable: boolean;

  // ── 主动操作 ──
  startOutgoingCall: (
    peerId: string,
    peerName: string,
    conversationId: string,
  ) => Promise<void>;
  acceptIncomingCall: () => Promise<void>;
  rejectIncomingCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  /** 完全重置通话状态 — 由 UI 在导航后调用 */
  resetCallState: () => void;

  // ── 信令回调（由 socket 订阅调用） ──
  onIncomingOffer: (data: IncomingCallData) => void;
  onRemoteAnswer: (from: string, answer: RTCSessionDescriptionInit) => void;
  onRemoteIceCandidate: (
    from: string,
    candidate: RTCIceCandidateInit,
  ) => void;
  onRemoteReject: () => void;
  onRemoteEnd: () => void;
}

// ── 模块级变量（不可序列化的 WebRTC 资源） ──

let pc: RTCPeerConnection | null = null;
let localStream: MediaStream | null = null;
let remoteStream: MediaStream | null = null;
// 呼叫超时定时器 — 30s 无响应自动结束
let callTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
// 通话接通时间戳（用于计算时长）— null 表示未接通
let callStartTime: number | null = null;
// 是否为呼叫方（发起方）— 用于决定谁发送通话记录
let isCaller: boolean = false;

function clearCallTimeout() {
  if (callTimeoutTimer) {
    clearTimeout(callTimeoutTimer);
    callTimeoutTimer = null;
  }
}

function startCallTimeout() {
  clearCallTimeout();
  callTimeoutTimer = setTimeout(() => {
    const { status } = useCallStore.getState();
    // 仅在呼叫中 / 连接中状态超时
    if (status === "calling" || status === "connecting") {
      console.warn("[call] timeout — no response within 30s");
      useCallStore.getState().endCall();
    }
  }, 30000);
}

// Google 公共 STUN 服务器 — 基本够用，生产环境需要加 TURN
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

/** 创建 RTCPeerConnection 并绑定事件 */
function createPeerConnection(
  onIceCandidate: (candidate: RTCIceCandidateInit) => void,
  onTrack: (stream: MediaStream) => void,
): RTCPeerConnection {
  const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS });

  // ICE 候选生成 → 通过信令发送给对方
  peer.onicecandidate = (e) => {
    if (e.candidate) {
      onIceCandidate(e.candidate.toJSON());
    }
  };

  // 收到远端轨道 → 保存并播放
  peer.ontrack = (e) => {
    if (!remoteStream) {
      remoteStream = new MediaStream();
    }
    e.streams[0]?.getTracks().forEach((track) => {
      remoteStream!.addTrack(track);
    });
    onTrack(remoteStream!);
  };

  // 连接状态变化
  peer.onconnectionstatechange = () => {
    console.log("[webrtc] connection state:", peer.connectionState);
    if (peer.connectionState === "failed" || peer.connectionState === "disconnected") {
      const { status } = useCallStore.getState();
      if (status === "connected" || status === "connecting") {
        useCallStore.getState().endCall();
      }
    }
  };

  return peer;
}

/** 获取本地麦克风音频流
 *  失败时返回 null（麦克风不可用 / 非 secure context / 无设备）
 *  — 通话仍可继续，进入"只收听"模式 */
async function getLocalAudioStream(): Promise<MediaStream | null> {
  if (localStream) return localStream;
  // 非 secure context（非 HTTPS / 非 localhost）下 mediaDevices 不可用
  if (
    typeof navigator === "undefined" ||
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia
  ) {
    console.warn("[webrtc] mediaDevices API not available (non-secure context?)");
    return null;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
    localStream = stream;
    return stream;
  } catch (err) {
    console.warn("[webrtc] getUserMedia failed:", err);
    return null;
  }
}

/** 清理所有 WebRTC 资源 — 用 try-catch 包裹，避免异常中断状态更新 */
function cleanupWebRTC() {
  clearCallTimeout();
  try {
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      try {
        pc.getSenders().forEach((s) => {
          try {
            s.track?.stop();
          } catch {
            /* ignore */
          }
        });
      } catch {
        /* ignore */
      }
      try {
        pc.close();
      } catch {
        /* ignore */
      }
      pc = null;
    }
  } catch (err) {
    console.error("[webrtc] cleanup pc failed:", err);
    pc = null;
  }
  try {
    if (localStream) {
      localStream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          /* ignore */
        }
      });
      localStream = null;
    }
  } catch (err) {
    console.error("[webrtc] cleanup localStream failed:", err);
    localStream = null;
  }
  remoteStream = null;
  // 重置通话记录相关变量
  callStartTime = null;
  isCaller = false;
}

/** 发送通话记录消息到聊天会话 — 仅呼叫方调用 */
function sendCallRecord(finalStatus: CallStatus) {
  const { conversationId } = useCallStore.getState();
  if (!conversationId) return;

  let callStatus: "completed" | "rejected" | "missed" | "failed" | "busy";
  let duration: number | undefined;

  if (callStartTime !== null) {
    // 曾接通过 → completed
    callStatus = "completed";
    duration = Math.floor((Date.now() - callStartTime) / 1000);
  } else if (finalStatus === "rejected") {
    callStatus = "rejected";
  } else if (finalStatus === "failed") {
    callStatus = "failed";
  } else {
    // ended 但未接通 → missed（呼叫方取消或对方未接听）
    callStatus = "missed";
  }

  try {
    sendMessage(conversationId, "", undefined, undefined, {
      status: callStatus,
      duration,
      isCaller,
    });
  } catch (err) {
    console.warn("[call] sendCallRecord failed:", err);
  }
}

/** 播放远端音频 — 创建一个隐藏的 <audio> 元素 */
let audioEl: HTMLAudioElement | null = null;
function playRemoteAudio(stream: MediaStream) {
  if (!audioEl) {
    audioEl = new Audio();
    audioEl.autoplay = true;
    audioEl.style.display = "none";
    document.body.appendChild(audioEl);
  }
  audioEl.srcObject = stream;
  audioEl.play().catch((err) => {
    console.warn("[webrtc] audio play failed:", err);
  });
}

function removeAudioEl() {
  try {
    if (audioEl) {
      audioEl.srcObject = null;
      audioEl.pause?.();
      audioEl.remove();
      audioEl = null;
    }
  } catch (err) {
    console.warn("[webrtc] removeAudioEl failed:", err);
    audioEl = null;
  }
}

// ── zustand store ──

export const useCallStore = create<CallState>((set, get) => ({
  status: "idle",
  peerId: null,
  peerName: null,
  conversationId: null,
  muted: false,
  incomingOffer: null,
  remoteReady: false,
  micAvailable: true,

  // ── 发起通话（呼叫方） ──
  startOutgoingCall: async (peerId, peerName, conversationId) => {
    // 仅在无活跃通话时允许发起（idle/ended/rejected/failed 都算无活跃）
    const activeStates: CallStatus[] = ["calling", "incoming", "connecting", "connected"];
    if (activeStates.includes(get().status)) {
      console.warn("[call] cannot start: call already in progress");
      return;
    }
    set({
      status: "calling",
      peerId,
      peerName,
      conversationId,
      muted: false,
      remoteReady: false,
      micAvailable: true,
    });
    isCaller = true;
    callStartTime = null;
    startCallTimeout();

    try {
      const stream = await getLocalAudioStream();
      // 检查状态是否还是 calling — 如果不是，说明用户已挂断或被拒
      if (get().status !== "calling") {
        console.log("[call] startOutgoingCall aborted: status changed after getUserMedia");
        if (stream && localStream === stream) localStream = null;
        return;
      }
      pc = createPeerConnection(
        (candidate) => emitCallIceCandidate(peerId, candidate),
        (remote) => {
          playRemoteAudio(remote);
          callStartTime = Date.now();
          set({ status: "connected", remoteReady: true });
        },
      );
      // 添加本地音频轨道（麦克风不可用时跳过 — 只收听模式）
      if (stream) {
        stream.getAudioTracks().forEach((track) => {
          pc!.addTrack(track, stream);
        });
      } else {
        // 标记麦克风不可用 — UI 显示提示
        set({ micAvailable: false });
        // 仍需添加一个收发器以接收远端音频
        pc!.addTransceiver("audio", { direction: "recvonly" });
      }
      // 创建 offer → 设置本地描述 → 发送给对方
      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      if (get().status !== "calling") {
        console.log("[call] startOutgoingCall aborted: status changed after createOffer");
        cleanupWebRTC();
        return;
      }
      await pc.setLocalDescription(offer);
      if (get().status !== "calling") {
        console.log("[call] startOutgoingCall aborted: status changed before emit");
        cleanupWebRTC();
        return;
      }
      emitCallOffer(peerId, conversationId, offer);
    } catch (err) {
      console.error("[call] startOutgoingCall failed:", err);
      // 仅在状态还是 calling 时才设为 failed — 避免覆盖已结束/已拒绝的状态
      if (get().status === "calling") {
        set({ status: "failed" });
        sendCallRecord("failed");
      }
      cleanupWebRTC();
    }
  },

  // ── 接受来电（被叫方） ──
  acceptIncomingCall: async () => {
    const { incomingOffer, peerId } = get();
    if (!incomingOffer || !peerId) {
      console.warn("[call] acceptIncomingCall: no incoming offer");
      return;
    }
    set({ status: "connecting", incomingOffer: null, micAvailable: true });
    isCaller = false;
    callStartTime = null;

    try {
      const stream = await getLocalAudioStream();
      if (get().status !== "connecting") {
        console.log("[call] acceptIncomingCall aborted: status changed after getUserMedia");
        if (stream && localStream === stream) localStream = null;
        return;
      }
      pc = createPeerConnection(
        (candidate) => emitCallIceCandidate(peerId, candidate),
        (remote) => {
          playRemoteAudio(remote);
          callStartTime = Date.now();
          set({ status: "connected", remoteReady: true });
        },
      );
      if (stream) {
        stream.getAudioTracks().forEach((track) => {
          pc!.addTrack(track, stream);
        });
      } else {
        set({ micAvailable: false });
      }
      // 设置远端 offer → 创建 answer → 设置本地描述 → 发送 answer
      await pc.setRemoteDescription(incomingOffer.offer);
      if (get().status !== "connecting") {
        console.log("[call] acceptIncomingCall aborted: status changed after setRemoteDescription");
        cleanupWebRTC();
        return;
      }
      const answer = await pc.createAnswer();
      if (get().status !== "connecting") {
        console.log("[call] acceptIncomingCall aborted: status changed after createAnswer");
        cleanupWebRTC();
        return;
      }
      await pc.setLocalDescription(answer);
      if (get().status !== "connecting") {
        console.log("[call] acceptIncomingCall aborted: status changed before emit");
        cleanupWebRTC();
        return;
      }
      emitCallAnswer(peerId, answer);
    } catch (err) {
      console.error("[call] acceptIncomingCall failed:", err);
      if (get().status === "connecting") {
        set({ status: "failed" });
      }
      cleanupWebRTC();
    }
  },

  // ── 拒接来电 ──
  rejectIncomingCall: () => {
    const { peerId } = get();
    if (peerId) {
      try {
        emitCallReject(peerId);
      } catch (err) {
        console.warn("[call] emitCallReject failed:", err);
      }
    }
    // 先更新状态
    set({
      status: "idle",
      peerId: null,
      peerName: null,
      conversationId: null,
      incomingOffer: null,
      muted: false,
      remoteReady: false,
      micAvailable: true,
    });
    // 再清理资源
    cleanupWebRTC();
    removeAudioEl();
  },

  // ── 挂断通话 ──
  endCall: () => {
    const { peerId, status } = get();
    // 通知对方挂断（仅在活跃通话状态才发送）
    const activeStates: CallStatus[] = ["calling", "incoming", "connecting", "connected"];
    if (peerId && activeStates.includes(status)) {
      try {
        emitCallEnd(peerId);
      } catch (err) {
        console.warn("[call] emitCallEnd failed:", err);
      }
    }
    // 呼叫方负责发送通话记录（被叫方不发送，避免重复）
    if (isCaller) {
      sendCallRecord("ended");
    }
    // 先更新状态 — 确保 UI 立即响应，不被后续清理中断
    set({
      status: "ended",
      muted: false,
      remoteReady: false,
    });
    // 再清理资源（即使失败也不影响状态）
    cleanupWebRTC();
    removeAudioEl();
    // 不在此处自动重置为 idle — 由 UI（VoiceCall）导航后调用 resetCallState
  },

  // ── 完全重置通话状态 ──
  resetCallState: () => {
    cleanupWebRTC();
    removeAudioEl();
    set({
      status: "idle",
      peerId: null,
      peerName: null,
      conversationId: null,
      incomingOffer: null,
      muted: false,
      remoteReady: false,
      micAvailable: true,
    });
  },

  // ── 切换静音 ──
  toggleMute: () => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (!audioTrack) return;
    audioTrack.enabled = !audioTrack.enabled;
    set({ muted: !audioTrack.enabled });
  },

  // ── 信令回调 ──

  // 收到来电
  onIncomingOffer: (data) => {
    const current = get().status;
    // 如果正在通话中或已有来电在显示，自动拒绝（忙线）
    if (
      current === "connected" ||
      current === "connecting" ||
      current === "calling" ||
      current === "incoming"
    ) {
      emitCallReject(data.from);
      return;
    }
    set({
      status: "incoming",
      peerId: data.from,
      peerName: data.fromName,
      conversationId: data.conversationId,
      incomingOffer: data,
      muted: false,
      remoteReady: false,
      micAvailable: true,
    });
  },

  // 收到对方 answer（呼叫方）
  onRemoteAnswer: (from, answer) => {
    const { peerId, status } = get();
    if (status !== "calling" && status !== "connecting") return;
    if (peerId && from !== peerId) return;
    if (!pc) return;
    clearCallTimeout();
    pc.setRemoteDescription(answer).catch((err) => {
      console.error("[call] setRemoteDescription(answer) failed:", err);
      set({ status: "failed" });
      cleanupWebRTC();
    });
    set({ status: "connecting" });
  },

  // 收到 ICE 候选
  onRemoteIceCandidate: (from, candidate) => {
    const { peerId } = get();
    if (peerId && from !== peerId) return;
    if (!pc) return;
    pc.addIceCandidate(new RTCIceCandidate(candidate)).catch((err) => {
      console.warn("[call] addIceCandidate failed:", err);
    });
  },

  // 对方拒接
  onRemoteReject: () => {
    const { status } = get();
    // 同一时间只会有一个通话 — 不检查 from，避免 userId 不匹配导致事件被丢弃
    if (status === "idle" || status === "ended" || status === "rejected") return;
    console.log("[call] remote rejected");
    // 呼叫方发送通话记录（被叫方拒接，呼叫方记录为 rejected）
    if (isCaller) {
      sendCallRecord("rejected");
    }
    // 先更新状态
    set({ status: "rejected" });
    // 再清理资源
    cleanupWebRTC();
    removeAudioEl();
    // 不自动重置 — 由 UI 导航后调用 resetCallState
  },

  // 对方挂断
  onRemoteEnd: () => {
    const { status } = get();
    if (status === "idle" || status === "ended" || status === "rejected") return;
    console.log("[call] remote ended");
    // 呼叫方发送通话记录（被叫方挂断，呼叫方记录）
    if (isCaller) {
      sendCallRecord("ended");
    }
    // 先更新状态
    set({ status: "ended" });
    // 再清理资源
    cleanupWebRTC();
    removeAudioEl();
    // 不自动重置 — 由 UI 导航后调用 resetCallState
  },
}));
