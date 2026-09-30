import { useState } from "react";
import { Avatar } from "@heroui/react";
import { XIcon } from "lucide-react";
import toast from "react-hot-toast";
import { getAvatarPalette } from "../../lib/utils";
import { forwardContent, groupForwardTarget } from "../../lib/forward";
import { getOrCreateKeyPair } from "../../lib/e2ee";
import { useChatStore } from "../../store/useChatStore";
import { useGroupStore } from "../../store/useGroupStore";
import { useAuthStore } from "../../store/useAuthStore";

function initialsFor(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("");
}

// Forwards a message you've already decrypted (text + optional media key
// material) to either a person or a group — the two are just different
// "targets" as far as forwarding is concerned.
export function ForwardPicker({ text = "", media = null, onClose }) {
  const users = useChatStore((state) => state.users);
  const groups = useGroupStore((state) => state.groups);
  const authUser = useAuthStore((state) => state.authUser);
  const [query, setQuery] = useState("");
  const [sendingId, setSendingId] = useState(null);

  const mySecretKey = authUser ? getOrCreateKeyPair(authUser._id)?.secretKey : null;
  const q = query.trim().toLowerCase();
  const filteredUsers = users.filter((user) => user.fullName.toLowerCase().includes(q));
  const filteredGroups = groups.filter((group) => group.name.toLowerCase().includes(q));

  const handleForwardToUser = async (user) => {
    setSendingId(user._id);
    try {
      await forwardContent(
        { text, media },
        { type: "dm", userId: user._id, publicKey: user.publicKey },
      );
      toast.success("Message forwarded");
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || "Failed to forward");
    } finally {
      setSendingId(null);
    }
  };

  const handleForwardToGroup = async (group) => {
    setSendingId(group._id);
    try {
      await forwardContent({ text, media }, groupForwardTarget(group, mySecretKey));
      toast.success("Message forwarded");
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || "Failed to forward");
    } finally {
      setSendingId(null);
    }
  };

  const nothingFound = filteredUsers.length === 0 && filteredGroups.length === 0;

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
            placeholder="Search people or groups"
            className="w-full rounded-full bg-surface px-3.5 py-2 text-sm outline-none placeholder:text-muted"
          />
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {nothingFound ? (
            <p className="px-4 py-6 text-center text-sm text-muted">Nothing matches that.</p>
          ) : (
            <>
              {filteredGroups.map((group) => (
                <button
                  key={group._id}
                  type="button"
                  disabled={sendingId !== null}
                  onClick={() => handleForwardToGroup(group)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface disabled:opacity-60"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-lg">
                    {group.avatarEmoji || "👥"}
                  </div>
                  <span className="truncate text-[15px] font-medium">{group.name}</span>
                  {sendingId === group._id ? (
                    <span className="ml-auto text-xs text-muted">Sending…</span>
                  ) : null}
                </button>
              ))}

              {filteredUsers.map((user) => {
                const palette = getAvatarPalette(user.fullName);
                return (
                  <button
                    key={user._id}
                    type="button"
                    disabled={sendingId !== null}
                    onClick={() => handleForwardToUser(user)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface disabled:opacity-60"
                  >
                    <Avatar className="size-10 shrink-0">
                      <Avatar.Image alt={user.fullName} src={user.profilePic} />
                      <Avatar.Fallback className={`text-sm font-semibold ${palette.bg} ${palette.text}`}>
                        {initialsFor(user.fullName)}
                      </Avatar.Fallback>
                    </Avatar>
                    <span className="truncate text-[15px] font-medium">{user.fullName}</span>
                    {sendingId === user._id ? (
                      <span className="ml-auto text-xs text-muted">Sending…</span>
                    ) : null}
                  </button>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
