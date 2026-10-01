import { lazy, Suspense, useState } from "react";
import { getInitials, useSelectedConversation } from "../../hooks/useSelectedConversation";
import { useAuthStore } from "../../store/useAuthStore";
import { useChatStore } from "../../store/useChatStore";
import { useGroupStore } from "../../store/useGroupStore";
import {
  UNDECRYPTABLE_TEXT,
  decryptDmMessage,
  decryptGroupMessage,
  getOrCreateKeyPair,
  groupKeyFor,
} from "../../lib/e2ee";
import { APP_NAME, AppLogo } from "../AppLogo";
import { UserButton } from "@clerk/react";

import { SearchField, Tabs } from "@heroui/react";
import { MessageSquareIcon, PlusIcon, UsersIcon, Users2Icon } from "lucide-react";
import { ConversationRow } from "./ConversationRow";
import { GroupRow } from "./GroupRow";
const GroupCreateModal = lazy(() =>
  import("./GroupCreateModal").then((m) => ({ default: m.GroupCreateModal })),
);

// The server only ever holds ciphertext for the last-message preview, so
// decrypt it here (media-only messages have empty text and fall back to
// "📷 Photo" etc. in the row).
function decryptPreview(user, mySecretKey) {
  if (!user.lastMessage?.isEncrypted) return user.lastMessage;
  const { text, failed } = decryptDmMessage(user.lastMessage, user.publicKey, mySecretKey);
  return { ...user.lastMessage, text: failed ? UNDECRYPTABLE_TEXT : text };
}

// Same idea for a group's last-message preview, so the search box below can
// match against it too — "search across all chats" means the content, not
// just who/what it's named.
function groupPreviewText(group, mySecretKey) {
  const lastMessage = group.lastMessage;
  if (!lastMessage || lastMessage.isDeleted) return "";
  if (!lastMessage.isEncrypted) return lastMessage.text || "";
  const { key } = groupKeyFor(group, mySecretKey);
  const { text, failed } = decryptGroupMessage(lastMessage, key);
  return failed ? "" : text;
}

function mapUserForList(user, onlineUsers, mySecretKey) {
  return {
    conversationId: user._id,
    id: user._id,
    name: user.fullName,
    avatarUrl: user.profilePic,
    initials: getInitials(user.fullName),
    isOnline: onlineUsers.includes(user._id),
    lastMessage: decryptPreview(user, mySecretKey),
    unreadCount: user.unreadCount,
    peer: {
      name: user.fullName,
      avatarUrl: user.profilePic,
      initials: getInitials(user.fullName),
      isOnline: onlineUsers.includes(user._id),
    },
  };
}

