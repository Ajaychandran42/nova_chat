import { useEffect, useRef, useState } from "react";
import { Avatar, Button } from "@heroui/react";
import { MicIcon, MicOffIcon, PhoneOffIcon, VideoIcon, VideoOffIcon } from "lucide-react";
import { useCallStore } from "../../store/useCallStore";
import { getAvatarPalette } from "../../lib/utils";

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

export function CallScreen() {
  const status = useCallStore((state) => state.status);
  const callType = useCallStore((state) => state.callType);
  const peer = useCallStore((state) => state.peer);
  const localStream = useCallStore((state) => state.localStream);
  const remoteStream = useCallStore((state) => state.remoteStream);
  const isMuted = useCallStore((state) => state.isMuted);
  const isCameraOff = useCallStore((state) => state.isCameraOff);
  const callStartedAt = useCallStore((state) => state.callStartedAt);
  const toggleMute = useCallStore((state) => state.toggleMute);
  const toggleCamera = useCallStore((state) => state.toggleCamera);
  const endCall = useCallStore((state) => state.endCall);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream || null;
  }, [localStream]);

  useEffect(() => {
    if (callType === "video" && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream || null;
    }
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream || null;
  }, [remoteStream, callType]);

  useEffect(() => {
    if (status !== "connected" || !callStartedAt) return undefined;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - callStartedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [status, callStartedAt]);

  if (status !== "calling" && status !== "connected") return null;

  const palette = getAvatarPalette(peer?.name || "?");
  const isVideoCall = callType === "video";

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-eclipse text-snow">
      {isVideoCall ? (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="absolute inset-0 size-full object-cover"
        />
      ) : null}
      <audio ref={remoteAudioRef} autoPlay hidden={isVideoCall} />

      {!isVideoCall || !remoteStream ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-black/40 via-black/70 to-black">
          <Avatar className="size-28 shrink-0">
            <Avatar.Image alt={peer?.name} src={peer?.avatarUrl} />
            <Avatar.Fallback className={`text-3xl font-semibold ${palette.bg} ${palette.text}`}>
              {peer?.initials}
            </Avatar.Fallback>
          </Avatar>
          <div className="text-center">
            <p className="text-xl font-semibold">{peer?.name}</p>
            <p className="mt-1 text-sm text-white/70">
              {status === "calling" ? "Ringing…" : formatDuration(elapsed)}
            </p>
          </div>
        </div>
      ) : (
        <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/60 to-transparent p-4 pt-[max(1rem,env(safe-area-inset-top))] text-center">
          <p className="text-lg font-semibold">{peer?.name}</p>
          <p className="text-sm text-white/70">{formatDuration(elapsed)}</p>
        </div>
      )}

      {isVideoCall && localStream ? (
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="absolute right-4 top-[max(4.5rem,calc(env(safe-area-inset-top)+4.5rem))] h-36 w-24 rounded-xl border border-white/20 object-cover shadow-lg sm:h-44 sm:w-32"
        />
      ) : null}

      <div className="relative mt-auto flex items-center justify-center gap-4 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <Button
          isIconOnly
          size="lg"
          className={`size-14 rounded-full ${isMuted ? "bg-white text-eclipse" : "bg-white/15 text-white"}`}
          aria-label={isMuted ? "Unmute" : "Mute"}
          onPress={toggleMute}
        >
          {isMuted ? <MicOffIcon className="size-6" /> : <MicIcon className="size-6" />}
        </Button>

        {isVideoCall ? (
          <Button
            isIconOnly
            size="lg"
            className={`size-14 rounded-full ${isCameraOff ? "bg-white text-eclipse" : "bg-white/15 text-white"}`}
            aria-label={isCameraOff ? "Turn camera on" : "Turn camera off"}
            onPress={toggleCamera}
          >
            {isCameraOff ? <VideoOffIcon className="size-6" /> : <VideoIcon className="size-6" />}
          </Button>
        ) : null}

        <Button
          isIconOnly
          size="lg"
          className="size-14 rounded-full bg-danger text-danger-foreground"
          aria-label="End call"
          onPress={() => endCall()}
        >
          <PhoneOffIcon className="size-6" />
        </Button>
      </div>
    </div>
  );
}
