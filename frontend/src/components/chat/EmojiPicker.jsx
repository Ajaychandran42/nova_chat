import { useState } from "react";
import { Button } from "@heroui/react";
import { SmilePlusIcon } from "lucide-react";

// A small, curated set — enough for real chat use without shipping a full
// emoji-data package. Grouped loosely by "how often people actually use it".
const EMOJI_GROUPS = [
  {
    label: "Smileys",
    emojis: ["😀", "😂", "🥹", "😊", "😍", "😘", "😉", "😎", "🤔", "😅", "😭", "🥳", "😴", "🙄"],
  },
  {
    label: "Gestures",
    emojis: ["👍", "👎", "👏", "🙌", "🙏", "💪", "🤝", "✌️", "👌", "🤞"],
  },
  {
    label: "Hearts",
    emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "💯", "🔥", "✨"],
  },
  {
    label: "Other",
    emojis: ["🎉", "😢", "😡", "👀", "🚀", "✅", "❌", "⭐", "🤗", "😬"],
  },
];

export function EmojiPicker({ onSelect }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative shrink-0">
      <Button
        variant="ghost"
        isIconOnly
        className="size-9 touch-manipulation self-end text-accent"
        aria-label="Add emoji"
        aria-expanded={isOpen}
        onPress={() => setIsOpen((open) => !open)}
      >
        <SmilePlusIcon className="size-5 sm:size-6" strokeWidth={2} />
      </Button>

      {isOpen ? (
        <>
          {/* click-outside catcher */}
          <button
            type="button"
            aria-label="Close emoji picker"
            className="fixed inset-0 z-20 cursor-default"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute bottom-full left-0 z-30 mb-2 max-h-72 w-64 overflow-y-auto rounded-2xl border border-border bg-background p-3 shadow-xl">
            {EMOJI_GROUPS.map((group) => (
              <div key={group.label} className="mb-2 last:mb-0">
                <p className="mb-1 px-1 text-[11px] font-medium uppercase tracking-wide text-muted">
                  {group.label}
                </p>
                <div className="grid grid-cols-7 gap-0.5">
                  {group.emojis.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      className="flex size-8 items-center justify-center rounded-lg text-lg leading-none hover:bg-surface"
                      onClick={() => {
                        onSelect(emoji);
                        setIsOpen(false);
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
