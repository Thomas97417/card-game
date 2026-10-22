import { useState } from "react";
import {
  ArrowRight,
  ArrowUp,
  ArrowRightLeft,
  Plus,
  Minus,
  Layers3,
} from "lucide-react";
import {
  MAX_CARD_LEVEL,
  RARITY_LABELS,
  resolveCard,
  upgradeCost,
  type OwnedCard,
} from "@sylve/game";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { CreaturePortrait } from "@/components/game/creature-portrait";
import { StatBadge } from "@/components/game/stat-badge";
import { showGameError } from "@/components/game/shared";

export function CardUpgradeDialog({
  entry,
  inDeck,
  canRemove,
  hasSpace,
  onClose,
  onUpgrade,
  onAdd,
  onRemove,
  onMove,
}: {
  entry: OwnedCard | undefined;
  inDeck: boolean;
  canRemove: boolean;
  hasSpace: boolean;
  onClose: () => void;
  onUpgrade: (variantId: string) => Promise<unknown>;
  onAdd: () => void;
  onRemove: () => void;
  onMove: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const card = entry?.card;
  const level = card?.level ?? 1;
  const max = level >= MAX_CARD_LEVEL;
  const cost = upgradeCost(level);
  const next = card && !max ? resolveCard(card.id, level + 1) : null;
  async function upgrade() {
    if (!card || busy) return;
    setBusy(true);
    try {
      await onUpgrade(card.id);
    } catch (error) {
      showGameError(error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={!!entry}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="upgrade-dialog">
        {card && entry && (
          <>
            <span
              className="rarity-label"
              data-rarity={card.rarity ?? "common"}
            >
              {RARITY_LABELS[card.rarity ?? "common"]} · Niveau {level}
            </span>
            <DialogTitle>{card.name}</DialogTitle>
            <DialogDescription>{card.title}</DialogDescription>
            <div className="upgrade-preview">
              <div
                className="upgrade-portrait"
                data-rarity={card.rarity ?? "common"}
              >
                <CreaturePortrait card={card} />
              </div>
              <div className="upgrade-statistics">
                <span>Caractéristiques</span>
                <div>
                  <StatBadge
                    kind="attack"
                    value={card.attack}
                    combatType={card.combatType}
                  />
                  {next && (
                    <>
                      <ArrowRight size={15} />
                      <strong>{next.attack}</strong>
                    </>
                  )}
                </div>
                <div>
                  <StatBadge kind="health" value={card.health} />
                  {next && (
                    <>
                      <ArrowRight size={15} />
                      <strong>{next.health}</strong>
                    </>
                  )}
                </div>
                {next && <small>Au niveau {level + 1}</small>}
              </div>
            </div>
            <div className="upgrade-copies">
              <Layers3 size={18} />
              <span>
                {entry.copies}{" "}
                {max ? "exemplaires en réserve" : `/ ${cost} exemplaires`}
              </span>
            </div>
            <progress
              className="upgrade-progress"
              max={max ? Math.max(1, entry.copies) : cost}
              value={entry.copies}
              aria-label="Exemplaires pour le prochain niveau"
            />
            <button
              className="sylve-button upgrade-action"
              disabled={busy || max || entry.copies < cost}
              onClick={() => void upgrade()}
            >
              <ArrowUp size={18} />
              {busy
                ? "Amélioration…"
                : max
                  ? "Niveau maximal atteint"
                  : `Améliorer au niveau ${level + 1}`}
            </button>
            {!max && (
              <p className="upgrade-help">
                L’amélioration consomme {cost} exemplaires de cette variante.
              </p>
            )}
            <div className="upgrade-deck-actions">
              {inDeck ? (
                <>
                  <button className="sylve-button secondary" onClick={onMove}>
                    <ArrowRightLeft size={16} />
                    Déplacer dans le deck
                  </button>
                  <button
                    className="sylve-button secondary"
                    disabled={!canRemove}
                    onClick={onRemove}
                  >
                    <Minus size={16} />
                    Retirer du deck
                  </button>
                </>
              ) : (
                <button
                  className="sylve-button secondary"
                  onClick={hasSpace ? onAdd : onMove}
                >
                  {hasSpace ? <Plus size={16} /> : <ArrowRightLeft size={16} />}
                  {hasSpace ? "Ajouter au deck" : "Remplacer une carte"}
                </button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
