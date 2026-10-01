import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import { io } from "socket.io-client";
import { getOrCreateKeyPair, publicKeyToBase64 } from "../lib/e2ee";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || (import.meta.env.DEV ? "http://localhost:3000" : undefined);

export const useAuthStore = create((set, get) => ({
  authUser: null,
  isCheckingAuth: true,
  onlineUsers: [],
  socket: null,

  checkAuth: async () => {
    set({ isCheckingAuth: true });

    try {
      const res = await axiosInstance.get("/auth/check");
      set({ authUser: res.data });

      get().connectSocket(res.data);
      get().ensurePublicKeyPublished(res.data);
    } catch (error) {
      console.error("Error in checkAuth:", error);
      set({ authUser: null });
    } finally {
      set({ isCheckingAuth: false });
    }
  },

  // Makes sure this device's E2EE public key is on file with the server —
  // generates the local keypair if it doesn't exist yet (first time this
  // browser has seen this user), and republishes it if the server's copy
  // is missing or out of date (e.g. a fresh browser profile).
  ensurePublicKeyPublished: async (user) => {
    if (!user?._id) return;

    const keyPair = getOrCreateKeyPair(user._id);
    if (!keyPair) return;

    const myPublicKeyB64 = publicKeyToBase64(keyPair.publicKey);
    if (user.publicKey === myPublicKeyB64) return;

    try {
      const res = await axiosInstance.patch("/auth/public-key", { publicKey: myPublicKeyB64 });
      set({ authUser: res.data });
    } catch (error) {
      console.error("Error publishing E2EE public key:", error);
    }
  },

  clearAuth: () => {
    set({ authUser: null, isCheckingAuth: false, onlineUsers: [] });
    get().disconnectSocket();
  },

  connectSocket: (user) => {
    if (!user || get().socket?.connected) return;

    // `auth` as a function is re-invoked on every connection attempt
    // (including automatic reconnects), so this always sends a fresh,
    // still-valid Clerk session token rather than one that's gone stale.
    const socket = io(SOCKET_URL, {
      auth: async (callback) => {
        const token = await window.Clerk?.session?.getToken();
        callback({ token });
      },
    });

    set({ socket });

    socket.on("getOnlineUsers", (userIds) => {
      set({ onlineUsers: userIds });
    });

    socket.on("connect_error", (error) => {
      // almost always means the session token couldn't be verified
      // server-side (expired/missing) — nothing sensitive to show the user
      console.warn("Socket connection rejected:", error.message);
    });
  },

  disconnectSocket: () => {
    const socket = get().socket;
    if (socket?.connected) socket.disconnect();
    set({ socket: null });
  },
}));
