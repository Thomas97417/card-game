import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { Swords } from "lucide-react";
import type { GameView } from "@sylve/game";
import type { DuelData } from "./duel-screen";

export const DUEL_INTRO_DURATION = 2000;

/** Reconnecting to a duel should take the player straight back to the board. */
export function useDuelIntro(
  gameId: string,
  data: Pick<GameView, "status" | "turn">,
) {
  const storageKey = `sylve:duel-intro:${gameId}`;
  const [showIntro, setShowIntro] = useState(() => {
    if (data.status !== "active" || data.turn !== 1) return false;
    try {
      return window.sessionStorage.getItem(storageKey) !== "seen";
    } catch {
      return true;
    }
  });
  const completeIntro = useCallback(() => {
    try {
      window.sessionStorage.setItem(storageKey, "seen");
    } catch {
      // The transition still works when browser storage is unavailable.
    }
    setShowIntro(false);
  }, [storageKey]);
  return { showIntro, completeIntro };
}

const MODE_LABELS = {
  solo: "Duel solo",
  public: "Duel classé",
  private: "Duel amical",
};

export function DuelIntro({
  data,
  onComplete,
}: {
  data: Pick<DuelData, "players" | "me" | "mode">;
  onComplete: () => void;
}) {
  const mine = data.players[data.me]!;
  const enemy = data.players[1 - data.me]!;

  useEffect(() => {
    const timer = window.setTimeout(onComplete, DUEL_INTRO_DURATION);
    return () => window.clearTimeout(timer);
  }, [onComplete]);

  return (
    <section
      className="duel-intro"
      role="status"
      aria-label={`${mine.name} contre ${enemy.name}. Le duel commence.`}
      style={
        { "--duel-intro-duration": `${DUEL_INTRO_DURATION}ms` } as CSSProperties
      }
    >
      {([mine, enemy] as const).map((player, index) => (
        <div
          key={index}
          className={`duel-intro-panel ${index === 0 ? "own" : "enemy"}`}
        >
          <div className="duel-intro-scenery" />
          <div className="duel-intro-aura" />
          <div className="duel-intro-fighter">
            <img
              className="duel-intro-portrait"
              src={`/art/heroes/${index === 0 ? "hero-sylve" : "hero-amber"}.webp`}
              alt=""
              fetchPriority="high"
              draggable={false}
            />
          </div>
          <div className="duel-intro-identity">
            <span className="duel-intro-player-label">
              {index === 0 ? "Ton gardien" : "Adversaire"}
            </span>
            <h2>{player.name}</h2>
            {player.heroLevel !== undefined && (
              <span className="duel-intro-level">
                Gardien · Niveau {player.heroLevel}
              </span>
            )}
          </div>
        </div>
      ))}
      <svg
        className="duel-intro-seam"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d="M58 0 42 100" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="duel-intro-heading" aria-hidden="true">
        <span>L’arène des gardiens</span>
        <strong>{MODE_LABELS[data.mode ?? "private"]}</strong>
      </div>
      <div className="duel-intro-versus" aria-hidden="true">
        <span className="duel-intro-ring" />
        <Swords className="duel-intro-swords" strokeWidth={1} />
        <strong>VS</strong>
      </div>
      <div className="duel-intro-sparks" aria-hidden="true">
        {Array.from({ length: 12 }, (_, index) => (
          <i key={index} style={{ "--spark": index } as CSSProperties} />
        ))}
      </div>
      <div className="duel-intro-caption" aria-hidden="true">
        <span>Que le duel commence</span>
        <span className="duel-intro-progress" />
      </div>
    </section>
  );
}
