import { useNavigate } from "@tanstack/react-router";
import { useCurrentUser } from "@/hooks/use-current-user";
import { ChevronRight } from "lucide-react";
import { CollectionIcon, GameIcon } from "@/components/game/game-icon";

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

export default function UserMenu() {
  const user = useCurrentUser();
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Ouvrir le menu des paramètres"
        title="Paramètres et compte"
        className="sylve-settings-trigger"
      >
        <img
          src="/art/ui/settings-gear.webp"
          alt=""
          aria-hidden="true"
          width={384}
          height={384}
          draggable={false}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={12}
        className="sylve-user-menu"
        aria-label="Menu du gardien"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="sylve-user-identity">
            <span className="sylve-user-emblem" aria-hidden="true">
              <GameIcon kind="guardian" size={34} />
            </span>
            <div>
              <span className="sylve-menu-eyebrow">COMPTE DU GARDIEN</span>
              <strong>{user?.name ?? "Gardien de la Sylve"}</strong>
              <span className="sylve-user-email">{user?.email}</span>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => navigate({ to: "/hub" })}>
            <span className="sylve-menu-icon">
              <GameIcon kind="refuge" size={28} />
            </span>
            <span>
              Le refuge<small>Retrouver la clairière</small>
            </span>
            <ChevronRight className="sylve-menu-chevron" size={14} />
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate({ to: "/decks" })}>
            <span className="sylve-menu-icon">
              <CollectionIcon size={28} />
            </span>
            <span>
              Mon deck<small>Préparer mes compagnons</small>
            </span>
            <ChevronRight className="sylve-menu-chevron" size={14} />
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate({ to: "/sanctuary" })}>
            <span className="sylve-menu-icon">
              <GameIcon kind="sanctuary" size={28} />
            </span>
            <span>
              Le sanctuaire<small>Invoquer des compagnons</small>
            </span>
            <ChevronRight className="sylve-menu-chevron" size={14} />
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate({ to: "/arena" })}>
            <span className="sylve-menu-icon">
              <GameIcon kind="arena" size={28} />
            </span>
            <span>
              L’arène<small>Rejoindre un combat</small>
            </span>
            <ChevronRight className="sylve-menu-chevron" size={14} />
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
            <span className="sylve-menu-icon">
              <GameIcon kind="settings" size={28} />
            </span>
            <span>
              Paramètres<small>Gérer mon compte</small>
            </span>
            <ChevronRight className="sylve-menu-chevron" size={14} />
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
          <span className="sylve-menu-icon">
            <GameIcon kind="logout" size={28} />
          </span>
          Se déconnecter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
