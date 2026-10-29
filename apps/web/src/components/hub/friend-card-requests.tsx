import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import { Check, LoaderCircle, Send } from "lucide-react";
import { resolveCard, RARITY_LABELS } from "@sylve/game";
import { api } from "@my-better-t-app/backend/convex/_generated/api";
import { CreaturePortrait } from "@/components/game/creature-portrait";
import { GameIcon } from "@/components/game/game-icon";

export type FriendCardRequests = FunctionReturnType<
  typeof api.social.cardRequests
>;

export function FriendCardRequests({
  requests,
}: {
  requests: FriendCardRequests | undefined;
}) {
  const donate = useMutation(api.social.donateCards);
  const pending = useRef(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(request: FriendCardRequests[number]) {
    if (pending.current || request.sendable <= 0) return;
    pending.current = true;
    setBusy(request.id);
    setNotice(null);
    setError(null);
    try {
      const result = await donate({
        requestId: request.id,
        count: request.sendable,
        expectedDonated: request.donated,
      });
      setNotice(
        result.sent
          ? `${result.count} carte${result.count > 1 ? "s" : ""} envoyée${result.count > 1 ? "s" : ""} à ${request.playerName} · +${result.experience} XP de Rang.`
          : "Ce don a déjà été pris en compte.",
      );
    } catch (cause) {
      setError(
        cause instanceof ConvexError && typeof cause.data === "string"
          ? cause.data
          : "Le don a échoué. Réessaie.",
      );
    } finally {
      pending.current = false;
      setBusy(null);
    }
  }

  return (
    <section
      className="social-card-requests"
      aria-label="Cartes demandées par mes amis"
      aria-busy={!requests}
    >
      {error && (
        <p className="social-notice social-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="social-notice" role="status">
          {notice}
        </p>
      )}
      {!requests ? (
        <div className="hub-world-chat-empty" role="status">
          <LoaderCircle size={24} className="animate-spin" />
          <p>Retrouvons leurs demandes…</p>
        </div>
      ) : requests.length === 0 ? (
        <div className="hub-world-chat-empty social-friends-empty">
          <GameIcon kind="friends" size={60} />
          <strong>Aucune carte demandée aujourd’hui</strong>
          <Link className="social-deck-link" to="/decks">
            Faire ma demande depuis le deck
          </Link>
        </div>
      ) : (
        <ul className="social-card-request-list">
          {requests.map((request) => {
            const card = resolveCard(request.variantId);
            const complete = request.received >= request.requested;
            const limitReached = request.donated >= request.donationLimit;
            const unavailable = complete
              ? "Demande comblée"
              : limitReached
                ? "Limite de don atteinte"
                : "Aucun exemplaire en réserve";
            return (
              <li
                key={request.id}
                className="social-card-request"
                data-rarity={card.rarity}
              >
                <div className="social-card-request-heading">
                  <Link
                    to="/decks"
                    search={{ card: card.id }}
                    className="social-request-portrait"
                    aria-label={`Voir ${card.name} dans le deck`}
                  >
                    <CreaturePortrait card={card} />
                  </Link>
                  <div className="social-card-request-identity">
                    <span>{request.playerName} demande</span>
                    <strong>{card.name}</strong>
                    <small>
                      {RARITY_LABELS[card.rarity ?? "common"]} ·{" "}
                      {request.copies} en réserve
                    </small>
                  </div>
                  {complete && <Check size={18} aria-label="Demande comblée" />}
                </div>
                <div className="social-card-request-progress">
                  <progress
                    value={request.received}
                    max={request.requested}
                    aria-label={`Cartes reçues par ${request.playerName}`}
                  />
                  <span>
                    {request.received} / {request.requested}
                  </span>
                </div>
                <div className="social-card-request-footer">
                  <small>
                    Tes dons : {request.donated} / {request.donationLimit}
                  </small>
                  <button
                    type="button"
                    className="social-help-button social-card-send"
                    disabled={!!busy || request.sendable <= 0}
                    aria-label={
                      request.sendable > 0
                        ? `Envoyer ${request.sendable} cartes à ${request.playerName}, +${request.sendable * request.experiencePerCard} XP de Rang`
                        : `${unavailable} pour ${request.playerName}`
                    }
                    onClick={() => void send(request)}
                  >
                    {busy === request.id ? (
                      <LoaderCircle size={16} className="animate-spin" />
                    ) : complete || limitReached ? (
                      <Check size={16} />
                    ) : (
                      <Send size={15} />
                    )}
                    <span>
                      {request.sendable > 0
                        ? `Envoyer ${request.sendable}`
                        : unavailable}
                      {request.sendable > 0 && (
                        <small>
                          +{request.sendable * request.experiencePerCard} XP
                        </small>
                      )}
                    </span>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
