const QUICK_REACTIONS = ["❤️", "😂", "😮", "😢", "🙏", "👍"];

export function QuickReactBar({ onSelect, align = "start" }) {
  return (
    <div
      className={`absolute bottom-full z-20 mb-1 flex items-center gap-0.5 rounded-full border border-border bg-background px-1.5 py-1 shadow-lg ${
        align === "end" ? "right-0" : "left-0"
      }`}
    >
      {QUICK_REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          className="flex size-8 items-center justify-center rounded-full text-lg leading-none transition-transform hover:scale-125"
          onClick={() => onSelect(emoji)}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
