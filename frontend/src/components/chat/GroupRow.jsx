import { decryptGroupMessage, getOrCreateKeyPair, groupKeyFor, UNDECRYPTABLE_TEXT } from "../../lib/e2ee";
import { useAuthStore } from "../../store/useAuthStore";

// The last-message preview is ciphertext on the server for encrypted groups,
// so decrypt it here (media-only messages have empty text and fall back to
// "📷 Photo" etc.).
function previewFor(group, mySecretKey) {
  const lastMessage = group.lastMessage;
  if (!lastMessage) return "No messages yet";
  if (lastMessage.isDeleted) return "Message deleted";

  let text = lastMessage.text || "";
  if (lastMessage.isEncrypted) {
    const { key } = groupKeyFor(group, mySecretKey);
    const { text: plain, failed } = decryptGroupMessage(lastMessage, key);
    text = failed ? UNDECRYPTABLE_TEXT : plain;
  }

  return (
    text ||
    (lastMessage.image
      ? "📷 Photo"
      : lastMessage.video
        ? "🎥 Video"
        : lastMessage.audio
          ? "🎤 Voice message"
          : "")
  );
}

export function GroupRow({ group, selected, onSelect }) {
  const authUser = useAuthStore((state) => state.authUser);
  const mySecretKey = authUser ? getOrCreateKeyPair(authUser._id)?.secretKey : null;
  const preview = previewFor(group, mySecretKey);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors sm:px-3 ${
        selected ? "bg-accent-soft ring-1 ring-inset ring-accent/25" : "hover:bg-surface/70"
      }`}
    >
      {selected ? (
        <span className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-accent" aria-hidden />
      ) : null}

      <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xl">
        {group.avatarEmoji || "👥"}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold">{group.name}</p>
        <p className="truncate text-xs text-muted">{preview}</p>
      </div>
    </button>
  );
}
