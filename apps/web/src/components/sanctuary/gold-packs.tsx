import { useRef, useState, type CSSProperties } from "react";
import { ConvexError } from "convex/values";
import {
  GOLD_PACKS,
  type GoldPackId,
  type GoldPurchaseRequest,
  type GoldPurchaseResult,
} from "@sylve/game/gold-packs";
import { useCurrencyGain } from "@/components/currency-gain";
import { EmeraldAmount } from "@/components/emerald-balance";
import { GoldAmount } from "@/components/gold-balance";

export function GoldPacks({
  emeralds,
  ready,
  onPurchase,
}: {
  emeralds: number | null | undefined;
  ready: boolean;
  onPurchase?: (request: GoldPurchaseRequest) => Promise<GoldPurchaseResult>;
}) {
  const [busy, setBusy] = useState<GoldPackId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const showGain = useCurrencyGain();
  const lock = useRef(false);
  const pending = useRef<GoldPurchaseRequest | null>(null);

  async function buy(packId: GoldPackId) {
    const pack = GOLD_PACKS.find((item) => item.id === packId)!;
    const retry = pending.current?.packId === packId;
    if (
      lock.current ||
      !ready ||
      !onPurchase ||
      (pending.current && !retry) ||
      (!retry && (emeralds == null || emeralds < pack.cost))
    )
      return;
    lock.current = true;
    setBusy(packId);
    setError(null);
    pending.current ??= { packId, requestId: crypto.randomUUID() };
    try {
      const result = await onPurchase(pending.current);
      pending.current = null;
      showGain("gold", result.gold);
    } catch (cause) {
      if (cause instanceof ConvexError) pending.current = null;
      setError(
        cause instanceof ConvexError && typeof cause.data === "string"
          ? cause.data
          : "L’achat n’a pas pu être confirmé. Réessaie pour le retrouver sans double débit.",
      );
    } finally {
      lock.current = false;
      setBusy(null);
    }
  }

  return (
    <section
      className="gold-shop"
      id="gold-packs"
      aria-label="Packs d’or"
      aria-busy={busy !== null}
    >
      <div className="gold-pack-grid">
        {GOLD_PACKS.map((pack) => {
          const working = busy === pack.id;
          const retry = busy === null && pending.current?.packId === pack.id;
          const insufficient = emeralds != null && emeralds < pack.cost;
          return (
            <article
              className="gold-pack"
              key={pack.id}
              aria-labelledby={`${pack.id}-title`}
            >
              <img
                className="gold-pack-art"
                src={pack.image}
                width={512}
                height={512}
                alt=""
                draggable={false}
                loading="lazy"
                style={
                  { "--treasure-art-scale": pack.artScale } as CSSProperties
                }
              />
              <h2 id={`${pack.id}-title`}>{pack.name}</h2>
              <p className="gold-pack-description">{pack.description}</p>
              <div className="gold-pack-amount">
                <GoldAmount amount={pack.gold} />
              </div>
              <div className="sanctuary-purchase-footer">
                <button
                  className="gold-pack-button"
                  type="button"
                  disabled={
                    !ready ||
                    !!busy ||
                    !onPurchase ||
                    (!!pending.current && !retry) ||
                    (!retry && (emeralds == null || insufficient))
                  }
                  aria-busy={working || undefined}
                  aria-label={`${retry ? "Vérifier l’achat de" : "Acheter"} ${pack.gold.toLocaleString("fr-FR")} pièces d’or — ${pack.name}, ${pack.cost} émeraudes`}
                  title={
                    retry
                      ? "Vérifier l’achat."
                      : insufficient
                        ? `Il te manque ${(pack.cost - emeralds!).toLocaleString("fr-FR")} émeraudes.`
                        : undefined
                  }
                  onClick={() => void buy(pack.id)}
                >
                  <EmeraldAmount amount={pack.cost} />
                </button>
                {insufficient && !retry && (
                  <span className="gold-pack-note">
                    Il te manque{" "}
                    {(pack.cost - emeralds!).toLocaleString("fr-FR")} émeraudes.
                  </span>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {error && (
        <p className="sanctuary-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
