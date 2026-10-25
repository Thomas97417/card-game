import { useEffect, useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { Crown, RefreshCw, X } from "lucide-react";
import { api } from "@my-better-t-app/backend/convex/_generated/api";
import { getCombatType, RARITY_LABELS, type CardDefinition } from "@sylve/game";
import { leagueAt } from "@sylve/game/leagues";
import { CardUpgradeDialog } from "@/components/decks/card-upgrade-dialog";
import { CreaturePortrait } from "@/components/game/creature-portrait";
import { GameIcon } from "@/components/game/game-icon";
import { LeagueBadge, TrophyIcon } from "@/components/leagues/league-progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export function HubRanking({ id, onClose }: { id: string; onClose: () => void }) {
  const titleId = useId();
  const closeButton = useRef<HTMLButtonElement>(null);
  const [expandedPlayers, setExpandedPlayers] = useState<string[]>([]);
  const [inspectedCard, setInspectedCard] = useState<CardDefinition | null>(null);
  const cardTrigger = useRef<HTMLButtonElement>(null);
  const { data: players, isPending, isError, refetch } = useQuery({
    ...convexQuery(api.collection.leaderboard, {}),
    retry: false,
  });

  useEffect(() => {
    closeButton.current?.focus({ preventScroll: true });
  }, []);

  return (
    <>
      <section
        id={id}
        className="hub-ranking"
        aria-labelledby={titleId}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            onClose();
          }
        }}
      >
        <header className="hub-ranking-heading">
          <GameIcon kind="ranking" size={44} />
          <div>
            <span className="hub-ranking-eyebrow">Les gardiens de la Sylve</span>
            <h2 id={titleId}>Classement mondial</h2>
            <p>Les meilleurs gardiens, du rang 1 au rang 50.</p>
          </div>
          <button
            ref={closeButton}
            type="button"
            className="hub-ranking-close"
            aria-label="Fermer le classement"
            onClick={onClose}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="hub-ranking-scroll" aria-busy={isPending}>
          {isPending ? (
            <RankingLoading label="Chargement du classement…" />
          ) : isError ? (
            <RankingError
              message="Le classement est momentanément indisponible."
              onRetry={() => void refetch()}
            />
          ) : !players?.length ? (
            <div className="hub-ranking-empty" role="status">
              <GameIcon kind="ranking" size={64} />
              <strong>Le cercle attend ses champions</strong>
              <p>
                Termine un combat solo ou un duel public dans l’arène pour entrer
                dans le classement.
              </p>
            </div>
          ) : (
            <Accordion value={expandedPlayers} onValueChange={setExpandedPlayers}>
              {players.map((player) => {
                const league = leagueAt(player.trophies);
                return (
                  <AccordionItem
                    key={player.ownerId}
                    value={player.ownerId}
                    className="hub-ranking-player"
                    data-self={player.isCurrentPlayer || undefined}
                  >
                    <AccordionTrigger className="hub-ranking-trigger">
                      <span className="hub-ranking-rank" data-rank={player.rank}>
                        {player.rank === 1 && <Crown size={12} aria-hidden="true" />}
                        <span>#{player.rank}</span>
                      </span>
                      <span aria-hidden="true">
                        <LeagueBadge league={league} size={42} />
                      </span>
                      <span className="hub-ranking-identity">
                        <span className="hub-ranking-name">
                          <span>{player.name}</span>
                          {player.isCurrentPlayer && <small>Toi</small>}
                        </span>
                        <span className="hub-ranking-league">{league.label}</span>
                      </span>
                      <span className="hub-ranking-trophies">
                        <TrophyIcon />
                        {player.trophies.toLocaleString("fr-FR")}
                        <span className="sr-only">trophées</span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      {expandedPlayers.includes(player.ownerId) && (
                        <RankedPlayerDetails
                          ownerId={player.ownerId}
                          onInspect={(card, trigger) => {
                            cardTrigger.current = trigger;
                            setInspectedCard(card);
                          }}
                        />
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </div>

        <footer className="hub-ranking-footer">
          <span className="hub-ranking-live">
            {isError ? "Indisponible" : isPending ? "Connexion…" : "En direct"}
          </span>
          <span>Clique sur un gardien pour découvrir son deck.</span>
        </footer>
      </section>
      <CardUpgradeDialog
        entry={inspectedCard ? { card: inspectedCard, copies: 0 } : undefined}
        readOnly
        onClose={() => setInspectedCard(null)}
        finalFocus={cardTrigger}
      />
    </>
  );
}

function RankedPlayerDetails({
  ownerId,
  onInspect,
}: {
  ownerId: string;
  onInspect: (card: CardDefinition, trigger: HTMLButtonElement) => void;
}) {
  const { data: profile, isPending, isError, refetch } = useQuery({
    ...convexQuery(api.collection.playerProfile, { ownerId }),
    retry: false,
  });

  return (
    <div className="hub-ranking-details">
      {isPending ? (
        <RankingLoading label="Chargement du profil…" />
      ) : isError ? (
        <RankingError
          message="Le profil n’a pas pu être chargé."
          onRetry={() => void refetch()}
        />
      ) : !profile ? (
        <p className="hub-ranking-note" role="status">
          Ce profil n’est plus disponible.
        </p>
      ) : (
        <>
          <dl className="hub-ranking-records">
            <div>
              <dt>Record de trophées</dt>
              <dd>{profile.peakTrophies.toLocaleString("fr-FR")}</dd>
            </div>
            <div>
              <dt>Meilleure ligue</dt>
              <dd>{leagueAt(profile.peakTrophies).label}</dd>
            </div>
          </dl>
          {profile.deck?.cards.length ? (
            <>
              <div className="hub-ranking-deck-heading">
                <h4>
                  <GameIcon kind="all" size={18} /> {profile.deck.name}
                </h4>
                <span>
                  {profile.deck.cards.length}/{profile.deckCapacity} cartes
                </span>
              </div>
              <ul className="hub-ranking-deck" aria-label="Deck du joueur">
                {profile.deck.cards.map((card) => (
                  <li key={card.id}>
                    <button
                      type="button"
                      className="hub-ranking-card"
                      data-rarity={card.rarity ?? "common"}
                      aria-label={`Voir ${card.name}, ${RARITY_LABELS[card.rarity ?? "common"]}, niveau ${card.level ?? 1}`}
                      aria-haspopup="dialog"
                      onClick={(event) => onInspect(card, event.currentTarget)}
                    >
                      <span className="hub-ranking-card-art">
                        <CreaturePortrait card={card} />
                        <span>Niv. {card.level ?? 1}</span>
                      </span>
                      <span className="hub-ranking-card-name">{card.name}</span>
                      <span className="hub-ranking-card-rarity">
                        {RARITY_LABELS[card.rarity ?? "common"]}
                      </span>
                      <span className="hub-ranking-card-stats">
                        <span>
                          <GameIcon kind={getCombatType(card)} size={13} />
                          {card.attack}<span className="sr-only"> attaque</span>
                        </span>
                        <span>
                          <GameIcon kind="health" size={13} />
                          {card.health}<span className="sr-only"> points de vie</span>
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="hub-ranking-note">Ce gardien n’a pas encore de deck.</p>
          )}
        </>
      )}
    </div>
  );
}

function RankingLoading({ label }: { label: string }) {
  return (
    <div className="hub-ranking-loading" role="status">
      <RefreshCw size={17} className="motion-safe:animate-spin" aria-hidden="true" />
      {label}
    </div>
  );
}

function RankingError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="hub-ranking-error" role="alert">
      <p>{message}</p>
      <button type="button" onClick={onRetry}>
        <RefreshCw size={14} aria-hidden="true" /> Réessayer
      </button>
    </div>
  );
}
