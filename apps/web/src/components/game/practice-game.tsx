import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_DECK,
  endTurn,
  playerView,
  summon,
  surrender,
  validateDeck,
  withdraw,
  type GameState,
  type Transition,
} from "@sylve/game";
import {
  PRACTICE_COMPUTER_ID,
  PRACTICE_DEADLINE,
  PRACTICE_PLAYER_ID,
  chooseComputerMove,
  createPracticeGame,
} from "@sylve/game/practice";
import { DuelScreen } from "./duel-screen";
import { GameLoading } from "./shared";
import { COMBAT_TIMING } from "./combat-timing";

/** The session is local; no account, multiplayer lock or server mutation is needed. */
export function PracticeGame({ deck }: { deck?: string }) {
  const [initial, setInitial] = useState<GameState | null>(null);
  const [sessionId, setSessionId] = useState(0);
  const deckIds = useMemo(() => {
    try {
      return validateDeck(deck?.split(",") ?? DEFAULT_DECK).map(
        (card) => card.id,
      );
    } catch {
      return [...DEFAULT_DECK];
    }
  }, [deck]);
  function restart() {
    setInitial(createPracticeGame(deckIds, Date.now(), Math.random));
    setSessionId((id) => id + 1);
  }
  useEffect(() => {
    setInitial(createPracticeGame(deckIds, Date.now(), Math.random));
    setSessionId((id) => id + 1);
  }, [deckIds]);
  if (!initial) return <GameLoading />;
  return (
    <PracticeMatch key={sessionId} initial={initial} onRestart={restart} />
  );
}

function PracticeMatch({
  initial,
  onRestart,
}: {
  initial: GameState;
  onRestart: () => void;
}) {
  const [session, setSession] = useState({
    state: initial,
    events: [] as Transition["events"],
  });
  const current = useRef(session);
  const [settledSequence, setSettledSequence] = useState(-1);
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
    };
    current.current = next;
    setSession(next);
  }
  useEffect(() => {
    if (
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
      const move = chooseComputerMove(
        playerView(state, PRACTICE_COMPUTER_ID),
        Math.random,
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
  }, [session, settledSequence]);
  return (
    <DuelScreen
      data={data}
      practice
      onRestart={onRestart}
      onPlaybackSettled={setSettledSequence}
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
      onWithdrawCard={async (cardId, turn, position) =>
        commit(
          withdraw(
            current.current.state,
            0,
            cardId,
            turn,
            Date.now(),
            position,
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
