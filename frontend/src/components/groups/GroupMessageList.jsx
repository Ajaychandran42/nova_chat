import useScrollToBottom from "../../hooks/useScrollToBottom";
import { MessageBubble } from "../chat/MessageBubble";
import { NoConversationPlaceholder } from "../chat/NoConversationPlaceholder";
import { useSelectedGroup } from "../../hooks/useSelectedGroup";
import { useGroupStore } from "../../store/useGroupStore";

export function GroupMessageList() {
  const { activeGroup, activeGroupId } = useSelectedGroup();
  const isLoading = useGroupStore((state) => state.isGroupMessagesLoading);
  const setReplyingTo = useGroupStore((state) => state.setReplyingTo);
  const reactToGroupMessage = useGroupStore((state) => state.reactToGroupMessage);
  const deleteGroupMessage = useGroupStore((state) => state.deleteGroupMessage);
  const editGroupMessage = useGroupStore((state) => state.editGroupMessage);

  const lastMessageId = activeGroup?.messages.at(-1)?.id;
  const messagesScrollRef = useScrollToBottom(activeGroupId, lastMessageId);

  if (!activeGroup) return <NoConversationPlaceholder />;

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <div
        ref={messagesScrollRef}
        className="flex flex-1 flex-col gap-1 overflow-y-auto overscroll-contain px-2 py-3 sm:px-3 sm:py-4"
      >
        <div className="mb-3 flex justify-center">
          <span className="rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-muted">
            {activeGroup.messages.length === 0 ? "No messages yet — say hi 👋" : "Today"}
          </span>
        </div>
        {activeGroup.messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            senderName={message.senderName}
            onReply={setReplyingTo}
            onReact={reactToGroupMessage}
            onDelete={deleteGroupMessage}
            onEdit={editGroupMessage}
          />
        ))}
        {isLoading ? <p className="text-center text-xs text-muted">Loading messages…</p> : null}
      </div>
    </div>
  );
}
