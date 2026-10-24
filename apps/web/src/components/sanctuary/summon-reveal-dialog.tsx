import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, LoaderCircle, RotateCw, Sparkles } from "lucide-react";
import {
  combatTypeLabel,
  RARITY_LABELS,
  resolveCard,
  type OwnedCard,
} from "@sylve/game";
import type { LootReveal } from "@sylve/game/progression";
import {
  HEROES_PER_SUMMON,
  summonOffer,
  summonPack,
  type SummonResult,
} from "@sylve/game/summoning";
import { CardArtwork } from "@/components/decks/card-artwork";
import { CardUpgradeDialog } from "@/components/decks/card-upgrade-dialog";
import { EmeraldAmount } from "@/components/emerald-balance";
import { GoldIcon } from "@/components/gold-balance";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

type Reward =
  | { kind: "hero"; item: LootReveal }
  | { kind: "gold"; amount: number };

function roundRewards(result: SummonResult, round: number): Reward[] {
  const rewards: Reward[] = result.reveals
    .slice(round * HEROES_PER_SUMMON, (round + 1) * HEROES_PER_SUMMON)
    .map((item) => ({ kind: "hero", item }));
  // Old history has only an aggregate. Split that existing total without granting anything.
  const total = result.gold ?? 0;
  const gold =
    result.goldBySummon?.[round] ??
    Math.floor(total / result.count) + (round < total % result.count ? 1 : 0);
  if (gold > 0) rewards.push({ kind: "gold", amount: gold });
  // The position of the gold card must not give it away. Keep history order stable.
  let seed = 2166136261;
  for (const char of `${result.requestId}:${round}`)
    seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
  for (let i = rewards.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [rewards[i], rewards[j]] = [rewards[j]!, rewards[i]!];
  }
  return rewards;
}

