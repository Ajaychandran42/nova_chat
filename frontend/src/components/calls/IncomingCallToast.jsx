import { useEffect } from "react";
import { Avatar, Button } from "@heroui/react";
import { PhoneIcon, PhoneOffIcon, VideoIcon } from "lucide-react";
import { useCallStore } from "../../store/useCallStore";
import { useAuthStore } from "../../store/useAuthStore";
import { getAvatarPalette } from "../../lib/utils";

// Mounted once at the app root. Subscribes to call signaling for the whole
// session and renders the "incoming call" ringing card when someone calls.
export function IncomingCallToast() {
  const socket = useAuthStore((state) => state.socket);
  const subscribeToCallEvents = useCallStore((state) => state.subscribeToCallEvents);
  const status = useCallStore((state) => state.status);
  const incomingCall = useCallStore((state) => state.incomingCall);
  const acceptCall = useCallStore((state) => state.acceptCall);
  const declineCall = useCallStore((state) => state.declineCall);

  useEffect(() => {
    if (socket) subscribeToCallEvents();
  }, [socket, subscribeToCallEvents]);

  if (status !== "ringing" || !incomingCall) return null;

  const palette = getAvatarPalette(incomingCall.callerName || "?");

  return (
    <div className="fixed inset-x-0 top-3 z-50 flex justify-center px-3 sm:top-5">
      <div className="flex w-full max-w-sm items-center gap-3 rounded-2xl border border-border bg-background/95 p-3 shadow-xl backdrop-blur-md">
        <Avatar className="size-11 shrink-0">
          <Avatar.Image alt={incomingCall.callerName} src={incomingCall.callerAvatar} />
          <Avatar.Fallback className={`text-sm font-semibold ${palette.bg} ${palette.text}`}>
            {(incomingCall.callerName || "?").slice(0, 2).toUpperCase()}
          </Avatar.Fallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{incomingCall.callerName || "Someone"}</p>
          <p className="truncate text-xs text-muted">
            Incoming {incomingCall.callType === "video" ? "video" : "voice"} call…
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            isIconOnly
            size="sm"
            className="rounded-full bg-danger text-danger-foreground"
            aria-label="Decline"
            onPress={declineCall}
          >
            <PhoneOffIcon className="size-4.5" />
          </Button>
          <Button
            isIconOnly
            size="sm"
            className="rounded-full bg-success text-white"
            aria-label="Accept"
            onPress={acceptCall}
          >
            {incomingCall.callType === "video" ? (
              <VideoIcon className="size-4.5" />
            ) : (
              <PhoneIcon className="size-4.5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
