import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import { hasImageKitConfig, uploadChatMedia } from "../lib/imagekit.js";
import { getReceiverSocketId, io } from "../lib/socket.js";

const REPLY_PREVIEW_FIELDS = "text image video audio senderId";

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
      // 2. Collapse them into one row per chat partner, noting our latest message time.
      {
        $group: {
          // The partner is the other person on the message (not me).
          _id: { $cond: [{ $eq: ["$senderId", loggedInUserId] }, "$receiverId", "$senderId"] },
          lastMessageAt: { $max: "$createdAt" },
        },
      },
      // 3. Put the most recent conversation at the top.
      { $sort: { lastMessageAt: -1 } },
      // 4. Look up each partner's user profile (comes back as an array).
      { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
      // 5. Pull that profile out of the array and make it the document.
      { $replaceRoot: { newRoot: { $first: "$user" } } },
      // 6. Hide the private clerkId field from the result.
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
    const { text, replyTo, audioDuration } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    let imageUrl;
    let videoUrl;
    let audioUrl;

    if (req.file) {
      if (!hasImageKitConfig()) {
        return res.status(500).json({ message: "Media upload is not configured" });
      }

      const url = await uploadChatMedia(req.file);
      if (req.file.mimetype.startsWith("video/")) videoUrl = url;
      else if (req.file.mimetype.startsWith("audio/")) audioUrl = url;
      else imageUrl = url;
    }

    const newMessage = new Message({
      senderId,
      receiverId,
      text,
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
