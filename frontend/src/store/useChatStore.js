import { create } from "zustand";
import { persist } from "zustand/middleware";

import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";
import toast from "react-hot-toast";

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
      isSoundEnabled: true,
      isSendingMedia: false,
      replyingTo: null, // { id, text, hasImage, hasVideo, hasAudio, senderId } | null
      typingUserIds: [], // ids of peers currently typing, across all open chats

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
        }));
      },

      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setSidebarTab: (sidebarTab) => set({ sidebarTab }),
      setComposerText: (composerText) => set({ composerText }),
      setSoundEnabled: (isSoundEnabled) => set({ isSoundEnabled }),

      sendTextMessage: async (conversationId) => {
        const { composerText, replyingTo } = get();
        const messageText = composerText.trim();
        if (!conversationId || !messageText) return false;

        return get().sendMessage({ text: messageText, replyTo: replyingTo?.id });
      },

      sendMediaMessage: async ({ conversationId, file }) => {
        if (!conversationId || !file) return false;

        const { replyingTo } = get();
        const formData = new FormData();
        formData.append("media", file);
        if (replyingTo?.id) formData.append("replyTo", replyingTo.id);

        set({ isSendingMedia: true });
        try {
          return await get().sendMessage(formData);
        } finally {
          set({ isSendingMedia: false });
        }
      },

      sendVoiceMessage: async ({ conversationId, blob, durationSeconds }) => {
        if (!conversationId || !blob) return false;

        const { replyingTo } = get();
        const formData = new FormData();
        formData.append("media", blob, "voice-message.webm");
        formData.append("audioDuration", String(Math.round(durationSeconds)));
        if (replyingTo?.id) formData.append("replyTo", replyingTo.id);

        set({ isSendingMedia: true });
        try {
          return await get().sendMessage(formData);
        } finally {
          set({ isSendingMedia: false });
        }
      },
    }),
    {
      name: "phoenix-storage",
      partialize: (state) => ({ isSoundEnabled: state.isSoundEnabled }),
    },
  ),
);
