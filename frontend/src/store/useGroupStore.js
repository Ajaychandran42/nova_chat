import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";
import { useChatStore } from "./useChatStore";
import {
  buildGroupKeys,
  encryptBytes,
  encryptForGroup,
  getOrCreateKeyPair,
  groupKeyFor,
} from "../lib/e2ee";

function myKeyPair() {
  const authUser = useAuthStore.getState().authUser;
  return authUser ? { authUser, keyPair: getOrCreateKeyPair(authUser._id) } : null;
}

// The key material for whichever group is open right now.
function activeGroupCrypto(get) {
  const me = myKeyPair();
  const group = get().groups.find((g) => g._id === get().activeGroupId);
  return groupKeyFor(group, me?.keyPair?.secretKey);
}

const NO_KEY_MESSAGE =
  "This device can't unlock this group's encryption key (your keys may have changed).";

export const useGroupStore = create((set, get) => ({
  groups: [],
  isGroupsLoading: false,
  activeGroupId: null,
  groupMessages: [],
  isGroupMessagesLoading: false,
  composerText: "",
  replyingTo: null,
  isSendingMedia: false,
  _subscribedSocket: null,

  getGroups: async () => {
    set({ isGroupsLoading: true });
    try {
      const res = await axiosInstance.get("/groups");
      set({ groups: res.data });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load groups");
    } finally {
      set({ isGroupsLoading: false });
    }
  },

  createGroup: async ({ name, memberIds }) => {
    try {
      const me = myKeyPair();
      if (!me?.keyPair) {
        toast.error("Your encryption keys aren't ready yet — try again in a moment.");
        return null;
      }

      // Everyone in the group needs a published public key so we can wrap the
      // group key for them. Refresh the user list once in case someone has
      // published theirs since we last looked; otherwise stop, rather than
      // quietly making an unencrypted group.
      const members = () => useChatStore.getState().users.filter((u) => memberIds.includes(u._id));
      let built = buildGroupKeys(members(), me.authUser._id, me.keyPair);
      if (built.missing.length > 0) {
        await useChatStore.getState().getUsers();
        built = buildGroupKeys(members(), me.authUser._id, me.keyPair);
      }
      if (built.missing.length > 0) {
        toast.error(
          `${built.missing.join(", ")} ${built.missing.length === 1 ? "hasn't" : "haven't"} turned on encryption yet — ask them to open Phoenix once, then try again.`,
        );
        return null;
      }

      const res = await axiosInstance.post("/groups", {
        name,
        memberIds,
        groupKeys: built.groupKeys,
      });
      set({ groups: [res.data, ...get().groups] });
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to create group");
      return null;
    }
  },

  // Creator-only: switch on encryption for a group made before it existed.
  enableGroupEncryption: async (groupId) => {
    try {
      const me = myKeyPair();
      let group = get().groups.find((g) => g._id === groupId);
      if (!me?.keyPair || !group) return false;

      let built = buildGroupKeys(group.members, me.authUser._id, me.keyPair);
      if (built.missing.length > 0) {
        await get().getGroups();
        group = get().groups.find((g) => g._id === groupId);
        built = buildGroupKeys(group.members, me.authUser._id, me.keyPair);
      }
      if (built.missing.length > 0) {
        toast.error(
          `${built.missing.join(", ")} ${built.missing.length === 1 ? "hasn't" : "haven't"} turned on encryption yet — ask them to open Phoenix once, then try again.`,
        );
        return false;
      }

      const res = await axiosInstance.put(`/groups/${groupId}/keys`, { groupKeys: built.groupKeys });
      set({ groups: get().groups.map((g) => (g._id === groupId ? { ...g, ...res.data } : g)) });
      toast.success("Encryption is on for this group");
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || "Couldn't enable encryption");
      return false;
    }
  },

  setActiveGroupId: (activeGroupId) => {
    set({
      activeGroupId,
      groupMessages: [],
      replyingTo: null,
      composerText: "",
    });
    if (activeGroupId) get().getGroupMessages(activeGroupId);
  },

  getGroupMessages: async (groupId) => {
    set({ isGroupMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/groups/${groupId}/messages`);
      // keep the sidebar's copy of the group (name/members) fresh too
      set((state) => ({
        groupMessages: res.data.messages,
        groups: state.groups.some((g) => g._id === res.data.group._id)
          ? state.groups.map((g) => (g._id === res.data.group._id ? { ...g, ...res.data.group } : g))
          : [res.data.group, ...state.groups],
      }));
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load group messages");
    } finally {
      set({ isGroupMessagesLoading: false });
    }
  },

  setComposerText: (composerText) => set({ composerText }),
  setReplyingTo: (replyingTo) => set({ replyingTo }),

  sendGroupMessage: async (payload) => {
    const groupId = get().activeGroupId;
    if (!groupId) return false;

    try {
      const res = await axiosInstance.post(`/groups/${groupId}/messages`, payload);
      set({ groupMessages: [...get().groupMessages, res.data], composerText: "", replyingTo: null });
      get().getGroups();
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to send message");
      return false;
    }
  },

  sendTextMessage: async () => {
    const text = get().composerText.trim();
    if (!text) return false;
    const replyTo = get().replyingTo?.id;

    const { encrypted, key } = activeGroupCrypto(get);
    if (encrypted) {
      if (!key) {
        toast.error(NO_KEY_MESSAGE);
        return false;
      }
      const { cipherText, nonce } = encryptForGroup({ text }, key);
      return get().sendGroupMessage({ text: cipherText, nonce, isEncrypted: true, replyTo });
    }

    // legacy group, created before encryption existed (the UI says so)
    return get().sendGroupMessage({ text, replyTo });
  },

  // Photos, videos, voice notes. In an encrypted group the file is encrypted
  // in the browser with a fresh key and only ciphertext is uploaded; the file
  // key rides inside the encrypted message payload.
  sendGroupMedia: async ({ blob, kind, mime, filename, audioDuration }) => {
    const { encrypted, key } = activeGroupCrypto(get);
    if (encrypted && !key) {
      toast.error(NO_KEY_MESSAGE);
      return false;
    }

    set({ isSendingMedia: true });
    try {
      const formData = new FormData();

      if (encrypted) {
        const { cipher, key: fileKey, nonce: fileNonce } = encryptBytes(
          new Uint8Array(await blob.arrayBuffer()),
        );
        const { cipherText, nonce } = encryptForGroup(
          { text: "", media: { kind, key: fileKey, nonce: fileNonce, mime } },
          key,
        );
        formData.append("media", new Blob([cipher], { type: "application/octet-stream" }), "encrypted.bin");
        formData.append("mediaKind", kind);
        formData.append("text", cipherText);
        formData.append("nonce", nonce);
        formData.append("isEncrypted", "true");
      } else {
        formData.append("media", blob, filename);
      }

      if (audioDuration) formData.append("audioDuration", String(audioDuration));
      if (get().replyingTo?.id) formData.append("replyTo", get().replyingTo.id);

      return await get().sendGroupMessage(formData);
    } catch (error) {
      console.error("Group media send failed:", error);
      toast.error("Couldn't encrypt and send that file");
      return false;
    } finally {
      set({ isSendingMedia: false });
    }
  },

  sendMediaMessage: async (file) => {
    const kind = file.type.startsWith("video/") ? "video" : "image";
    return get().sendGroupMedia({
      blob: file,
      kind,
      mime: file.type || (kind === "video" ? "video/mp4" : "image/jpeg"),
      filename: file.name,
    });
  },

  sendVoiceMessage: async ({ blob, durationSeconds }) =>
    get().sendGroupMedia({
      blob,
      kind: "audio",
      mime: blob.type || "audio/webm",
      filename: "voice-message.webm",
      audioDuration: Math.round(durationSeconds),
    }),

  reactToGroupMessage: async (messageId, emoji) => {
    try {
      const res = await axiosInstance.patch(`/groups/messages/react/${messageId}`, { emoji });
      set({ groupMessages: get().groupMessages.map((m) => (m._id === messageId ? res.data : m)) });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to react");
    }
  },

  deleteGroupMessage: async (messageId) => {
    try {
      const res = await axiosInstance.delete(`/groups/messages/${messageId}`);
      set({ groupMessages: get().groupMessages.map((m) => (m._id === messageId ? res.data : m)) });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete message");
    }
  },

  subscribeToGroupEvents: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;
    if (get()._subscribedSocket === socket) return;

    get().unsubscribeFromGroupEvents();

    socket.on("groupCreated", (group) => {
      set((state) =>
        state.groups.some((g) => g._id === group._id)
          ? state
          : { groups: [group, ...state.groups] },
      );
    });

    socket.on("groupUpdated", (group) => {
      set((state) => ({
        groups: state.groups.map((g) => (g._id === group._id ? { ...g, ...group } : g)),
      }));
    });

    socket.on("newGroupMessage", (message) => {
      if (String(message.groupId) === String(get().activeGroupId)) {
        set({ groupMessages: [...get().groupMessages, message] });
      }
      get().getGroups();
    });

    socket.on("groupMessageReaction", (updatedMessage) => {
      set({
        groupMessages: get().groupMessages.map((m) =>
          m._id === updatedMessage._id ? updatedMessage : m,
        ),
      });
    });

    socket.on("groupMessageDeleted", ({ messageId }) => {
      set({
        groupMessages: get().groupMessages.map((m) =>
          m._id === messageId ? { ...m, isDeleted: true, text: "", image: null, video: null, audio: null } : m,
        ),
      });
    });

    set({ _subscribedSocket: socket });
  },

  unsubscribeFromGroupEvents: () => {
    const socket = get()._subscribedSocket || useAuthStore.getState().socket;
    ["groupCreated", "groupUpdated", "newGroupMessage", "groupMessageReaction", "groupMessageDeleted"].forEach(
      (event) => socket?.off(event),
    );
    set({ _subscribedSocket: null });
  },
}));
