import { create } from "zustand";
import toast from "react-hot-toast";
import { useAuthStore } from "./useAuthStore";

// Public STUN only — enough for two peers on an open network / the same
// NAT. For reliable calls across arbitrary networks you'd add a TURN
// server here too (e.g. from Twilio or metered.ca) and nothing else in
// this file would need to change.
const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

function socket() {
  return useAuthStore.getState().socket;
}

function myId() {
  return useAuthStore.getState().authUser?._id;
}

export const useCallStore = create((set, get) => ({
  status: "idle", // idle | calling | ringing | connected
  callType: null, // "audio" | "video"
  peer: null, // { id, name, avatarUrl, initials }
  incomingCall: null, // { from, offer, callType, callerName, callerAvatar }
  localStream: null,
  remoteStream: null,
  isMuted: false,
  isCameraOff: false,
  callStartedAt: null,

  _pc: null,
  _pendingCandidates: [],
  _subscribed: false,

  subscribeToCallEvents: () => {
    if (get()._subscribed) return;
    const s = socket();
    if (!s) return;

    s.on("call:offer", ({ from, offer, callType, callerName, callerAvatar }) => {
      if (get().status !== "idle") {
        s.emit("call:busy", { to: from });
        return;
      }
      set({
        status: "ringing",
        incomingCall: { from, offer, callType, callerName, callerAvatar },
        callType,
      });
    });

    s.on("call:answer", async ({ answer }) => {
      const pc = get()._pc;
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      get()._flushCandidates();
      set({ status: "connected", callStartedAt: Date.now() });
    });

    s.on("call:ice-candidate", async ({ candidate }) => {
      if (!candidate) return;
      const pc = get()._pc;
      if (pc && pc.remoteDescription) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch {
          // ignore malformed/late candidates
        }
      } else {
        set((state) => ({ _pendingCandidates: [...state._pendingCandidates, candidate] }));
      }
    });

    s.on("call:reject", () => {
      toast("Call declined", { icon: "📵" });
      get().endCall({ notifyPeer: false });
    });

    s.on("call:busy", () => {
      toast("They're on another call right now", { icon: "📵" });
      get().endCall({ notifyPeer: false });
    });

    s.on("call:end", () => {
      get().endCall({ notifyPeer: false });
    });

    set({ _subscribed: true });
  },

  _flushCandidates: () => {
    const pc = get()._pc;
    const queued = get()._pendingCandidates;
    if (!pc || queued.length === 0) return;
    queued.forEach((candidate) => pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {}));
    set({ _pendingCandidates: [] });
  },

  _createPeerConnection: (targetUserId) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket()?.emit("call:ice-candidate", { to: targetUserId, candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      set({ remoteStream: event.streams[0] });
    };

    pc.onconnectionstatechange = () => {
      if (["failed", "disconnected", "closed"].includes(pc.connectionState)) {
        if (get().status === "connected") get().endCall({ notifyPeer: false });
      }
    };

    set({ _pc: pc });
    return pc;
  },

  startCall: async (peerUser, callType) => {
    if (get().status !== "idle") return;
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("This browser can't access the camera/microphone.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === "video",
      });

      set({
        status: "calling",
        callType,
        peer: peerUser,
        localStream: stream,
        isMuted: false,
        isCameraOff: false,
      });

      const pc = get()._createPeerConnection(peerUser.id);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket()?.emit("call:offer", {
        to: peerUser.id,
        offer,
        callType,
        callerName: useAuthStore.getState().authUser?.fullName ?? "Someone",
        callerAvatar: useAuthStore.getState().authUser?.profilePic,
      });
    } catch (error) {
      console.error("Failed to start call:", error);
      toast.error("Couldn't access your camera/microphone.");
      get().endCall({ notifyPeer: false });
    }
  },

  acceptCall: async () => {
    const incoming = get().incomingCall;
    if (!incoming) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: incoming.callType === "video",
      });

      set({
        status: "connected",
        callStartedAt: Date.now(),
        peer: {
          id: incoming.from,
          name: incoming.callerName,
          avatarUrl: incoming.callerAvatar,
          initials: (incoming.callerName || "?").slice(0, 2).toUpperCase(),
        },
        localStream: stream,
        incomingCall: null,
        isMuted: false,
        isCameraOff: false,
      });

      const pc = get()._createPeerConnection(incoming.from);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(incoming.offer));
      get()._flushCandidates();

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket()?.emit("call:answer", { to: incoming.from, answer });
    } catch (error) {
      console.error("Failed to accept call:", error);
      toast.error("Couldn't access your camera/microphone.");
      socket()?.emit("call:reject", { to: incoming.from });
      set({ incomingCall: null, status: "idle" });
    }
  },

  declineCall: () => {
    const incoming = get().incomingCall;
    if (incoming) socket()?.emit("call:reject", { to: incoming.from });
    set({ incomingCall: null, status: "idle", callType: null });
  },

  toggleMute: () => {
    const stream = get().localStream;
    const next = !get().isMuted;
    stream?.getAudioTracks().forEach((track) => (track.enabled = !next));
    set({ isMuted: next });
  },

  toggleCamera: () => {
    const stream = get().localStream;
    const next = !get().isCameraOff;
    stream?.getVideoTracks().forEach((track) => (track.enabled = !next));
    set({ isCameraOff: next });
  },

  endCall: ({ notifyPeer = true } = {}) => {
    const { _pc, localStream, peer, incomingCall } = get();

    if (notifyPeer) {
      const targetId = peer?.id || incomingCall?.from;
      if (targetId) socket()?.emit("call:end", { to: targetId });
    }

    _pc?.close();
    localStream?.getTracks().forEach((track) => track.stop());

    set({
      status: "idle",
      callType: null,
      peer: null,
      incomingCall: null,
      localStream: null,
      remoteStream: null,
      isMuted: false,
      isCameraOff: false,
      callStartedAt: null,
      _pc: null,
      _pendingCandidates: [],
    });
  },

  callWithUser: (peerUser, callType) => {
    if (!myId()) return;
    get().startCall(peerUser, callType);
  },
}));
