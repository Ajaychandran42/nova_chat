import Group from "../models/group.model.js";
import GroupMessage from "../models/groupMessage.model.js";
import { hasImageKitConfig, uploadChatMedia } from "../lib/imagekit.js";
import { getReceiverSocketId, io } from "../lib/socket.js";

const REPLY_PREVIEW_FIELDS = "text nonce isEncrypted image video audio senderId";
const MEMBER_FIELDS = "fullName email profilePic publicKey";

function notifyMembers(memberIds, senderId, event, payload) {
  memberIds
    .map(String)
    .filter((memberId) => memberId !== String(senderId))
    .forEach((memberId) => {
      const socketId = getReceiverSocketId(memberId);
      if (socketId) io.to(socketId).emit(event, payload);
    });
}

// Trim a group's `groupKeys` array down to just the requesting user's own
// wrapped entry before it goes out over the wire — everyone only ever
// needs their own, and there's no reason to hand out the others' (still
// harmless ciphertext, but no reason to widen exposure either).
function withOnlyMyGroupKey(group, userId) {
  const plain = typeof group.toObject === "function" ? group.toObject() : group;
  return {
    ...plain,
    groupKeys: (plain.groupKeys || []).filter((entry) => String(entry.userId) === String(userId)),
  };
}

// Keeps only wrapped-key entries that belong to actual members, and insists
// on all-or-nothing: an encrypted group needs a wrapped key for EVERY member,
// otherwise someone would be locked out of their own group.
function sanitizeWrappedKeys(groupKeys, memberIds, wrappedByUserId) {
  const memberSet = new Set(memberIds.map(String));
  const entries = (Array.isArray(groupKeys) ? groupKeys : [])
    .filter(
      (entry) =>
        entry?.userId && entry?.cipherText && entry?.nonce && memberSet.has(String(entry.userId)),
    )
    .map((entry) => ({
      userId: entry.userId,
      cipherText: entry.cipherText,
      nonce: entry.nonce,
      wrappedByUserId,
      wrappedByPublicKey:
        typeof entry.wrappedByPublicKey === "string" ? entry.wrappedByPublicKey : undefined,
    }));

  const covered = new Set(entries.map((entry) => String(entry.userId)));
  if (entries.length > 0 && covered.size !== memberSet.size) return null;
  return entries;
}

