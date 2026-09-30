import mongoose from "mongoose";

const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    admins: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    avatarEmoji: {
      type: String,
      default: "👥",
    },
    // The group's shared symmetric encryption key, individually wrapped
    // (box-encrypted) to each member's public key by whoever added them —
    // the server only ever stores/relays these ciphertexts, it can never
    // unwrap one itself.
    groupKeys: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        cipherText: { type: String, required: true },
        nonce: { type: String, required: true },
        // whose public key was used to wrap it — the recipient needs this
        // to know which public key to pair with their own secret key
        wrappedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        // ...and the public key they wrapped it with AT THAT TIME. Recipients
        // use this (not the wrapper's current directory key) to unwrap, so the
        // creator getting a fresh key on a new device can't lock everyone out.
        wrappedByPublicKey: { type: String },
      },
    ],
  },
  { timestamps: true },
);

const Group = mongoose.model("Group", groupSchema);

export default Group;
