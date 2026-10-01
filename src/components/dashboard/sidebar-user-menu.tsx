"use client";

import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Keyboard } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/user-avatar";
import { useKeyboardShortcuts } from "@/components/shortcuts/keyboard-shortcuts-context";
import { cn } from "@/lib/utils";

type SidebarUserMenuProps = {
  user: {
    name: string;
    email: string;
    image: string | null;
    isPro: boolean;
  };
};

export function SidebarUserMenu({ user }: SidebarUserMenuProps) {
  const router = useRouter();
  const { openShortcutsDialog } = useKeyboardShortcuts();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "group-data-[collapsed]:justify-center flex w-full items-center gap-3 rounded-lg p-1 text-left outline-none",
          "hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring",
        )}
        aria-label="Account menu"
      >
        <UserAvatar name={user.name} image={user.image} size="sm" />
        <div className="sidebar-text group-data-[collapsed]:hidden min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-sm font-medium">
            <span className="truncate">{user.name}</span>
            {user.isPro ? (
              <Badge
                variant="secondary"
                className="h-4 shrink-0 px-1 text-[10px] font-semibold uppercase tracking-wide"
              >
                Pro
              </Badge>
            ) : null}
          </p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-52">
        <DropdownMenuItem onClick={() => router.push("/profile")}>
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/settings")}>
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem onClick={openShortcutsDialog}>
          <Keyboard className="size-4 shrink-0" />
          Keyboard shortcuts
        </DropdownMenuItem>
        {!user.isPro ? (
          <DropdownMenuItem onClick={() => router.push("/upgrade")}>
            Upgrade to Pro
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => signOut({ callbackUrl: "/sign-in" })}
        >
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
