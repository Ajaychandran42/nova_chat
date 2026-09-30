import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  CheckIcon,
  CornerUpLeftIcon,
  ForwardIcon,
  PencilIcon,
  SmilePlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
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

function EditComposer({ initialText, isOwnMessage, onSave, onCancel }) {
  const [value, setValue] = useState(initialText);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.setSelectionRange(initialText.length, initialText.length);
    // only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === initialText) return onCancel();
    setIsSaving(true);
    await onSave(trimmed);
    setIsSaving(false);
  };

  return (
    <div>
      <textarea
        ref={inputRef}
        rows={1}
        value={value}
        disabled={isSaving}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            save();
          }
          if (event.key === "Escape") onCancel();
        }}
        className={`w-full resize-none whitespace-pre-wrap bg-transparent outline-none ${
          isOwnMessage ? "placeholder:text-accent-foreground/60" : "placeholder:text-muted"
        }`}
      />
      <div className="mt-1.5 flex items-center justify-end gap-1">
        <button
          type="button"
          aria-label="Cancel edit"
          onClick={onCancel}
          className={`flex size-6 items-center justify-center rounded-full ${
            isOwnMessage ? "hover:bg-accent-foreground/15" : "hover:bg-surface-tertiary"
          }`}
        >
          <XIcon className="size-3.5" />
        </button>
        <button
          type="button"
          aria-label="Save edit"
          disabled={isSaving}
          onClick={save}
          className={`flex size-6 items-center justify-center rounded-full disabled:opacity-50 ${
            isOwnMessage ? "hover:bg-accent-foreground/15" : "hover:bg-surface-tertiary"
          }`}
        >
          <CheckIcon className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

export function MessageBubble({ message, senderName, onReply, onReact, onDelete, onEdit }) {
  const [showQuickReact, setShowQuickReact] = useState(false);
  const [isForwarding, setIsForwarding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const authUserId = useAuthStore((state) => state.authUser?._id);
  const setReplyingTo = useChatStore((state) => state.setReplyingTo);
  const reactToMessage = useChatStore((state) => state.reactToMessage);
  const deleteMessage = useChatStore((state) => state.deleteMessage);
  const editMessage = useChatStore((state) => state.editMessage);
  const openLightbox = useLightboxStore((state) => state.open);

  const isOwnMessage = message.role === "me";
  const hasImage = Boolean(message.imageUrl);
  const hasVideo = Boolean(message.videoUrl);
  const hasAudio = Boolean(message.audioUrl);
  const hasMedia = hasImage || hasVideo || hasAudio;
  const canEdit = isOwnMessage && !hasMedia;

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

  const handleSaveEdit = async (newText) => {
    if (onEdit) await onEdit(message.id, newText);
    else await editMessage(message.id, newText);
    setIsEditing(false);
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
        {isEditing ? null : (
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
              className="flex size-7 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-foreground"
            >
              <ForwardIcon className="size-4" strokeWidth={2} />
            </button>
            {canEdit ? (
              <button
                type="button"
                aria-label="Edit message"
                onClick={() => setIsEditing(true)}
                className="flex size-7 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-foreground"
              >
                <PencilIcon className="size-4" strokeWidth={2} />
              </button>
            ) : null}
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
        )}

        <div
          className={`min-w-0 rounded-2xl px-3.5 py-2.5 text-[15px] leading-snug shadow-sm ${
            isOwnMessage
              ? "rounded-br-md bg-accent text-accent-foreground"
              : "rounded-bl-md border border-border bg-surface"
          } ${isEditing ? "w-64 sm:w-80" : ""}`}
        >
          {isEditing ? (
            <EditComposer
              initialText={message.text}
              isOwnMessage={isOwnMessage}
              onSave={handleSaveEdit}
              onCancel={() => setIsEditing(false)}
            />
          ) : (
            <>
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
                {message.edited ? " · Edited" : ""}
                {isOwnMessage ? (message.seen ? " · Read" : " · Sent") : ""}
              </p>

              <ReactionPills
                reactions={message.reactions}
                myUserId={authUserId}
                onToggle={handleReact}
              />
            </>
          )}
        </div>
      </div>

      {isForwarding ? (
        <Suspense fallback={null}>
          <ForwardPicker
            text={message.text}
            media={message.media}
            onClose={() => setIsForwarding(false)}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
