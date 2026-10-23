import { useRef, useState, type CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import { ConvexError } from "convex/values";
import {
  ArrowRight,
  Crown,
  Gem,
  History,
  LoaderCircle,
  Sparkles,
} from "lucide-react";
import { RARITIES, RARITY_LABELS, resolveCard } from "@sylve/game";
import {
  SUMMON_PACKS,
  WELCOME_DIAMONDS,
  summonPack,
  type SummonCount,
  type SummonPack,
  type SummonPackId,
  type SummonResult,
} from "@sylve/game/summoning";
import { CurrencyBalances } from "@/components/currency-balances";
import { DiamondAmount } from "@/components/diamond-balance";
import { CreatureCard } from "@/components/game/creature-card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { BestiaryDialog } from "./bestiary-dialog";

export interface SummonRequest {
  packId: SummonPackId;
  count: SummonCount;
  requestId: string;
}

interface SanctuaryProps {
  diamonds: number | null | undefined;
  ready: boolean;
  latest?: SummonResult | null;
  onSummon: (request: SummonRequest) => Promise<SummonResult>;
}

export function Sanctuary({
  diamonds,
  ready,
  latest,
  onSummon,
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
    if (lock.current || !ready || diamonds == null || diamonds < cost) return;
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
        <div className="sanctuary-location">
          <Gem size={15} />
          <span>Le sanctuaire</span>
        </div>
        <CurrencyBalances />
      </header>
      <div className="sanctuary-content">
        <div className="sanctuary-intro">
          <span className="sanctuary-eyebrow">
            <span />
            Le cercle des invocations
            <span />
          </span>
          <h1>Éveille de nouveaux alliés.</h1>
          <p>Offre tes diamants. Laisse la Sylve te répondre.</p>
        </div>
        <section
          className="summon-packs"
          aria-label="Packs d’invocation"
          aria-busy={!!busy}
        >
          {SUMMON_PACKS.map((pack) => (
            <PackChoice
              key={pack.id}
              pack={pack}
              diamonds={diamonds}
              ready={ready}
              busy={busy}
              onInvoke={invoke}
            />
          ))}
        </section>
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
        {!ready && !error && (
          <p className="sanctuary-feedback" role="status">
            Le sanctuaire s’éveille…
          </p>
        )}
        <footer className="sanctuary-footer">
          <p>
            <Gem size={13} />
            {WELCOME_DIAMONDS.toLocaleString("fr-FR")} diamants de bienvenue,
            offerts une seule fois.
          </p>
          <nav aria-label="Explorer le sanctuaire">
            {previous && (
              <button
                type="button"
                className="sanctuary-text-button"
                disabled={!!busy}
                onClick={() => setResult(previous)}
              >
                <History size={15} />
                Dernière invocation
              </button>
            )}
            <BestiaryDialog />
            <Link to="/decks" className="sanctuary-text-button">
              Ma collection
              <ArrowRight size={15} />
            </Link>
          </nav>
        </footer>
      </div>
      <SummonRevealDialog result={result} onClose={() => setResult(null)} />
    </main>
  );
}

function PackChoice({
  pack,
  diamonds,
  ready,
  busy,
  onInvoke,
}: {
  pack: SummonPack;
  diamonds: number | null | undefined;
  ready: boolean;
  busy: { packId: SummonPackId; count: SummonCount } | null;
  onInvoke: (id: SummonPackId, count: SummonCount) => void;
}) {
  const premium = pack.id === "ancients";
  const rarities = premium
    ? ["epic", "legendary", "epic"]
    : ["common", "rare", "legendary", "epic"];
  return (
    <article
      className={`summon-pack ${premium ? "summon-pack-premium" : ""}`}
      aria-labelledby={`pack-${pack.id}`}
    >
      <div className="summon-pack-heading">
        <span>{premium ? "L’appel des esprits" : "L’appel de la forêt"}</span>
        <Sparkles size={15} />
      </div>
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
      <div className="summon-guarantee">
        <Crown size={19} />
        <span>
          Par lot de 10
          <strong>
            Au moins {pack.guaranteedLegendaries} légendaire
            {pack.guaranteedLegendaries > 1 ? "s" : ""} garanti
            {pack.guaranteedLegendaries > 1 ? "s" : ""}
          </strong>
        </span>
      </div>
      <div className="summon-actions">
        {([1, 10] as const).map((count) => {
          const price = count === 10 ? pack.tenPrice : pack.price;
          const working = busy?.packId === pack.id && busy.count === count;
          const insufficient = diamonds != null && diamonds < price;
          return (
            <button
              key={count}
              type="button"
              className={`summon-button ${count === 10 ? "summon-button-ten" : ""}`}
              disabled={!ready || !!busy || diamonds == null || insufficient}
              aria-label={`Invoquer ${count} fois — ${pack.name}, ${price} diamants`}
              title={
                insufficient
                  ? `Il te manque ${(price - diamonds!).toLocaleString("fr-FR")} diamants.`
                  : undefined
              }
              onClick={() => onInvoke(pack.id, count)}
            >
              {count === 10 && <span className="summon-discount">−10 %</span>}
              <span className="summon-button-label">
                {working ? (
                  <LoaderCircle className="animate-spin" size={15} />
                ) : (
                  <Sparkles size={14} />
                )}
                {count === 1 ? "Invoquer ×1" : "Invoquer ×10"}
              </span>
              <span className="summon-button-price">
                {count === 10 && (
                  <del aria-label={`Au lieu de ${pack.price * 10} diamants`}>
                    {(pack.price * 10).toLocaleString("fr-FR")}
                  </del>
                )}
                <DiamondAmount amount={price} />
              </span>
            </button>
          );
        })}
      </div>
      {diamonds != null && diamonds < pack.price && (
        <p className="summon-insufficient">
          Diamants insuffisants · Il te manque{" "}
          {(pack.price - diamonds).toLocaleString("fr-FR")} diamants.
        </p>
      )}
      <p className="summon-rate-note">
        Taux par invocation, hors garantie du lot de 10.
      </p>
    </article>
  );
}

export function SummonRevealDialog({
  result,
  onClose,
}: {
  result: SummonResult | null;
  onClose: () => void;
}) {
  const popup = useRef<HTMLDivElement>(null);
  const pack = result ? summonPack(result.packId) : null;
  const legendaryCount =
    result?.reveals.filter((item) => item.variantId.endsWith(":legendary"))
      .length ?? 0;
  return (
    <Dialog
      open={!!result}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        ref={popup}
        initialFocus={popup}
        className="summon-reveal-dialog"
        appearance="game"
      >
        {result && pack && (
          <>
            <span className="sanctuary-eyebrow">
              <Sparkles size={14} />
              {pack.name}
            </span>
            <DialogTitle>
              {result.count === 10
                ? "Ton cercle s’agrandit."
                : "Un esprit a répondu."}
            </DialogTitle>
            <DialogDescription>
              {result.count} carte{result.count > 1 ? "s" : ""} ajoutée
              {result.count > 1 ? "s" : ""} à ta collection.{" "}
              {legendaryCount > 0 &&
                `${legendaryCount} légendaire${legendaryCount > 1 ? "s" : ""} !`}{" "}
              Les doublons rejoignent ta réserve d’exemplaires.
            </DialogDescription>
            <div
              className={`summon-reveal-grid ${result.count === 1 ? "summon-reveal-single" : ""}`}
              role="list"
              aria-label="Cartes invoquées"
            >
              {result.reveals.map((item, index) => {
                const card = resolveCard(item.variantId, item.level);
                return (
                  <div
                    className="summon-reveal-card"
                    data-rarity={card.rarity}
                    key={`${item.variantId}-${index}`}
                    role="listitem"
                    style={{ animationDelay: `${Math.min(index * 65, 500)}ms` }}
                  >
                    <CreatureCard card={card} disabled />
                    <strong>{card.name}</strong>
                    <span className="rarity-label" data-rarity={card.rarity}>
                      {RARITY_LABELS[card.rarity!]}
                    </span>
                    <small className={item.isNew ? "summon-new" : ""}>
                      {item.isNew ? (
                        <>
                          <Sparkles size={10} />
                          Nouvelle carte
                        </>
                      ) : (
                        "+1 exemplaire"
                      )}
                    </small>
                  </div>
                );
              })}
            </div>
            <div className="summon-reveal-actions">
              <DialogClose className="sanctuary-text-button">
                Continuer à invoquer
              </DialogClose>
              <Link to="/decks" className="sylve-button" onClick={onClose}>
                Voir ma collection
                <ArrowRight size={16} />
              </Link>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
