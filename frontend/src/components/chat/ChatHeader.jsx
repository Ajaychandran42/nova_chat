import { Avatar, Button } from "@heroui/react";
import { useState } from "react";
import { ChevronLeftIcon, LockIcon, SearchIcon, XIcon } from "lucide-react";
import { getOrCreateKeyPair, publicKeyToBase64 } from "../../lib/e2ee";
import { useAuthStore } from "../../store/useAuthStore";
import { EncryptionInfoModal } from "./EncryptionInfoModal";
import { getAvatarPalette } from "../../lib/utils";
import { AppLogo } from "../AppLogo";
import { AvatarWithOnlineIndicator } from "./AvatarWithOnlineIndicator";

import { ThemePresetPicker } from "../ThemePresetPicker";

import { ThemeToggle } from "../ThemeToggle";

import { useChatStore } from "../../store/useChatStore";
import { useSelectedConversation } from "../../hooks/useSelectedConversation";

export function ChatHeader() {
  const setActiveConversationId = useChatStore((state) => state.setActiveConversationId);
  const toggleMessageSearch = useChatStore((state) => state.toggleMessageSearch);
  const isMessageSearchOpen = useChatStore((state) => state.isMessageSearchOpen);

  const { activeConversation, isLargeScreen } = useSelectedConversation();
  const authUser = useAuthStore((state) => state.authUser);
  const [isSecurityOpen, setIsSecurityOpen] = useState(false);
  const myKeyPair = authUser ? getOrCreateKeyPair(authUser._id) : null;
  const myPublicKey = myKeyPair ? publicKeyToBase64(myKeyPair.publicKey) : "";
  const peerHasKey = Boolean(activeConversation?.peer.publicKey);
  const peerPalette = activeConversation ? getAvatarPalette(activeConversation.peer.name) : null;

  return (
    <header className="sticky top-0 z-10 flex shrink-0 flex-wrap items-center gap-1 border-b border-border px-1.5 py-1.5 sm:gap-2 sm:px-2 sm:py-2">
      {activeConversation && !isLargeScreen ? (
        <Button
          variant="ghost"
          size="sm"
          isIconOnly
          className="shrink-0"
          onPress={() => setActiveConversationId(null)}
        >
          <ChevronLeftIcon className="size-6" strokeWidth={2.25} />
        </Button>
      ) : null}

      {activeConversation ? (
        <>
          <AvatarWithOnlineIndicator isOnline={activeConversation.peer.isOnline ?? true}>
            <Avatar className="size-9 shrink-0">
              <Avatar.Image
                alt={activeConversation.peer.name}
                src={activeConversation.peer.avatarUrl}
              />
              <Avatar.Fallback
                className={`text-sm font-semibold ${peerPalette.bg} ${peerPalette.text}`}
              >
                {activeConversation.peer.initials}
              </Avatar.Fallback>
            </Avatar>
          </AvatarWithOnlineIndicator>

          <div className="flex-1 text-center sm:text-left">
            <p className="truncate text-[15px] font-semibold leading-tight">
              {activeConversation.peer.name}
            </p>
            <p className="truncate text-xs text-muted">
              {activeConversation.peer.isOnline ? (
                <span className="font-medium text-success">Online</span>
              ) : (
                "Offline"
              )}
              <span className="text-muted"> · {peerHasKey ? "🔒 Encrypted" : "⚠️ Not set up"}</span>
            </p>
          </div>
        </>
      ) : (
        <div className="flex flex-1 items-center gap-2.5 sm:text-left">
          <AppLogo size={36} className="rounded-[9px]" />
          <div className="flex-1 text-center sm:text-left">
            <p className="truncate text-[13px] font-medium text-muted">Select a conversation</p>
          </div>
        </div>
      )}

      <div className="ml-auto flex max-w-full shrink-0 flex-wrap items-center justify-end gap-0.5 sm:gap-1">
        <div className="hidden min-[400px]:contents">
          <ThemePresetPicker />
        </div>

        <ThemeToggle />

        {activeConversation ? (
          <Button
            variant="ghost"
            size="sm"
            isIconOnly
            className="shrink-0"
            aria-label="Encryption details"
            onPress={() => setIsSecurityOpen(true)}
          >
            <LockIcon className={`size-5 ${peerHasKey ? "text-success" : "text-warning"}`} strokeWidth={2} aria-hidden />
          </Button>
        ) : null}

        {activeConversation ? (
          <Button
            variant="ghost"
            size="sm"
            isIconOnly
            className="shrink-0"
            aria-label="Search in conversation"
            aria-pressed={isMessageSearchOpen}
            onPress={toggleMessageSearch}
          >
            <SearchIcon className="size-5.5" strokeWidth={2} aria-hidden />
          </Button>
        ) : null}

        {activeConversation ? (
          <Button
            variant="ghost"
            size="sm"
            isIconOnly
            className="shrink-0"
            aria-label="Close chat"
            onPress={() => setActiveConversationId(null)}
          >
            <XIcon className="size-5.5" strokeWidth={2} aria-hidden />
          </Button>
        ) : null}
      </div>
      {isSecurityOpen && activeConversation ? (
        <EncryptionInfoModal
          peerName={activeConversation.peer.name}
          myPublicKey={myPublicKey}
          peerPublicKey={activeConversation.peer.publicKey}
          onClose={() => setIsSecurityOpen(false)}
        />
      ) : null}
    </header>
  );
}
