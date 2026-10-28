import { lazy, Suspense, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { CollectionIcon } from "@/components/game/game-icon";
import {
  leagueAt, leagueProgress, type League, type LeagueProgress, type TrophyChange,
} from "@sylve/game/leagues";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const loadLeagueJourney = () => import("./league-journey");
const LeagueJourney = lazy(loadLeagueJourney);

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
  showDivision = true,
}: {
  league: League;
  size?: number;
  showDivision?: boolean;
}) {
  return (
    <span
      className="league-badge"
      style={{ width: size, height: size }}
      role="img"
      aria-label={showDivision ? league.label : league.name}
    >
      <img
        src={`/art/leagues/${league.tier}.webp`}
        alt=""
        width={size}
        height={size}
        draggable={false}
      />
      {showDivision && league.division && (
        <span className="league-division" aria-hidden="true">
          {league.division}
        </span>
      )}
    </span>
  );
}

export function LeaguePanel({
  progress,
  compact = false,
  showNextUnlock = true,
}: {
  progress: LeagueProgress;
  compact?: boolean;
  showNextUnlock?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const { current, next, trophies, earned, required, nextSlot } = progress;
  const percentage = Math.min(100, Math.max(0, (earned / required) * 100));
  const progressLabel = `Progression vers ${next?.label ?? "le sommet des ligues"}`;
  const progressDescription = next
    ? `${earned} sur ${required} trophées, ${next.minTrophies - trophies} trophées avant ${next.label}`
    : "Ligue maximale atteinte";
  return (
    <>
      <button
        ref={triggerRef}
        className={`league-panel ${compact ? "is-compact" : ""}`}
        type="button"
        onPointerEnter={() => { void loadLeagueJourney().catch(() => {}); }}
        onFocus={() => { void loadLeagueJourney().catch(() => {}); }}
        onClick={() => setOpen(true)}
        aria-label={`Ta ligue : ${current.label}, ${trophies} trophées. Voir les ligues et récompenses`}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={progressDescription}
      >
        {compact && (
          <span
            className="league-panel-background"
            role="progressbar"
            aria-label={progressLabel}
            aria-valuemin={0}
            aria-valuemax={required}
            aria-valuenow={earned}
            aria-valuetext={progressDescription}
          >
            <span style={{ width: `${percentage}%` }} />
          </span>
        )}
        <LeagueBadge league={current} size={compact ? 58 : 80} />
        <span className="league-panel-content">
          <span className="league-panel-heading">
            {!compact && <strong>{current.label}</strong>}
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
                aria-label={progressLabel}
                aria-valuemin={0}
                aria-valuemax={required}
                aria-valuenow={earned}
                aria-valuetext={progressDescription}
              >
                <span style={{ width: `${percentage}%` }} />
              </span>
              <span className="league-panel-next">
                {next
                  ? `${next.minTrophies - trophies} trophées avant ${next.label}`
                  : "Le sommet des gardiens"}
              </span>
            </>
          )}
        </span>
        {!compact && <ChevronRight size={17} aria-hidden="true" />}
      </button>
      {!compact && showNextUnlock && (
        <p className="league-next-unlock">
          <CollectionIcon size={13} />
          {nextSlot
            ? `Deck de ${nextSlot.slot} cartes en ${leagueAt(nextSlot.trophies).label}`
            : "Les 8 emplacements de deck sont débloqués"}
        </p>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          ref={popupRef}
          initialFocus={popupRef}
          finalFocus={triggerRef}
          className="league-dialog"
          appearance="game"
        >
          {open && (
            <Suspense fallback={<><DialogTitle>Chargement des ligues</DialogTitle><p role="status">Un instant…</p></>}>
              <LeagueJourney progress={progress} />
            </Suspense>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function LeagueResult({ reward }: { reward: Partial<TrophyChange> }) {
  if (reward.trophiesTotal === undefined || reward.trophies === undefined)
    return null;
  const { current, next, earned, required } = leagueProgress(
    reward.trophiesTotal,
  );
  const previous = leagueAt(reward.previousTrophies ?? reward.trophiesTotal);
  const demoted = current.index < previous.index;
  const delta =
    reward.trophies > 0
      ? `+${reward.trophies}`
      : reward.trophies < 0
        ? `−${Math.abs(reward.trophies)}`
        : "0";
  return (
    <div
      className={`duel-league-reward ${reward.trophies <= 0 ? "is-loss" : ""}`}
    >
      <div className="result-trophies">
        <span className="result-trophy-delta" aria-label={`${delta} trophées`}>
          <TrophyIcon />
          <strong>{delta}</strong>
        </span>
        <span className="result-trophy-total">
          <strong>{reward.trophiesTotal.toLocaleString("fr-FR")}</strong>{" "}
          trophées
        </span>
      </div>
      <div className="result-league-progression" data-max={!next}>
        <span className="result-league-rank" title={current.label}>
          <LeagueBadge league={current} size={64} />
        </span>
        <div className="result-league-progress">
          {demoted && (
            <span className="result-league-demotion">
              Rétrogradation<span className="sr-only"> · {current.label}</span>
            </span>
          )}
          <span className="result-league-fraction" aria-hidden="true">
            {next ? (
              <>
                <strong>{earned}</strong> / {required}
              </>
            ) : (
              "Ligue ultime"
            )}
          </span>
          <div
            className="result-league-bar"
            role="progressbar"
            aria-label={
              next
                ? `Progression vers ${next.label}`
                : "Ligue maximale atteinte"
            }
            aria-valuemin={0}
            aria-valuemax={required}
            aria-valuenow={earned}
            aria-valuetext={
              next
                ? `${reward.trophiesTotal} trophées, ${next.minTrophies - reward.trophiesTotal} avant ${next.label}`
                : `${reward.trophiesTotal} trophées, ligue maximale atteinte`
            }
          >
            <span style={{ width: `${(earned / required) * 100}%` }} />
          </div>
        </div>
        {next && (
          <span className="result-league-rank is-next" title={next.label}>
            <LeagueBadge league={next} size={64} />
          </span>
        )}
      </div>
    </div>
  );
}
