import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ConvexError } from "convex/values";
import { Check, Crown, LoaderCircle, ShieldCheck, X } from "lucide-react";
import { resolveCard, RARITY_LABELS } from "@sylve/game";
import {
  LEGENDARY_OFFERS,
  LEGENDARY_OFFER_MAX_RANK,
  LEGENDARY_OFFER_EMERALDS,
  LEGENDARY_OFFER_GOLD,
  type LegendaryOffer,
  type LegendaryOfferBoard,
  type LegendaryOfferId,
  type LegendaryPaymentStatus,
} from "@sylve/game/legendary-offers";
import { CreaturePortrait } from "@/components/game/creature-portrait";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export interface HubLegendaryOffersProps {
  board?: LegendaryOfferBoard;
  onPurchase?: (offerId: LegendaryOfferId) => Promise<void>;
}

export function LegendaryOffersDialog({
  board,
  onPurchase,
  open,
  onClose,
}: HubLegendaryOffersProps & { open: boolean; onClose: () => void }) {
  const [busy, setBusy] = useState<LegendaryOfferId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);

  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  async function buy(offerId: LegendaryOfferId) {
    if (
      lock.current ||
      !board?.eligible ||
      !onPurchase ||
      !board.offers.find((offer) => offer.id === offerId)?.available
    )
      return;
    lock.current = true;
    setBusy(offerId);
    setError(null);
    try {
      await onPurchase(offerId);
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
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent className="legendary-offers-dialog" appearance="game">
        <header className="legendary-offers-heading">
          <DialogTitle>Le pouvoir des légendes</DialogTitle>
          <span className="legendary-offers-rank">
            <Crown size={14} /> Jusqu’au rang {LEGENDARY_OFFER_MAX_RANK} inclus{" "}
            <span>· Ton rang : {board?.rank ?? "…"}</span>
          </span>
        </header>
        <div className="legendary-offers-grid" aria-busy={busy !== null}>
          {LEGENDARY_OFFERS.map((offer) => {
            const available =
              board?.eligible &&
              board.offers.find((item) => item.id === offer.id)?.available;
            return (
              <article
                key={offer.id}
                className={`legendary-offer is-${offer.theme}`}
                aria-labelledby={`offer-${offer.id}`}
              >
                <div className="legendary-offer-topline">
                  <span>Pack légendaire</span>
                </div>
                <h3 id={`offer-${offer.id}`}>{offer.name}</h3>
                <p className="legendary-offer-subtitle">{offer.subtitle}</p>
                <OfferCards offer={offer} />
                <p className="legendary-offer-description">
                  {offer.description}
                </p>
                <div className="legendary-offer-currencies">
                  <span>
                    <img src="/art/treasures/emerald-small-pouch.webp" alt="" />
                    <span>
                      <strong>
                        {LEGENDARY_OFFER_EMERALDS.toLocaleString("fr-FR")}
                      </strong>
                      <small>Émeraudes</small>
                    </span>
                  </span>
                  <span>
                    <img src="/art/treasures/gold-pouch.webp" alt="" />
                    <span>
                      <strong>
                        {LEGENDARY_OFFER_GOLD.toLocaleString("fr-FR")}
                      </strong>
                      <small>Or</small>
                    </span>
                  </span>
                </div>
                <button
                  type="button"
                  className="legendary-offer-buy"
                  disabled={!available || !!busy || !onPurchase}
                  aria-busy={busy === offer.id || undefined}
                  aria-label={`Acheter ${offer.name} pour 20 €`}
                  onClick={() => void buy(offer.id)}
                >
                  <span>
                    {busy === offer.id ? (
                      <>
                        <LoaderCircle size={16} className="animate-spin" />{" "}
                        Ouverture…
                      </>
                    ) : (
                      "Obtenir ce pack"
                    )}
                  </span>
                  <strong>20,00 €</strong>
                </button>
                <p className="legendary-offer-purchase-note">
                  {!board?.eligible
                    ? "Offre réservée aux rangs 1 à 25 inclus"
                    : !available
                      ? "Bientôt disponible"
                      : "Paiement ponctuel · Sécurisé par Polar"}
                </p>
              </article>
            );
          })}
        </div>
        {error && (
          <p className="legendary-offers-error" role="alert">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function OfferCards({ offer }: { offer: LegendaryOffer }) {
  return (
    <div className="legendary-offer-showcase">
      <div className="legendary-offer-magic" aria-hidden="true">
        <span className="offer-magic-rays" />
        <span className="offer-magic-ring" />
        {Array.from({ length: 12 }, (_, index) => (
          <i key={index} style={{ "--spark": index } as CSSProperties} />
        ))}
      </div>
      <ul
        className="legendary-offer-cards"
        aria-label={`Cartes du pack ${offer.name}`}
      >
        {offer.cards.map(({ variantId, count }) => {
          const card = resolveCard(variantId);
          const rarity = card.rarity ?? "rare";
          return (
            <li
              key={variantId}
              className="legendary-offer-card-slot"
              data-rarity={rarity}
            >
              <div
                className="legendary-offer-card"
                style={{ "--creature-color": card.color } as CSSProperties}
              >
                <span className="offer-card-rarity">
                  {RARITY_LABELS[rarity]}
                </span>
                <CreaturePortrait card={card} />
                <strong className="offer-card-name">{card.name}</strong>
                <span className="offer-card-shine" aria-hidden="true" />
              </div>
              <span className="offer-card-count">
                <small>×</small> {count}
                <span className="sr-only"> exemplaires</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function LegendaryPaymentFeedback({
  status,
  onDismiss,
}: {
  status: LegendaryPaymentStatus | null | undefined;
  onDismiss: () => void;
}) {
  const [delayed, setDelayed] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setDelayed(true), 45_000);
    return () => window.clearTimeout(timer);
  }, []);
  const pending = status === undefined || status?.status === "pending";
  const offer = LEGENDARY_OFFERS.find((item) => item.id === status?.offerId);
  return (
    <div className="legendary-payment-feedback" role="status">
      {pending ? (
        <LoaderCircle size={20} className="animate-spin" />
      ) : status?.status === "paid" ? (
        <Check size={20} />
      ) : (
        <ShieldCheck size={20} />
      )}
      <span>
        {pending
          ? delayed
            ? "La confirmation prend un peu de temps. Ton pack sera ajouté dès réception du paiement, même si tu quittes le refuge."
            : "Vérification du paiement… Ton pack arrive dès sa confirmation."
          : status?.status === "paid"
            ? `${offer?.name ?? "Pack légendaire"} reçu : ${status.emeralds.toLocaleString("fr-FR")} émeraudes, ${status.gold.toLocaleString("fr-FR")} or et tes ${status.cards.reduce((sum, card) => sum + card.count, 0)} cartes ont rejoint ta collection.`
            : status?.status === "refunded"
              ? "Cet achat a été remboursé. Les ressources et les exemplaires correspondants ont été retirés."
              : "Cet achat n’a pas été retrouvé sur ton compte. Si tu as été débité, conserve ton reçu et contacte l’assistance."}
      </span>
      <button
        type="button"
        aria-label="Fermer le suivi du paiement"
        onClick={onDismiss}
      >
        <X size={18} />
      </button>
    </div>
  );
}
