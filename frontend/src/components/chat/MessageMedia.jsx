import { LockIcon } from "lucide-react";
import { withTransform } from "../../lib/imagekit";
import { useDecryptedMedia } from "../../hooks/useDecryptedMedia";
import { MessageAudio } from "./MessageAudio";
import { MessageVideo } from "./MessageVideo";

// Compress + size legacy (unencrypted) images for the bubble. Encrypted
// images can't be transformed by the CDN — it only ever sees ciphertext —
// so those are shown as decrypted locally.
const IMAGE_TRANSFORM = "q-auto,w-640,f-auto";

function MediaPlaceholder({ status, label }) {
  return (
    <div className="mb-1.5 flex h-24 min-w-40 items-center justify-center gap-2 rounded-lg bg-black/10 px-3 text-xs opacity-80">
      <LockIcon className={`size-4 ${status === "loading" ? "animate-pulse" : ""}`} />
      {status === "loading" ? `Decrypting ${label}…` : `Couldn't decrypt ${label}`}
    </div>
  );
}

export function DecryptedImage({ url, media, onOpen }) {
  const { src, status } = useDecryptedMedia(url, media);
  if (status !== "ready") return <MediaPlaceholder status={status} label="photo" />;

  const isEncrypted = Boolean(media);
  return (
    <button
      type="button"
      onClick={() => onOpen(isEncrypted ? src : withTransform(url, "q-auto,f-auto"))}
      className="mb-1.5 block cursor-zoom-in"
      aria-label="View photo"
    >
      <img
        src={isEncrypted ? src : withTransform(url, IMAGE_TRANSFORM)}
        alt=""
        className="max-h-52 max-w-full rounded-lg object-cover sm:max-h-64 sm:rounded-xl"
      />
    </button>
  );
}

export function DecryptedVideo({ url, media }) {
  const { src, status } = useDecryptedMedia(url, media);
  if (status !== "ready") return <MediaPlaceholder status={status} label="video" />;
  return media ? (
    // decrypted locally, so no CDN poster/transform — plain player on the blob
    <video
      src={src}
      controls
      playsInline
      preload="metadata"
      className="mb-1.5 max-h-64 max-w-full rounded-lg"
    />
  ) : (
    <MessageVideo src={src} />
  );
}

export function DecryptedAudio({ url, media, duration, isOwnMessage }) {
  const { src, status } = useDecryptedMedia(url, media);
  if (status !== "ready") return <MediaPlaceholder status={status} label="voice message" />;
  return <MessageAudio src={src} duration={duration} isOwnMessage={isOwnMessage} />;
}
