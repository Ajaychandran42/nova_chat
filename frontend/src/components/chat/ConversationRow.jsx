import { Avatar } from "@heroui/react";
import { getAvatarPalette } from "../../lib/utils";
import { AvatarWithOnlineIndicator } from "./AvatarWithOnlineIndicator";

export function ConversationRow({ user, selected, onSelect }) {
  const palette = getAvatarPalette(user.name);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors sm:px-3 ${
        selected
          ? "bg-accent-soft ring-1 ring-inset ring-accent/25"
          : "hover:bg-surface/70"
      }`}
    >
      {selected ? (
        <span className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-accent" aria-hidden />
      ) : null}

      <AvatarWithOnlineIndicator isOnline={user.isOnline ?? true}>
        <Avatar className="size-12 shrink-0">
          <Avatar.Image alt={user.name} src={user.avatarUrl} />
          <Avatar.Fallback
            className={`text-sm font-semibold ${palette.bg} ${palette.text}`}
          >
            {user.initials}
          </Avatar.Fallback>
        </Avatar>
      </AvatarWithOnlineIndicator>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[15px] font-semibold">{user.name}</p>
        </div>
        <p
          className={`truncate text-xs ${
            user.isOnline ? "font-medium text-success" : "text-muted"
          }`}
        >
          {user.isOnline ? "Online" : "Offline"}
        </p>
      </div>
    </button>
  );
}
