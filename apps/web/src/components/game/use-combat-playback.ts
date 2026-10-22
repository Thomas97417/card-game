import { useEffect, useRef, useState } from "react";
import type { GameEvent, GameView } from "@sylve/game";
import { COMBAT_TIMING } from "./combat-timing";

type View = GameView & { events: GameEvent[] };

/** Animate committed engine events; mounting starts at the current snapshot. */
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
      setEvent(null);
      return;
    }
    setPlaying(true);
    const timers: number[] = [];
    let delay = 0;
    let effectsEnd = 0;
    for (const entry of pending) {
      timers.push(window.setTimeout(() => setEvent(entry), delay));
      const duration =
        entry.type === "attack"
          ? COMBAT_TIMING.attack
          : entry.type === "death"
            ? COMBAT_TIMING.death
            : entry.type === "summon"
              ? COMBAT_TIMING.summon
              : entry.type === "withdraw"
                ? COMBAT_TIMING.withdraw
                : 0;
      const commitAt =
        delay + (entry.type === "attack" ? COMBAT_TIMING.impact : duration);
      if (entry.type === "attack")
        effectsEnd = Math.max(effectsEnd, commitAt + COMBAT_TIMING.damage);
      timers.push(
        window.setTimeout(() => {
          setDisplay((previous) => {
            if (!previous) return latest;
            if (entry.type === "turn" || entry.type === "victory")
              return latest;
            const players = previous.players.map((player, index) => {
              if (
                (entry.type === "summon" || entry.type === "withdraw") &&
                index === entry.player
              )
                return latest.players[index]!;
              if (entry.type === "death" && index === entry.player)
                return {
                  ...player,
                  board: player.board.filter(
                    (unit) =>
                      !(
                        unit.cardId === entry.cardId &&
                        unit.row === entry.row &&
                        unit.depth === entry.depth
                      ),
                  ),
                };
              if (entry.type === "attack" && index === entry.targetPlayer)
                return entry.targetCardId
                  ? {
                      ...player,
                      board: player.board.map((unit) =>
                        unit.cardId === entry.targetCardId &&
                        (entry.targetRow === undefined ||
                          unit.row === entry.targetRow) &&
                        (entry.targetDepth === undefined ||
                          unit.depth === entry.targetDepth)
                          ? { ...unit, hp: entry.hp! }
                          : unit,
                      ),
                    }
                  : { ...player, heroHp: entry.hp! };
              return player;
            });
            return { ...previous, players };
          });
        }, commitAt),
      );
      delay += duration;
      timers.push(
        window.setTimeout(() => {
          last.current = entry.seq;
        }, delay),
      );
    }
    timers.push(
      window.setTimeout(
        () => {
          setDisplay(latest);
          setPlaying(false);
          setEvent(null);
          last.current = latest.sequence;
        },
        Math.max(delay + COMBAT_TIMING.settle, effectsEnd),
      ),
    );
    return () => timers.forEach(window.clearTimeout);
  }, [latest]);
  return { display, event, playing };
}
