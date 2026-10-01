import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    clerkId: {
      type: String,
      required: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    fullName: {
      type: String,
      required: true,
      maxlength: 200,
    },
    profilePic: {
      type: String,
      default: "",
    },
    // X25519 public key (base64), used to end-to-end encrypt messages/media
    // addressed to this user. Never anything sensitive — safe to expose.
    publicKey: {
      type: String,
      default: "",
      maxlength: 200, // X25519 keys are always 32 bytes — base64 of that is 44 chars
    },
  },
  { timestamps: true }, // createdAt & updatedAt
);

const User = mongoose.model("User", userSchema);

export default User;