export function SummonRevealDialog({
  result,
  collection,
  emeralds,
  busy = false,
  ready = true,
  error,
  onClose,
  onUpgrade,
  onRepeat,
  onRetry,
}: {
  result: SummonResult | null;
  collection: OwnedCard[] | undefined;
  emeralds?: number | null;
  busy?: boolean;
  ready?: boolean;
  error?: string | null;
  onClose: () => void;
  onUpgrade: (variantId: string) => Promise<unknown>;
  onRepeat: () => void;
  onRetry?: () => void;
}) {
  const [round, setRound] = useState(0);
  const [flipped, setFlipped] = useState<Set<string>>(() => new Set());
  const [inspected, setInspected] = useState<string | null>(null);
  const [lastFlipped, setLastFlipped] = useState<number | null>(null);
  const popup = useRef<HTMLDivElement>(null);
  const center = useRef<HTMLButtonElement>(null);
  const fronts = useRef(new Map<number, HTMLDivElement>());
  const entries = new Map(collection?.map((entry) => [entry.card.id, entry]));
  const finalReveals = new Map(
    result?.reveals.map((item) => [item.variantId, item]),
  );
  const inspectedReveal = inspected ? finalReveals.get(inspected) : undefined;
  const inspectedEntry = inspectedReveal
    ? (entries.get(inspectedReveal.variantId) ?? {
        card: resolveCard(inspectedReveal.variantId, inspectedReveal.level),
        copies: inspectedReveal.copies,
      })
    : undefined;
  const rewards = result ? roundRewards(result, round) : [];
  const revealed = rewards.filter((_, index) =>
    flipped.has(`${round}:${index}`),
  ).length;
  const complete = revealed === rewards.length;
  const lastRound = result ? round === result.count - 1 : true;
  const offer = result ? summonOffer(result.packId, result.count, true) : null;
  const insufficient =
    emeralds == null || (offer != null && emeralds < offer.cost);
  useEffect(() => {
    if (lastFlipped == null) return;
    if (complete) center.current?.focus();
    else {
      const face = fronts.current.get(lastFlipped);
      (face?.querySelector<HTMLButtonElement>("button") ?? face)?.focus();
    }
  }, [complete, flipped, lastFlipped]);
  useEffect(() => {
    if (round > 0)
      popup.current
        ?.querySelector<HTMLButtonElement>(".summon-card-back")
        ?.focus();
  }, [round]);

  function close() {
    setInspected(null);
    onClose();
  }

  function flip(index: number) {
    if (flipped.has(`${round}:${index}`)) return;
    setLastFlipped(index);
    setFlipped((previous) => new Set(previous).add(`${round}:${index}`));
  }

  return (
    <Dialog
      open={!!result}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent
        ref={popup}
        initialFocus={popup}
        className="summon-reveal-dialog"
        appearance="game"
      >
        {result && offer && (
          <>
            <header className="summon-reveal-heading">
              <div>
                <span className="summon-reveal-eyebrow">
                  Le cercle des esprits
                </span>
                <DialogTitle>{summonPack(result.packId).name}</DialogTitle>
              </div>
              <span className="summon-round-counter" aria-live="polite">
                Invocation {round + 1} / {result.count}
              </span>
            </header>
            <p className="summon-reveal-help">
              Touche chaque carte pour découvrir ta récompense.
            </p>
            <div className="summon-circle-stage">
              <div className="summon-circle-ring" aria-hidden="true" />
              <div
                className="summon-circle"
                role="list"
                aria-label={`Récompenses de l’invocation ${round + 1}`}
                key={round}
              >
                {rewards.map((reward, index) => {
                  const isFlipped = flipped.has(`${round}:${index}`);
                  const angle =
                    ((-120 + (index * 360) / rewards.length) * Math.PI) / 180;
                  return (
                    <div
                      className="summon-circle-slot"
                      role="listitem"
                      key={index}
                      style={
                        {
                          "--card-x": `${50 + Math.cos(angle) * 37}%`,
                          "--card-y": `${50 + Math.sin(angle) * 39}%`,
                        } as CSSProperties
                      }
                    >
                      <div
                        className={`summon-flip ${isFlipped ? "is-revealed" : ""}`}
                      >
                        <button
                          type="button"
                          className="summon-card-back"
                          aria-label={`Révéler la carte ${index + 1}`}
                          tabIndex={isFlipped ? -1 : 0}
                          aria-hidden={isFlipped || undefined}
                          disabled={isFlipped}
                          onClick={() => flip(index)}
                        >
                          <img
                            src="/art/ui/summon-card-back.webp"
                            alt=""
                            width={400}
                            height={560}
                            draggable={false}
                          />
                        </button>
                        {isFlipped && (
                          <div
                            className="summon-card-front"
                            tabIndex={-1}
                            ref={(node) => {
                              if (node) fronts.current.set(index, node);
                              else fronts.current.delete(index);
                            }}
                          >
                            {reward.kind === "gold" ? (
                              <div
                                className="summon-gold-card"
                                role="img"
                                aria-label={`Carte d’or : ${reward.amount} pièces d’or`}
                              >
                                <span className="summon-gold-eyebrow">
                                  Trésor des esprits
                                </span>
                                <GoldIcon />
                                <strong>
                                  +{reward.amount.toLocaleString("fr-FR")}
                                </strong>
                                <span>Pièces d’or</span>
                              </div>
                            ) : (
                              (() => {
                                const entry = entries.get(
                                  reward.item.variantId,
                                );
                                const card =
                                  entry?.card ??
                                  resolveCard(
                                    reward.item.variantId,
                                    reward.item.level,
                                  );
                                return (
                                  <button
                                    type="button"
                                    className="workshop-card"
                                    data-rarity={card.rarity}
                                    style={
                                      {
                                        "--creature-color": card.color,
                                      } as CSSProperties
                                    }
                                    aria-label={`${card.name}, ${combatTypeLabel(card)}, ${card.attack} attaque, ${card.health} points de vie, ${RARITY_LABELS[card.rarity!]}, niveau ${card.level ?? 1}, voir les informations`}
                                    aria-haspopup="dialog"
                                    onClick={() =>
                                      setInspected(reward.item.variantId)
                                    }
                                  >
                                    <CardArtwork
                                      card={card}
                                      copies={
                                        entry?.copies ??
                                        finalReveals.get(reward.item.variantId)
                                          ?.copies
                                      }
                                    />
                                  </button>
                                );
                              })()
                            )}
                          </div>
                        )}
                      </div>
                      {isFlipped && (
                        <div className="summon-reward-caption">
                          {reward.kind === "gold" ? (
                            <span>Carte d’or</span>
                          ) : (
                            <>
                              <span
                                className="rarity-label"
                                data-rarity={
                                  resolveCard(reward.item.variantId).rarity
                                }
                              >
                                {
                                  RARITY_LABELS[
                                    resolveCard(reward.item.variantId).rarity!
                                  ]
                                }
                              </span>
                              <small
                                className={
                                  reward.item.isNew ? "summon-new" : ""
                                }
                              >
                                {reward.item.isNew ? "Nouvelle · " : ""}+
                                {reward.item.count.toLocaleString("fr-FR")}
                              </small>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="summon-circle-center">
                <Sparkles size={22} aria-hidden="true" />
                <p className="summon-flipped-counter" role="status">
                  {revealed} / {rewards.length} cartes révélées
                </p>
                <span className="summon-repeat-badge">
                  −{offer.discountPercent} % au prochain{" "}
                  {result.count === 10 ? "lot ×10" : "appel"}
                </span>
                <button
                  ref={center}
                  type="button"
                  className="summon-repeat-button"
                  disabled={
                    !complete ||
                    busy ||
                    (!lastRound ? false : !ready || insufficient)
                  }
                  aria-label={
                    !lastRound
                      ? `Invocation suivante — ${round + 2} sur ${result.count}`
                      : `Réinvoquer ×${result.count}, ${offer.cost} émeraudes, remise de ${offer.discountPercent} %`
                  }
                  onClick={() => {
                    if (!lastRound) {
                      setLastFlipped(null);
                      setRound((value) => value + 1);
                    } else onRepeat();
                  }}
                >
                  {busy ? (
                    <LoaderCircle className="animate-spin" size={16} />
                  ) : lastRound ? (
                    <RotateCw size={15} />
                  ) : (
                    <ArrowRight size={15} />
                  )}
                  <span>
                    {busy
                      ? "Invocation…"
                      : lastRound
                        ? `Réinvoquer ×${result.count}`
                        : "Suivante"}
                  </span>
                  {lastRound && <EmeraldAmount amount={offer.cost} />}
                </button>
                {!lastRound && (
                  <span className="summon-next-price">
                    Prochain lot ×10 : <EmeraldAmount amount={offer.cost} />
                  </span>
                )}
                <small className="summon-repeat-hint">
                  {!complete
                    ? "Révèle toutes les cartes pour continuer"
                    : !lastRound
                      ? "La suite de ton lot t’attend"
                      : insufficient
                        ? "Émeraudes insuffisantes"
                        : "Remise conservée pour ce pack et ce format"}
                </small>
              </div>
            </div>
            {error && (
              <div className="summon-repeat-error" role="alert">
                {error}
                {onRetry && (
                  <button
                    type="button"
                    className="sanctuary-text-button"
                    disabled={busy}
                    onClick={onRetry}
                  >
                    Retrouver mon invocation
                  </button>
                )}
              </div>
            )}
            <footer className="summon-reveal-actions">
              <DialogClose className="sanctuary-text-button">
                Retour au sanctuaire
              </DialogClose>
              <Link
                to="/decks"
                className="sanctuary-text-button"
                onClick={close}
              >
                Ma collection <ArrowRight size={15} />
              </Link>
            </footer>
          </>
        )}
      </DialogContent>
      <CardUpgradeDialog
        entry={inspectedEntry}
        onClose={() => setInspected(null)}
        onUpgrade={onUpgrade}
      />
    </Dialog>
  );
}
