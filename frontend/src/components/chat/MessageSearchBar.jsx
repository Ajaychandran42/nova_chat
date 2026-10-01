import { useEffect, useState } from "react";
import { ChevronDownIcon, ChevronUpIcon, XIcon } from "lucide-react";
import { useChatStore } from "../../store/useChatStore";
import { useSelectedConversation } from "../../hooks/useSelectedConversation";

function scrollToMatch(messageId) {
  const el = document.getElementById(`message-${messageId}`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("ring-2", "ring-accent", "ring-offset-2", "ring-offset-background");
  setTimeout(() => {
    el.classList.remove("ring-2", "ring-accent", "ring-offset-2", "ring-offset-background");
  }, 1200);
}

export function MessageSearchBar() {
  const isOpen = useChatStore((state) => state.isMessageSearchOpen);
  const query = useChatStore((state) => state.messageSearchQuery);
  const setQuery = useChatStore((state) => state.setMessageSearchQuery);
  const toggleMessageSearch = useChatStore((state) => state.toggleMessageSearch);
  const { activeConversation } = useSelectedConversation();

  const trimmedQuery = query.trim().toLowerCase();
  const matches = trimmedQuery
    ? (activeConversation?.messages || []).filter(
        (message) => !message.isDeleted && message.text.toLowerCase().includes(trimmedQuery),
      )
    : [];

  // Re-sync the active match whenever the query (or the open conversation)
  // changes — this is the "adjust state during render" pattern React
  // recommends instead of setState-in-an-effect for derived state.
  const syncKey = `${activeConversation?.id ?? ""}::${trimmedQuery}`;
  const [prevSyncKey, setPrevSyncKey] = useState(syncKey);
  const [currentIndex, setCurrentIndex] = useState(matches.length > 0 ? 0 : -1);

  if (syncKey !== prevSyncKey) {
    setPrevSyncKey(syncKey);
    setCurrentIndex(matches.length > 0 ? 0 : -1);
  }

  // Scrolling/highlighting is a DOM side effect, not state — an effect is the
  // right place for it, and it never calls setState itself.
  useEffect(() => {
    if (currentIndex >= 0 && matches[currentIndex]) {
      scrollToMatch(matches[currentIndex].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, syncKey]);

  if (!isOpen) return null;

  const goToIndex = (index) => {
    if (matches.length === 0) return;
    const nextIndex = (index + matches.length) % matches.length;
    setCurrentIndex(nextIndex);
    scrollToMatch(matches[nextIndex].id);
  };

  return (
    <div className="flex shrink-0 items-center gap-1.5 border-b border-border bg-surface px-2.5 py-2 sm:px-3">
      <input
        autoFocus
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") goToIndex(currentIndex + (event.shiftKey ? -1 : 1));
          if (event.key === "Escape") toggleMessageSearch();
        }}
        placeholder="Search in this conversation"
        className="min-w-0 flex-1 rounded-full bg-background px-3.5 py-1.5 text-sm outline-none placeholder:text-muted"
      />

      <span className="shrink-0 whitespace-nowrap text-xs tabular-nums text-muted">
        {trimmedQuery ? (matches.length > 0 ? `${currentIndex + 1}/${matches.length}` : "0/0") : ""}
      </span>

      <button
        type="button"
        aria-label="Previous match"
        disabled={matches.length === 0}
        onClick={() => goToIndex(currentIndex - 1)}
        className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-background disabled:opacity-40"
      >
        <ChevronUpIcon className="size-4" />
      </button>
      <button
        type="button"
        aria-label="Next match"
        disabled={matches.length === 0}
        onClick={() => goToIndex(currentIndex + 1)}
        className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-background disabled:opacity-40"
      >
        <ChevronDownIcon className="size-4" />
      </button>
      <button
        type="button"
        aria-label="Close search"
        onClick={toggleMessageSearch}
        className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-background"
      >
        <XIcon className="size-4" />
      </button>
    </div>
  );
}
