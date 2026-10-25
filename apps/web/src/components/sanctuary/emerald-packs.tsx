import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ConvexError } from "convex/values";
import { Check, LoaderCircle, ShieldCheck, X } from "lucide-react";
import {
  EMERALD_PACKS,
  type EmeraldPackId,
  type EmeraldPackOffer,
  type EmeraldPaymentStatus,
} from "@sylve/game/emerald-packs";
import { EmeraldAmount } from "@/components/emerald-balance";

export function EmeraldPacks({
  offers,
  ready,
  onPurchase,
}: {
  offers: EmeraldPackOffer[] | undefined;
  ready: boolean;
  onPurchase?: (packId: EmeraldPackId) => Promise<void>;
}) {
  const [busy, setBusy] = useState<EmeraldPackId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);

  async function buy(packId: EmeraldPackId) {
    if (
      lock.current ||
      !ready ||
      !onPurchase ||
      !offers?.find((offer) => offer.id === packId)?.available
    )
      return;
    lock.current = true;
    setBusy(packId);
    setError(null);
    try {
      await onPurchase(packId);
    } catch (cause) {
      setError(
        cause instanceof ConvexError && typeof cause.data === "string"
          ? cause.data
          : "Le paiement n’a pas pu s’ouvrir. Réessaie dans un instant.",
      );
    } finally {
      lock.current = false;
      setBusy(null);
    }
  }

  return (
    <section
      className="emerald-shop"
      id="emerald-packs"
      aria-label="Packs d’émeraudes"
      aria-busy={busy !== null}
    >
      <div className="emerald-pack-grid">
        {EMERALD_PACKS.map((pack) => {
          const offer = offers?.find((item) => item.id === pack.id);
          const price =
            offer?.priceAmount != null && offer.priceCurrency
              ? new Intl.NumberFormat("fr-FR", {
                  style: "currency",
                  currency: offer.priceCurrency,
                }).format(offer.priceAmount / 100)
              : null;
          const working = busy === pack.id;
          return (
            <article
              className="emerald-pack"
              key={pack.id}
              aria-labelledby={`emerald-pack-${pack.id}`}
            >
              <img
                className="emerald-pack-art"
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
              <h2 id={`emerald-pack-${pack.id}`}>{pack.name}</h2>
              <p className="emerald-pack-description">{pack.description}</p>
              <div className="emerald-pack-amount">
                <EmeraldAmount amount={pack.emeralds} />
              </div>
              <button
                className="emerald-pack-button"
                type="button"
                disabled={!ready || !!busy || !offer?.available || !onPurchase}
                aria-busy={working || !offers || undefined}
                aria-label={`Acheter ${pack.emeralds.toLocaleString("fr-FR")} émeraudes — ${pack.name}${price ? `, ${price}` : ""}`}
                title={
                  !offers
                    ? "Chargement du prix…"
                    : !offer?.available
                      ? "Ce pack est momentanément indisponible."
                      : undefined
                }
                onClick={() => void buy(pack.id)}
              >
                <strong>{price ?? "—"}</strong>
              </button>
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

export function EmeraldPaymentFeedback({
  status,
  onDismiss,
}: {
  status: EmeraldPaymentStatus | null | undefined;
  onDismiss: () => void;
}) {
  const [delayed, setDelayed] = useState(false);
  useEffect(() => {
    const timeout = window.setTimeout(() => setDelayed(true), 45_000);
    return () => window.clearTimeout(timeout);
  }, []);
  const pending = status === undefined || status?.status === "pending";
  return (
    <div
      className={`sanctuary-feedback emerald-payment-feedback ${status?.status === "paid" ? "is-paid" : ""}`}
      role="status"
    >
      {pending ? (
        <LoaderCircle size={17} className="animate-spin" />
      ) : status?.status === "paid" ? (
        <Check size={17} />
      ) : (
        <ShieldCheck size={17} />
      )}
      <span>
        {pending
          ? delayed
            ? "La confirmation prend un peu de temps. Tes émeraudes seront ajoutées dès réception du paiement, même si tu quittes cette page."
            : "Vérification du paiement… Tes émeraudes apparaîtront dès sa confirmation."
          : status?.status === "paid"
            ? `Paiement confirmé : ${status.emeralds.toLocaleString("fr-FR")} émeraudes ont été ajoutées à ton solde.`
            : status?.status === "refunded"
              ? "Cet achat a été remboursé. Les émeraudes correspondantes ont été retirées."
              : "Cet achat n’a pas été retrouvé sur ton compte. Si tu as été débité, conserve ton reçu et contacte l’assistance."}
      </span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Fermer le suivi du paiement"
      >
        <X size={16} />
      </button>
    </div>
  );
}
