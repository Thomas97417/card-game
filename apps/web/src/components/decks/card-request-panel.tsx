import { useRef, useState } from "react";
import type { FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import { Check, Clock3, LoaderCircle, Send } from "lucide-react";
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
        <p>Tes amis peuvent t’aider à faire grandir ta collection.</p>
      </header>
      {!status ? (
        <p className="card-request-note" role="status">
          <LoaderCircle size={18} className="animate-spin" /> Chargement de ta
          demande…
        </p>
      ) : (
        <>
          {request && requestedCard ? (
            <div className="card-request-summary" data-complete={complete}>
              <GameIcon kind={complete ? "rewards" : "friends"} size={58} />
              <div>
                <span className="card-request-eyebrow">
                  {complete ? "Demande comblée" : "Ta demande du jour"}
                </span>
                <h3>{requestedCard.name}</h3>
                <p>
                  {request.received} / {request.requested} cartes reçues
                </p>
              </div>
              <progress
                max={request.requested}
                value={request.received}
                aria-label="Cartes reçues aujourd’hui"
              />
              <p className="card-request-summary-note">
                Les cartes reçues rejoignent directement ta réserve.
              </p>
            </div>
          ) : eligible ? (
            <div className="card-request-summary">
              <GameIcon kind="friends" size={58} />
              <div>
                <span className="card-request-eyebrow">
                  {status.leagueLabel} · Meilleure ligue
                </span>
                <h3>
                  {count} cartes {rarity === "common" ? "communes" : "rares"}
                </h3>
                <p>{entry.card.name} · Demande à tous tes amis</p>
              </div>
            </div>
          ) : null}
          {!eligible && (
            <p className="card-request-note">
              Seules les cartes communes et rares peuvent être demandées.
              Choisis une de ces cartes dans ta collection.
            </p>
          )}
          {!status.unlocked && (
            <p className="card-request-note">
              Les demandes se débloquent avec les amis au rang{" "}
              {FRIENDS_UNLOCK_RANK}. Améliore tes cartes pour gagner de l’XP.
            </p>
          )}
          {status.unlocked && status.friendCount === 0 && !request && (
            <p className="card-request-note">
              Ajoute des gardiens à tes amis depuis le hub pour qu’ils puissent
              répondre à ta demande.
            </p>
          )}
          <div className="card-request-rules">
            <p>
              <Clock3 size={17} aria-hidden="true" />
              <span>
                Une demande par jour. Nouvelle demande à minuit, heure de Paris.
              </span>
            </p>
            <p>
              <GameIcon kind="all" size={19} />
              <span>
                Les quantités augmentent avec ta meilleure ligue atteinte.
              </span>
            </p>
          </div>
          {error && (
            <p className="card-request-note is-error" role="alert">
              {error}
            </p>
          )}
          {posted && (
            <p className="card-request-note" role="status">
              <Check size={18} /> Demande envoyée à tes amis.
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
            ) : request || posted ? (
              <Check size={18} />
            ) : (
              <Send size={18} />
            )}
            {busy
              ? "Envoi de la demande…"
              : request || posted
                ? "Demande du jour utilisée"
                : `Demander ${count} cartes`}
          </button>
          <p className="card-request-footnote">
            Retrouve les demandes de tes amis dans le hub, menu Amis. Chaque don
            leur rapporte de l’XP de Rang.
          </p>
        </>
      )}
    </section>
  );
}
