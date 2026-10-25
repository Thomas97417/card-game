import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Link } from "@tanstack/react-router";
import { ConvexError } from "convex/values";
import {
  ArrowRight,
  Check,
  History,
  LoaderCircle,
} from "lucide-react";
import type {
  EmeraldPackId,
  EmeraldPackOffer,
} from "@sylve/game/emerald-packs";
import { CHEST_SLOT_KEYS } from "@sylve/game/progression";
import type {
  GoldPurchaseRequest,
  GoldPurchaseResult,
} from "@sylve/game/gold-packs";
import { RARITIES, RARITY_LABELS, type OwnedCard } from "@sylve/game";
import {
  ACTIVE_SUMMON_PACKS,
  summonPack,
  summonOffer,
  summonQuantity,
  mergeSummonProgress,
  summonRevealComplete,
  type SummonRevealProgress,
  type SummonCount,
  type SummonPack,
  type SummonPackId,
  type SummonResult,
} from "@sylve/game/summoning";
import { GameHeader } from "@/components/game-header";
import { EmeraldAmount } from "@/components/emerald-balance";
import { useHorizontalDrag } from "@/hooks/use-horizontal-drag";
import { useHorizontalWheel } from "@/hooks/use-horizontal-wheel";
import { BestiaryDialog } from "./bestiary-dialog";
import { EmeraldPacks } from "./emerald-packs";
import { GoldPacks } from "./gold-packs";
import { SummonRevealDialog } from "./summon-reveal-dialog";
import {
  useSummonRevealProgress,
  type SaveSummonProgress,
} from "./use-summon-reveal-progress";

export interface SummonRequest {
  packId: SummonPackId;
  count: SummonCount;
  requestId: string;
  repeatToken?: string;
}

interface SanctuaryProps {
  emeralds: number | null | undefined;
  ready: boolean;
  peakTrophies?: number;
  latest?: SummonResult | null;
  unfinished?: SummonResult | null;
  collection: OwnedCard[] | undefined;
  purchasedChestSlots?: readonly number[];
  onSummon: (request: SummonRequest) => Promise<SummonResult>;
  onCloseCircle: (repeatToken: string) => Promise<unknown>;
  onSaveRevealProgress: SaveSummonProgress;
  onUnlockChestSlot: (slot: number) => Promise<unknown>;
  onUpgrade: (variantId: string) => Promise<unknown>;
  emeraldOffers?: EmeraldPackOffer[];
  onBuyEmeralds?: (packId: EmeraldPackId) => Promise<void>;
  onBuyGold?: (request: GoldPurchaseRequest) => Promise<GoldPurchaseResult>;
  paymentFeedback?: ReactNode;
}

