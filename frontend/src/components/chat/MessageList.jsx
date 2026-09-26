import useScrollToBottom from "../../hooks/useScrollToBottom";
import { MessageBubble } from "./MessageBubble";
import { NoConversationPlaceholder } from "./NoConversationPlaceholder";
import { useSelectedConversation } from "../../hooks/useSelectedConversation";
import { useChatStore } from "../../store/useChatStore";

function TypingBubble() {
  return (
    <div className="flex w-full justify-start">
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-border bg-surface px-4 py-3">
        {[0, 1, 2].map((dot) => (
          <span
            key={dot}
            className="size-1.5 animate-bounce rounded-full bg-muted"
            style={{ animationDelay: `${dot * 120}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

export function MessageList() {
  const { activeConversation, activeConversationId } = useSelectedConversation();
  const typingUserIds = useChatStore((state) => state.typingUserIds);
  const isPeerTyping = activeConversationId
    ? typingUserIds.includes(activeConversationId)
    : false;

  const lastMessageId = activeConversation?.messages.at(-1)?.id;
  const messagesScrollRef = useScrollToBottom(activeConversationId, lastMessageId, isPeerTyping);

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      {activeConversation ? (
        <div
          ref={messagesScrollRef}
          className="flex flex-1 flex-col gap-1 overflow-y-auto overscroll-contain px-2 py-3 sm:px-3 sm:py-4"
        >
          <div className="mb-3 flex justify-center">
            <span className="rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-muted">
              Today
            </span>
          </div>
          {activeConversation.messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          {isPeerTyping ? <TypingBubble /> : null}
        </div>
      ) : (
        <NoConversationPlaceholder />
      )}
    </div>
  );
}
