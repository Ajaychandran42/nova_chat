import { useState } from "react";
import { Avatar } from "@heroui/react";
import { XIcon } from "lucide-react";
import { getAvatarPalette } from "../../lib/utils";
import { useChatStore } from "../../store/useChatStore";

export function ForwardPicker({ messageId, messageText = "", onClose }) {
  const users = useChatStore((state) => state.users);
  const forwardMessage = useChatStore((state) => state.forwardMessage);
  const [query, setQuery] = useState("");
  const [sendingToId, setSendingToId] = useState(null);

  const filteredUsers = users.filter((user) =>
    user.fullName.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const handleForward = async (userId) => {
    setSendingToId(userId);
    const ok = await forwardMessage(messageId, userId, messageText);
    setSendingToId(null);
    if (ok) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[80vh] w-full max-w-sm flex-col overflow-hidden rounded-t-2xl border border-border bg-background shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-base font-semibold">Forward to...</p>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-surface"
          >
            <XIcon className="size-4" />
          </button>
        </div>

        <div className="border-b border-border px-3 py-2">
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search people"
            className="w-full rounded-full bg-surface px-3.5 py-2 text-sm outline-none placeholder:text-muted"
          />
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {filteredUsers.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted">No people found.</p>
          ) : (
            filteredUsers.map((user) => {
              const palette = getAvatarPalette(user.fullName);
              return (
                <button
                  key={user._id}
                  type="button"
                  disabled={sendingToId !== null}
                  onClick={() => handleForward(user._id)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface disabled:opacity-60"
                >
                  <Avatar className="size-10 shrink-0">
                    <Avatar.Image alt={user.fullName} src={user.profilePic} />
                    <Avatar.Fallback className={`text-sm font-semibold ${palette.bg} ${palette.text}`}>
                      {user.fullName
                        .split(" ")
                        .filter(Boolean)
                        .map((part) => part[0])
                        .join("")}
                    </Avatar.Fallback>
                  </Avatar>
                  <span className="truncate text-[15px] font-medium">{user.fullName}</span>
                  {sendingToId === user._id ? (
                    <span className="ml-auto text-xs text-muted">Sending…</span>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