export function Sanctuary({
  emeralds,
  ready,
  peakTrophies = 0,
  latest,
  unfinished,
  collection,
  purchasedChestSlots,
  onSummon,
  onCloseCircle,
  onSaveRevealProgress,
  onUnlockChestSlot,
  onUpgrade,
  emeraldOffers,
  onBuyEmeralds,
  onBuyGold,
  paymentFeedback,
}: SanctuaryProps) {
  const [busy, setBusy] = useState<{
    packId: SummonPackId;
    count: SummonCount;
  } | null>(null);
  const [result, setResult] = useState<SummonResult | null>(null);
  const [viewingHistory, setViewingHistory] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [lastResult, setLastResult] = useState<SummonResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<number | null>(null);
  const [unlockedKeys, setUnlockedKeys] = useState<number[]>([]);
  const [unlockedMessage, setUnlockedMessage] = useState<string | null>(null);
  const lock = useRef(false);
  const pending = useRef<SummonRequest | null>(null);
  const offersRow = useRef<HTMLDivElement>(null);
  const activeCircle = useRef<string | null>(null);
  const circleEpoch = useRef(0);
  const mounted = useRef(true);
  const closeCircle = useRef(onCloseCircle);
  closeCircle.current = onCloseCircle;
  const progress = useSummonRevealProgress(
    onSaveRevealProgress,
    latest,
    unfinished,
  );

  const releaseCircle = useCallback(() => {
    circleEpoch.current++;
    const token = activeCircle.current;
    activeCircle.current = null;
    if (pending.current?.repeatToken) pending.current = null;
    // Discard the local permission even if navigation interrupts the connection.
    if (token) void closeCircle.current(token).catch(() => undefined);
  }, []);
  const closeResult = useCallback(() => {
    releaseCircle();
    setResult(null);
    setViewingHistory(false);
    setResuming(false);
    setError(null);
  }, [releaseCircle]);
  useEffect(() => {
    mounted.current = true;
    window.addEventListener("pagehide", closeResult);
    return () => {
      mounted.current = false;
      window.removeEventListener("pagehide", closeResult);
      releaseCircle();
    };
  }, [closeResult, releaseCircle]);
  const { isDragging, dragHandlers } = useHorizontalDrag(true);
  useHorizontalWheel(offersRow);
  const previous = lastResult
    ? progress.current(lastResult)
    : latest
      ? progress.current(latest)
      : null;
  const availableKeys = CHEST_SLOT_KEYS.filter(
    (key) =>
      purchasedChestSlots !== undefined &&
      !purchasedChestSlots.includes(key.slot) &&
      !unlockedKeys.includes(key.slot),
  );

  function openSaved(draw: SummonResult) {
    // Finding the paid draw also resolves a previously lost purchase response.
    if (pending.current?.requestId === draw.requestId) pending.current = null;
    const saved = progress.resume(draw);
    setViewingHistory(saved.revealCompleted !== false);
    setResuming(saved.revealCompleted === false);
    setResult({ ...saved, repeatToken: undefined });
  }

  function saveProgress(update: SummonRevealProgress) {
    if (!result) return;
    const merged = mergeSummonProgress(result.revealProgress, update);
    progress.update(result, merged);
    setResult({
      ...result,
      revealProgress: merged,
      revealCompleted: summonRevealComplete(result, merged),
    });
  }

  async function invoke(
    packId: SummonPackId,
    count: SummonCount,
    repeatToken?: string,
  ) {
    if (!summonPack(packId).enabled) return;
    const { cost } = summonOffer(
      packId,
      count,
      !!repeatToken,
      repeatToken && result?.repeatToken === repeatToken
        ? result.cost
        : undefined,
    );
    const retry =
      pending.current?.packId === packId &&
      pending.current.count === count &&
      pending.current.repeatToken === repeatToken;
    if (
      lock.current ||
      !ready ||
      (!retry && (emeralds == null || emeralds < cost))
    )
      return;
    lock.current = true;
    const epoch = circleEpoch.current;
    setBusy({ packId, count });
    setError(null);
    setUnlockedMessage(null);
    try {
      if (!retry || !pending.current)
        pending.current = {
          packId,
          count,
          requestId: crypto.randomUUID(),
          ...(repeatToken ? { repeatToken } : {}),
        };
      const purchased = await onSummon(pending.current);
      const reward = {
        ...purchased,
        revealProgress: purchased.revealProgress ?? { round: 0, revealed: [] },
        revealCompleted: purchased.revealCompleted ?? false,
      };
      const saved = { ...reward };
      delete saved.repeatToken;
      if (mounted.current) {
        setLastResult(saved);
        progress.remember(saved);
      }
      if (mounted.current && epoch === circleEpoch.current) {
        activeCircle.current = reward.repeatToken ?? null;
        setViewingHistory(reward.revealCompleted);
        setResuming(false);
        setResult(reward);
      } else if (reward.repeatToken) {
        void closeCircle.current(reward.repeatToken).catch(() => undefined);
      }
      pending.current = null;
    } catch (cause) {
      if (!mounted.current || epoch !== circleEpoch.current) return;
      setError(
        cause instanceof ConvexError && typeof cause.data === "string"
          ? cause.data
          : "L’invocation n’a pas pu aboutir. Réessaie pour retrouver ton tirage sans double débit.",
      );
    } finally {
      if (mounted.current) setBusy(null);
      lock.current = false;
    }
  }

  async function unlockSlot(slot: number) {
    const key = CHEST_SLOT_KEYS.find((key) => key.slot === slot);
    if (
      !key ||
      lock.current ||
      !ready ||
      emeralds == null ||
      emeralds < key.price ||
      purchasedChestSlots === undefined ||
      purchasedChestSlots.includes(slot) ||
      unlockedKeys.includes(slot)
    )
      return;
    lock.current = true;
    setBusyKey(slot);
    setError(null);
    setUnlockedMessage(null);
    try {
      await onUnlockChestSlot(slot);
      setUnlockedKeys((keys) => [...keys, slot]);
      setUnlockedMessage(
        `L’emplacement ${slot + 2} est débloqué pour toujours.`,
      );
    } catch (cause) {
      setError(
        cause instanceof ConvexError && typeof cause.data === "string"
          ? cause.data
          : "L’achat n’a pas pu être confirmé. Réessaie : cet emplacement ne sera débité qu’une fois.",
      );
    } finally {
      setBusyKey(null);
      lock.current = false;
    }
  }

  return (
    <main className="sanctuary-page" aria-label="Le sanctuaire">
      <div className="sanctuary-scenery" aria-hidden="true">
        <img
          className="sanctuary-background"
          src="/art/sanctuary.webp"
          alt=""
          fetchPriority="high"
          draggable={false}
        />
        <div className="sanctuary-shade" />
      </div>
      <GameHeader />
      <h1 className="sr-only">Le sanctuaire</h1>
      <div className="sanctuary-content">
        <div className="sanctuary-offers">
          {paymentFeedback}
          <div
            ref={offersRow}
            className={`sanctuary-offer-row ${isDragging ? "is-dragging" : ""}`}
            role="region"
            aria-label="Invocations, émeraudes, or et clés, défilement horizontal"
            tabIndex={0}
            {...dragHandlers}
          >
            <section
              className="summon-packs"
              id="summon-packs"
              aria-label="Packs d’invocation"
              aria-busy={!!busy}
            >
              {ACTIVE_SUMMON_PACKS.map((pack) => (
                <PackChoice
                  key={pack.id}
                  pack={pack}
                  peakTrophies={peakTrophies}
                  emeralds={emeralds}
                  ready={ready && busyKey === null}
                  busy={busy}
                  onInvoke={invoke}
                />
              ))}
            </section>
            <EmeraldPacks
              offers={emeraldOffers}
              ready={ready && !busy && busyKey === null}
              onPurchase={onBuyEmeralds}
            />
            <GoldPacks
              emeralds={emeralds}
              ready={ready && !busy && busyKey === null}
              onPurchase={onBuyGold}
            />
            {availableKeys.length > 0 && (
              <section
                className="sanctuary-chest-keys"
                id="chest-keys"
                aria-label="Clés de coffre"
                aria-busy={busyKey !== null}
              >
                <div className="sanctuary-key-grid">
                  {availableKeys.map((key) => {
                    const insufficient =
                      emeralds != null && emeralds < key.price;
                    const working = busyKey === key.slot;
                    return (
                      <article
                        className="sanctuary-key-card"
                        key={key.slot}
                        aria-labelledby={`key-${key.slot}`}
                      >
                        <img
                          className="sanctuary-key-art"
                          src={key.image}
                          alt=""
                          width={512}
                          height={512}
                          draggable={false}
                        />
                        <div className="sanctuary-key-copy">
                          <h2 id={`key-${key.slot}`}>{key.name}</h2>
                          <p>
                            Déverrouille l’emplacement de coffre{" "}
                            {String(key.slot + 2).padStart(2, "0")}.
                          </p>
                        </div>
                        <button
                          type="button"
                          className="sanctuary-key-button"
                          disabled={
                            !ready ||
                            !!busy ||
                            busyKey !== null ||
                            emeralds == null ||
                            insufficient
                          }
                          aria-label={`Déverrouiller l’emplacement ${key.slot + 2} — ${key.name}, ${key.price} émeraudes`}
                          title={
                            insufficient
                              ? `Il te manque ${(key.price - emeralds!).toLocaleString("fr-FR")} émeraudes.`
                              : undefined
                          }
                          onClick={() => void unlockSlot(key.slot)}
                        >
                          <span>
                            {working && (
                              <LoaderCircle
                                className="animate-spin"
                                size={15}
                              />
                            )}
                            Déverrouiller
                          </span>
                          <EmeraldAmount amount={key.price} />
                        </button>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
          <nav
            className="sanctuary-navigation"
            aria-label="Explorer le sanctuaire"
          >
            {progress.pending && (
              <button
                type="button"
                className="sanctuary-resume-button"
                disabled={!!busy || busyKey !== null}
                onClick={() => {
                  if (progress.pending) openSaved(progress.pending);
                }}
              >
                <History size={17} />
                Finissez votre tirage
                <ArrowRight size={16} />
              </button>
            )}
            {previous && previous.revealCompleted !== false && (
              <button
                type="button"
                className="sanctuary-text-button"
                disabled={!!busy || busyKey !== null}
                onClick={() => openSaved(previous)}
              >
                <History size={17} />
                Dernière invocation
              </button>
            )}
            <BestiaryDialog />
            <Link to="/decks" className="sanctuary-text-button">
              Ma collection
              <ArrowRight size={15} />
            </Link>
          </nav>
        </div>
        {unlockedMessage && (
          <p className="sanctuary-feedback sanctuary-key-success" role="status">
            <Check size={16} />
            {unlockedMessage}
            <Link to="/arena">
              Voir mes coffres <ArrowRight size={15} />
            </Link>
          </p>
        )}
        {error && !result && (
          <p className="sanctuary-error" role="alert">
            {error}
            {pending.current && (
              <button
                type="button"
                className="sanctuary-text-button"
                disabled={!!busy}
                onClick={() => {
                  const request = pending.current;
                  if (request)
                    void invoke(
                      request.packId,
                      request.count,
                      request.repeatToken,
                    );
                }}
              >
                Retrouver mon invocation
              </button>
            )}
          </p>
        )}
      </div>
      <SummonRevealDialog
        key={`${result?.requestId ?? "closed"}:${viewingHistory}:${resuming}`}
        result={result}
        history={viewingHistory}
        resuming={resuming}
        onProgress={viewingHistory ? undefined : saveProgress}
        collection={collection}
        emeralds={emeralds}
        ready={ready}
        busy={!!busy}
        error={error}
        onRepeat={() => {
          if (result)
            void invoke(result.packId, result.count, result.repeatToken);
        }}
        onRetry={
          pending.current
            ? () => {
                const request = pending.current;
                if (request)
                  void invoke(
                    request.packId,
                    request.count,
                    request.repeatToken,
                  );
              }
            : undefined
        }
        onClose={closeResult}
        onUpgrade={onUpgrade}
      />
    </main>
  );
}

function PackChoice({
  pack,
  peakTrophies,
  emeralds,
  ready,
  busy,
  onInvoke,
}: {
  pack: SummonPack;
  peakTrophies: number;
  emeralds: number | null | undefined;
  ready: boolean;
  busy: { packId: SummonPackId; count: SummonCount } | null;
  onInvoke: (id: SummonPackId, count: SummonCount) => void;
}) {
  const premium = pack.id !== "sylve";
  const divine = pack.id === "divine";
  const guarantee = divine
    ? `${pack.guaranteedLegendaries} compagnons légendaires`
    : pack.guaranteedLegendaries === 1
      ? "1 compagnon légendaire garanti"
      : `${pack.guaranteedLegendaries} compagnons légendaires garantis`;
  const rarities = divine
    ? ["legendary", "legendary", "legendary"]
    : premium
      ? ["epic", "legendary", "epic"]
      : ["rare", "legendary", "epic"];
  return (
    <article
      className={`summon-pack ${premium ? "summon-pack-premium" : ""} ${divine ? "summon-pack-divine" : ""}`}
      aria-labelledby={`pack-${pack.id}`}
    >
      <div className="summon-pack-art" aria-hidden="true">
        <div className="summon-orbit" />
        {rarities.map((rarity, i) => (
          <img
            key={`${rarity}-${i}`}
            src={`/art/ui/rarity-${rarity}.webp`}
            alt=""
            width={160}
            height={216}
            draggable={false}
            style={
              {
                "--fan-angle": `${(i - (rarities.length - 1) / 2) * 17}deg`,
                "--fan-offset": `${(i - (rarities.length - 1) / 2) * 34}px`,
                zIndex: i === Math.floor(rarities.length / 2) ? 5 : i + 1,
              } as CSSProperties
            }
          />
        ))}
      </div>
      <div className="summon-pack-copy">
        <h2 id={`pack-${pack.id}`}>{pack.name}</h2>
        <p>{pack.description}</p>
      </div>
      <div className="summon-rates" aria-label={`Taux de ${pack.name}`}>
        {RARITIES.filter((rarity) => pack.rates[rarity] > 0).map((rarity) => {
          const quantity = summonQuantity(pack.id, rarity, peakTrophies);
          const boosted =
            pack.id === "ancients" && rarity === "legendary"
              ? summonQuantity(pack.id, rarity, peakTrophies, 2)
              : null;
          return (
            <span key={rarity} data-rarity={rarity}>
              <i aria-hidden="true" />
              {RARITY_LABELS[rarity]}
              <strong>{pack.rates[rarity]} %</strong>
              <small
                title={
                  boosted
                    ? "Les deux lots légendaires garantis ont chacun 50 % de chance d’être renforcés."
                    : undefined
                }
              >
                ×{quantity.min}
                {quantity.max !== quantity.min ? `–${quantity.max}` : ""}
                {boosted && (
                  <>
                    {" "}
                    ou ×{boosted.min}–{boosted.max}
                  </>
                )}
              </small>
            </span>
          );
        })}
      </div>
      <div className="summon-actions">
        {([1, 10] as const).map((count) => {
          const price = count === 10 ? pack.tenPrice : pack.price;
          const working = busy?.packId === pack.id && busy.count === count;
          const insufficient = emeralds != null && emeralds < price;
          return (
            <button
              key={count}
              type="button"
              className={`summon-button ${count === 10 ? "summon-button-ten" : ""}`}
              disabled={!ready || !!busy || emeralds == null || insufficient}
              aria-busy={working || undefined}
              aria-label={`Invoquer ${count} fois — ${pack.name}, ${price} émeraudes`}
              aria-describedby={
                count === 10
                  ? `pack-${pack.id}-offer pack-${pack.id}-guarantee`
                  : undefined
              }
              title={
                insufficient
                  ? `Il te manque ${(price - emeralds!).toLocaleString("fr-FR")} émeraudes.`
                  : undefined
              }
              onClick={() => onInvoke(pack.id, count)}
            >
              {count === 10 && (
                <span
                  id={`pack-${pack.id}-offer`}
                  className="summon-offer-ribbon"
                >
                  Offre ×10
                </span>
              )}
              <span className="summon-button-label">
                {working && <LoaderCircle className="animate-spin" size={15} />}
                {count === 1 ? "Invoquer ×1" : "Invoquer ×10"}
              </span>
              <span className="summon-button-price">
                {count === 10 && (
                  <del aria-label={`Au lieu de ${pack.price * 10} émeraudes`}>
                    {(pack.price * 10).toLocaleString("fr-FR")}
                  </del>
                )}
                <EmeraldAmount amount={price} />
              </span>
              {count === 10 && (
                <span
                  id={`pack-${pack.id}-guarantee`}
                  className="summon-button-guarantee"
                >
                  {guarantee}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </article>
  );
}
