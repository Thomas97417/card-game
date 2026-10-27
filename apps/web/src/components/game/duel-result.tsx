import { Link } from "@tanstack/react-router";
import { useRef, type CSSProperties } from "react";
import { ArrowRight, Check, LockKeyhole, RotateCcw } from "lucide-react";
import { leagueAt } from "@sylve/game/leagues";
import { chestName, VICTORY_CHEST_WINS } from "@sylve/game/progression";
import {
  LeagueBadge,
  LeagueResult,
} from "@/components/leagues/league-progress";
import { LeagueUnlocks } from "@/components/leagues/league-unlocks";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { DuelData } from "./duel-screen";

export function DuelResult({
  data,
  practice,
  onRestart,
}: {
  data: DuelData;
  practice: boolean;
  onRestart?: () => void;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const won = data.winner === data.me;
  const reward = data.trophyChange ?? (won ? data.reward : null);
  const current = leagueAt(reward?.trophiesTotal ?? 0);
  const promoted =
    won &&
    reward?.previousTrophies !== undefined &&
    current.index > leagueAt(reward.previousTrophies).index;
  const recovered =
    promoted &&
    data.trophyChange?.previousPeakTrophies !== undefined &&
    current.minTrophies <= data.trophyChange.previousPeakTrophies;
  const victoryWins = data.reward?.victoryWins;
  const victoryReady =
    victoryWins !== undefined && victoryWins >= VICTORY_CHEST_WINS;

  return (
    <Dialog open disablePointerDismissal>
      <DialogContent
        appearance="game"
        className={`result-card ${promoted ? "is-promotion" : ""} ${won ? "is-victory" : "is-defeat"}`}
        showCloseButton={false}
        initialFocus={titleRef}
        aria-describedby={undefined}
      >
        <header className="result-hero">
          {promoted && (
            <span className="result-kicker">
              {recovered ? "Ligue retrouvée" : "Nouvelle ligue"}
            </span>
          )}
          <div className="result-emblem">
            <span className="result-emblem-rays" aria-hidden="true" />
            {promoted ? (
              <LeagueBadge league={current} size={168} />
            ) : (
              <img
                className="result-outcome-art"
                src={`/art/results/${won ? "victory" : "defeat"}.webp`}
                alt={
                  won
                    ? "Épée couronnée de la victoire"
                    : "Bouclier brisé de la défaite"
                }
                width={160}
                height={160}
                draggable={false}
              />
            )}
            {promoted && (
              <span className="result-sparks" aria-hidden="true">
                {Array.from({ length: 10 }, (_, i) => (
                  <i key={i} style={{ "--spark": i } as CSSProperties} />
                ))}
              </span>
            )}
          </div>
          <DialogTitle render={<h1 />} ref={titleRef} tabIndex={-1}>
            {promoted ? current.label : won ? "Victoire !" : "Défaite"}
          </DialogTitle>
        </header>
        {reward && <LeagueResult reward={reward} />}
        {won && data.trophyChange && (
          <LeagueUnlocks reward={data.trophyChange} />
        )}
        {won && data.reward && (
          <div className="result-loot">
            <div
              className={`result-loot-item ${data.reward.status === "lost" ? "is-full" : ""}`}
            >
              {data.reward.status === "awarded" && data.reward.rarity ? (
                <>
                  <img
                    src={`/art/chests/${data.reward.rarity}.webp`}
                    alt=""
                    width={64}
                    height={64}
                  />
                  <div>
                    <span className="result-loot-label">Gagné</span>
                    <strong>{chestName(data.reward.rarity)}</strong>
                  </div>
                </>
              ) : (
                <>
                  <LockKeyhole size={28} aria-hidden="true" />
                  <div>
                    <strong>Coffres pleins</strong>
                    <span>Coffre non reçu</span>
                  </div>
                </>
              )}
            </div>
            {victoryWins !== undefined && (
              <div
                className={`result-loot-item result-victory-chest ${victoryReady ? "is-ready" : ""}`}
              >
                <img
                  src={`/art/chests/common${victoryReady ? "-open" : ""}.webp`}
                  alt=""
                  width={60}
                  height={60}
                />
                <div>
                  <strong>Coffre de victoires</strong>
                  <span
                    className="result-chest-progress"
                    aria-label={`Coffre de victoires : ${victoryWins}/${VICTORY_CHEST_WINS}${victoryReady ? ", prêt à ouvrir" : ""}`}
                  >
                    <span className="result-chest-pips" aria-hidden="true">
                      {Array.from({ length: VICTORY_CHEST_WINS }, (_, i) => (
                        <i key={i} data-filled={i < victoryWins} />
                      ))}
                    </span>
                    {victoryReady ? (
                      <span>
                        <Check size={12} aria-hidden="true" /> Prêt à ouvrir
                      </span>
                    ) : (
                      <span>
                        {victoryWins}/{VICTORY_CHEST_WINS}
                      </span>
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
        <div className="result-actions">
          {onRestart && (
            <button
              className="sylve-button practice-replay"
              onClick={onRestart}
            >
              <RotateCcw size={16} aria-hidden="true" /> Rejouer
            </button>
          )}
          <Link
            to="/arena"
            className={`sylve-button ${practice && onRestart ? "secondary" : ""}`}
          >
            Retour au salon <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
