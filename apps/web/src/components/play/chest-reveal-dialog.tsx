import { Link } from "@tanstack/react-router";
import { Sparkles, ArrowRight } from "lucide-react";
import {
  MAX_CARD_LEVEL,
  RARITY_LABELS,
  resolveCard,
  upgradeCost,
  type CardRarity,
} from "@sylve/game";
import { CHEST_LABELS, type LootReveal } from "@sylve/game/progression";
import { CreatureCard } from "@/components/game/creature-card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

export interface ChestReveal {
  rarity: CardRarity;
  reveals: LootReveal[];
}
export function ChestRevealDialog({
  reward,
  onClose,
}: {
  reward: ChestReveal | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={!!reward}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="chest-reveal-dialog">
        {reward && (
          <>
            <div className="chest-reveal-heading">
              <img
                src={`/art/chests/${reward.rarity}.webp`}
                alt=""
                width={120}
                height={120}
              />
              <div>
                <span className="rarity-label" data-rarity={reward.rarity}>
                  Coffre {CHEST_LABELS[reward.rarity].toLowerCase()}
                </span>
                <DialogTitle>Le trésor est à toi.</DialogTitle>
                <DialogDescription>
                  {reward.reveals.reduce((sum, item) => sum + item.count, 0)}{" "}
                  exemplaires rejoignent ta collection.
                </DialogDescription>
              </div>
            </div>
            <div className="chest-reveal-grid">
              {reward.reveals.map((item, index) => {
                const card = resolveCard(item.variantId, item.level);
                const canUpgrade =
                  item.level < MAX_CARD_LEVEL &&
                  item.copies >= upgradeCost(item.level);
                return (
                  <div
                    key={item.variantId}
                    className="chest-reveal-item"
                    style={{ animationDelay: `${Math.min(index * 65, 650)}ms` }}
                  >
                    <span className="chest-loot-quantity">×{item.count}</span>
                    <CreatureCard card={card} disabled />
                    <strong>{card.name}</strong>
                    <span className="rarity-label" data-rarity={card.rarity}>
                      {RARITY_LABELS[card.rarity!]}
                    </span>
                    {item.isNew ? (
                      <span className="loot-new">
                        <Sparkles size={12} />
                        Débloquée !
                      </span>
                    ) : (
                      <small>
                        {canUpgrade
                          ? "Amélioration disponible"
                          : `${item.copies} exemplaires en réserve`}
                      </small>
                    )}
                  </div>
                );
              })}
            </div>
            <Link className="sylve-button" to="/decks" onClick={onClose}>
              Voir mes compagnons
              <ArrowRight size={17} />
            </Link>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
