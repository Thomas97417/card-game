import { useNavigate } from "@tanstack/react-router";
import { useCurrentUser } from "@/hooks/use-current-user";
import { LogOut, Map, Settings, User } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

import { Button } from "./ui/button";

export default function UserMenu({
  overlay = false,
}: { overlay?: boolean } = {}) {
  const user = useCurrentUser();
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Mon compte"
        render={
          <Button
            variant="outline"
            className={cn(
              "flex items-center gap-2 px-2",
              overlay &&
                "size-11 rounded-full border-[#d1be85]/70 bg-[#1a3026]/90 p-0 text-[#f1d28b] shadow-lg backdrop-blur-sm hover:bg-[#304a31] hover:text-[#fff6dd] focus-visible:ring-[#e9ca82] dark:bg-[#1a3026]/90 dark:hover:bg-[#304a31]",
            )}
          />
        }
      >
        <User className="size-4 shrink-0" />
        {!overlay && (
          <span className="hidden max-w-32 truncate text-sm font-medium sm:inline-block">
            {user?.name}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={cn(
          "w-56 bg-card",
          overlay &&
            "rounded-xl border border-[#c2b489] bg-[#f8f6ee] p-1 text-[#283e33] [--muted-foreground:#697664] [--muted:#e8eadf] [--foreground:#283e33]",
        )}
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium leading-none">{user?.name}</p>
              <p className="text-muted-foreground text-xs leading-none">
                {user?.email}
              </p>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {!overlay && (
            <>
              <DropdownMenuItem onClick={() => navigate({ to: "/hub" })}>
                <Map className="mr-2 size-4" />
                Mon refuge
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate({ to: "/arena" })}>
                <User className="mr-2 size-4" />
                Arène
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
            <Settings className="mr-2 size-4" />
            Paramètres
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => {
            authClient.signOut({
              fetchOptions: {
                onSuccess: () => {
                  navigate({ to: "/" });
                  location.reload();
                },
              },
            });
          }}
        >
          <LogOut className="mr-2 size-4" />
          Se déconnecter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
