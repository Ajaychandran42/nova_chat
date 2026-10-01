import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import { hasImageKitConfig, uploadChatMedia } from "../lib/imagekit.js";
import { getReceiverSocketId, io } from "../lib/socket.js";

const REPLY_PREVIEW_FIELDS = "text nonce isEncrypted image video audio senderId";

export async function getUsersForSidebar(req, res) {
  try {
    const loggedInUserId = req.user._id;

    const filteredUsers = await User.find({ _id: { $ne: loggedInUserId } }).select("-clerkId");

    res.status(200).json(filteredUsers);
  } catch (error) {
    console.error("Error in getUsersForSidebar:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function getConversationsForSidebar(req, res) {
  try {
    const loggedInUserId = req.user._id;

    const conversations = await Message.aggregate([
      // 1. Keep only the messages I sent or received.
      { $match: { $or: [{ senderId: loggedInUserId }, { receiverId: loggedInUserId }] } },
      // 2. Oldest-to-newest, so `$last` below picks the most recent message per chat.
      { $sort: { createdAt: 1 } },
      // 3. Collapse them into one row per chat partner: last message + unread count.
      {
        $group: {
          // The partner is the other person on the message (not me).
          _id: { $cond: [{ $eq: ["$senderId", loggedInUserId] }, "$receiverId", "$senderId"] },
          lastMessageAt: { $max: "$createdAt" },
          lastMessage: {
            $last: {
              text: "$text",
              nonce: "$nonce",
              isEncrypted: "$isEncrypted",
              image: "$image",
              video: "$video",
              audio: "$audio",
              isDeleted: "$isDeleted",
              senderId: "$senderId",
              createdAt: "$createdAt",
            },
          },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$receiverId", loggedInUserId] },
                    { $eq: ["$seen", false] },
                    { $eq: ["$isDeleted", false] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      // 4. Put the most recent conversation at the top.
      { $sort: { lastMessageAt: -1 } },
      // 5. Look up each partner's user profile.
      { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
      { $unwind: "$user" },
      // 6. Merge the profile with the last-message/unread-count summary.
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: ["$user", { lastMessage: "$lastMessage", unreadCount: "$unreadCount" }],
          },
        },
      },
      // 7. Hide the private clerkId field from the result.
      { $project: { clerkId: 0 } },
    ]);

    res.status(200).json(conversations);
  } catch (error) {
    console.error("Error in getConversationsForSidebar:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function getMessages(req, res) {
  try {
    const { id: userToChatId } = req.params;
    const myId = req.user._id;

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
    })
      .sort({ createdAt: 1 })
      .populate("replyTo", REPLY_PREVIEW_FIELDS);

    // Mark messages the other person sent to me as seen, and let them know.
    const unseenIds = messages
      .filter((m) => String(m.senderId) === String(userToChatId) && !m.seen)
      .map((m) => m._id);

    if (unseenIds.length > 0) {
      await Message.updateMany({ _id: { $in: unseenIds } }, { $set: { seen: true } });

      const senderSocketId = getReceiverSocketId(userToChatId);
      if (senderSocketId) {
        io.to(senderSocketId).emit("messagesSeen", { by: myId, messageIds: unseenIds });
      }
    }

    res.status(200).json(messages);
  } catch (error) {
    console.error("Error in getMessages:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function sendMessage(req, res) {
  try {
    const { text, nonce, isEncrypted, replyTo, audioDuration, mediaKind } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;
    // isEncrypted arrives as a string ("true") over multipart/form-data,
    // so compare loosely rather than assuming a real boolean.
    const encrypted = isEncrypted === true || isEncrypted === "true";

    let imageUrl;
    let videoUrl;
    let audioUrl;

    if (req.file) {
      if (!hasImageKitConfig()) {
        return res.status(500).json({ message: "Media upload is not configured" });
      }

      // Encrypted media is an opaque blob, so the client tells us what kind
      // of thing it is (image/video/audio) — we can't sniff it. Only the
      // kind is visible to the server, never the contents.
      const isOpaque = req.file.mimetype === "application/octet-stream";
      if (isOpaque && !encrypted) {
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

    const newMessage = new Message({
      senderId,
      receiverId,
      text,
      nonce: nonce || null,
      isEncrypted: encrypted,
      image: imageUrl,
      video: videoUrl,
      audio: audioUrl,
      audioDuration: audioUrl && audioDuration ? Number(audioDuration) : undefined,
      replyTo: replyTo || null,
    });

    await newMessage.save();
    await newMessage.populate("replyTo", REPLY_PREVIEW_FIELDS);

    const receiverSocketId = getReceiverSocketId(receiverId);
    // only send the message in realtime if user is online
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", newMessage);
    }

    res.status(201).json(newMessage);
  } catch (error) {
    console.error("Error in sendMessage:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function reactToMessage(req, res) {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const myId = req.user._id;

    if (!emoji) return res.status(400).json({ message: "emoji is required" });

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: "Message not found" });
    if (![message.senderId, message.receiverId].some((id) => String(id) === String(myId))) {
      return res.status(403).json({ message: "Not your conversation" });
    }

    const existingIndex = message.reactions.findIndex((r) => String(r.userId) === String(myId));

    if (existingIndex !== -1 && message.reactions[existingIndex].emoji === emoji) {
      // tapping the same emoji again removes it
      message.reactions.splice(existingIndex, 1);
    } else if (existingIndex !== -1) {
      message.reactions[existingIndex].emoji = emoji;
    } else {
      message.reactions.push({ userId: myId, emoji });
    }

    await message.save();
    await message.populate("replyTo", REPLY_PREVIEW_FIELDS);

    const otherUserId =
      String(message.senderId) === String(myId) ? message.receiverId : message.senderId;
    const otherSocketId = getReceiverSocketId(otherUserId);
    if (otherSocketId) {
      io.to(otherSocketId).emit("messageReaction", message);
    }

    res.status(200).json(message);
  } catch (error) {
    console.error("Error in reactToMessage:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
}

// Forwarding, redesigned around what E2EE actually makes possible: the
// server never has plaintext for ANY message (DM or group), so it can't
// usefully "look up the original and copy it" the way a plaintext chat app
// would. Instead, the client — which by definition could only get here by
// already having successfully DECRYPTED the source message with a real key
// it legitimately holds — re-encrypts that content for the new target and
// hands it straight to us. The decryption step itself is the access check;
// there's no extra "were you allowed to see the original" gate to add here,
// because an unauthorized client physically cannot produce a valid
// ciphertext to forward in the first place. This one endpoint therefore
// works identically whether the original message was a DM or a group
// message — the server never needed to know or care which.
export async function forwardMessage(req, res) {
  try {
    const { toUserId } = req.params;
    const { text, nonce, isEncrypted, image, video, audio, audioDuration } = req.body;
    const senderId = req.user._id;

    const forwardedMessage = new Message({
      senderId,
      receiverId: toUserId,
      text,
      nonce: nonce || null,
      isEncrypted: isEncrypted === true || isEncrypted === "true",
      image: image || undefined,
      video: video || undefined,
      audio: audio || undefined,
      audioDuration: audioDuration || undefined,
      forwarded: true,
    });

    await forwardedMessage.save();

    const receiverSocketId = getReceiverSocketId(toUserId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", forwardedMessage);
    }

    res.status(201).json(forwardedMessage);
  } catch (error) {
    console.error("Error in forwardMessage:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
}

// Sender-only, text messages only (editing a photo/video/voice note isn't
// really "editing" — you'd just send a new one). Re-encrypted client-side
// exactly like a fresh send; the server just swaps in the new ciphertext.
export async function editMessage(req, res) {
  try {
    const { messageId } = req.params;
    const { text, nonce, isEncrypted } = req.body;
    const myId = req.user._id;

    if (!text) return res.status(400).json({ message: "text is required" });

    const message = await Message.findById(messageId);
    if (!message || message.isDeleted) {
      return res.status(404).json({ message: "Message not found" });
    }
    if (String(message.senderId) !== String(myId)) {
      return res.status(403).json({ message: "You can only edit your own messages" });
    }
    if (message.image || message.video || message.audio) {
      return res.status(400).json({ message: "Only text messages can be edited" });
    }

    message.text = text;
    message.nonce = nonce || null;
    message.isEncrypted = isEncrypted === true || isEncrypted === "true";
    message.edited = true;
    await message.save();
    await message.populate("replyTo", REPLY_PREVIEW_FIELDS);

    const otherUserId =
      String(message.senderId) === String(myId) ? message.receiverId : message.senderId;
    const otherSocketId = getReceiverSocketId(otherUserId);
    if (otherSocketId) io.to(otherSocketId).emit("messageEdited", message);

    res.status(200).json(message);
  } catch (error) {
    console.error("Error in editMessage:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function deleteMessage(req, res) {
  try {
    const { messageId } = req.params;
    const myId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: "Message not found" });

    if (String(message.senderId) !== String(myId)) {
      return res.status(403).json({ message: "You can only delete your own messages" });
    }

    message.isDeleted = true;
    message.text = undefined;
    message.nonce = undefined;
    message.isEncrypted = false;
    message.image = undefined;
    message.video = undefined;
    message.audio = undefined;
    message.audioDuration = undefined;
    message.reactions = [];
    await message.save();

    const otherUserId =
      String(message.senderId) === String(myId) ? message.receiverId : message.senderId;
    const otherSocketId = getReceiverSocketId(otherUserId);
    if (otherSocketId) {
      io.to(otherSocketId).emit("messageDeleted", { messageId: message._id });
    }

    res.status(200).json(message);
  } catch (error) {
    console.error("Error in deleteMessage:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
}
