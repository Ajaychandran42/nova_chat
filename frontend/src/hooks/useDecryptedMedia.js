import { useEffect, useState } from "react";
import { decryptBytes } from "../lib/e2ee";

// url -> Promise<blob: URL>. Kept for the session so scrolling a chat
// doesn't re-download and re-decrypt the same photo over and over.
const decryptedCache = new Map();

function loadDecrypted(url, media) {
  const cacheKey = `${url}|${media.key}`;
  if (!decryptedCache.has(cacheKey)) {
    const promise = fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`Download failed (${res.status})`);
        return res.arrayBuffer();
      })
      .then((buffer) => {
        const plain = decryptBytes(new Uint8Array(buffer), media.key, media.nonce);
        return URL.createObjectURL(new Blob([plain], { type: media.mime || "application/octet-stream" }));
      })
      .catch((error) => {
        decryptedCache.delete(cacheKey); // allow a retry next render
        throw error;
      });
    decryptedCache.set(cacheKey, promise);
  }
  return decryptedCache.get(cacheKey);
}

/**
 * Returns { src, status } for a message attachment.
 *  - Legacy/unencrypted media (no `media` key material): src is the URL as-is.
 *  - Encrypted media: downloads the ciphertext, decrypts it locally, and
 *    returns a blob: URL. status is "loading" | "ready" | "error".
 */
export function useDecryptedMedia(url, media) {
  const [result, setResult] = useState({ cacheKey: null, src: null, failed: false });
  const cacheKey = url && media ? `${url}|${media.key}` : null;

  useEffect(() => {
    if (!cacheKey) return undefined;
    let cancelled = false;

    loadDecrypted(url, media)
      .then((src) => !cancelled && setResult({ cacheKey, src, failed: false }))
      .catch(() => !cancelled && setResult({ cacheKey, src: null, failed: true }));

    return () => {
      cancelled = true;
    };
    // media is a fresh object each render; its key is what identifies it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  if (!media) return { src: url, status: "ready" };
  if (result.cacheKey !== cacheKey) return { src: null, status: "loading" };
  return result.failed ? { src: null, status: "error" } : { src: result.src, status: "ready" };
}
