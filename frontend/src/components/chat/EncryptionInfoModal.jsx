import { LockIcon, XIcon } from "lucide-react";
import { safetyNumber } from "../../lib/e2ee";

export function EncryptionInfoModal({ peerName, myPublicKey, peerPublicKey, onClose }) {
  const number = safetyNumber(myPublicKey, peerPublicKey);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-t-2xl border border-border bg-background p-5 shadow-2xl sm:rounded-2xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-full bg-success/15 text-success">
              <LockIcon className="size-4.5" />
            </span>
            <p className="text-base font-semibold">End-to-end encrypted</p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-surface"
          >
            <XIcon className="size-4" />
          </button>
        </div>

        <p className="text-sm text-muted">
          Messages, photos, videos and voice notes in this chat are encrypted on your device before
          they're sent. Only you and {peerName} can read them — not the server, and not the file
          host.
        </p>

        {number ? (
          <div className="mt-4 rounded-xl bg-surface p-3">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">
              Safety number
            </p>
            <p className="font-mono text-sm leading-relaxed tracking-wider">{number}</p>
            <p className="mt-2 text-xs text-muted">
              Compare this with {peerName} in person or over a call. If it matches on both of your
              screens, nobody is intercepting this chat.
            </p>
          </div>
        ) : (
          <p className="mt-4 rounded-xl bg-surface p-3 text-sm text-muted">
            {peerName} hasn't turned on encryption yet, so you can't message them until they open
            Phoenix once.
          </p>
        )}
      </div>
    </div>
  );
}
