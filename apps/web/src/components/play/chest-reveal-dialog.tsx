import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Sparkles } from "lucide-react";
import {
  combatTypeLabel,
  maxCardLevel,
  RARITY_LABELS,
  resolveCard,
  upgradeCost,
  upgradeGoldCost,
  type OwnedCard,
} from "@sylve/game";
import {
  chestName,
  type ChestType,
  type LootReveal,
} from "@sylve/game/progression";
import { CardArtwork } from "@/components/decks/card-artwork";
import { CardUpgradeDialog } from "@/components/decks/card-upgrade-dialog";
import { GoldIcon, useGoldBalance } from "@/components/gold-balance";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

export interface ChestReveal {
  rarity: ChestType;
  reveals: LootReveal[];
  gold: number;
}
export function ChestRevealDialog({
  reward,
  collection,
  onUpgrade,
  onClose,
}: {
  reward: ChestReveal | null;
  collection: OwnedCard[] | undefined;
  onUpgrade: (variantId: string) => Promise<unknown>;
  onClose: () => void;
}) {
  const gold = useGoldBalance();
  const popup = useRef<HTMLDivElement>(null);
  const cardTrigger = useRef<HTMLButtonElement>(null);
  const [reveal, setReveal] = useState({ reward, count: 0 });
  const [inspected, setInspected] = useState<string | null>(null);
  const revealedCount = reveal.reward === reward ? reveal.count : 0;
  const entries = new Map(collection?.map((entry) => [entry.card.id, entry]));
  const inspectedReveal = reward?.reveals.find(
    (item) => item.variantId === inspected,
  );
  const inspectedEntry = inspectedReveal
    ? (entries.get(inspectedReveal.variantId) ?? {
        card: resolveCard(inspectedReveal.variantId, inspectedReveal.level),
        copies: inspectedReveal.copies,
      })
    : undefined;

  useEffect(() => {
    setReveal({ reward, count: 0 });
    setInspected(null);
    if (!reward) return;
    const timers = Array.from({ length: reward.reveals.length + 1 }, (_, index) =>
      setTimeout(() => setReveal({ reward, count: index + 1 }), 650 * (index + 1)),
    );
    return () => timers.forEach(clearTimeout);
  }, [reward]);

  function close() {
    setInspected(null);
    onClose();
  }

  return (
    <Dialog
      open={!!reward}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent
        ref={popup}
        initialFocus={popup}
        className="chest-reveal-dialog"
        appearance="game"
        data-rarity={
          reward?.rarity === "bigRare" ? "rare" : (reward?.rarity ?? "common")
        }
      >
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
                <span
                  className="rarity-label"
                  data-rarity={
                    reward.rarity === "bigRare" ? "rare" : reward.rarity
                  }
                >
                  {chestName(reward.rarity)}
                </span>
                <DialogTitle>Le trésor est à toi.</DialogTitle>
                <DialogDescription>
                  {reward.gold.toLocaleString("fr-FR")} pièces d’or et{" "}
                  {reward.reveals.reduce((sum, item) => sum + item.count, 0)}{" "}
                  exemplaires rejoignent ta collection.
                </DialogDescription>
              </div>
            </div>
            <div
              className="chest-reveal-grid"
              role="list"
              aria-label="Récompenses du coffre"
            >
              <div className="chest-reveal-item" role="listitem">
                <ChestRewardCard revealed={revealedCount > 0}>
                  <div
                    className="summon-gold-card"
                    role="img"
                    aria-label={`Carte d’or : ${reward.gold} pièces d’or`}
                  >
                    <span className="summon-gold-eyebrow">Trésor du coffre</span>
                    <GoldIcon />
                    <strong>+{reward.gold.toLocaleString("fr-FR")}</strong>
                    <span>Pièces d’or</span>
                  </div>
                </ChestRewardCard>
              </div>
              {reward.reveals.map((item, index) => {
                const entry = entries.get(item.variantId);
                const card =
                  entry?.card ?? resolveCard(item.variantId, item.level);
                const copies = entry?.copies ?? item.copies;
                const isRevealed = revealedCount > index + 1;
                const canUpgrade =
                  (card.level ?? 1) < maxCardLevel(card.rarity, card.baseId) &&
                  copies >= upgradeCost(card.level ?? 1, card.rarity) &&
                  gold != null &&
                  gold >= upgradeGoldCost(card.level ?? 1, card.rarity);
                return (
                  <div
                    key={item.variantId}
                    className="chest-reveal-item"
                    role="listitem"
                    data-rarity={isRevealed ? card.rarity : undefined}
                  >
                    <ChestRewardCard revealed={isRevealed}>
                      <button
                        type="button"
                        className="workshop-card"
                        data-rarity={card.rarity}
                        style={
                          { "--creature-color": card.color } as CSSProperties
                        }
                        aria-label={`${card.name}, ${combatTypeLabel(card)}, ${card.attack} attaque, ${card.health} points de vie, ${RARITY_LABELS[card.rarity ?? "common"]}, niveau ${card.level ?? 1}, voir les informations`}
                        aria-haspopup="dialog"
                        onClick={(event) => {
                          cardTrigger.current = event.currentTarget;
                          setInspected(item.variantId);
                        }}
                      >
                        <CardArtwork card={card} copies={copies} />
                      </button>
                    </ChestRewardCard>
                    <div className="chest-reveal-caption">
                      {isRevealed && (
                        <>
                          <div className="chest-reveal-meta">
                            <span
                              className="rarity-label"
                              data-rarity={card.rarity}
                            >
                              {RARITY_LABELS[card.rarity ?? "common"]}
                            </span>
                            <span className="chest-loot-quantity">
                              ×{item.count}
                            </span>
                          </div>
                          {item.isNew ? (
                            <span className="loot-new">
                              <Sparkles size={12} />
                              Débloquée !
                            </span>
                          ) : (
                            <small>
                              {canUpgrade
                                ? "Amélioration disponible"
                                : `${copies} exemplaires en réserve`}
                            </small>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </DialogContent>
      <CardUpgradeDialog
        entry={inspectedEntry}
        collection={collection}
        onClose={() => setInspected(null)}
        onUpgrade={onUpgrade}
        finalFocus={cardTrigger}
      />
    </Dialog>
  );
}

function ChestRewardCard({
  revealed,
  children,
}: {
  revealed: boolean;
  children: ReactNode;
}) {
  return (
    <div className="chest-reveal-card">
      <div className={`summon-flip${revealed ? " is-revealed" : ""}`}>
        <div className="summon-card-back" aria-hidden="true">
          <img
            src="/art/ui/summon-card-back.webp"
            alt=""
            width={400}
            height={560}
            draggable={false}
          />
        </div>
        {revealed && <div className="summon-card-front">{children}</div>}
      </div>
    </div>
  );
}
