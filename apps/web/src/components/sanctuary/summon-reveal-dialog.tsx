import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowRight } from "lucide-react";
import {
  combatTypeLabel,
  RARITY_LABELS,
  resolveCard,
  type OwnedCard,
} from "@sylve/game";
import {
  SUMMON_REVEAL_SLOTS,
  summonRoundRewards,
  type SummonRevealProgress,
  summonOffer,
  summonPack,
  type SummonResult,
} from "@sylve/game/summoning";
import { CardArtwork } from "@/components/decks/card-artwork";
import { CardUpgradeDialog } from "@/components/decks/card-upgrade-dialog";
import { EmeraldAmount } from "@/components/emerald-balance";
import { GoldIcon } from "@/components/gold-balance";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export function SummonRevealDialog({
  result,
  history = false,
  resuming = false,
  onProgress,
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
  history?: boolean;
  resuming?: boolean;
  onProgress?: (progress: SummonRevealProgress) => void;
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
  const [round, setRound] = useState(() =>
    history ? 0 : (result?.revealProgress?.round ?? 0),
  );
  const [flipped, setFlipped] = useState<Set<number>>(
    () => new Set(result?.revealProgress?.revealed),
  );
  const flippedRef = useRef(flipped);
  const [inspected, setInspected] = useState<string | null>(null);
  const [lastFlipped, setLastFlipped] = useState<number | null>(null);
  const [celebrating, setCelebrating] = useState<Set<number>>(() => new Set());
  const celebrationTimers = useRef(new Set<ReturnType<typeof setTimeout>>());
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
  const rewards = result ? summonRoundRewards(result, round) : [];
  const revealed = history
    ? rewards.length
    : rewards.filter((_, index) =>
        flipped.has(round * SUMMON_REVEAL_SLOTS + index),
      ).length;
  const complete = revealed === rewards.length;
  const celebratingRound = rewards.some((_, index) =>
    celebrating.has(round * SUMMON_REVEAL_SLOTS + index),
  );
  const lastRound = result ? round === result.count - 1 : true;
  const enabled = result ? summonPack(result.packId).enabled : false;
  const offer = result
    ? summonOffer(
        result.packId,
        result.count,
        !history && !!result.repeatToken,
        result.cost,
      )
    : null;
  const insufficient =
    emeralds == null || (offer != null && emeralds < offer.cost);
  const repeatHint =
    lastRound && !enabled
      ? "Cet appel est temporairement indisponible."
      : null;
  useEffect(() => {
    const timers = celebrationTimers.current;
    return () => {
      for (const timer of timers) clearTimeout(timer);
    };
  }, []);
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
        ?.querySelector<HTMLButtonElement>(
          history ? ".summon-card-front button" : ".summon-card-back",
        )
        ?.focus();
  }, [round, history]);

  function close() {
    setInspected(null);
    onClose();
  }

  function flip(index: number) {
    const marker = round * SUMMON_REVEAL_SLOTS + index;
    if (flippedRef.current.has(marker)) return;
    const next = new Set(flippedRef.current).add(marker);
    flippedRef.current = next;
    setLastFlipped(index);
    setFlipped(next);
    const reward = rewards[index];
    if (
      reward?.kind === "hero" &&
      resolveCard(reward.item.variantId).rarity === "legendary"
    ) {
      setCelebrating((current) => new Set(current).add(marker));
      const timer = setTimeout(() => {
        celebrationTimers.current.delete(timer);
        setCelebrating((current) => {
          const active = new Set(current);
          active.delete(marker);
          return active;
        });
      }, 2_400);
      celebrationTimers.current.add(timer);
    }
    onProgress?.({ round, revealed: [...next].sort((a, b) => a - b) });
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
                  {history
                    ? "Dernière invocation"
                    : resuming
                      ? "Finissez votre tirage"
                      : "Le cercle des esprits"}
                </span>
                <DialogTitle>{summonPack(result.packId).name}</DialogTitle>
              </div>
              <span className="summon-round-counter" aria-live="polite">
                Invocation {round + 1} / {result.count}
              </span>
            </header>
            <div className="summon-circle-stage">
              <div className="summon-circle-ring" aria-hidden="true" />
              {celebratingRound && (
                <div className="summon-legendary-ambience" aria-hidden="true" />
              )}
              <div
                className="summon-circle"
                role="list"
                aria-label={`Récompenses de l’invocation ${round + 1}`}
                key={round}
              >
                {rewards.map((reward, index) => {
                  const isCelebrating = celebrating.has(
                    round * SUMMON_REVEAL_SLOTS + index,
                  );
                  const isFlipped =
                    history || flipped.has(round * SUMMON_REVEAL_SLOTS + index);
                  const angle =
                    ((-120 + (index * 360) / rewards.length) * Math.PI) / 180;
                  return (
                    <div
                      className={`summon-circle-slot${isCelebrating ? " is-legendary-revealing" : ""}`}
                      role="listitem"
                      key={index}
                      style={
                        {
                          "--card-x": Math.cos(angle),
                          "--card-y": `${50 + Math.sin(angle) * 36}%`,
                        } as CSSProperties
                      }
                    >
                      {isCelebrating && <LegendaryRevealEffects />}
                      <div
                        className={`summon-flip ${isFlipped ? "is-revealed" : ""}`}
                      >
                        {!history && (
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
                        )}
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
                <button
                  ref={center}
                  type="button"
                  className="summon-repeat-button"
                  aria-busy={busy || undefined}
                  disabled={
                    !complete ||
                    busy ||
                    (!lastRound ? false : !enabled || !ready || insufficient)
                  }
                  aria-label={
                    !lastRound
                      ? `Invocation suivante — ${round + 2} sur ${result.count}`
                      : `Réinvoquer ×${result.count}, ${offer.cost} émeraudes`
                  }
                  onClick={() => {
                    if (!lastRound) {
                      setLastFlipped(null);
                      setRound(round + 1);
                      if (!history)
                        onProgress?.({
                          round: round + 1,
                          revealed: [...flippedRef.current].sort(
                            (a, b) => a - b,
                          ),
                        });
                    } else onRepeat();
                  }}
                >
                  {lastRound ? (
                    <EmeraldAmount amount={offer.cost} />
                  ) : (
                    <>
                      <ArrowRight size={15} />
                      <span>Suivante</span>
                    </>
                  )}
                </button>
                {repeatHint && (
                  <small className="summon-repeat-hint">{repeatHint}</small>
                )}
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

function LegendaryRevealEffects() {
  return (
    <div className="summon-legendary-effects" aria-hidden="true">
      <span className="summon-legendary-aura" />
      <span className="summon-legendary-rays" />
      <span className="summon-legendary-wave" />
      <span className="summon-legendary-wave is-delayed" />
      {Array.from({ length: 18 }, (_, index) => {
        const angle = (index / 18) * Math.PI * 2;
        const distance = 70 + (index % 3) * 20;
        return (
          <i
            className="summon-legendary-particle"
            key={index}
            style={
              {
                "--particle-x": `${Math.cos(angle) * distance}cqw`,
                "--particle-y": `${Math.sin(angle) * distance}cqw`,
                "--particle-delay": `${380 + (index % 4) * 55}ms`,
                "--particle-turn": `${index * 37}deg`,
              } as CSSProperties
            }
          />
        );
      })}
    </div>
  );
}
