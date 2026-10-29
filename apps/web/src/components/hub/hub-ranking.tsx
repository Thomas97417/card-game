import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { Crown, RefreshCw } from "lucide-react";
import { api } from "@my-better-t-app/backend/convex/_generated/api";
import { getCombatType, RARITY_LABELS, type CardDefinition } from "@sylve/game";
import { heroDefinition } from "@sylve/game/hero-metadata";
import { leagueAt } from "@sylve/game/leagues";
import { CardUpgradeDialog } from "@/components/decks/card-upgrade-dialog";
import { GuardianAvatar } from "@/components/guardian-avatar";
import { CreaturePortrait } from "@/components/game/creature-portrait";
import { FactionBackdrop } from "@/components/game/faction-artwork";
import { GameIcon } from "@/components/game/game-icon";
import { LeagueBadge, TrophyIcon } from "@/components/leagues/league-progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { HubPanel } from "./hub-panel";

export function HubRanking({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const [expandedPlayers, setExpandedPlayers] = useState<string[]>([]);
  const [inspectedCard, setInspectedCard] = useState<CardDefinition | null>(
    null,
  );
  const cardTrigger = useRef<HTMLButtonElement>(null);
  const {
    data: players,
    isPending,
    isError,
    refetch,
  } = useQuery({
    ...convexQuery(api.collection.leaderboard, {}),
    retry: false,
  });

  return (
    <>
      <HubPanel
        id={id}
        className="hub-ranking"
        title="Classement mondial"
        description="Les meilleurs gardiens, du rang 1 au rang 50."
        icon="ranking"
        closeLabel="Fermer le classement"
        onClose={onClose}
      >
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
                Termine un combat solo ou un duel public dans l’arène pour
                entrer dans le classement.
              </p>
            </div>
          ) : (
            <Accordion
              value={expandedPlayers}
              onValueChange={setExpandedPlayers}
            >
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
                      <span
                        className="hub-ranking-rank"
                        data-rank={player.rank}
                      >
                        {player.rank === 1 && (
                          <Crown size={12} aria-hidden="true" />
                        )}
                        <span>#{player.rank}</span>
                      </span>
                      <span className="hub-ranking-avatar" aria-hidden="true">
                        <GuardianAvatar heroId={player.profile?.heroId} />
                      </span>
                      <span className="hub-ranking-identity">
                        <span className="hub-ranking-name">
                          <span>{player.name}</span>
                          {player.isCurrentPlayer && <small>Toi</small>}
                        </span>
                        <span className="hub-ranking-league">
                          <span className="hub-ranking-league-icon" aria-hidden="true">
                            <LeagueBadge league={league} size={20} showDivision={false} />
                          </span>
                          <span className="hub-ranking-league-label">{league.label}</span>
                        </span>
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
      </HubPanel>
      <CardUpgradeDialog
        entry={inspectedCard ? { card: inspectedCard, copies: 0 } : undefined}
        readOnly
        onClose={() => setInspectedCard(null)}
        finalFocus={cardTrigger}
      />
    </>
  );
}

export function RankedPlayerDetails({
  ownerId,
  playerName,
  onInspect,
}: {
  ownerId: string;
  playerName?: string;
  onInspect: (card: CardDefinition, trigger: HTMLButtonElement) => void;
}) {
  const {
    data: profile,
    isPending,
    isError,
    refetch,
  } = useQuery({
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
          {playerName !== undefined && (
            <header className="social-profile-hero">
              <div className="social-profile-portrait">
                <GuardianAvatar heroId={profile.guardian?.heroId} />
              </div>
              <div className="social-profile-identity">
                <div className="social-profile-name">
                  <h2>{playerName}</h2>
                  {profile.rank !== undefined && (
                    <span className="social-profile-rank">
                      <Crown size={13} aria-hidden="true" /> Rang {profile.rank}
                    </span>
                  )}
                </div>
                {profile.rankProgress && (
                  <div className="social-profile-experience">
                    <div>
                      <span>
                        {profile.rankProgress.required > 0
                          ? `Vers le rang ${profile.rank + 1}`
                          : "Rang maximum"}
                      </span>
                      <strong>
                        {profile.rankProgress.required > 0
                          ? `${profile.rankProgress.earned.toLocaleString("fr-FR")} / ${profile.rankProgress.required.toLocaleString("fr-FR")} XP`
                          : "MAX"}
                      </strong>
                    </div>
                    <progress
                      aria-label={`Expérience du rang ${profile.rank}`}
                      aria-valuetext={profile.rankProgress.required > 0
                        ? `${profile.rankProgress.earned} sur ${profile.rankProgress.required} XP`
                        : "Rang maximum"}
                      value={profile.rankProgress.required > 0 ? profile.rankProgress.earned : 1}
                      max={profile.rankProgress.required || 1}
                    />
                  </div>
                )}
                <p className="social-profile-guardian-label">
                  Gardien actif
                  {profile.guardian && ` · Niveau ${profile.guardian.level}`}
                </p>
                <p className="social-profile-guardian-name">
                  {heroDefinition(profile.guardian?.heroId).name}
                </p>
              </div>
            </header>
          )}
          <dl className={`hub-ranking-records${playerName !== undefined ? " social-profile-stats" : ""}`}>
            {playerName !== undefined && (
              <div>
                <dt>Trophées actuels</dt>
                <dd><TrophyIcon />{profile.trophies.toLocaleString("fr-FR")}</dd>
              </div>
            )}
            <div>
              <dt>Record de trophées</dt>
              <dd><TrophyIcon />{profile.peakTrophies.toLocaleString("fr-FR")}</dd>
            </div>
            {playerName !== undefined && (
              <div>
                <dt>Ligue actuelle</dt>
                <dd>
                  <span aria-hidden="true"><LeagueBadge league={leagueAt(profile.trophies)} size={32} showDivision={false} /></span>
                  {leagueAt(profile.trophies).label}
                </dd>
              </div>
            )}
            <div>
              <dt>Meilleure ligue</dt>
              <dd>
                <span aria-hidden="true"><LeagueBadge league={leagueAt(profile.peakTrophies)} size={32} showDivision={false} /></span>
                {leagueAt(profile.peakTrophies).label}
              </dd>
            </div>
          </dl>
          {profile.deck?.cards.length ? (
            <>
              <div className="hub-ranking-deck-heading">
                <h4>
                  <GameIcon kind="all" size={18} /> Cartes équipées
                </h4>
              </div>
              <ul className="hub-ranking-deck" aria-label="Deck du joueur">
                {profile.deck.cards.map((card) => (
                  <li key={card.id}>
                    <button
                      type="button"
                      className="hub-ranking-card"
                      data-faction={card.faction}
                      data-rarity={card.rarity ?? "common"}
                      aria-label={`Voir ${card.name}, ${RARITY_LABELS[card.rarity ?? "common"]}, niveau ${card.level ?? 1}`}
                      aria-haspopup="dialog"
                      onClick={(event) => onInspect(card, event.currentTarget)}
                    >
                      <span className="hub-ranking-card-art">
                        <FactionBackdrop card={card} />
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
                          {card.attack}
                          <span className="sr-only"> attaque</span>
                        </span>
                        <span>
                          <GameIcon kind="health" size={13} />
                          {card.health}
                          <span className="sr-only"> points de vie</span>
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="hub-ranking-note">
              Ce gardien n’a pas encore de deck.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function RankingLoading({ label }: { label: string }) {
  return (
    <div className="hub-ranking-loading" role="status">
      <RefreshCw
        size={17}
        className="motion-safe:animate-spin"
        aria-hidden="true"
      />
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
