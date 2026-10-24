import { useRef, useState, type CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import { ConvexError } from "convex/values";
import { ArrowRight, History, LoaderCircle } from "lucide-react";
import {
  combatTypeLabel,
  RARITIES,
  RARITY_LABELS,
  resolveCard,
  type OwnedCard,
} from "@sylve/game";
import {
  SUMMON_PACKS,
  summonPack,
  type SummonCount,
  type SummonPack,
  type SummonPackId,
  type SummonResult,
} from "@sylve/game/summoning";
import { CurrencyBalances } from "@/components/currency-balances";
import { EmeraldAmount } from "@/components/emerald-balance";
import { CardArtwork } from "@/components/decks/card-artwork";
import { CardUpgradeDialog } from "@/components/decks/card-upgrade-dialog";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { BestiaryDialog } from "./bestiary-dialog";

export interface SummonRequest {
  packId: SummonPackId;
  count: SummonCount;
  requestId: string;
}

interface SanctuaryProps {
  emeralds: number | null | undefined;
  ready: boolean;
  latest?: SummonResult | null;
  collection: OwnedCard[] | undefined;
  onSummon: (request: SummonRequest) => Promise<SummonResult>;
  onUpgrade: (variantId: string) => Promise<unknown>;
}

export function Sanctuary({
  emeralds,
  ready,
  latest,
  collection,
  onSummon,
  onUpgrade,
}: SanctuaryProps) {
  const [busy, setBusy] = useState<{
    packId: SummonPackId;
    count: SummonCount;
  } | null>(null);
  const [result, setResult] = useState<SummonResult | null>(null);
  const [lastResult, setLastResult] = useState<SummonResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const pending = useRef<SummonRequest | null>(null);
  const previous = lastResult ?? latest;

  async function invoke(packId: SummonPackId, count: SummonCount) {
    const pack = summonPack(packId);
    const cost = count === 10 ? pack.tenPrice : pack.price;
    if (lock.current || !ready || emeralds == null || emeralds < cost) return;
    lock.current = true;
    setBusy({ packId, count });
    setError(null);
    try {
      if (pending.current?.packId !== packId || pending.current.count !== count)
        pending.current = { packId, count, requestId: crypto.randomUUID() };
      const reward = await onSummon(pending.current);
      setResult(reward);
      setLastResult(reward);
      pending.current = null;
    } catch (cause) {
      setError(
        cause instanceof ConvexError && typeof cause.data === "string"
          ? cause.data
          : "L’invocation n’a pas pu aboutir. Réessaie pour retrouver ton tirage sans double débit.",
      );
    } finally {
      setBusy(null);
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
      <header className="sanctuary-header">
        <Link
          to="/hub"
          className="workshop-back"
          aria-label="Retour au refuge"
          draggable={false}
        >
          <img
            src="/art/ui/back-arrow.webp"
            alt=""
            width={288}
            height={157}
            draggable={false}
          />
        </Link>
        <div className="sanctuary-header-tools">
          {previous && (
            <button
              type="button"
              className="sanctuary-history-button"
              aria-label="Dernière invocation"
              title="Dernière invocation"
              disabled={!!busy}
              onClick={() => setResult(previous)}
            >
              <History size={17} />
            </button>
          )}
          <CurrencyBalances />
        </div>
      </header>
      <h1 className="sr-only">Le sanctuaire</h1>
      <div className="sanctuary-content">
        <div className="sanctuary-offers">
          <section
            className="summon-packs"
            aria-label="Packs d’invocation"
            aria-busy={!!busy}
          >
            {SUMMON_PACKS.map((pack) => (
              <PackChoice
                key={pack.id}
                pack={pack}
                emeralds={emeralds}
                ready={ready}
                busy={busy}
                onInvoke={invoke}
              />
            ))}
          </section>
          <nav
            className="sanctuary-navigation"
            aria-label="Explorer le sanctuaire"
          >
            <BestiaryDialog />
            <Link to="/decks" className="sanctuary-text-button">
              Ma collection
              <ArrowRight size={15} />
            </Link>
          </nav>
        </div>
        {busy && (
          <p className="sanctuary-feedback" role="status">
            <LoaderCircle className="animate-spin" size={16} />
            Les esprits répondent à ton appel…
          </p>
        )}
        {error && (
          <p className="sanctuary-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <SummonRevealDialog
        result={result}
        collection={collection}
        onClose={() => setResult(null)}
        onUpgrade={onUpgrade}
      />
    </main>
  );
}

function PackChoice({
  pack,
  emeralds,
  ready,
  busy,
  onInvoke,
}: {
  pack: SummonPack;
  emeralds: number | null | undefined;
  ready: boolean;
  busy: { packId: SummonPackId; count: SummonCount } | null;
  onInvoke: (id: SummonPackId, count: SummonCount) => void;
}) {
  const premium = pack.id === "ancients";
  const guarantee = `${pack.guaranteedLegendaries} légendaire${pack.guaranteedLegendaries > 1 ? "s" : ""} garanti${pack.guaranteedLegendaries > 1 ? "s" : ""}`;
  const rarities = premium
    ? ["epic", "legendary", "epic"]
    : ["common", "rare", "legendary", "epic"];
  return (
    <article
      className={`summon-pack ${premium ? "summon-pack-premium" : ""}`}
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
        {RARITIES.filter((rarity) => pack.rates[rarity] > 0).map((rarity) => (
          <span key={rarity} data-rarity={rarity}>
            <i aria-hidden="true" />
            {RARITY_LABELS[rarity]}
            <strong>{pack.rates[rarity]} %</strong>
          </span>
        ))}
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
                  1 tirage gratuit
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

export function SummonRevealDialog({
  result,
  collection,
  onClose,
  onUpgrade,
}: {
  result: SummonResult | null;
  collection: OwnedCard[] | undefined;
  onClose: () => void;
  onUpgrade: (variantId: string) => Promise<unknown>;
}) {
  const [inspected, setInspected] = useState<string | null>(null);
  const popup = useRef<HTMLDivElement>(null);
  const entries = new Map(collection?.map((entry) => [entry.card.id, entry]));
  const reveals = new Map(result?.reveals.map((item) => [item.variantId, item]));
  const inspectedReveal = inspected ? reveals.get(inspected) : undefined;
  const inspectedEntry = inspectedReveal
    ? entries.get(inspectedReveal.variantId) ?? {
        card: resolveCard(inspectedReveal.variantId, inspectedReveal.level),
        copies: inspectedReveal.copies,
      }
    : undefined;

  function close() {
    setInspected(null);
    onClose();
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
        {result && (
          <>
            <header className="summon-reveal-heading">
              <DialogTitle>
                {result.count === 10
                  ? "Dernières invocations"
                  : "Dernière invocation"}
              </DialogTitle>
              <div className="summon-reveal-actions">
                <DialogClose className="sanctuary-text-button">
                  Continuer à invoquer
                </DialogClose>
                <Link to="/decks" className="sylve-button" onClick={close}>
                  Voir ma collection
                  <ArrowRight size={16} />
                </Link>
              </div>
            </header>
            <div
              className="summon-reveal-grid"
              role="list"
              aria-label="Cartes invoquées"
              data-count={result.count}
            >
              {result.reveals.map((item, index) => {
                const entry = entries.get(item.variantId);
                const card =
                  entry?.card ?? resolveCard(item.variantId, item.level);
                return (
                  <div
                    className="summon-reveal-card"
                    data-rarity={card.rarity}
                    key={`${item.variantId}-${index}`}
                    role="listitem"
                    style={{ animationDelay: `${Math.min(index * 65, 500)}ms` }}
                  >
                    <button
                      type="button"
                      className="workshop-card"
                      data-rarity={card.rarity}
                      style={{ "--creature-color": card.color } as CSSProperties}
                      aria-label={`${card.name}, ${combatTypeLabel(card)}, ${card.attack} attaque, ${card.health} points de vie, ${RARITY_LABELS[card.rarity!]}, niveau ${card.level ?? 1}, voir les informations`}
                      aria-haspopup="dialog"
                      onClick={() => setInspected(item.variantId)}
                    >
                      <CardArtwork
                        card={card}
                        copies={
                          entry?.copies ?? reveals.get(item.variantId)?.copies
                        }
                      />
                    </button>
                    <span className="rarity-label" data-rarity={card.rarity}>
                      {RARITY_LABELS[card.rarity!]}
                    </span>
                    <small className={item.isNew ? "summon-new" : ""}>
                      {item.isNew ? "Nouvelle carte" : "+1 exemplaire"}
                    </small>
                  </div>
                );
              })}
            </div>
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
