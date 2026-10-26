import { useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Check, LoaderCircle, MessageCircle, X } from "lucide-react";
import { api } from "@my-better-t-app/backend/convex/_generated/api";
import {
  FRIEND_HELP_TOKENS,
  FRIEND_LIMIT,
} from "@my-better-t-app/backend/convex/lib/social";
import { leagueAt } from "@sylve/game/leagues";
import { ConvexError } from "convex/values";
import {
  FriendshipAmount,
  FriendshipIcon,
} from "@/components/friendship-balance";
import { GameIcon } from "@/components/game/game-icon";
import { HubPanel } from "./hub-panel";
import { PlayerMenu, type SocialPlayer } from "./player-menu";
import { useSocialDay } from "./use-social-day";

export type FriendsOverview = FunctionReturnType<typeof api.social.list>;

export function FriendsPanel({
  id,
  onClose,
  onMessage,
}: {
  id: string;
  onClose: () => void;
  onMessage: (player: SocialPlayer) => void;
}) {
  const refreshDay = useSocialDay();
  const data = useQuery(api.social.list, { refreshDay });
  const sendHelp = useMutation(api.social.sendHelp);
  const accept = useMutation(api.social.accept);
  const remove = useMutation(api.social.remove);
  const [busy, setBusy] = useState<string | null>(null);
  const pending = useRef(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(
    playerId: string,
    action: (args: { playerId: string }) => Promise<unknown>,
    success: string,
  ) {
    if (pending.current) return;
    pending.current = true;
    setBusy(playerId);
    setError(null);
    setNotice(null);
    try {
      await action({ playerId });
      setNotice(success);
    } catch (cause) {
      setError(
        cause instanceof ConvexError && typeof cause.data === "string"
          ? cause.data
          : "L’action a échoué. Réessaie.",
      );
    } finally {
      pending.current = false;
      setBusy(null);
    }
  }

  return (
    <HubPanel
      id={id}
      title="Amis"
      description="Les liens qui font grandir le refuge"
      icon="friends"
      closeLabel="Fermer les amis"
      onClose={onClose}
      className="hub-friends"
    >
      <div className="social-friends-summary">
        <span>
          <strong>{data?.friends.length ?? "—"}</strong> / {FRIEND_LIMIT} amis
        </span>
        {data && <FriendshipAmount amount={data.tokens} />}
      </div>
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
      <div className="social-friends-scroll" aria-busy={!data}>
        {!data ? (
          <div className="hub-world-chat-empty" role="status">
            <LoaderCircle size={24} className="animate-spin" />
            <p>Retrouvons tes amis…</p>
          </div>
        ) : (
          <>
            {data.incoming.length > 0 && (
              <section
                className="social-request-section"
                aria-label="Demandes reçues"
              >
                <h3>
                  Demandes reçues <span>{data.incoming.length}</span>
                </h3>
                <ul className="social-player-list">
                  {data.incoming.map((player) => (
                    <li key={player.playerId} className="social-player-row">
                      <PlayerMenu {...player} onMessage={onMessage} />
                      <span className="social-player-identity">
                        <strong>{player.name}</strong>
                        <small>Souhaite devenir ton ami</small>
                      </span>
                      <button
                        type="button"
                        className="social-icon-button"
                        disabled={!!busy || data.friends.length >= FRIEND_LIMIT}
                        aria-label={`Accepter ${player.name}`}
                        title={
                          data.friends.length >= FRIEND_LIMIT
                            ? "Ta liste contient déjà 25 amis"
                            : "Accepter"
                        }
                        onClick={() =>
                          void act(
                            player.playerId,
                            accept,
                            `${player.name} fait maintenant partie de tes amis.`,
                          )
                        }
                      >
                        <Check size={17} />
                      </button>
                      <button
                        type="button"
                        className="social-icon-button"
                        disabled={!!busy}
                        aria-label={`Refuser ${player.name}`}
                        onClick={() =>
                          void act(player.playerId, remove, "Demande refusée.")
                        }
                      >
                        <X size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <section aria-label="Mes amis">
              {data.friends.length ? (
                <ul className="social-player-list">
                  {data.friends.map((player) => (
                    <li key={player.playerId} className="social-player-row">
                      <PlayerMenu {...player} onMessage={onMessage} />
                      <button
                        type="button"
                        className="social-player-identity social-conversation-link"
                        aria-label={`Discuter avec ${player.name}`}
                        onClick={() => onMessage(player)}
                      >
                        <strong>{player.name}</strong>
                        <small>{leagueAt(player.trophies).label}</small>
                      </button>
                      <button
                        type="button"
                        className="social-icon-button"
                        aria-label={`Envoyer un message à ${player.name}`}
                        onClick={() => onMessage(player)}
                      >
                        <MessageCircle size={17} />
                      </button>
                      <button
                        type="button"
                        className="social-help-button"
                        disabled={!!busy || player.helpSent}
                        aria-label={
                          player.helpSent
                            ? `Aide déjà envoyée à ${player.name}`
                            : `Envoyer une aide à ${player.name}, ${FRIEND_HELP_TOKENS} jetons`
                        }
                        title={
                          player.helpSent
                            ? "Aide envoyée aujourd’hui"
                            : "+10 jetons pour cet ami"
                        }
                        onClick={() =>
                          void act(
                            player.playerId,
                            sendHelp,
                            `Aide envoyée : ${player.name} reçoit 10 jetons d’entraide.`,
                          )
                        }
                      >
                        {busy === player.playerId ? (
                          <LoaderCircle size={16} className="animate-spin" />
                        ) : player.helpSent ? (
                          <Check size={17} />
                        ) : (
                          <>
                            <FriendshipIcon />
                            <span>+10</span>
                          </>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="hub-world-chat-empty social-friends-empty">
                  <GameIcon kind="friends" size={68} />
                  <strong>Une aventure à partager</strong>
                  <p>
                    Clique sur l’icône d’un gardien dans le chat mondial, puis
                    sur « Ajouter aux amis ».
                  </p>
                </div>
              )}
            </section>
            {data.outgoing.length > 0 && (
              <section
                className="social-request-section"
                aria-label="Demandes envoyées"
              >
                <h3>
                  Demandes envoyées <span>{data.outgoing.length}</span>
                </h3>
                <ul className="social-player-list">
                  {data.outgoing.map((player) => (
                    <li key={player.playerId} className="social-player-row">
                      <PlayerMenu {...player} onMessage={onMessage} />
                      <span className="social-player-identity">
                        <strong>{player.name}</strong>
                        <small>En attente de réponse</small>
                      </span>
                      <button
                        type="button"
                        className="social-icon-button"
                        disabled={!!busy}
                        aria-label={`Annuler la demande à ${player.name}`}
                        onClick={() =>
                          void act(player.playerId, remove, "Demande annulée.")
                        }
                      >
                        <X size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </HubPanel>
  );
}

export function FriendConversations({
  data,
  onSelect,
}: {
  data: FriendsOverview | undefined;
  onSelect: (player: SocialPlayer) => void;
}) {
  if (!data)
    return (
      <div className="hub-world-chat-empty" role="status">
        <LoaderCircle className="animate-spin" size={24} />
        <p>Chargement des conversations…</p>
      </div>
    );
  return (
    <div className="social-friends-scroll">
      {data.friends.length ? (
        <ul className="social-player-list">
          {data.friends.map((player) => (
            <li key={player.playerId} className="social-player-row">
              <PlayerMenu {...player} onMessage={onSelect} />
              <button
                type="button"
                className="social-player-identity social-conversation-link"
                onClick={() => onSelect(player)}
              >
                <strong>{player.name}</strong>
                <small>{leagueAt(player.trophies).label}</small>
              </button>
              <button
                type="button"
                className="social-icon-button"
                aria-label={`Discuter avec ${player.name}`}
                onClick={() => onSelect(player)}
              >
                <MessageCircle size={18} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="hub-world-chat-empty social-friends-empty">
          <GameIcon kind="friends" size={60} />
          <strong>Retrouve tes amis ici</strong>
          <p>
            Ajoute des gardiens depuis le chat mondial pour discuter en privé.
          </p>
        </div>
      )}
    </div>
  );
}
