import { axiosInstance } from "./axios";
import { encryptForGroup, encryptForPeer, getOrCreateKeyPair, groupKeyFor } from "./e2ee";
import { useAuthStore } from "../store/useAuthStore";

// Forwarding a message means re-encrypting content the CALLER has already
// decrypted (that's the whole point of doing this client-side — the server
// never gets to see it either way) for a new target, which can be either a
// person (DM) or a group. One function handles both directions because,
// past the decrypt step, "forward this" is the same operation regardless
// of whether the content originally came from a DM or a group.
//
// target: { type: "dm", userId, publicKey } | { type: "group", groupId, groupKey: Uint8Array | null }
export async function forwardContent({ text, media }, target) {
  const authUser = useAuthStore.getState().authUser;
  const myKeyPair = authUser ? getOrCreateKeyPair(authUser._id) : null;
  if (!myKeyPair) throw new Error("Your encryption keys aren't ready yet");

  const payload = { text: text || "", media: media || undefined };

  if (target.type === "dm") {
    if (!target.publicKey) throw new Error("They haven't turned on encryption yet");
    const { cipherText, nonce } = encryptForPeer(payload, target.publicKey, myKeyPair.secretKey);
    return axiosInstance.post(`/messages/forward/${target.userId}`, {
      text: cipherText,
      nonce,
      isEncrypted: true,
    });
  }

  if (!target.groupKey) {
    // legacy, pre-encryption group — send as plaintext, same as a normal
    // message would go to it
    return axiosInstance.post(`/groups/${target.groupId}/messages/forward`, {
      text: text || "",
      isEncrypted: false,
    });
  }

  const { cipherText, nonce } = encryptForGroup(payload, target.groupKey);
  return axiosInstance.post(`/groups/${target.groupId}/messages/forward`, {
    text: cipherText,
    nonce,
    isEncrypted: true,
  });
}

// Resolves what's needed to encrypt *to* a group from a raw group object
// (as stored in useGroupStore) — a thin wrapper so callers don't need to
// know about groupKeyFor's { encrypted, key } shape.
export function groupForwardTarget(group, mySecretKey) {
  const { key } = groupKeyFor(group, mySecretKey);
  return { type: "group", groupId: group._id, groupKey: key };
}
