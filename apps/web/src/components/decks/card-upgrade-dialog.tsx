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
  upgradeGoldCost,
  combatTypeLabel,
  getCombatType,
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
import { GameIcon } from "@/components/game/game-icon";
import { showGameError } from "@/components/game/shared";
import { GoldAmount, useGoldBalance } from "@/components/gold-balance";

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
  const gold = useGoldBalance();
  const card = entry?.card;
  const level = card?.level ?? 1;
  const max = level >= MAX_CARD_LEVEL;
  const cost = upgradeCost(level);
  const goldCost = upgradeGoldCost(level);
  const enoughGold = gold != null && gold >= goldCost;
  const next = card && !max ? resolveCard(card.id, level + 1) : null;
  async function upgrade() {
    if (!card || busy || max || !entry || entry.copies < cost || !enoughGold)
      return;
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
      <DialogContent
        className="upgrade-dialog"
        appearance="game"
        data-rarity={card?.rarity ?? "common"}
      >
        {card && entry && (
          <>
            <span className="eyebrow upgrade-eyebrow">
              {inDeck ? "TON COMPAGNON" : "TA COLLECTION"}
            </span>
            <DialogTitle>{card.name}</DialogTitle>
            <DialogDescription>{card.title}</DialogDescription>
            <div className="upgrade-meta">
              <span
                className="rarity-label"
                data-rarity={card.rarity ?? "common"}
              >
                {RARITY_LABELS[card.rarity ?? "common"]} · Niveau {level}
              </span>
              <span className="upgrade-combat-type">
                <GameIcon kind={getCombatType(card)} size={18} />
                {combatTypeLabel(card)}
              </span>
            </div>
            <div className="upgrade-preview">
              <div
                className="upgrade-portrait"
                data-rarity={card.rarity ?? "common"}
              >
                <CreaturePortrait card={card} />
              </div>
              <div className="upgrade-statistics">
                <span>Caractéristiques</span>
                <div className="upgrade-stat">
                  <span>Attaque</span>
                  <div>
                    <StatBadge
                      kind="attack"
                      value={card.attack}
                      combatType={getCombatType(card)}
                    />
                    {next && (
                      <>
                        <ArrowRight size={15} aria-hidden="true" />
                        <strong
                          aria-label={`${next.attack} au niveau ${level + 1}`}
                        >
                          {next.attack}
                        </strong>
                      </>
                    )}
                  </div>
                </div>
                <div className="upgrade-stat">
                  <span>Vie maximale</span>
                  <div>
                    <StatBadge kind="health" value={card.health} />
                    {next && (
                      <>
                        <ArrowRight size={15} aria-hidden="true" />
                        <strong
                          aria-label={`${next.health} au niveau ${level + 1}`}
                        >
                          {next.health}
                        </strong>
                      </>
                    )}
                  </div>
                </div>
                {next && <small>Au niveau {level + 1}</small>}
              </div>
            </div>
            <div className="upgrade-resources">
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
              {!max && (
                <div className="upgrade-gold" data-insufficient={!enoughGold}>
                  <span>Coût en or</span>
                  <GoldAmount amount={goldCost} />
                  <small>
                    {gold == null
                      ? "Chargement du solde…"
                      : `${gold.toLocaleString("fr-FR")} en réserve`}
                  </small>
                </div>
              )}
            </div>
            <button
              className="sylve-button upgrade-action"
              disabled={busy || max || entry.copies < cost || !enoughGold}
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
                L’amélioration consomme {cost} exemplaires et {goldCost} pièces
                d’or.
                {entry.copies >= cost && gold != null && !enoughGold && (
                  <span className="upgrade-shortage">
                    Il te manque {(goldCost - gold).toLocaleString("fr-FR")}{" "}
                    {goldCost - gold === 1 ? "pièce" : "pièces"} d’or.
                  </span>
                )}
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
