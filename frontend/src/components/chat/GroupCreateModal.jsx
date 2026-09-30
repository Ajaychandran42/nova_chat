import { useState } from "react";
import { Avatar } from "@heroui/react";
import { CheckIcon, XIcon } from "lucide-react";
import { getAvatarPalette } from "../../lib/utils";
import { getInitials } from "../../hooks/useSelectedConversation";
import { useChatStore } from "../../store/useChatStore";
import { useGroupStore } from "../../store/useGroupStore";

export function GroupCreateModal({ onClose, onCreated }) {
  const users = useChatStore((state) => state.users);
  const createGroup = useGroupStore((state) => state.createGroup);

  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredUsers = users.filter((user) =>
    user.fullName.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const toggleUser = (userId) => {
    setSelectedIds((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId],
    );
  };

  const canSubmit = name.trim().length > 0 && selectedIds.length > 0 && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    const group = await createGroup({ name: name.trim(), memberIds: selectedIds });
    setIsSubmitting(false);
    if (group) onCreated(group._id);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[85vh] w-full max-w-sm flex-col overflow-hidden rounded-t-2xl border border-border bg-background shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-base font-semibold">New group</p>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-surface"
          >
            <XIcon className="size-4" />
          </button>
        </div>

        <div className="space-y-2 border-b border-border px-4 py-3">
          <input
            autoFocus
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Group name"
            className="w-full rounded-xl bg-surface px-3.5 py-2 text-sm outline-none placeholder:text-muted"
          />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search people to add"
            className="w-full rounded-full bg-surface px-3.5 py-2 text-sm outline-none placeholder:text-muted"
          />
          <p className="text-xs text-muted">
            🔒 Group messages, photos and voice notes are end-to-end encrypted. Everyone you add
            needs to have opened Phoenix at least once.
          </p>
          {selectedIds.length > 0 ? (
            <p className="text-xs text-muted">
              {selectedIds.length} member{selectedIds.length === 1 ? "" : "s"} selected
            </p>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {filteredUsers.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted">No people found.</p>
          ) : (
            filteredUsers.map((user) => {
              const palette = getAvatarPalette(user.fullName);
              const isSelected = selectedIds.includes(user._id);
              return (
                <button
                  key={user._id}
                  type="button"
                  onClick={() => toggleUser(user._id)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface"
                >
                  <Avatar className="size-10 shrink-0">
                    <Avatar.Image alt={user.fullName} src={user.profilePic} />
                    <Avatar.Fallback className={`text-sm font-semibold ${palette.bg} ${palette.text}`}>
                      {getInitials(user.fullName)}
                    </Avatar.Fallback>
                  </Avatar>
                  <span className="min-w-0 flex-1 truncate text-[15px] font-medium">
                    {user.fullName}
                  </span>
                  <span
                    className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${
                      isSelected ? "border-accent bg-accent text-accent-foreground" : "border-border"
                    }`}
                  >
                    {isSelected ? <CheckIcon className="size-3.5" /> : null}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="border-t border-border p-3">
          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="w-full rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground disabled:opacity-40"
          >
            {isSubmitting ? "Creating…" : "Create group"}
          </button>
        </div>
      </div>
    </div>
  );
}
