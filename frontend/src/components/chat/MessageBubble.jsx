import { lazy, Suspense, useState } from "react";
import { CornerUpLeftIcon, ForwardIcon, SmilePlusIcon, Trash2Icon } from "lucide-react";
import { DecryptedAudio, DecryptedImage, DecryptedVideo } from "./MessageMedia";
import { QuickReactBar } from "./QuickReactBar";
import { useChatStore } from "../../store/useChatStore";
import { useAuthStore } from "../../store/useAuthStore";
import { useLightboxStore } from "../../store/useLightboxStore";

const ForwardPicker = lazy(() =>
  import("./ForwardPicker").then((m) => ({ default: m.ForwardPicker })),
);

function ReplyQuote({ replyTo, isOwnMessage }) {
  if (!replyTo) return null;

  const label = replyTo.hasImage
    ? "📷 Photo"
    : replyTo.hasVideo
      ? "🎥 Video"
      : replyTo.hasAudio
        ? "🎤 Voice message"
        : replyTo.text || "Message";

  return (
    <div
      className={`mb-1.5 rounded-lg border-l-2 px-2 py-1 text-xs ${
        isOwnMessage
          ? "border-accent-foreground/50 bg-accent-foreground/10 text-accent-foreground/85"
          : "border-accent bg-accent/10 text-foreground/75"
      }`}
    >
      <p className="line-clamp-2 wrap-break-word">{label}</p>
    </div>
  );
}

