import { create } from "zustand";
import { persist } from "zustand/middleware";

import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";
import { encryptBytes, encryptForPeer, getOrCreateKeyPair } from "../lib/e2ee";
import toast from "react-hot-toast";

// Finds the recipient's public key (refreshing the user list once if we
// don't have it yet — they may have published it since we last looked).
// If they genuinely haven't turned encryption on we STOP rather than quietly
// falling back to plaintext: a silent downgrade would defeat the point.
async function resolveEncryptionTarget(get, set, userId) {
  const authUser = useAuthStore.getState().authUser;
  const keyPair = authUser ? getOrCreateKeyPair(authUser._id) : null;
  if (!keyPair) {
    toast.error("Your encryption keys aren't ready yet — try again in a moment.");
    return null;
  }

  const findPeer = () =>
    get().users.find((u) => u._id === userId) || get().conversations.find((u) => u._id === userId);

  let peer = findPeer();
  if (!peer?.publicKey) {
    await get().getUsers();
    peer = findPeer();
  }
  if (!peer?.publicKey) {
    toast.error(
      `${peer?.fullName || "They"} haven't turned on encryption yet — ask them to open Phoenix once, then try again.`,
    );
    return null;
  }

  if (get().selectedUser?._id === userId) set({ selectedUser: peer });
  return { peer, secretKey: keyPair.secretKey };
}

