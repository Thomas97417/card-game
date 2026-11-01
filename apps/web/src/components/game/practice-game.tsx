import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_DECK,
  endTurn,
  playerView,
  summon,
  surrender,
  validateDeck,
  useHeroAbility,
  type GameState,
  type Transition,
  type HeroId,
} from "@sylve/game";
import {
  PRACTICE_COMPUTER_ID,
  PRACTICE_DEADLINE,
  PRACTICE_PLAYER_ID,
  COMPUTER_MEMORY_LENGTH,
  chooseComputerMove,
  chooseComputerHeroAbility,
  createPracticeGame,
} from "@sylve/game/practice";
import { DuelScreen } from "./duel-screen";
import { DuelIntro, useDuelIntroAssets } from "./duel-intro";
import { COMBAT_TIMING } from "./combat-timing";

/** The session is local; no account, multiplayer lock or server mutation is needed. */
export function PracticeGame({
  deck,
  heroId,
  heroLevel,
  pending = false,
}: {
  deck?: string;
  heroId?: HeroId;
  heroLevel?: number;
  pending?: boolean;
}) {
  const [round, setRound] = useState<{ initial: GameState; id: number } | null>(null);
  const [showIntro, setShowIntro] = useState(true);
  const [boardReady, setBoardReady] = useState(false);
  const deckIds = useMemo(() => {
    try {
      return validateDeck(deck?.split(",") ?? DEFAULT_DECK).map(
        (card) => card.id,
      );
    } catch {
      return [...DEFAULT_DECK];
    }
  }, [deck]);
  const restart = useCallback(() => {
    const initial = createPracticeGame(deckIds, Date.now(), Math.random, {
      heroId,
      heroLevel,
    });
    setRound((current) => ({ initial, id: current ? current.id + 1 : 0 }));
    setBoardReady(false);
    setShowIntro(true);
  }, [deckIds, heroId, heroLevel]);
  useEffect(() => {
    if (!pending) restart();
  }, [pending, restart]);
  const data = useMemo(
    () => round ? playerView(round.initial, PRACTICE_PLAYER_ID) : undefined,
    [round],
  );
  const presenting = pending || !round || showIntro;
  const onReady = useCallback(() => setBoardReady(true), []);
  const completeIntro = useCallback(() => setShowIntro(false), []);
  const assetsReady = useDuelIntroAssets(
    presenting ? round?.id ?? 0 : undefined,
    data?.players[data.me]?.heroId ?? heroId,
    data?.players[1 - data.me]?.heroId,
  );
  const ready = !pending && !!round && boardReady && assetsReady;

  return (
    <div className="duel-entry">
      <div
        className="duel-entry-board"
        inert={presenting}
        aria-hidden={presenting || undefined}
      >
        {!pending && round && (
          <PracticeMatch
            key={round.id}
            initial={round.initial}
            onRestart={restart}
            presenting={presenting}
            onReady={onReady}
          />
        )}
      </div>
      {presenting && (
        <DuelIntro
          key={round?.id ?? 0}
          data={data}
          player={{ name: "Toi", heroId, heroLevel }}
          mode="practice"
          ready={ready}
          message={ready
            ? "Que l’entraînement commence"
            : "Préparation de l’entraînement…"}
          onComplete={completeIntro}
        />
      )}
    </div>
  );
}

function PracticeMatch({
  initial,
  onRestart,
  presenting,
  onReady,
}: {
  initial: GameState;
  onRestart: () => void;
  presenting: boolean;
  onReady: () => void;
}) {
  const [session, setSession] = useState({
    state: initial,
    events: [] as Transition["events"],
    computerHistory: [] as string[],
  });
  const current = useRef(session);
  const [settledSequence, setSettledSequence] = useState(-1);
  useEffect(() => {
    if (settledSequence === session.state.sequence) onReady();
  }, [settledSequence, session.state.sequence, onReady]);
  const data = useMemo(
    () => ({
      ...playerView(session.state, PRACTICE_PLAYER_ID),
      events: session.events,
    }),
    [session],
  );
  function commit(transition: Transition) {
    if (transition.state.status === "active")
      transition.state.turnEndsAt = PRACTICE_DEADLINE;
    const next = {
      state: transition.state,
      events: [...current.current.events, ...transition.events].slice(-80),
      computerHistory: [
        ...current.current.computerHistory,
        ...transition.events
          .filter(
            (event) =>
              event.type === "summon" &&
              event.player === 1 &&
              event.cardId &&
              !event.unit?.definition,
          )
          .map((event) => event.cardId!),
      ].slice(-COMPUTER_MEMORY_LENGTH),
    };
    current.current = next;
    setSession(next);
  }
  useEffect(() => {
    if (
      presenting ||
      session.state.status !== "active" ||
      session.state.activePlayer !== 1 ||
      settledSequence !== session.state.sequence
    )
      return;
    const sequence = session.state.sequence;
    const timer = window.setTimeout(() => {
      const state = current.current.state;
      if (
        state.sequence !== sequence ||
        state.status !== "active" ||
        state.activePlayer !== 1
      )
        return;
      const ability = chooseComputerHeroAbility(
        playerView(state, PRACTICE_COMPUTER_ID),
      );
      if (ability) {
        commit(
          useHeroAbility(
            state,
            1,
            ability.id,
            state.players[1]!.heroAbilityUses ?? 0,
            state.turn,
            Date.now(),
            Math.random,
          ),
        );
        return;
      }
      const move = chooseComputerMove(
        playerView(state, PRACTICE_COMPUTER_ID),
        Math.random,
        current.current.computerHistory,
      );
      commit(
        move
          ? summon(
              state,
              1,
              move.cardId,
              move.row,
              move.depth,
              state.turn,
              Date.now(),
              Math.random,
            )
          : endTurn(state, 1, state.turn, Date.now(), Math.random),
      );
    }, COMBAT_TIMING.computerThink);
    return () => window.clearTimeout(timer);
  }, [session, settledSequence, presenting]);
  return (
    <DuelScreen
      data={data}
      practice
      onRestart={onRestart}
      onPlaybackSettled={setSettledSequence}
      onHeroAbility={async (abilityId, expectedUses, turn) =>
        commit(
          useHeroAbility(
            current.current.state,
            0,
            abilityId,
            expectedUses,
            turn,
            Date.now(),
            Math.random,
          ),
        )
      }
      onPlayCard={async (cardId, row, depth, turn) =>
        commit(
          summon(
            current.current.state,
            0,
            cardId,
            row,
            depth,
            turn,
            Date.now(),
            Math.random,
          ),
        )
      }
      onEndTurn={async (turn) =>
        commit(endTurn(current.current.state, 0, turn, Date.now(), Math.random))
      }
      onSurrender={async () => commit(surrender(current.current.state, 0))}
    />
  );
}
