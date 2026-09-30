import { formatMessageTime } from "../lib/utils";
import { UNDECRYPTABLE_TEXT, decryptGroupMessage, getOrCreateKeyPair, groupKeyFor } from "../lib/e2ee";
import { useGroupStore } from "../store/useGroupStore";
import { useAuthStore } from "../store/useAuthStore";

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

function mapGroup({ group, messages, authUser }) {
  const memberById = new Map((group.members || []).map((member) => [member._id, member]));

  // Messages arrive as ciphertext; the group key is unwrapped here, in the
  // browser, with my secret key.
  const mySecretKey = authUser ? getOrCreateKeyPair(authUser._id)?.secretKey : null;
  const { encrypted, key } = groupKeyFor(group, mySecretKey);
  const readMessage = (message) => decryptGroupMessage(message, key);

  const mappedMessages = messages.map((message) => {
    const { text, media, failed } = readMessage(message);

    return {
      id: message._id,
      senderId: message.senderId,
      senderName:
        String(message.senderId) === String(authUser?._id)
          ? "You"
          : memberById.get(message.senderId)?.fullName ||
            memberById.get(message.senderId?._id)?.fullName,
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
    };
  });

  return {
    id: group._id,
    name: group.name,
    avatarEmoji: group.avatarEmoji || "👥",
    memberCount: (group.members || []).length,
    members: group.members || [],
    isEncrypted: encrypted,
    canDecrypt: !encrypted || Boolean(key),
    isCreator: String(group.createdBy) === String(authUser?._id),
    messages: mappedMessages,
  };
}

export function useSelectedGroup() {
  const activeGroupId = useGroupStore((state) => state.activeGroupId);
  const groups = useGroupStore((state) => state.groups);
  const groupMessages = useGroupStore((state) => state.groupMessages);
  const authUser = useAuthStore((state) => state.authUser);

  const rawGroup = activeGroupId ? groups.find((g) => g._id === activeGroupId) : null;

  const activeGroup = rawGroup
    ? mapGroup({ group: rawGroup, messages: groupMessages, authUser })
    : null;

  return { activeGroup, activeGroupId };
}