export async function createGroup(req, res) {
  try {
    const { name, memberIds = [], groupKeys = [] } = req.body;
    const creatorId = req.user._id;

    if (!name?.trim()) return res.status(400).json({ message: "Group name is required" });
    if (!Array.isArray(memberIds) || memberIds.length < 1) {
      return res.status(400).json({ message: "Pick at least one other member" });
    }

    const members = [...new Set([...memberIds.map(String), String(creatorId)])];

    // groupKeys: the shared E2EE group key, generated client-side and
    // individually wrapped (box-encrypted) to every member's public key —
    // including the creator's own. The server can't read any of these; it
    // just stores and later hands back each member their own entry.
    const wrappedKeys = sanitizeWrappedKeys(groupKeys, members, creatorId);
    if (wrappedKeys === null) {
      return res.status(400).json({ message: "Encryption keys must be provided for every member" });
    }

    const group = await Group.create({
      name: name.trim(),
      members,
      admins: [creatorId],
      createdBy: creatorId,
      groupKeys: wrappedKeys,
    });

    const rawMemberIds = [...group.members];
    await group.populate("members", MEMBER_FIELDS);

    // each member gets the group with only THEIR own wrapped key in it
    rawMemberIds
      .map(String)
      .filter((memberId) => memberId !== String(creatorId))
      .forEach((memberId) => {
        const socketId = getReceiverSocketId(memberId);
        if (socketId) io.to(socketId).emit("groupCreated", withOnlyMyGroupKey(group, memberId));
      });

    res.status(201).json(withOnlyMyGroupKey(group, creatorId));
  } catch (error) {
    console.error("Error in createGroup:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
}

// Lets the creator of a pre-encryption group switch encryption on: they
// generate the group key client-side and wrap it for every member, exactly
// like at creation. One-way and one-time — an encrypted group can't be
// re-keyed or downgraded through here.
export async function enableGroupEncryption(req, res) {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });
    if (String(group.createdBy) !== String(userId)) {
      return res.status(403).json({ message: "Only the group's creator can enable encryption" });
    }
    if ((group.groupKeys || []).length > 0) {
      return res.status(409).json({ message: "This group is already encrypted" });
    }

    const wrappedKeys = sanitizeWrappedKeys(req.body.groupKeys, group.members, userId);
    if (!wrappedKeys || wrappedKeys.length === 0) {
      return res.status(400).json({ message: "Encryption keys must be provided for every member" });
    }

    group.groupKeys = wrappedKeys;
    await group.save();
    const rawMemberIds = group.members.map(String);
    await group.populate("members", MEMBER_FIELDS);

    rawMemberIds
      .filter((memberId) => memberId !== String(userId))
      .forEach((memberId) => {
        const socketId = getReceiverSocketId(memberId);
        if (socketId) io.to(socketId).emit("groupUpdated", withOnlyMyGroupKey(group, memberId));
      });

    res.status(200).json(withOnlyMyGroupKey(group, userId));
  } catch (error) {
    console.error("Error in enableGroupEncryption:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function getMyGroups(req, res) {
  try {
    const myId = req.user._id;

    const groups = await Group.find({ members: myId })
      .populate("members", MEMBER_FIELDS)
      .sort({ updatedAt: -1 })
      .lean();

    const groupsWithLastMessage = await Promise.all(
      groups.map(async (group) => {
        const lastMessage = await GroupMessage.findOne({ groupId: group._id })
          .sort({ createdAt: -1 })
          .select("text nonce isEncrypted image video audio senderId isDeleted createdAt")
          .lean();
        return {
          ...group,
          groupKeys: (group.groupKeys || []).filter(
            (entry) => String(entry.userId) === String(myId),
          ),
          lastMessage: lastMessage || null,
        };
      }),
    );

    res.status(200).json(groupsWithLastMessage);
  } catch (error) {
    console.error("Error in getMyGroups:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function assertMembership(groupId, userId) {
  const group = await Group.findById(groupId);
  if (!group) return { group: null, isMember: false };
  return { group, isMember: group.members.some((memberId) => String(memberId) === String(userId)) };
}

export async function getGroupMessages(req, res) {
  try {
    const { groupId } = req.params;
    const { group, isMember } = await assertMembership(groupId, req.user._id);

    if (!group) return res.status(404).json({ message: "Group not found" });
    if (!isMember) return res.status(403).json({ message: "You're not a member of this group" });

    const messages = await GroupMessage.find({ groupId })
      .sort({ createdAt: 1 })
      .populate("replyTo", REPLY_PREVIEW_FIELDS);

    // members need to come back populated (names + public keys) — the client
    // needs the creator's public key to unwrap its copy of the group key
    await group.populate("members", MEMBER_FIELDS);

    res.status(200).json({ group: withOnlyMyGroupKey(group, req.user._id), messages });
  } catch (error) {
    console.error("Error in getGroupMessages:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function sendGroupMessage(req, res) {
  try {
    const { groupId } = req.params;
    const { text, replyTo, audioDuration, mediaKind } = req.body;
    const nonce = req.body.nonce;
    const isEncrypted = req.body.isEncrypted === true || req.body.isEncrypted === "true";
    const senderId = req.user._id;

    const { group, isMember } = await assertMembership(groupId, senderId);
    if (!group) return res.status(404).json({ message: "Group not found" });
    if (!isMember) return res.status(403).json({ message: "You're not a member of this group" });

    // Once a group is encrypted it stays that way: refuse plaintext so a
    // buggy or malicious client can't quietly leak messages in the clear.
    if ((group.groupKeys || []).length > 0 && !isEncrypted) {
      return res
        .status(400)
        .json({ message: "This group is end-to-end encrypted — plaintext messages are refused" });
    }

    let imageUrl;
    let videoUrl;
    let audioUrl;

    if (req.file) {
      if (!hasImageKitConfig()) {
        return res.status(500).json({ message: "Media upload is not configured" });
      }

      const isOpaque = req.file.mimetype === "application/octet-stream";
      if (isOpaque && !isEncrypted) {
        return res.status(400).json({ message: "Opaque uploads must be end-to-end encrypted" });
      }

      const kind = isOpaque
        ? mediaKind
        : req.file.mimetype.startsWith("video/")
          ? "video"
          : req.file.mimetype.startsWith("audio/")
            ? "audio"
            : "image";
      if (!["image", "video", "audio"].includes(kind)) {
        return res.status(400).json({ message: "Unknown media kind" });
      }

      const url = await uploadChatMedia(req.file);
      if (kind === "video") videoUrl = url;
      else if (kind === "audio") audioUrl = url;
      else imageUrl = url;
    }

    const newMessage = await GroupMessage.create({
      groupId,
      senderId,
      text,
      nonce: nonce || null,
      isEncrypted,
      image: imageUrl,
      video: videoUrl,
      audio: audioUrl,
      audioDuration: audioUrl && audioDuration ? Number(audioDuration) : undefined,
      replyTo: replyTo || null,
    });
    await newMessage.populate("replyTo", REPLY_PREVIEW_FIELDS);

    // bump the group so it resurfaces at the top of everyone's sidebar
    group.updatedAt = new Date();
    await group.save();

    notifyMembers(group.members, senderId, "newGroupMessage", newMessage);

    res.status(201).json(newMessage);
  } catch (error) {
    console.error("Error in sendGroupMessage:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function reactToGroupMessage(req, res) {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user._id;
    if (!emoji) return res.status(400).json({ message: "emoji is required" });

    const message = await GroupMessage.findById(messageId);
    if (!message) return res.status(404).json({ message: "Message not found" });

    const { group, isMember } = await assertMembership(message.groupId, userId);
    if (!group) return res.status(404).json({ message: "Group not found" });
    if (!isMember) return res.status(403).json({ message: "You're not a member of this group" });

    const existingIndex = message.reactions.findIndex(
      (r) => String(r.userId) === String(userId) && r.emoji === emoji,
    );
    if (existingIndex >= 0) {
      message.reactions.splice(existingIndex, 1);
    } else {
      message.reactions = message.reactions.filter((r) => String(r.userId) !== String(userId));
      message.reactions.push({ userId, emoji });
    }

    await message.save();
    await message.populate("replyTo", REPLY_PREVIEW_FIELDS);

    notifyMembers(group.members, userId, "groupMessageReaction", message);

    res.status(200).json(message);
  } catch (error) {
    console.error("Error in reactToGroupMessage:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function deleteGroupMessage(req, res) {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    const message = await GroupMessage.findById(messageId);
    if (!message) return res.status(404).json({ message: "Message not found" });
    if (String(message.senderId) !== String(userId)) {
      return res.status(403).json({ message: "You can only delete your own messages" });
    }

    const { group } = await assertMembership(message.groupId, userId);

    message.isDeleted = true;
    message.text = "";
    message.nonce = undefined;
    message.isEncrypted = false;
    message.image = undefined;
    message.video = undefined;
    message.audio = undefined;
    await message.save();

    if (group) notifyMembers(group.members, userId, "groupMessageDeleted", { messageId: message._id });

    res.status(200).json(message);
  } catch (error) {
    console.error("Error in deleteGroupMessage:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
}
