import { Button, TextArea } from "@heroui/react";
import {
  ImageIcon,
  LoaderIcon,
  MicIcon,
  SendHorizontalIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useGroupStore } from "../../store/useGroupStore";
import { EmojiPicker } from "../chat/EmojiPicker";
import { useSelectedGroup } from "../../hooks/useSelectedGroup";

function formatSeconds(seconds) {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

function ReplyPreviewBar() {
  const replyingTo = useGroupStore((state) => state.replyingTo);
  const setReplyingTo = useGroupStore((state) => state.setReplyingTo);

  if (!replyingTo) return null;

  const label = replyingTo.hasImage
    ? "📷 Photo"
    : replyingTo.hasVideo
      ? "🎥 Video"
      : replyingTo.hasAudio
        ? "🎤 Voice message"
        : replyingTo.text || "Message";

  return (
    <div className="mx-auto mb-2 flex max-w-full items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm">
      <div className="min-w-0 flex-1 border-l-2 border-accent pl-2">
        <p className="text-xs font-medium text-accent">Replying to</p>
        <p className="truncate text-muted">{label}</p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        isIconOnly
        aria-label="Cancel reply"
        onPress={() => setReplyingTo(null)}
      >
        <XIcon className="size-4" />
      </Button>
    </div>
  );
}

function EncryptionBanner() {
  const { activeGroup } = useSelectedGroup();
  const enableGroupEncryption = useGroupStore((state) => state.enableGroupEncryption);
  const [isEnabling, setIsEnabling] = useState(false);

  if (!activeGroup) return null;

  // this device can't unlock the key (fresh device / regenerated keys)
  if (activeGroup.isEncrypted && !activeGroup.canDecrypt) {
    return (
      <div className="mx-auto mb-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs">
        🔒 This group is encrypted, but this device can't unlock its key — your encryption keys
        changed since you joined. You won't be able to read or send messages here.
      </div>
    );
  }

  // a group created before encryption existed
  if (!activeGroup.isEncrypted) {
    return (
      <div className="mx-auto mb-2 flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-xs">
        <span className="min-w-0 flex-1">
          🔓 Messages in this group aren't end-to-end encrypted.
          {activeGroup.isCreator ? "" : " Only the group's creator can switch encryption on."}
        </span>
        {activeGroup.isCreator ? (
          <button
            type="button"
            disabled={isEnabling}
            onClick={async () => {
              setIsEnabling(true);
              await enableGroupEncryption(activeGroup.id);
              setIsEnabling(false);
            }}
            className="shrink-0 rounded-full bg-accent px-3 py-1 font-semibold text-accent-foreground disabled:opacity-50"
          >
            {isEnabling ? "Enabling…" : "Enable encryption"}
          </button>
        ) : null}
      </div>
    );
  }

  return null;
}

export function GroupComposer() {
  const composerText = useGroupStore((state) => state.composerText);
  const sendMediaMessage = useGroupStore((state) => state.sendMediaMessage);
  const sendVoiceMessage = useGroupStore((state) => state.sendVoiceMessage);
  const isSendingMedia = useGroupStore((state) => state.isSendingMedia);
  const sendTextMessage = useGroupStore((state) => state.sendTextMessage);
  const setComposerText = useGroupStore((state) => state.setComposerText);
  const activeGroupId = useGroupStore((state) => state.activeGroupId);
  const mediaInputRef = useRef(null);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recordingStartRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  useEffect(() => {
    if (!isRecording) return undefined;
    const interval = setInterval(() => {
      setRecordingSeconds((Date.now() - recordingStartRef.current) / 1000);
    }, 200);
    return () => clearInterval(interval);
  }, [isRecording]);

  useEffect(
    () => () => {
      mediaRecorderRef.current?.stream?.getTracks().forEach((track) => track.stop());
    },
    [activeGroupId],
  );

  const handleSend = async () => {
    await sendTextMessage();
  };

  const handleEmojiSelect = (emoji) => {
    setComposerText(`${composerText}${emoji}`);
  };

  const handleMediaPick = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    await sendMediaMessage(file);
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      recordingStartRef.current = Date.now();
      setRecordingSeconds(0);
      setIsRecording(true);
    } catch {
      // mic permission denied or unavailable — silently no-op
    }
  };

  const stopRecording = ({ send }) =>
    new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder) return resolve();

      recorder.onstop = async () => {
        const durationSeconds = (Date.now() - recordingStartRef.current) / 1000;
        recorder.stream.getTracks().forEach((track) => track.stop());
        setIsRecording(false);

        if (send && durationSeconds >= 1) {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          await sendVoiceMessage({ blob, durationSeconds });
        }

        mediaRecorderRef.current = null;
        resolve();
      };

      recorder.stop();
    });

  if (isRecording) {
    return (
      <footer className="shrink-0 border-t border-border px-1.5 pb-2 pt-2 sm:px-2">
        <div className="mx-auto flex w-full max-w-full items-center gap-2 px-0.5 sm:px-1">
          <Button
            variant="ghost"
            isIconOnly
            className="size-9 shrink-0 text-danger"
            aria-label="Cancel recording"
            onPress={() => stopRecording({ send: false })}
          >
            <Trash2Icon className="size-5" />
          </Button>

          <div className="flex flex-1 items-center gap-2 rounded-full bg-surface px-4 py-2.5">
            <span className="size-2.5 shrink-0 animate-pulse rounded-full bg-danger" />
            <span className="text-sm font-medium tabular-nums">
              {formatSeconds(recordingSeconds)}
            </span>
            <span className="text-sm text-muted">Recording voice message…</span>
          </div>

          <Button
            variant="primary"
            isIconOnly
            className="size-10 shrink-0 rounded-full transition-transform active:scale-90"
            aria-label="Send voice message"
            onPress={() => stopRecording({ send: true })}
          >
            <SendHorizontalIcon className="size-5" />
          </Button>
        </div>
      </footer>
    );
  }

  return (
    <footer className="shrink-0 border-t border-border px-1.5 pb-2 pt-2 sm:px-2">
      {isSendingMedia ? (
        <div className="mx-auto mb-2 flex max-w-full items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-muted">
          <LoaderIcon
            className="size-4 shrink-0 animate-spin text-accent"
            strokeWidth={2}
            aria-hidden
          />
          <span className="truncate">Uploading...</span>
        </div>
      ) : null}

      <EncryptionBanner />

      <ReplyPreviewBar />

      <div className="mx-auto flex w-full max-w-full items-end gap-1 px-0.5 sm:gap-1.5 sm:px-1">
        <input
          ref={mediaInputRef}
          type="file"
          accept="image/*,video/*"
          className="sr-only"
          disabled={isSendingMedia}
          tabIndex={-1}
          aria-hidden
          onChange={handleMediaPick}
        />
        <Button
          variant="ghost"
          isIconOnly
          isDisabled={isSendingMedia}
          className="size-9 shrink-0 touch-manipulation self-end text-accent"
          onPress={() => mediaInputRef.current?.click()}
        >
          <ImageIcon className="size-5 sm:size-6" strokeWidth={2} />
        </Button>

        <EmojiPicker onSelect={handleEmojiSelect} />

        <TextArea
          fullWidth
          variant="secondary"
          placeholder="Message the group..."
          rows={1}
          value={composerText}
          onChange={(event) => setComposerText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              handleSend();
            }
          }}
          className="flex-1 rounded-full bg-surface"
        />

        {composerText.trim() ? (
          <Button
            variant="primary"
            isIconOnly
            onPress={handleSend}
            className="size-10 shrink-0 rounded-full transition-transform active:scale-90"
            aria-label="Send message"
          >
            <SendHorizontalIcon className="size-5" />
          </Button>
        ) : (
          <Button
            variant="primary"
            isIconOnly
            isDisabled={isSendingMedia}
            onPress={startRecording}
            className="size-10 shrink-0 rounded-full transition-transform active:scale-90"
            aria-label="Record voice message"
          >
            <MicIcon className="size-5" />
          </Button>
        )}
      </div>
    </footer>
  );
}