function ReactionPills({ reactions, myUserId, onToggle }) {
  if (!reactions || reactions.length === 0) return null;

  const counts = reactions.reduce((acc, reaction) => {
    acc[reaction.emoji] = (acc[reaction.emoji] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {Object.entries(counts).map(([emoji, count]) => {
        const mine = reactions.some((r) => r.emoji === emoji && String(r.userId) === myUserId);
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => onToggle(emoji)}
            className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs ${
              mine
                ? "border-accent bg-accent/15 text-accent"
                : "border-border bg-background text-muted"
            }`}
          >
            <span>{emoji}</span>
            {count > 1 ? <span className="tabular-nums">{count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export function MessageBubble({
  message,
  senderName,
  onReply,
  onReact,
  onDelete,
  allowForward = true,
}) {
  const [showQuickReact, setShowQuickReact] = useState(false);
  const [isForwarding, setIsForwarding] = useState(false);
  const authUserId = useAuthStore((state) => state.authUser?._id);
  const setReplyingTo = useChatStore((state) => state.setReplyingTo);
  const reactToMessage = useChatStore((state) => state.reactToMessage);
  const deleteMessage = useChatStore((state) => state.deleteMessage);
  const openLightbox = useLightboxStore((state) => state.open);

  const isOwnMessage = message.role === "me";
  const hasImage = Boolean(message.imageUrl);
  const hasVideo = Boolean(message.videoUrl);
  const hasAudio = Boolean(message.audioUrl);

  if (message.isDeleted) {
    return (
      <div className={`flex w-full ${isOwnMessage ? "justify-end" : "justify-start"}`}>
        <div className="max-w-[min(90%,28rem)] rounded-2xl border border-dashed border-border px-3.5 py-2.5 text-[13px] italic text-muted sm:max-w-[min(75%,28rem)]">
          This message was deleted
        </div>
      </div>
    );
  }

  const handleReply = () => {
    const replyPayload = {
      id: message.id,
      text: message.text,
      hasImage,
      hasVideo,
      hasAudio,
      senderId: message.senderId,
    };
    if (onReply) onReply(replyPayload);
    else setReplyingTo(replyPayload);
    setShowQuickReact(false);
  };

  const handleReact = (emoji) => {
    if (onReact) onReact(message.id, emoji);
    else reactToMessage(message.id, emoji);
    setShowQuickReact(false);
  };

  const handleDelete = () => {
    if (onDelete) onDelete(message.id);
    else deleteMessage(message.id);
  };

  return (
    <div
      id={`message-${message.id}`}
      className={`group flex w-full scroll-mt-16 rounded-lg transition-shadow ${
        isOwnMessage ? "justify-end" : "justify-start"
      }`}
    >
      <div
        className={`flex max-w-[min(90%,28rem)] items-center gap-1 sm:max-w-[min(75%,28rem)] ${
          isOwnMessage ? "flex-row-reverse" : "flex-row"
        }`}
      >
        {/* hover/tap action toolbar */}
        <div
          className={`relative flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 ${
            showQuickReact ? "opacity-100" : ""
          }`}
        >
          {showQuickReact ? (
            <QuickReactBar onSelect={handleReact} align={isOwnMessage ? "end" : "start"} />
          ) : null}
          <button
            type="button"
            aria-label="React"
            onClick={() => setShowQuickReact((open) => !open)}
            className="flex size-7 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-foreground"
          >
            <SmilePlusIcon className="size-4" strokeWidth={2} />
          </button>
          <button
            type="button"
            aria-label="Reply"
            onClick={handleReply}
            className="flex size-7 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-foreground"
          >
            <CornerUpLeftIcon className="size-4" strokeWidth={2} />
          </button>
          <button
            type="button"
            aria-label="Forward"
            onClick={() => setIsForwarding(true)}
            className={`flex size-7 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-foreground ${
              allowForward ? "" : "hidden"
            }`}
          >
            <ForwardIcon className="size-4" strokeWidth={2} />
          </button>
          {isOwnMessage ? (
            <button
              type="button"
              aria-label="Delete message"
              onClick={handleDelete}
              className="flex size-7 items-center justify-center rounded-full text-muted hover:bg-danger/10 hover:text-danger"
            >
              <Trash2Icon className="size-4" strokeWidth={2} />
            </button>
          ) : null}
        </div>

        <div
          className={`min-w-0 rounded-2xl px-3.5 py-2.5 text-[15px] leading-snug shadow-sm ${
            isOwnMessage
              ? "rounded-br-md bg-accent text-accent-foreground"
              : "rounded-bl-md border border-border bg-surface"
          }`}
        >
          <ReplyQuote replyTo={message.replyTo} isOwnMessage={isOwnMessage} />

          {senderName && !isOwnMessage ? (
            <p className="mb-0.5 text-xs font-semibold text-accent">{senderName}</p>
          ) : null}

          {message.forwarded ? (
            <p
              className={`mb-1 flex items-center gap-1 text-[11px] italic ${
                isOwnMessage ? "text-accent-foreground/70" : "text-muted"
              }`}
            >
              <ForwardIcon className="size-3" strokeWidth={2} />
              Forwarded
            </p>
          ) : null}

          {hasImage ? (
            <DecryptedImage url={message.imageUrl} media={message.media} onOpen={openLightbox} />
          ) : null}
          {hasVideo ? <DecryptedVideo url={message.videoUrl} media={message.media} /> : null}
          {hasAudio ? (
            <DecryptedAudio
              url={message.audioUrl}
              media={message.media}
              duration={message.audioDuration}
              isOwnMessage={isOwnMessage}
            />
          ) : null}
          {message.text ? (
            <p className="whitespace-pre-wrap wrap-break-word">{message.text}</p>
          ) : null}

          <p
            className={`mt-1 text-[11px] tabular-nums ${
              isOwnMessage ? "text-accent-foreground/75" : "text-muted"
            }`}
          >
            {message.time}
            {isOwnMessage ? (message.seen ? " · Read" : " · Sent") : ""}
          </p>

          <ReactionPills
            reactions={message.reactions}
            myUserId={authUserId}
            onToggle={handleReact}
          />
        </div>
      </div>

      {isForwarding && allowForward ? (
        <Suspense fallback={null}>
          <ForwardPicker
            messageId={message.id}
            messageText={message.text}
            onClose={() => setIsForwarding(false)}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
