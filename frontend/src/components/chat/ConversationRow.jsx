import { Avatar } from "@heroui/react";
import { getAvatarPalette, formatMessageTime } from "../../lib/utils";
import { AvatarWithOnlineIndicator } from "./AvatarWithOnlineIndicator";

function lastMessagePreview(lastMessage) {
  if (!lastMessage) return null;
  if (lastMessage.isDeleted) return "Message deleted";
  if (lastMessage.text) return lastMessage.text;
  if (lastMessage.image) return "📷 Photo";
  if (lastMessage.video) return "🎥 Video";
  if (lastMessage.audio) return "🎤 Voice message";
  return "";
}

export function ConversationRow({ user, selected, onSelect }) {
  const palette = getAvatarPalette(user.name);
  const preview = lastMessagePreview(user.lastMessage);
  const unreadCount = user.unreadCount || 0;
  const timestamp = user.lastMessage?.createdAt ? formatMessageTime(user.lastMessage.createdAt) : null;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors active:scale-[0.99] sm:px-3 ${
        selected ? "bg-accent-soft ring-1 ring-inset ring-accent/25" : "hover:bg-surface/70"
      }`}
    >
      {selected ? (
        <span className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-accent" aria-hidden />
      ) : null}

      <AvatarWithOnlineIndicator isOnline={user.isOnline ?? true}>
        <Avatar className="size-12 shrink-0">
          <Avatar.Image alt={user.name} src={user.avatarUrl} />
          <Avatar.Fallback className={`text-sm font-semibold ${palette.bg} ${palette.text}`}>
            {user.initials}
          </Avatar.Fallback>
        </Avatar>
      </AvatarWithOnlineIndicator>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[15px] font-semibold">{user.name}</p>
          {timestamp ? (
            <span
              className={`shrink-0 text-[11px] tabular-nums ${
                unreadCount > 0 ? "font-semibold text-accent" : "text-muted"
              }`}
            >
              {timestamp}
            </span>
          ) : null}
        </div>
        <div className="flex items-center justify-between gap-2">
          {preview !== null ? (
            <p
              className={`min-w-0 flex-1 truncate text-xs ${
                unreadCount > 0 ? "font-semibold text-foreground" : "text-muted"
              }`}
            >
              {preview}
            </p>
          ) : (
            <p
              className={`min-w-0 flex-1 truncate text-xs ${
                user.isOnline ? "font-medium text-success" : "text-muted"
              }`}
            >
              {user.isOnline ? "Online" : "Offline"}
            </p>
          )}

          {unreadCount > 0 ? (
            <span className="flex h-5 min-w-5 shrink-0 animate-[reaction-pop_220ms_ease-out] items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-semibold tabular-nums text-accent-foreground shadow-[0_1px_2px_color-mix(in_oklab,var(--accent)_35%,transparent)] motion-reduce:animate-none">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}