function ChatSidebar() {
  const conversations = useChatStore((state) => state.conversations);
  const users = useChatStore((state) => state.users);

  const searchQuery = useChatStore((state) => state.searchQuery);
  const setSearchQuery = useChatStore((state) => state.setSearchQuery);

  const sidebarTab = useChatStore((state) => state.sidebarTab);
  const setSidebarTab = useChatStore((state) => state.setSidebarTab);

  const setActiveConversationId = useChatStore((state) => state.setActiveConversationId);

  const groups = useGroupStore((state) => state.groups);
  const activeGroupId = useGroupStore((state) => state.activeGroupId);
  const setActiveGroupId = useGroupStore((state) => state.setActiveGroupId);

  const onlineUsers = useAuthStore((state) => state.onlineUsers);

  const authUser = useAuthStore((state) => state.authUser);

  const mySecretKey = authUser ? getOrCreateKeyPair(authUser._id)?.secretKey : null;

  const { activeConversationId, isLargeScreen } = useSelectedConversation();
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

  const conversationUsers = conversations.map((user) => mapUserForList(user, onlineUsers, mySecretKey));
  const allUsers = users.map((user) => mapUserForList(user, onlineUsers, mySecretKey));

  // The search box matches on name OR the (decrypted) last message, across
  // whichever tab you're on — so it doubles as a search across all your
  // chats' recent content, not just contact/group names.
  const filteredConversations = normalizedSearchQuery
    ? conversationUsers.filter(
        (conversation) =>
          conversation.peer.name.toLowerCase().includes(normalizedSearchQuery) ||
          (conversation.lastMessage?.text || "").toLowerCase().includes(normalizedSearchQuery),
      )
    : conversationUsers;

  const filteredUsers = normalizedSearchQuery
    ? allUsers.filter((user) => user.name.toLowerCase().includes(normalizedSearchQuery))
    : allUsers;

  const filteredGroups = normalizedSearchQuery
    ? groups.filter(
        (group) =>
          group.name.toLowerCase().includes(normalizedSearchQuery) ||
          groupPreviewText(group, mySecretKey).toLowerCase().includes(normalizedSearchQuery),
      )
    : groups;

  const selectConversation = (id) => {
    setActiveGroupId(null);
    setActiveConversationId(id);
  };

  const selectGroup = (id) => {
    setActiveConversationId(null);
    setActiveGroupId(id);
  };

  const hasActiveThread = Boolean(activeConversationId || activeGroupId);

  return (
    <aside
      className={`w-full shrink-0 flex-col overflow-hidden border-r border-border lg:w-72 ${
        !isLargeScreen && hasActiveThread ? "hidden lg:flex" : "flex"
      }`}
    >
      <div className="shrink-0 border-b border-border px-2 pb-2 pt-2.5 sm:px-3 sm:pt-3">
        <div className="flex items-center gap-2.5 px-0.5 sm:gap-3 sm:px-1">
          <AppLogo size={32} className="size-8 shrink-0 rounded-[9px] sm:size-8.5" alt="" />
          <div className="min-w-0 flex-1">
            <p className="font-display truncate text-[18px] font-semibold leading-tight tracking-tight sm:text-xl">
              {APP_NAME}
            </p>
            <p className="truncate text-xs font-medium leading-tight text-success">Online</p>
          </div>
          <UserButton
            appearance={{
              elements: {
                avatarBox: "size-8",
              },
            }}
          />
        </div>
      </div>

      <Tabs
        selectedKey={sidebarTab}
        onSelectionChange={(key) => setSidebarTab(String(key))}
        variant="secondary"
        className="flex flex-1 flex-col overflow-y-auto"
      >
        <div className="shrink-0 border-b border-border px-3 pb-2 pt-2">
          <SearchField
            fullWidth
            variant="secondary"
            className="w-full"
            value={searchQuery}
            onChange={setSearchQuery}
          >
            <SearchField.Group className="rounded-full bg-surface">
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Search chats" />
              {searchQuery ? <SearchField.ClearButton /> : null}
            </SearchField.Group>
          </SearchField>
        </div>

        <Tabs.ListContainer className="shrink-0 border-b border-border px-2 pb-2 pt-1">
          <Tabs.List className="w-full gap-0.5">
            <Tabs.Tab id="chats" className="flex-1 justify-center gap-1.5">
              <MessageSquareIcon className="size-3.5 opacity-80" aria-hidden />
              Chats
            </Tabs.Tab>
            <Tabs.Tab id="groups" className="flex-1 justify-center gap-1.5">
              <Users2Icon className="size-3.5 opacity-80" aria-hidden />
              Groups
            </Tabs.Tab>
            <Tabs.Tab id="users" className="flex-1 justify-center gap-1.5">
              <UsersIcon className="size-3.5 opacity-80" aria-hidden />
              Users
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel
          id="chats"
          className="flex-1 space-y-0.5 overflow-x-hidden overflow-y-auto px-1.5 py-1.5 outline-none sm:px-2"
        >
          {filteredConversations.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted">
              Nothing here matches that — try a different name or word.
            </p>
          ) : (
            filteredConversations.map((conversation) => (
              <ConversationRow
                key={conversation.id}
                user={conversation}
                selected={conversation.id === activeConversationId}
                onSelect={() => selectConversation(conversation.id)}
              />
            ))
          )}
        </Tabs.Panel>

        <Tabs.Panel
          id="groups"
          className="flex-1 space-y-0.5 overflow-x-hidden overflow-y-auto px-1.5 py-1.5 outline-none sm:px-2"
        >
          <button
            type="button"
            onClick={() => setIsCreatingGroup(true)}
            className="mb-1 flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left text-accent hover:bg-surface/70 sm:px-3"
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent/15">
              <PlusIcon className="size-5" />
            </span>
            <span className="text-[15px] font-semibold">New group</span>
          </button>

          {filteredGroups.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted">
              No groups yet — create one to get started.
            </p>
          ) : (
            filteredGroups.map((group) => (
              <GroupRow
                key={group._id}
                group={group}
                selected={group._id === activeGroupId}
                onSelect={() => selectGroup(group._id)}
              />
            ))
          )}
        </Tabs.Panel>

        <Tabs.Panel
          id="users"
          className="flex-1 space-y-0.5 overflow-x-hidden overflow-y-auto px-1.5 py-1.5 outline-none sm:px-2"
        >
          {filteredUsers.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted">No one matches that name.</p>
          ) : (
            filteredUsers.map((user) => (
              <ConversationRow
                key={user.conversationId}
                user={user}
                selected={user.conversationId === activeConversationId}
                onSelect={() => selectConversation(user.conversationId)}
              />
            ))
          )}
        </Tabs.Panel>
      </Tabs>

      {isCreatingGroup ? (
        <Suspense fallback={null}>
          <GroupCreateModal
            onClose={() => setIsCreatingGroup(false)}
            onCreated={(groupId) => {
              setIsCreatingGroup(false);
              setSidebarTab("groups");
              selectGroup(groupId);
            }}
          />
        </Suspense>
      ) : null}
    </aside>
  );
}
export default ChatSidebar;
