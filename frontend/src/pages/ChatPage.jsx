import { useEffect } from "react";
import { useChatStore } from "../store/useChatStore";
import { useGroupStore } from "../store/useGroupStore";
import { useSelectedConversation } from "../hooks/useSelectedConversation";
import { useSelectedGroup } from "../hooks/useSelectedGroup";
import ChatSidebar from "../components/chat/ChatSidebar";
import { ChatHeader } from "../components/chat/ChatHeader";
import { MessageSearchBar } from "../components/chat/MessageSearchBar";
import { MessageList } from "../components/chat/MessageList";
import { ChatComposer } from "../components/chat/ChatComposer";
import { GroupChatHeader } from "../components/groups/GroupChatHeader";
import { GroupMessageList } from "../components/groups/GroupMessageList";
import { GroupComposer } from "../components/groups/GroupComposer";

function ChatPage() {
  const getConversations = useChatStore((state) => state.getConversations);
  const getMessages = useChatStore((state) => state.getMessages);
  const getUsers = useChatStore((state) => state.getUsers);
  const subscribeToMessages = useChatStore((state) => state.subscribeToMessages);
  const unsubscribeFromMessages = useChatStore((state) => state.unsubscribeFromMessages);

  const getGroups = useGroupStore((state) => state.getGroups);
  const subscribeToGroupEvents = useGroupStore((state) => state.subscribeToGroupEvents);
  const unsubscribeFromGroupEvents = useGroupStore((state) => state.unsubscribeFromGroupEvents);

  const { activeConversation, activeConversationId, isLargeScreen } = useSelectedConversation();
  const { activeGroup, activeGroupId } = useSelectedGroup();

  useEffect(() => {
    getUsers();
    getConversations();
    getGroups();
    subscribeToGroupEvents();
    return () => unsubscribeFromGroupEvents();
  }, [getUsers, getConversations, getGroups, subscribeToGroupEvents, unsubscribeFromGroupEvents]);

  useEffect(() => {
    if (!activeConversationId) return;

    getMessages(activeConversationId);
    subscribeToMessages(activeConversationId);

    // cleanup
    return () => unsubscribeFromMessages();
  }, [getMessages, activeConversationId, subscribeToMessages, unsubscribeFromMessages]);

  const hasActivePane = Boolean(activeConversationId || activeGroupId);

  // Full-screen by default, edge-to-edge on every device — no framed
  // "window" with padding or a max-width, like WhatsApp Web / Telegram.
  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background text-foreground">
      <ChatSidebar />

      <div
        className={`flex-1 flex-col overflow-hidden ${
          !isLargeScreen && !hasActivePane ? "hidden lg:flex" : "flex"
        }`}
      >
        {activeGroupId ? (
          <>
            <GroupChatHeader />
            <GroupMessageList />
            {activeGroup ? <GroupComposer /> : null}
          </>
        ) : (
          <>
            <ChatHeader />
            <MessageSearchBar />
            <MessageList />
            {activeConversation ? <ChatComposer /> : null}
          </>
        )}
      </div>
    </div>
  );
}
export default ChatPage;
