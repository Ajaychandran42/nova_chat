import { Button } from "@heroui/react";
import { ChevronLeftIcon, UsersIcon, XIcon } from "lucide-react";
import { useGroupStore } from "../../store/useGroupStore";
import { useSelectedGroup } from "../../hooks/useSelectedGroup";
import { useSelectedConversation } from "../../hooks/useSelectedConversation";
import { ThemePresetPicker } from "../ThemePresetPicker";
import { ThemeToggle } from "../ThemeToggle";

export function GroupChatHeader() {
  const setActiveGroupId = useGroupStore((state) => state.setActiveGroupId);
  const { activeGroup } = useSelectedGroup();
  const { isLargeScreen } = useSelectedConversation();

  if (!activeGroup) return null;

  return (
    <header className="sticky top-0 z-10 flex shrink-0 flex-wrap items-center gap-1 border-b border-border px-1.5 py-1.5 sm:gap-2 sm:px-2 sm:py-2">
      {!isLargeScreen ? (
        <Button
          variant="ghost"
          size="sm"
          isIconOnly
          className="shrink-0"
          onPress={() => setActiveGroupId(null)}
        >
          <ChevronLeftIcon className="size-6" strokeWidth={2.25} />
        </Button>
      ) : null}

      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-lg">
        {activeGroup.avatarEmoji}
      </div>

      <div className="flex-1 text-center sm:text-left">
        <p className="truncate text-[15px] font-semibold leading-tight">{activeGroup.name}</p>
        <p className="flex items-center justify-center gap-1 truncate text-xs text-muted sm:justify-start">
          <UsersIcon className="size-3" strokeWidth={2} />
          {activeGroup.memberCount} members · {activeGroup.isEncrypted ? "🔒 Encrypted" : "🔓 Not encrypted"}
        </p>
      </div>

      <div className="ml-auto flex max-w-full shrink-0 flex-wrap items-center justify-end gap-0.5 sm:gap-1">
        <div className="hidden min-[400px]:contents">
          <ThemePresetPicker />
        </div>

        <ThemeToggle />

        <Button
          variant="ghost"
          size="sm"
          isIconOnly
          className="shrink-0"
          aria-label="Close group"
          onPress={() => setActiveGroupId(null)}
        >
          <XIcon className="size-5.5" strokeWidth={2} aria-hidden />
        </Button>
      </div>
    </header>
  );
}
