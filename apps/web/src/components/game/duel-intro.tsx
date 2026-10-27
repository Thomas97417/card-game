import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Swords } from "lucide-react";
import { heroPortrait, type HeroId, type GameView } from "@sylve/game";
import type { DuelData } from "./duel-screen";
import { showGameError } from "./shared";

export const DUEL_INTRO_DURATION = 2000;
export const DUEL_INTRO_EXIT_DURATION = 360;
export type DuelIntroData = Pick<DuelData, "players" | "me" | "mode">;
export type IntroPlayer = { name: string; heroLevel?: number; heroId?: HeroId };

export function shouldShowDuelIntro(
  gameId: string,
  data: Pick<GameView, "status" | "turn">,
) {
  if (data.status !== "active" || data.turn !== 1) return false;
  try {
    return (
      window.sessionStorage.getItem(`sylve:duel-intro:${gameId}`) !== "seen"
    );
  } catch {
    return true;
  }
}

export function rememberDuelIntro(gameId: string) {
  try {
    window.sessionStorage.setItem(`sylve:duel-intro:${gameId}`, "seen");
  } catch {
    // The transition still works when browser storage is unavailable.
  }
}

/** Reconnecting to a duel should take the player straight back to the board. */
export function useDuelIntro(
  gameId: string,
  data: Pick<GameView, "status" | "turn">,
  alreadyPresenting = false,
) {
  const [showIntro, setShowIntro] = useState(
    () => !alreadyPresenting && shouldShowDuelIntro(gameId, data),
  );
  const completeIntro = useCallback(() => {
    rememberDuelIntro(gameId);
    setShowIntro(false);
  }, [gameId]);
  return { showIntro, completeIntro };
}

const MODE_LABELS = {
  solo: "Duel solo",
  public: "Duel classé",
  private: "Duel amical",
};

export function DuelIntro({
  data,
  player = { name: "Toi" },
  mode = data?.mode ?? "private",
  ready = true,
  message = "Que le duel commence",
  onCancel,
  onComplete,
}: {
  data?: DuelIntroData;
  player?: IntroPlayer;
  mode?: NonNullable<DuelData["mode"]>;
  ready?: boolean;
  message?: string;
  onCancel?: () => Promise<unknown>;
  onComplete: () => void;
}) {
  const mine = data ? data.players[data.me]! : player;
  const enemy: IntroPlayer = data
    ? data.players[1 - data.me]!
    : {
        name: mode === "solo" ? "Gardien mécanique" : "Adversaire en approche",
      };
  const [presented, setPresented] = useState(false);
  const started = useRef(Date.now());
  const [cancelling, setCancelling] = useState(false);
  const exiting = presented && ready;

  useEffect(() => {
    const timer = window.setTimeout(
      () => setPresented(true),
      DUEL_INTRO_DURATION - DUEL_INTRO_EXIT_DURATION,
    );
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(
      onComplete,
      Math.max(
        DUEL_INTRO_EXIT_DURATION,
        DUEL_INTRO_DURATION - (Date.now() - started.current),
      ),
    );
    return () => window.clearTimeout(timer);
  }, [ready, onComplete]);

  return (
    <section
      className="duel-intro"
      data-exiting={exiting}
      data-waiting={presented && !ready}
      role="status"
      aria-label={`${mine.name} contre ${enemy.name}. ${message}.`}
      style={
        {
          "--duel-intro-duration": `${DUEL_INTRO_DURATION}ms`,
          "--duel-intro-exit-duration": `${DUEL_INTRO_EXIT_DURATION}ms`,
        } as CSSProperties
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
              src={heroPortrait(player.heroId, index !== 0)}
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
        <strong>{MODE_LABELS[mode]}</strong>
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
      <div className="duel-intro-caption">
        <span>{message}</span>
        <span
          className="duel-intro-progress"
          role="progressbar"
          aria-label="Préparation du duel"
          aria-valuetext={ready ? "Plateau prêt" : message}
        />
        {onCancel && !exiting && (
          <button
            className="duel-intro-cancel"
            type="button"
            disabled={cancelling}
            onClick={() => {
              if (cancelling) return;
              setCancelling(true);
              void onCancel()
                .catch(showGameError)
                .finally(() => setCancelling(false));
            }}
          >
            {cancelling ? "Annulation…" : "Annuler la recherche"}
          </button>
        )}
      </div>
    </section>
  );
}
