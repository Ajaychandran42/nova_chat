import nacl from "tweetnacl";
import { decodeBase64, decodeUTF8, encodeBase64, encodeUTF8 } from "tweetnacl-util";

// --- Identity keypair -------------------------------------------------
//
// Every user gets an X25519 keypair, generated in the browser the first
// time they sign in. The secret key NEVER leaves the device — it's kept
// in localStorage only, scoped to this user id. The public key gets
// published to the server (via PATCH /auth/public-key) so others can
// encrypt messages addressed to them.
//
// Trade-off, stated plainly: because the secret key only lives in this
// browser's storage, clearing site data or signing in on a new device
// starts a fresh identity — old messages become unreadable there. A real
// key-backup/multi-device flow is a separate project on top of this.

function storageKey(userId) {
  return `e2ee:secretKey:${userId}`;
}

const keyPairCache = new Map();

export function getOrCreateKeyPair(userId) {
  if (!userId) return null;
  if (keyPairCache.has(userId)) return keyPairCache.get(userId);

  let keyPair;
  const stored = localStorage.getItem(storageKey(userId));
  if (stored) {
    const secretKey = decodeBase64(stored);
    const { publicKey } = nacl.box.keyPair.fromSecretKey(secretKey);
    keyPair = { publicKey, secretKey };
  } else {
    keyPair = nacl.box.keyPair();
    localStorage.setItem(storageKey(userId), encodeBase64(keyPair.secretKey));
  }

  keyPairCache.set(userId, keyPair);
  return keyPair;
}

export function publicKeyToBase64(publicKey) {
  return encodeBase64(publicKey);
}

function publicKeyFromBase64(base64) {
  return decodeBase64(base64);
}

// --- 1:1 (box / authenticated public-key encryption) ------------------
//
// nacl.box uses X25519 + XSalsa20-Poly1305. Both sides derive the SAME
// shared secret (my secret + their public == their secret + my public),
// which is also why the sender can always re-read their own sent
// messages. Deriving that secret is the expensive step, so it's computed
// once per peer and cached — decrypting a whole chat history on every
// render would otherwise be painfully slow.

const sharedKeyCache = new Map();

function sharedKeyFor(peerPublicKeyB64, mySecretKey) {
  const cacheKey = `${encodeBase64(mySecretKey.subarray(0, 6))}:${peerPublicKeyB64}`;
  let shared = sharedKeyCache.get(cacheKey);
  if (!shared) {
    shared = nacl.box.before(publicKeyFromBase64(peerPublicKeyB64), mySecretKey);
    sharedKeyCache.set(cacheKey, shared);
  }
  return shared;
}

export function encryptForPeer(plainObject, peerPublicKeyB64, mySecretKey) {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const messageBytes = decodeUTF8(JSON.stringify(plainObject));
  const cipher = nacl.box.after(messageBytes, nonce, sharedKeyFor(peerPublicKeyB64, mySecretKey));

  return { cipherText: encodeBase64(cipher), nonce: encodeBase64(nonce) };
}

export function decryptFromPeer(cipherTextB64, nonceB64, peerPublicKeyB64, mySecretKey) {
  try {
    const cipher = decodeBase64(cipherTextB64);
    const nonce = decodeBase64(nonceB64);
    const opened = nacl.box.open.after(cipher, nonce, sharedKeyFor(peerPublicKeyB64, mySecretKey));
    if (!opened) return null;
    return JSON.parse(encodeUTF8(opened));
  } catch {
    return null;
  }
}

// Turns a raw message document from the API into what should be shown.
// Legacy (pre-encryption) messages pass straight through. Encrypted ones
// carry a JSON payload: { text, media?: { kind, key, nonce, mime } }.
export function decryptDmMessage(message, peerPublicKeyB64, mySecretKey) {
  if (!message?.isEncrypted) {
    return { text: message?.text || "", media: null, failed: false };
  }
  if (!peerPublicKeyB64 || !mySecretKey || !message.nonce || !message.text) {
    return { text: "", media: null, failed: true };
  }

  const payload = decryptFromPeer(message.text, message.nonce, peerPublicKeyB64, mySecretKey);
  if (!payload) return { text: "", media: null, failed: true };

  return {
    text: typeof payload.text === "string" ? payload.text : "",
    media: payload.media || null,
    failed: false,
  };
}

export const UNDECRYPTABLE_TEXT = "🔒 Can't decrypt this message";

// --- Files (secretbox / one random key per file) -----------------------
//
// Media is encrypted in the browser BEFORE upload, with a fresh random key
// per file. The server/CDN only ever stores the ciphertext. The per-file
// key travels inside the (already end-to-end encrypted) message payload,
// so only the two people in the chat can ever unlock it.

export function encryptBytes(bytes) {
  const key = nacl.randomBytes(nacl.secretbox.keyLength);
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const cipher = nacl.secretbox(bytes, nonce, key);
  return { cipher, key: encodeBase64(key), nonce: encodeBase64(nonce) };
}

export function decryptBytes(cipher, keyB64, nonceB64) {
  const opened = nacl.secretbox.open(cipher, decodeBase64(nonceB64), decodeBase64(keyB64));
  if (!opened) throw new Error("Failed to decrypt file");
  return opened;
}

// --- Verification -----------------------------------------------------
//
// A "safety number": a short fingerprint of both people's public keys. If
// two people read the same number to each other (in person / over a call)
// they know nobody swapped a key in the middle.

