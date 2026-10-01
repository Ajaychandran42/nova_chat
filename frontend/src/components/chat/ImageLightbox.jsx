import { useRef, useState } from "react";
import { XIcon } from "lucide-react";
import { useLightboxStore } from "../../store/useLightboxStore";

const MIN_SCALE = 1;
const MAX_SCALE = 4;

export function ImageLightbox() {
  const imageUrl = useLightboxStore((state) => state.imageUrl);
  const close = useLightboxStore((state) => state.close);

  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isInteracting, setIsInteracting] = useState(false);
  const pinchState = useRef(null); // { startDistance, startScale }
  const panState = useRef(null); // { startX, startY, originX, originY }

  if (!imageUrl) return null;

  const reset = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  const handleClose = () => {
    reset();
    close();
  };

  const handleWheel = (event) => {
    event.preventDefault();
    setScale((current) => {
      const next = current - event.deltaY * 0.0015;
      return Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));
    });
  };

  const handleDoubleClick = () => {
    setScale((current) => (current > 1 ? 1 : 2.5));
    setOffset({ x: 0, y: 0 });
  };

  const distanceBetween = (touches) => {
    const [a, b] = touches;
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  };

  const handleTouchStart = (event) => {
    if (event.touches.length === 2) {
      pinchState.current = { startDistance: distanceBetween(event.touches), startScale: scale };
      setIsInteracting(true);
    } else if (event.touches.length === 1 && scale > 1) {
      const touch = event.touches[0];
      panState.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        originX: offset.x,
        originY: offset.y,
      };
      setIsInteracting(true);
    }
  };

  const handleTouchMove = (event) => {
    if (event.touches.length === 2 && pinchState.current) {
      event.preventDefault();
      const distance = distanceBetween(event.touches);
      const next =
        (distance / pinchState.current.startDistance) * pinchState.current.startScale;
      setScale(Math.min(MAX_SCALE, Math.max(MIN_SCALE, next)));
    } else if (event.touches.length === 1 && panState.current) {
      const touch = event.touches[0];
      setOffset({
        x: panState.current.originX + (touch.clientX - panState.current.startX),
        y: panState.current.originY + (touch.clientY - panState.current.startY),
      });
    }
  };

  const handleTouchEnd = (event) => {
    if (event.touches.length < 2) pinchState.current = null;
    if (event.touches.length === 0) {
      panState.current = null;
      setIsInteracting(false);
      if (scale <= 1) setOffset({ x: 0, y: 0 });
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) handleClose();
      }}
    >
      <button
        type="button"
        aria-label="Close image"
        onClick={handleClose}
        className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-10 flex size-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
      >
        <XIcon className="size-5" />
      </button>

      <div
        className="size-full touch-none overflow-hidden"
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <img
          src={imageUrl}
          alt=""
          draggable={false}
          onDoubleClick={handleDoubleClick}
          className="mx-auto size-full cursor-zoom-in touch-none object-contain select-none"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transition: isInteracting ? "none" : "transform 150ms ease-out",
          }}
        />
      </div>
    </div>
  );
}
