import { useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  Eye,
  MessageCircle,
  UserCheck,
  UserMinus,
  UserPlus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { CardDefinition } from "@sylve/game";
import type { HeroId } from "@sylve/game/hero-metadata";
import { api } from "@my-better-t-app/backend/convex/_generated/api";
import { showGameError } from "@/components/game/shared";
import { CardUpgradeDialog } from "@/components/decks/card-upgrade-dialog";
import { GuardianAvatar } from "@/components/guardian-avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RankedPlayerDetails } from "./hub-ranking";

export type SocialPlayer = { playerId: string; name: string; profile?: { heroId: HeroId } };

export function PlayerMenu({
  playerId,
  name,
  profile,
  className = "",
  onMessage,
}: SocialPlayer & {
  className?: string;
  onMessage: (player: SocialPlayer) => void;
}) {
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const relation = useQuery(
    api.social.relationship,
    open ? { playerId } : "skip",
  );
  const request = useMutation(api.social.request);
  const accept = useMutation(api.social.accept);
  const remove = useMutation(api.social.remove);

  async function act(
    action: (args: { playerId: string }) => Promise<unknown>,
    message: string,
  ) {
    if (busy) return;
    setBusy(true);
    try {
      await action({ playerId });
      toast.success(message);
    } catch (error) {
      showGameError(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger
          className={`social-avatar ${className}`}
          aria-label={`Actions pour ${name}`}
        >
          <GuardianAvatar heroId={profile?.heroId} />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="social-player-menu"
          side="top"
          align="start"
        >
          <p className="social-menu-name">{name}</p>
          <DropdownMenuItem onClick={() => setProfileOpen(true)}>
            <Eye /> Voir le profil
          </DropdownMenuItem>
          {relation === "none" && (
            <DropdownMenuItem
              disabled={busy}
              onClick={() => void act(request, "Demande d’amitié envoyée.")}
            >
              <UserPlus /> Ajouter aux amis
            </DropdownMenuItem>
          )}
          {relation === "incoming" && (
            <DropdownMenuItem
              disabled={busy}
              onClick={() => void act(accept, "Vous êtes désormais amis.")}
            >
              <UserCheck /> Accepter la demande
            </DropdownMenuItem>
          )}
          {relation === "outgoing" && (
            <DropdownMenuItem
              disabled={busy}
              onClick={() => void act(remove, "Demande annulée.")}
            >
              <X /> Annuler la demande
            </DropdownMenuItem>
          )}
          {relation === "friend" && (
            <>
              <DropdownMenuItem onClick={() => onMessage({ playerId, name, profile })}>
                <MessageCircle /> Envoyer un message
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={busy}
                onClick={() =>
                  void act(remove, "Ce gardien a été retiré de tes amis.")
                }
              >
                <UserMinus /> Retirer des amis
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {profileOpen && (
        <PlayerProfileDialog
          playerId={playerId}
          name={name}
          onClose={() => setProfileOpen(false)}
        />
      )}
    </>
  );
}

function PlayerProfileDialog({
  playerId,
  name,
  onClose,
}: SocialPlayer & { onClose: () => void }) {
  const [card, setCard] = useState<CardDefinition | null>(null);
  const cardTrigger = useRef<HTMLButtonElement>(null);
  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <DialogContent appearance="game" className="social-profile-dialog">
          <DialogTitle>{name}</DialogTitle>
          <DialogDescription>Profil du gardien</DialogDescription>
          <RankedPlayerDetails
            ownerId={playerId}
            onInspect={(selected, trigger) => {
              cardTrigger.current = trigger;
              setCard(selected);
            }}
          />
        </DialogContent>
      </Dialog>
      <CardUpgradeDialog
        entry={card ? { card, copies: 0 } : undefined}
        readOnly
        onClose={() => setCard(null)}
        finalFocus={cardTrigger}
      />
    </>
  );
}
