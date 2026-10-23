import { useState } from "react";
import {
  ArrowRight,
  ArrowUp,
  ArrowRightLeft,
  Check,
  Crown,
  Plus,
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
  FACTION_LABELS,
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
import { CardAbilities } from "@/components/game/card-abilities";
import { CardAbilityIcons } from "@/components/game/ability-icons";

export function CardUpgradeDialog({
  entry,
  inDeck,
  hasSpace,
  onClose,
  onUpgrade,
  onAdd,
  onMove,
}: {
  entry: OwnedCard | undefined;
  inDeck: boolean;
  hasSpace: boolean;
  onClose: () => void;
  onUpgrade: (variantId: string) => Promise<unknown>;
  onAdd: () => void;
  onMove: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const gold = useGoldBalance();
  const card = entry?.card;
  const level = card?.level ?? 1;
  const max = level >= MAX_CARD_LEVEL;
  const cost = upgradeCost(level, card?.rarity);
  const goldCost = upgradeGoldCost(level, card?.rarity);
  const enoughGold = gold != null && gold >= goldCost;
  const next = card && !max ? resolveCard(card.id, level + 1) : null;
  const actionLabel = busy
    ? "Amélioration…"
    : max
      ? "Niveau maximal atteint"
      : `Améliorer au niveau ${level + 1}`;

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
          <div className="upgrade-showcase">
            <div className="upgrade-portrait">
              <div className="upgrade-portrait-stats">
                <StatBadge
                  kind="attack"
                  value={card.attack}
                  combatType={getCombatType(card)}
                />
                <StatBadge kind="health" value={card.health} />
              </div>
              <span className="upgrade-card-level">Niv. {level}</span>
              <CreaturePortrait card={card} />
              <CardAbilityIcons
                card={card}
                className="upgrade-portrait-abilities"
              />
              <div className="upgrade-portrait-caption">
                <span
                  className="rarity-label"
                  data-rarity={card.rarity ?? "common"}
                >
                  {RARITY_LABELS[card.rarity ?? "common"]}
                </span>
                <span className="upgrade-portrait-name" aria-hidden="true">
                  {card.name}
                </span>
                <span className="upgrade-card-type">
                  <GameIcon kind={getCombatType(card)} size={18} />
                  {combatTypeLabel(card)}
                  {card.faction && ` · ${FACTION_LABELS[card.faction]}`}
                </span>
              </div>
            </div>

            <div className="upgrade-main">
              <header className="upgrade-heading">
                <div className="upgrade-name-banner">
                  <DialogTitle>{card.name}</DialogTitle>
                </div>
                <DialogDescription>{card.title}</DialogDescription>
              </header>

              <section
                className="upgrade-progression"
                aria-label="Progression de la carte"
                data-ready={max || entry.copies >= cost}
              >
                <div className="upgrade-section-heading">
                  <h3>{max ? "Évolution accomplie" : "Évolution"}</h3>
                  <span>
                    {max ? "Niveau maximal" : `Vers le niveau ${level + 1}`}
                  </span>
                </div>
                <div className="upgrade-progress-track">
                  <progress
                    className="upgrade-progress"
                    max={max ? Math.max(1, entry.copies) : cost}
                    value={max ? Math.max(1, entry.copies) : entry.copies}
                    aria-label={
                      max
                        ? "Niveau maximal atteint"
                        : "Exemplaires pour le prochain niveau"
                    }
                  />
                  <span className="upgrade-copies">
                    <img
                      className="upgrade-copies-icon"
                      src={`/art/ui/rarity-${card.rarity ?? "common"}.webp`}
                      width={18}
                      height={24}
                      alt=""
                      aria-hidden="true"
                      draggable={false}
                    />
                    <span>
                      {max
                        ? `Niveau ${level} / ${MAX_CARD_LEVEL}`
                        : `${entry.copies} / ${cost} exemplaires`}
                    </span>
                  </span>
                  <span className="upgrade-next-level" aria-hidden="true">
                    {max ? <Crown size={23} /> : level + 1}
                  </span>
                </div>
                <p className="upgrade-progress-note">
                  {max
                    ? `${entry.copies} ${entry.copies === 1 ? "exemplaire" : "exemplaires"} en réserve`
                    : entry.copies >= cost
                      ? "Exemplaires réunis pour le prochain niveau"
                      : `Encore ${cost - entry.copies} ${cost - entry.copies === 1 ? "exemplaire" : "exemplaires"} à collectionner`}
                </p>
              </section>

              <section
                className="upgrade-statistics"
                aria-label="Caractéristiques"
              >
                <div className="upgrade-section-heading">
                  <h3>Caractéristiques</h3>
                  <span>
                    {next ? `Niv. ${level} → ${level + 1}` : `Niv. ${level}`}
                  </span>
                </div>
                <dl className="upgrade-stats">
                  {(
                    [
                      { kind: "attack", label: "Attaque" },
                      { kind: "health", label: "Vie maximale" },
                    ] as const
                  ).map(({ kind, label }) => (
                    <div className="upgrade-stat" key={kind}>
                      <dt>{label}</dt>
                      <dd>
                        <StatBadge
                          kind={kind}
                          value={card[kind]}
                          combatType={getCombatType(card)}
                        />
                        {next && (
                          <>
                            <ArrowRight size={16} aria-hidden="true" />
                            <strong
                              className="upgrade-stat-next"
                              aria-label={`${next[kind]} au niveau ${level + 1}`}
                            >
                              {next[kind]}
                            </strong>
                          </>
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>

              <CardAbilities card={card} next={next} />

              <div className="upgrade-evolution-action">
                <div className="upgrade-section-heading">
                  <h3>{max ? "Niveau maximal" : "Prochaine amélioration"}</h3>
                  {next && (
                    <span
                      className="upgrade-gains"
                      aria-label="Gains au prochain niveau"
                    >
                      <span>
                        +{next.attack - card.attack}
                        <GameIcon kind={getCombatType(card)} size={20} />
                      </span>
                      <span>
                        +{next.health - card.health}
                        <GameIcon kind="health" size={20} />
                      </span>
                    </span>
                  )}
                </div>
                <button
                  className="sylve-button upgrade-action"
                  disabled={busy || max || entry.copies < cost || !enoughGold}
                  aria-label={actionLabel}
                  onClick={() => void upgrade()}
                >
                  <span className="upgrade-action-label">
                    {max ? <Crown size={19} /> : <ArrowUp size={17} />}
                    {actionLabel}
                  </span>
                  {!max && <GoldAmount amount={goldCost} />}
                </button>
              </div>
            </div>

            <aside className="upgrade-deck-panel" aria-label="Actions du deck">
              <span className="eyebrow">TON DECK</span>
              <div className="upgrade-deck-status" data-in-deck={inDeck}>
                {inDeck ? <Check size={17} /> : <Layers3 size={17} />}
                <span>{inDeck ? "Dans ton deck" : "Dans ta collection"}</span>
              </div>
              <div className="upgrade-deck-actions">
                {inDeck ? (
                  <button className="sylve-button secondary" onClick={onMove}>
                    <ArrowRightLeft size={22} />
                    Déplacer dans le deck
                  </button>
                ) : (
                  <button
                    className="sylve-button secondary"
                    onClick={hasSpace ? onAdd : onMove}
                  >
                    {hasSpace ? (
                      <Plus size={22} />
                    ) : (
                      <ArrowRightLeft size={22} />
                    )}
                    {hasSpace ? "Ajouter au deck" : "Remplacer une carte"}
                  </button>
                )}
              </div>
            </aside>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
