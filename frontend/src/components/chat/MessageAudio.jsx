import { useEffect, useRef, useState } from "react";
import { PauseIcon, PlayIcon } from "lucide-react";

function formatSeconds(seconds) {
  const total = Math.max(0, Math.round(seconds || 0));
  const m = Math.floor(total / 60);
  const s = (total % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function MessageAudio({ src, duration = 0, isOwnMessage }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [knownDuration, setKnownDuration] = useState(duration);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => {
      if (Number.isFinite(audio.duration)) setKnownDuration(audio.duration);
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);
    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying((playing) => !playing);
  };

  const handleSeek = (event) => {
    const audio = audioRef.current;
    if (!audio || !knownDuration) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * knownDuration;
    setCurrentTime(audio.currentTime);
  };

  const progress = knownDuration ? Math.min(1, currentTime / knownDuration) : 0;

  return (
    <div className="flex min-w-56 items-center gap-2 py-0.5">
      <audio ref={audioRef} src={src} preload="metadata" />

      <button
        type="button"
        onClick={togglePlay}
        aria-label={isPlaying ? "Pause voice message" : "Play voice message"}
        className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
          isOwnMessage ? "bg-accent-foreground/20" : "bg-accent/15 text-accent"
        }`}
      >
        {isPlaying ? (
          <PauseIcon className="size-4.5 fill-current" />
        ) : (
          <PlayIcon className="size-4.5 fill-current" />
        )}
      </button>

      <div className="flex-1">
        <button
          type="button"
          aria-label="Seek"
          className={`h-1.5 w-full cursor-pointer rounded-full text-left ${
            isOwnMessage ? "bg-accent-foreground/25" : "bg-accent/20"
          }`}
          onClick={handleSeek}
        >
          <span
            className={`block h-full rounded-full ${
              isOwnMessage ? "bg-accent-foreground" : "bg-accent"
            }`}
            style={{ width: `${progress * 100}%` }}
          />
        </button>
        <p
          className={`mt-1 text-[11px] tabular-nums ${
            isOwnMessage ? "text-accent-foreground/75" : "text-muted"
          }`}
        >
          {formatSeconds(isPlaying || currentTime > 0 ? currentTime : knownDuration)}
        </p>
      </div>
    </div>
  );
}
