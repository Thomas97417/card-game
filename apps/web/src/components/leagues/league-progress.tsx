import { useState } from "react";
import { Check, ChevronRight, Layers3, LockKeyhole } from "lucide-react";
import { RARITIES, RARITY_LABELS } from "@sylve/game";
import {
  DECK_SLOT_UNLOCKS,
  LEAGUES,
  TROPHIES_PER_WIN,
  deckCapacity,
  leagueAt,
  type League,
  type LeagueProgress,
} from "@sylve/game/leagues";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

export function TrophyIcon() {
  return (
    <img
      className="trophy-icon"
      src="/art/ui/trophy.webp"
      alt=""
      aria-hidden="true"
      width={40}
      height={40}
      draggable={false}
    />
  );
}

export function LeagueBadge({
  league,
  size = 72,
}: {
  league: League;
  size?: number;
}) {
  return (
    <span
      className="league-badge"
      style={{ width: size, height: size }}
      role="img"
      aria-label={league.label}
    >
      <img
        src={`/art/leagues/${league.tier}.webp`}
        alt=""
        width={size}
        height={size}
        draggable={false}
      />
      <span className="league-division" aria-hidden="true">
        {league.division}
      </span>
    </span>
  );
}

export function LeaguePanel({
  progress,
  compact = false,
}: {
  progress: LeagueProgress;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { current, next, trophies, earned, required, nextSlot } = progress;
  return (
    <>
      <button
        className={`league-panel ${compact ? "is-compact" : ""}`}
        onClick={() => setOpen(true)}
        aria-label={`Ta ligue : ${current.label}, ${trophies} trophées. Voir les ligues et récompenses`}
        aria-haspopup="dialog"
      >
        <LeagueBadge league={current} size={compact ? 58 : 80} />
        <span className="league-panel-content">
          <span className="league-panel-heading">
            <strong>{current.label}</strong>
            <span className="trophy-amount">
              <TrophyIcon />
              {trophies.toLocaleString("fr-FR")}
            </span>
          </span>
          {!compact && (
            <>
              <span
                className="league-progress-track"
                role="progressbar"
                aria-label={`Progression vers ${next?.label ?? "le sommet des ligues"}`}
                aria-valuemin={0}
                aria-valuemax={required}
                aria-valuenow={earned}
                aria-valuetext={
                  next
                    ? `${next.minTrophies - trophies} trophées avant ${next.label}`
                    : "Ligue maximale atteinte"
                }
              >
                <span style={{ width: `${(earned / required) * 100}%` }} />
              </span>
              <span className="league-panel-next">
                {next
                  ? `${next.minTrophies - trophies} trophées avant ${next.label}`
                  : "Le sommet des gardiens"}
              </span>
            </>
          )}
        </span>
        <ChevronRight size={17} aria-hidden="true" />
      </button>
      {!compact && (
        <p className="league-next-unlock">
          <Layers3 size={13} />
          {nextSlot
            ? `Deck de ${nextSlot.slot} cartes en ${leagueAt(nextSlot.trophies).label}`
            : "Les 8 emplacements de deck sont débloqués"}
        </p>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="league-dialog" appearance="game">
          <span className="eyebrow">LES LIGUES DE LA SYLVE</span>
          <DialogTitle>La voie des gardiens</DialogTitle>
          <DialogDescription>
            Chaque victoire solo connectée ou en duel public rapporte{" "}
            {TROPHIES_PER_WIN} trophées. Une promotion tous les 200 trophées.
            Les défaites et défis amicaux ne changent pas tes trophées.
          </DialogDescription>
          <div className="league-current-summary">
            <LeagueBadge league={current} size={96} />
            <div>
              <strong>{current.label}</strong>
              <span className="trophy-amount">
                <TrophyIcon />
                {trophies.toLocaleString("fr-FR")} trophées
              </span>
              <small>Deck : {progress.deckCapacity} cartes maximum</small>
            </div>
          </div>
          <section className="league-loot" aria-label="Butin de ta ligue">
            <h3>De plus beaux trésors à chaque palier</h3>
            <p>
              Chances des coffres de combat en {current.label}. Chaque coffre
              contient une carte de sa rareté.
            </p>
            <dl>
              {RARITIES.map((rarity) => (
                <div key={rarity} data-rarity={rarity}>
                  <dt>{RARITY_LABELS[rarity]}</dt>
                  <dd>
                    {current.chestChances[rarity].toLocaleString("fr-FR", {
                      maximumFractionDigits: 2,
                    })}{" "}
                    %
                  </dd>
                </div>
              ))}
            </dl>
            <small>
              Cartes et or dans tous les coffres : +
              {Math.round((current.lootMultiplier - 1) * 100)} % par rapport à
              Fer IV. Le butin est fixé à l’obtention du coffre.
            </small>
          </section>
          <ol className="league-road" aria-label="Parcours des ligues">
            {LEAGUES.map((league) => {
              const unlocked = trophies >= league.minTrophies;
              const active = current.id === league.id;
              const slot = DECK_SLOT_UNLOCKS.find(
                (unlock) => unlock.trophies === league.minTrophies,
              );
              return (
                <li
                  key={league.id}
                  className={`${unlocked ? "is-unlocked" : ""} ${active ? "is-current" : ""}`}
                  aria-current={active ? "step" : undefined}
                >
                  <LeagueBadge league={league} size={70} />
                  <strong>{league.label}</strong>
                  <span className="league-road-threshold">
                    <TrophyIcon />
                    {league.minTrophies.toLocaleString("fr-FR")}
                  </span>
                  {slot ? (
                    <small className="league-slot-reward">
                      <Layers3 size={12} />
                      {slot.slot} cartes dans le deck
                    </small>
                  ) : (
                    <small>
                      Butin ×
                      {league.lootMultiplier.toLocaleString("fr-FR", {
                        maximumFractionDigits: 2,
                      })}
                    </small>
                  )}
                  <span className="league-road-state">
                    {active ? (
                      "Ta ligue"
                    ) : unlocked ? (
                      <>
                        <Check size={12} /> Atteinte
                      </>
                    ) : (
                      <>
                        <LockKeyhole size={11} /> À atteindre
                      </>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function LeagueVictory({
  reward,
}: {
  reward: {
    trophies?: number;
    trophiesTotal?: number;
    previousTrophies?: number;
  };
}) {
  if (reward.trophiesTotal === undefined || reward.trophies === undefined)
    return null;
  const current = leagueAt(reward.trophiesTotal);
  const previous = leagueAt(reward.previousTrophies ?? reward.trophiesTotal);
  const promoted = current.index > previous.index;
  const gainedSlot =
    deckCapacity(reward.trophiesTotal) >
    deckCapacity(reward.previousTrophies ?? reward.trophiesTotal);
  return (
    <div className={`duel-league-reward ${promoted ? "is-promotion" : ""}`}>
      {promoted ? <LeagueBadge league={current} size={76} /> : <TrophyIcon />}
      <div>
        <strong>
          {promoted
            ? `Promotion : ${current.label} !`
            : `+${reward.trophies} trophées`}
        </strong>
        <span>
          {promoted ? `+${reward.trophies} trophées · ` : ""}
          {reward.trophiesTotal.toLocaleString("fr-FR")} trophées au total
        </span>
        {gainedSlot && (
          <small>
            Nouvel emplacement débloqué : ton deck peut contenir{" "}
            {deckCapacity(reward.trophiesTotal)} cartes !
          </small>
        )}
      </div>
    </div>
  );
}
