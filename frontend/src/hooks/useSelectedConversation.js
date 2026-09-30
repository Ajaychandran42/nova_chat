import { useMediaQuery } from "./useMediaQuery";
import { formatMessageTime } from "../lib/utils";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { UNDECRYPTABLE_TEXT, decryptDmMessage, getOrCreateKeyPair } from "../lib/e2ee";

// John Doe -> JD
export function getInitials(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((namePart) => namePart[0])
    .join("");
}

// mapUserToConversation is an adapter — it converts the raw backend shapes (a user document + an array of message documents) into the clean view-model that the chat UI components expect to render.

// Two transformations happen:
// 1. Messages → UI messages
// 2. User → peer

function mapReplyPreview(replyTo, readMessage) {
  if (!replyTo) return null;

  const { text, failed } = readMessage(replyTo);

  return {
    id: replyTo._id,
    text: failed ? UNDECRYPTABLE_TEXT : text,
    hasImage: Boolean(replyTo.image),
    hasVideo: Boolean(replyTo.video),
    hasAudio: Boolean(replyTo.audio),
    senderId: replyTo.senderId,
  };
}

function mapUserToConversation({ user, messages, authUser, onlineUsers }) {
  // Messages arrive from the server as ciphertext. Decrypting happens here,
  // in the browser, using my secret key + this peer's public key.
  const mySecretKey = authUser ? getOrCreateKeyPair(authUser._id)?.secretKey : null;
  const readMessage = (message) => decryptDmMessage(message, user.publicKey, mySecretKey);

  const mappedMessages = messages.map((message) => {
    const { text, media, failed } = readMessage(message);

    return {
      id: message._id,
      senderId: message.senderId,
      role: String(message.senderId) === String(authUser?._id) ? "me" : "them",
      text: failed ? UNDECRYPTABLE_TEXT : text,
      media,
      isEncrypted: Boolean(message.isEncrypted),
      time: formatMessageTime(message.createdAt),
      imageUrl: message.image,
      videoUrl: message.video,
      audioUrl: message.audio,
      audioDuration: message.audioDuration,
      replyTo: mapReplyPreview(message.replyTo, readMessage),
      reactions: message.reactions || [],
      isDeleted: Boolean(message.isDeleted),
      edited: Boolean(message.edited),
      forwarded: Boolean(message.forwarded),
      seen: Boolean(message.seen),
    };
  });

  return {
    id: user._id,
    peer: {
      id: user._id,
      name: user.fullName,
      subtitle: user.email,
      isOnline: onlineUsers.includes(user._id),
      avatarUrl: user.profilePic,
      initials: getInitials(user.fullName),
      publicKey: user.publicKey || "",
    },
    messages: mappedMessages,
  };
}

export function useSelectedConversation() {
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const conversations = useChatStore((state) => state.conversations);
  const users = useChatStore((state) => state.users);
  const messages = useChatStore((state) => state.messages);

  const authUser = useAuthStore((state) => state.authUser);
  const onlineUsers = useAuthStore((state) => state.onlineUsers);

  const isLargeScreen = useMediaQuery("(min-width: 1024px)");

  const selectedUser = activeConversationId
    ? users.find((user) => user._id === activeConversationId) ||
      conversations.find((user) => user._id === activeConversationId)
    : null;

  const activeConversation = selectedUser
    ? mapUserToConversation({ user: selectedUser, messages, authUser, onlineUsers })
    : null;

  return {
    activeConversation,
    activeConversationId,
    isLargeScreen,
  };
}
