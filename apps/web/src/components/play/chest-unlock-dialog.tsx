import { Hourglass, Sparkles } from "lucide-react";
import { chestName, chestRushCost } from "@sylve/game/progression";
import { EmeraldAmount } from "@/components/emerald-balance";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { remainingTime, type LobbyChest } from "./play-lobby";

export function ChestUnlockDialog({
  chest,
  now,
  emeralds,
  busy,
  onOpen,
  onClose,
}: {
  chest: LobbyChest | null;
  now: number;
  emeralds: number | null | undefined;
  busy: boolean;
  onOpen: (maxEmeralds: number) => void;
  onClose: () => void;
}) {
  const cost = chest ? chestRushCost(chest, now) : 0;
  const insufficient = cost > 0 && emeralds != null && emeralds < cost;
  return (
    <Dialog
      open={!!chest}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        className="chest-unlock-dialog"
        appearance="game"
        data-rarity={chest?.rarity === "bigRare" ? "rare" : chest?.rarity}
      >
        {chest && (
          <>
            <img
              className="chest-unlock-art"
              src={`/art/chests/${chest.rarity}.webp`}
              alt=""
              width={160}
              height={160}
            />
            <DialogTitle>{chestName(chest.rarity)}</DialogTitle>
            <DialogDescription>
              {cost > 0
                ? "Attends la fin du compte à rebours ou ouvre ton coffre dès maintenant avec des émeraudes."
                : "Ton coffre est prêt. Tu peux l’ouvrir gratuitement."}
            </DialogDescription>
            {cost > 0 && (
              <>
                <p className="chest-unlock-timer">
                  <Hourglass size={17} />
                  Ouverture gratuite dans{" "}
                  <time>{remainingTime(chest.unlockAt - now)}</time>
                </p>
                <p className="chest-unlock-note">
                  Le prix diminue avec le temps restant.
                </p>
              </>
            )}
            {insufficient && (
              <p className="chest-unlock-note" role="status">
                Il te manque {(cost - emeralds!).toLocaleString("fr-FR")}{" "}
                émeraude{cost - emeralds! > 1 ? "s" : ""}.
              </p>
            )}
            <button
              className="sylve-button"
              type="button"
              disabled={busy || insufficient || (cost > 0 && emeralds == null)}
              onClick={() => onOpen(cost)}
              aria-label={
                cost > 0
                  ? `Ouvrir maintenant pour ${cost} émeraudes`
                  : "Ouvrir gratuitement"
              }
            >
              <Sparkles size={17} />
              {cost > 0 ? (
                <>
                  Ouvrir maintenant <EmeraldAmount amount={cost} />
                </>
              ) : (
                "Ouvrir gratuitement"
              )}
            </button>
            <button
              className="sylve-button secondary"
              type="button"
              disabled={busy}
              onClick={onClose}
            >
              {cost > 0 ? "Continuer à attendre" : "Fermer"}
            </button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