export function safetyNumber(myPublicKeyB64, peerPublicKeyB64) {
  if (!myPublicKeyB64 || !peerPublicKeyB64) return null;
  const [a, b] = [myPublicKeyB64, peerPublicKeyB64].sort();
  const hash = nacl.hash(decodeUTF8(`${a}|${b}`));
  const hex = Array.from(hash.slice(0, 15))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  return hex.match(/.{1,5}/g).join(" ");
}

// --- Group (secretbox / shared symmetric key) --------------------------
//
// Every group has one shared key (random 32 bytes), generated once by
// whoever creates the group and wrapped (box-encrypted) individually to
// each member's public key. Actual group messages are encrypted with
// that shared key directly via secretbox — much cheaper than
// box-encrypting to every member on every message, at the cost of no
// per-message forward secrecy and no support (yet) for adding members to
// an existing group, since that needs the key re-wrapped for them.

export function generateGroupKey() {
  return nacl.randomBytes(nacl.secretbox.keyLength);
}

export function wrapGroupKeyForMember(groupKeyBytes, memberPublicKeyB64, mySecretKey) {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const cipher = nacl.box(groupKeyBytes, nonce, publicKeyFromBase64(memberPublicKeyB64), mySecretKey);
  return { cipherText: encodeBase64(cipher), nonce: encodeBase64(nonce) };
}

export function unwrapGroupKey(cipherTextB64, nonceB64, wrappedByPublicKeyB64, mySecretKey) {
  try {
    const cipher = decodeBase64(cipherTextB64);
    const nonce = decodeBase64(nonceB64);
    const opened = nacl.box.open(
      cipher,
      nonce,
      publicKeyFromBase64(wrappedByPublicKeyB64),
      mySecretKey,
    );
    return opened || null;
  } catch {
    return null;
  }
}

export function encryptForGroup(plainObject, groupKeyBytes) {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const messageBytes = decodeUTF8(JSON.stringify(plainObject));
  const cipher = nacl.secretbox(messageBytes, nonce, groupKeyBytes);
  return { cipherText: encodeBase64(cipher), nonce: encodeBase64(nonce) };
}

export function decryptFromGroup(cipherTextB64, nonceB64, groupKeyBytes) {
  try {
    const cipher = decodeBase64(cipherTextB64);
    const nonce = decodeBase64(nonceB64);
    const opened = nacl.secretbox.open(cipher, nonce, groupKeyBytes);
    if (!opened) return null;
    return JSON.parse(encodeUTF8(opened));
  } catch {
    return null;
  }
}

// Works out (and caches) the shared key for a group from MY wrapped copy.
//  { encrypted: false }            -> a legacy group created before encryption
//  { encrypted: true, key: null }  -> encrypted, but I can't unlock it here
//                                     (e.g. this is a fresh device/identity)
//  { encrypted: true, key: bytes } -> ready to encrypt/decrypt
const groupKeyCache = new Map();

export function groupKeyFor(group, mySecretKey) {
  const entry = group?.groupKeys?.[0];
  if (!entry) return { encrypted: false, key: null };
  if (!mySecretKey) return { encrypted: true, key: null };

  const cacheKey = `${group._id}:${entry.cipherText}`;
  if (groupKeyCache.has(cacheKey)) return { encrypted: true, key: groupKeyCache.get(cacheKey) };

  const wrappedByPublicKey =
    entry.wrappedByPublicKey ||
    group.members?.find((member) => String(member._id) === String(entry.wrappedByUserId))
      ?.publicKey;
  const key = wrappedByPublicKey
    ? unwrapGroupKey(entry.cipherText, entry.nonce, wrappedByPublicKey, mySecretKey)
    : null;

  if (key) groupKeyCache.set(cacheKey, key);
  return { encrypted: true, key };
}

// Group counterpart of decryptDmMessage.
export function decryptGroupMessage(message, groupKeyBytes) {
  if (!message?.isEncrypted) {
    return { text: message?.text || "", media: null, failed: false };
  }
  if (!groupKeyBytes || !message.nonce || !message.text) {
    return { text: "", media: null, failed: true };
  }

  const payload = decryptFromGroup(message.text, message.nonce, groupKeyBytes);
  if (!payload) return { text: "", media: null, failed: true };

  return {
    text: typeof payload.text === "string" ? payload.text : "",
    media: payload.media || null,
    failed: false,
  };
}

// Wraps a fresh group key for every member (including me). Returns null and
// the names of anyone who hasn't published a public key yet if it can't.
export function buildGroupKeys(members, myUserId, myKeyPair) {
  const missing = members.filter((m) => m._id !== myUserId && !m.publicKey).map((m) => m.fullName);
  if (missing.length > 0) return { missing };

  const myPublicKey = publicKeyToBase64(myKeyPair.publicKey);
  const groupKey = generateGroupKey();
  const everyone = [
    ...members.filter((m) => m._id !== myUserId),
    { _id: myUserId, publicKey: myPublicKey },
  ];

  return {
    missing: [],
    groupKeys: everyone.map((member) => ({
      userId: member._id,
      ...wrapGroupKeyForMember(groupKey, member.publicKey, myKeyPair.secretKey),
      wrappedByPublicKey: myPublicKey,
    })),
  };
}