export const useChatStore = create(
  persist(
    (set, get) => ({
      users: [],
      conversations: [],
      messages: [],
      selectedUser: null,
      isConversationsLoading: false,
      isUsersLoading: false,
      isMessagesLoading: false,
      activeConversationId: null,
      searchQuery: "",
      sidebarTab: "chats",
      composerText: "",
      isSendingMedia: false,
      replyingTo: null, // { id, text, hasImage, hasVideo, hasAudio, senderId } | null
      typingUserIds: [], // ids of peers currently typing, across all open chats
      isMessageSearchOpen: false,
      messageSearchQuery: "",

      getUsers: async () => {
        set({ isUsersLoading: true });
        try {
          const res = await axiosInstance.get("/messages/users");
          set((state) => ({
            users: res.data,
            selectedUser:
              state.selectedUser && res.data.some((user) => user._id === state.selectedUser._id)
                ? state.selectedUser
                : null,
          }));
        } catch (error) {
          console.log("Error in get Users", error.message);
        } finally {
          set({ isUsersLoading: false });
        }
      },

      getConversations: async () => {
        set({ isConversationsLoading: true });
        try {
          const res = await axiosInstance.get("/messages/conversations");
          set({ conversations: res.data });
        } catch (error) {
          console.log("Error in getConversations", error.message);
        } finally {
          set({ isConversationsLoading: false });
        }
      },

      getMessages: async (userId) => {
        if (!userId) return;
        set({ isMessagesLoading: true });
        try {
          const res = await axiosInstance.get(`/messages/${userId}`);
          set({ messages: res.data });
        } catch (error) {
          toast.error(error.response?.data?.message || "Failed to load messages");
        } finally {
          set({ isMessagesLoading: false });
        }
      },

      sendMessage: async (messageData) => {
        const { selectedUser, messages } = get();
        if (!selectedUser) return false;

        try {
          const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, messageData);
          set({ messages: [...messages, res.data], composerText: "", replyingTo: null });
          get().getConversations();
          return true;
        } catch (error) {
          toast.error(error.response?.data?.message || "Failed to send message");
          return false;
        }
      },

      reactToMessage: async (messageId, emoji) => {
        const { selectedUser, messages } = get();
        if (!selectedUser) return;

        try {
          const res = await axiosInstance.patch(`/messages/react/${messageId}`, { emoji });
          set({ messages: messages.map((m) => (m._id === messageId ? res.data : m)) });
        } catch (error) {
          toast.error(error.response?.data?.message || "Failed to react");
        }
      },

      deleteMessage: async (messageId) => {
        const { messages } = get();
        try {
          const res = await axiosInstance.delete(`/messages/${messageId}`);
          set({ messages: messages.map((m) => (m._id === messageId ? res.data : m)) });
        } catch (error) {
          toast.error(error.response?.data?.message || "Failed to delete message");
        }
      },

      setReplyingTo: (replyingTo) => set({ replyingTo }),

      emitTyping: () => {
        const socket = useAuthStore.getState().socket;
        const to = get().selectedUser?._id;
        if (socket && to) socket.emit("typing", { to });
      },

      emitStopTyping: () => {
        const socket = useAuthStore.getState().socket;
        const to = get().selectedUser?._id;
        if (socket && to) socket.emit("stopTyping", { to });
      },

      subscribeToMessages: (userId) => {
        if (!userId) return;

        const socket = useAuthStore.getState().socket;
        if (!socket) return;

        socket.off("newMessage");
        socket.on("newMessage", (newMessage) => {
          // if im not the receiver don't do anything just return
          if (String(newMessage.senderId) !== String(userId)) return;

          set({ messages: [...get().messages, newMessage] });
          set({ typingUserIds: get().typingUserIds.filter((id) => id !== userId) });

          get().getConversations();
        });

        socket.off("messageReaction");
        socket.on("messageReaction", (updatedMessage) => {
          set({
            messages: get().messages.map((m) =>
              m._id === updatedMessage._id ? updatedMessage : m,
            ),
          });
        });

        socket.off("messageDeleted");
        socket.on("messageDeleted", ({ messageId }) => {
          set({
            messages: get().messages.map((m) =>
              m._id === messageId
                ? { ...m, isDeleted: true, text: "", image: null, video: null, audio: null }
                : m,
            ),
          });
        });

        socket.off("messageEdited");
        socket.on("messageEdited", (updatedMessage) => {
          set({
            messages: get().messages.map((m) =>
              m._id === updatedMessage._id ? updatedMessage : m,
            ),
          });
        });

        socket.off("messagesSeen");
        socket.on("messagesSeen", ({ messageIds }) => {
          const idSet = new Set(messageIds);
          set({
            messages: get().messages.map((m) => (idSet.has(m._id) ? { ...m, seen: true } : m)),
          });
        });

        socket.off("typing");
        socket.on("typing", ({ from }) => {
          if (from !== userId) return;
          set({ typingUserIds: [...new Set([...get().typingUserIds, from])] });
        });

        socket.off("stopTyping");
        socket.on("stopTyping", ({ from }) => {
          set({ typingUserIds: get().typingUserIds.filter((id) => id !== from) });
        });
      },

      unsubscribeFromMessages: () => {
        const socket = useAuthStore.getState().socket;
        [
          "newMessage",
          "messageReaction",
          "messageEdited",
          "messageDeleted",
          "messagesSeen",
          "typing",
          "stopTyping",
        ].forEach((event) => socket?.off(event));
        set({ typingUserIds: [] });
      },

      setSelectedUser: (selectedUser) => set({ selectedUser }),

      setActiveConversationId: (activeConversationId) => {
        set((state) => ({
          activeConversationId,
          selectedUser:
            state.users.find((user) => user._id === activeConversationId) ||
            state.conversations.find((user) => user._id === activeConversationId) ||
            null,
          messages: activeConversationId ? state.messages : [],
          isMessageSearchOpen: false,
          messageSearchQuery: "",
          replyingTo: null,
        }));
      },

      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setSidebarTab: (sidebarTab) => set({ sidebarTab }),
      setComposerText: (composerText) => set({ composerText }),

      toggleMessageSearch: () =>
        set((state) => ({
          isMessageSearchOpen: !state.isMessageSearchOpen,
          messageSearchQuery: state.isMessageSearchOpen ? "" : state.messageSearchQuery,
        })),
      setMessageSearchQuery: (messageSearchQuery) => set({ messageSearchQuery }),

      // Forwarding itself now lives in lib/forward.js + ForwardPicker — it
      // needs to reach across into whichever store owns the TARGET (a DM
      // here, but could be a group), so it doesn't fit neatly as a single
      // store's action anymore. MessageBubble already has the message
      // decrypted in hand and passes that straight to the picker.

      editMessage: async (messageId, newText) => {
        const target = await resolveEncryptionTarget(get, set, get().activeConversationId);
        if (!target) return false;

        try {
          const { cipherText, nonce } = encryptForPeer(
            { text: newText },
            target.peer.publicKey,
            target.secretKey,
          );
          const res = await axiosInstance.patch(`/messages/${messageId}`, {
            text: cipherText,
            nonce,
            isEncrypted: true,
          });
          set({ messages: get().messages.map((m) => (m._id === messageId ? res.data : m)) });
          return true;
        } catch (error) {
          toast.error(error.response?.data?.message || "Failed to edit message");
          return false;
        }
      },

      sendTextMessage: async (conversationId) => {
        const { composerText, replyingTo } = get();
        const messageText = composerText.trim();
        if (!conversationId || !messageText) return false;

        const target = await resolveEncryptionTarget(get, set, conversationId);
        if (!target) return false;

        const { cipherText, nonce } = encryptForPeer(
          { text: messageText },
          target.peer.publicKey,
          target.secretKey,
        );

        return get().sendMessage({
          text: cipherText,
          nonce,
          isEncrypted: true,
          replyTo: replyingTo?.id,
        });
      },

      // Photos, videos and voice notes: encrypt the file bytes in the browser
      // with a fresh key, upload only the ciphertext, and put the key inside
      // the end-to-end encrypted message payload.
      sendEncryptedMedia: async ({ conversationId, blob, kind, mime, audioDuration }) => {
        const target = await resolveEncryptionTarget(get, set, conversationId);
        if (!target) return false;

        set({ isSendingMedia: true });
        try {
          const { replyingTo } = get();
          const { cipher, key, nonce: fileNonce } = encryptBytes(new Uint8Array(await blob.arrayBuffer()));
          const { cipherText, nonce } = encryptForPeer(
            { text: "", media: { kind, key, nonce: fileNonce, mime } },
            target.peer.publicKey,
            target.secretKey,
          );

          const formData = new FormData();
          formData.append("media", new Blob([cipher], { type: "application/octet-stream" }), "encrypted.bin");
          formData.append("mediaKind", kind);
          formData.append("text", cipherText);
          formData.append("nonce", nonce);
          formData.append("isEncrypted", "true");
          if (audioDuration) formData.append("audioDuration", String(audioDuration));
          if (replyingTo?.id) formData.append("replyTo", replyingTo.id);

          return await get().sendMessage(formData);
        } catch (error) {
          console.error("Encrypted media send failed:", error);
          toast.error("Couldn't encrypt and send that file");
          return false;
        } finally {
          set({ isSendingMedia: false });
        }
      },

      sendMediaMessage: async ({ conversationId, file }) => {
        if (!conversationId || !file) return false;

        const kind = file.type.startsWith("video/") ? "video" : "image";
        return get().sendEncryptedMedia({
          conversationId,
          blob: file,
          kind,
          mime: file.type || (kind === "video" ? "video/mp4" : "image/jpeg"),
        });
      },

      sendVoiceMessage: async ({ conversationId, blob, durationSeconds }) => {
        if (!conversationId || !blob) return false;

        return get().sendEncryptedMedia({
          conversationId,
          blob,
          kind: "audio",
          mime: blob.type || "audio/webm",
          audioDuration: Math.round(durationSeconds),
        });
      },
    }),
    {
      name: "phoenix-storage",
      partialize: () => ({}),
    },
  ),
);
