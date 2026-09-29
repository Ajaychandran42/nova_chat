import mongoose from "mongoose";

const groupMessageSchema = new mongoose.Schema(
  {
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      maxlength: 20000, // generous — encrypted payloads are base64 and run longer than the plaintext
    },
    nonce: {
      type: String,
      default: null,
      maxlength: 200,
    },
    isEncrypted: {
      type: Boolean,
      default: false,
    },
    image: {
      type: String,
    },
    video: {
      type: String,
    },
    audio: {
      type: String,
    },
    audioDuration: {
      type: Number,
    },
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GroupMessage",
      default: null,
    },
    reactions: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        emoji: { type: String, required: true },
      },
    ],
    isDeleted: {
      type: Boolean,
      default: false,
    },
    forwarded: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

const GroupMessage = mongoose.model("GroupMessage", groupMessageSchema);

export default GroupMessage;
