import { useRef, useState } from "react";
import type { FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import { LoaderCircle } from "lucide-react";
import { resolveCard, type OwnedCard } from "@sylve/game";
import { isRequestableRarity } from "@sylve/game/card-requests";
import { FRIENDS_UNLOCK_RANK } from "@sylve/game/ranks";
import type { api } from "@my-better-t-app/backend/convex/_generated/api";
import { GameIcon } from "@/components/game/game-icon";

export type CardRequestStatus = FunctionReturnType<
  typeof api.social.cardRequestStatus
>;

export interface CardRequestActions {
  cardRequestStatus?: CardRequestStatus;
  onRequestCards?: (variantId: string) => Promise<unknown>;
}

export function CardRequestPanel({
  entry,
  status,
  onRequest,
}: {
  entry: OwnedCard;
  status: CardRequestStatus | undefined;
  onRequest: (variantId: string) => Promise<unknown>;
}) {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [posted, setPosted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rarity = entry.card.rarity;
  const eligible = isRequestableRarity(rarity);
  const count = eligible && status ? status.limits[rarity].request : 0;
  const request = status?.request;
  const requestedCard = request ? resolveCard(request.variantId) : null;
  const complete = !!request && request.received >= request.requested;

  async function requestCards() {
    if (pending.current || !status?.unlocked || !eligible || request || posted)
      return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      await onRequest(entry.card.id);
      setPosted(true);
    } catch (cause) {
      setError(
        cause instanceof ConvexError && typeof cause.data === "string"
          ? cause.data
          : "La demande a échoué. Réessaie.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="card-request-panel" aria-label="Demander des cartes">
      <header className="upgrade-view-heading">
        <h2>Demander des cartes</h2>
      </header>
      {!status ? (
        <p className="card-request-note" role="status">
          <LoaderCircle size={18} className="animate-spin" /> Chargement…
        </p>
      ) : (
        <div className="card-request-card" data-complete={complete}>
          {(request || (eligible && status.unlocked)) && (
            <span className="card-request-daily">
              <GameIcon kind="rewardClock" size={22} />
              {request || posted ? "Demain" : "1 / jour"}
            </span>
          )}
          <div className="card-request-summary">
            <GameIcon
              kind={
                request
                  ? complete
                    ? "rewards"
                    : "friends"
                  : !eligible || !status.unlocked
                    ? "rewardLock"
                    : "friends"
              }
              size={80}
            />
            {request && requestedCard ? (
              <>
                <span className="card-request-eyebrow">
                  {complete ? "Demande comblée" : "Ta demande du jour"}
                </span>
                <h3>{requestedCard.name}</h3>
                <p className="card-request-received">
                  <strong>
                    {request.received} / {request.requested}
                  </strong>
                  cartes reçues
                </p>
                <progress
                  max={request.requested}
                  value={request.received}
                  aria-label="Cartes reçues aujourd’hui"
                />
              </>
            ) : !status.unlocked ? (
              <h3>Rang {FRIENDS_UNLOCK_RANK} requis</h3>
            ) : !eligible ? (
              <h3>Communes et rares uniquement</h3>
            ) : (
              <h3 className="card-request-count" data-rarity={rarity}>
                <img
                  src={`/art/ui/rarity-${rarity}.webp`}
                  alt=""
                  aria-hidden="true"
                  width={30}
                  height={42}
                  draggable={false}
                />
                <span>
                  <strong>{count}</strong> cartes{" "}
                  {rarity === "common" ? "communes" : "rares"}
                </span>
              </h3>
            )}
          </div>
          {error && (
            <p className="card-request-note is-error" role="alert">
              {error}
            </p>
          )}
          {posted && (
            <p className="sr-only" role="status">
              Demande envoyée à tes amis.
            </p>
          )}
          <button
            type="button"
            className="sylve-button card-request-submit"
            disabled={
              !eligible || !status.unlocked || !!request || busy || posted
            }
            onClick={() => void requestCards()}
          >
            {busy ? (
              <LoaderCircle size={18} className="animate-spin" />
            ) : (
              <GameIcon
                kind={request || posted ? "rewards" : "friends"}
                size={28}
              />
            )}
            {busy
              ? "Envoi de la demande…"
              : request || posted
                ? "Demande du jour utilisée"
                : !status.unlocked
                  ? `Rang ${FRIENDS_UNLOCK_RANK} requis`
                  : !eligible
                    ? "Indisponible pour cette rareté"
                    : `Demander ${count} cartes`}
          </button>
        </div>
      )}
    </section>
  );
}
