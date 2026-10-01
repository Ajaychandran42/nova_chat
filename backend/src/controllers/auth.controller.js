import User from "../models/user.model.js";

export async function checkAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  res.status(200).json(req.user);
}

// Publishes this user's E2EE public key (X25519, base64) so others can
// encrypt messages to them. The matching private key is generated and kept
// client-side only — it's never sent here, and the server has no way to
// derive it from the public key.
export async function updatePublicKey(req, res) {
  try {
    const { publicKey } = req.body;
    if (!publicKey || typeof publicKey !== "string") {
      return res.status(400).json({ message: "publicKey is required" });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { publicKey },
      { new: true },
    ).select("-clerkId");

    res.status(200).json(user);
  } catch (error) {
    console.error("Error in updatePublicKey:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
}
