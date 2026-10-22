import { useEffect, useRef, useState } from "react";
import type { GameEvent, GameView } from "@sylve/game";

type View = GameView & { events: GameEvent[] };

/** Animate only server-confirmed events; refreshing starts at the current snapshot. */
export function useCombatPlayback(latest: View | undefined) {
  const [display, setDisplay] = useState<View>();
  const [event, setEvent] = useState<GameEvent | null>(null);
  const [playing, setPlaying] = useState(false);
  const last = useRef<number | null>(null);
  useEffect(() => {
    if (!latest) return;
    if (last.current === null) {
      last.current = latest.sequence;
      setDisplay(latest);
      return;
    }
    const pending = latest.events.filter((entry) => entry.seq > last.current!);
    if (!pending.length) {
      setDisplay(latest);
      setPlaying(false);
      return;
    }
    setPlaying(true);
    const timers: number[] = [];
    let delay = 0;
    for (const entry of pending) {
      timers.push(window.setTimeout(() => setEvent(entry), delay));
      const duration =
        entry.type === "attack"
          ? 420
          : entry.type === "death"
            ? 220
            : entry.type === "summon"
              ? 260
              : 0;
      delay += duration;
      timers.push(
        window.setTimeout(() => {
          last.current = entry.seq;
          setDisplay((previous) => {
            if (!previous) return latest;
            if (entry.type === "turn" || entry.type === "victory")
              return latest;
            const players = previous.players.map((player, index) => {
              if (entry.type === "summon" && index === entry.player)
                return latest.players[index]!;
              if (entry.type === "death" && index === entry.player)
                return {
                  ...player,
                  board: player.board.filter(
                    (unit) => unit.cardId !== entry.cardId,
                  ),
                };
              if (entry.type === "attack" && index === entry.targetPlayer)
                return entry.targetCardId
                  ? {
                      ...player,
                      board: player.board.map((unit) =>
                        unit.cardId === entry.targetCardId
                          ? { ...unit, hp: entry.hp! }
                          : unit,
                      ),
                    }
                  : { ...player, heroHp: entry.hp! };
              return player;
            });
            return { ...previous, players };
          });
        }, delay),
      );
    }
    timers.push(
      window.setTimeout(() => {
        setDisplay(latest);
        setPlaying(false);
        setEvent(null);
        last.current = latest.sequence;
      }, delay + 40),
    );
    return () => timers.forEach(window.clearTimeout);
  }, [latest]);
  return { display, event, playing };
}
