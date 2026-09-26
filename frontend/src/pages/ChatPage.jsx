import { useChatStore } from "../store/useChatStore";
import { useSelectedConversation } from "../hooks/useSelectedConversation";
import { useEffect } from "react";
import ChatSidebar from "../components/chat/ChatSidebar";
import { ChatHeader } from "../components/chat/ChatHeader";
import { MessageList } from "../components/chat/MessageList";
import { ChatComposer } from "../components/chat/ChatComposer";

function ChatPage() {
  const getConversations = useChatStore((state) => state.getConversations);
  const getMessages = useChatStore((state) => state.getMessages);
  const getUsers = useChatStore((state) => state.getUsers);
  const subscribeToMessages = useChatStore((state) => state.subscribeToMessages);
  const unsubscribeFromMessages = useChatStore((state) => state.unsubscribeFromMessages);

  const { activeConversation, activeConversationId, isLargeScreen } = useSelectedConversation();

  useEffect(() => {
    getUsers();
    getConversations();
  }, [getConversations, getUsers]);

  useEffect(() => {
    if (!activeConversationId) return;

    getMessages(activeConversationId);
    subscribeToMessages(activeConversationId);

    // cleanup
    return () => unsubscribeFromMessages();
  }, [getMessages, activeConversationId, subscribeToMessages, unsubscribeFromMessages]);

  // Full-screen by default, edge-to-edge on every device — no framed
  // "window" with padding or a max-width, like WhatsApp Web / Telegram.
  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background text-foreground">
      <ChatSidebar />

      <div
        className={`flex-1 flex-col overflow-hidden ${
          !isLargeScreen && !activeConversationId ? "hidden lg:flex" : "flex"
        }`}
      >
        <ChatHeader />
        <MessageList />

        {activeConversation ? <ChatComposer /> : null}
      </div>
    </div>
  );
}
export default ChatPage;
