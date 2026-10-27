import { useEffect, useRef, useState } from "react";
import {
  unitCard,
  unitAttack,
  unitMaxHp,
  type GameEvent,
  type GameView,
} from "@sylve/game";
import { COMBAT_TIMING } from "./combat-timing";

type View = GameView & { events: GameEvent[] };

/** Animate committed engine events; mounting starts at the current snapshot. */
export function useCombatPlayback(latest: View | undefined) {
  const [display, setDisplay] = useState<View | undefined>(latest);
  const [event, setEvent] = useState<GameEvent | null>(null);
  const [playing, setPlaying] = useState(false);
  const last = useRef<number | null>(latest?.sequence ?? null);
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
              : entry.type === "ability" || entry.type === "hero_ability"
                ? COMBAT_TIMING.ability
                : entry.type === "withdraw"
                  ? COMBAT_TIMING.withdraw
                  : 0;
      const commitAt =
        delay +
        (entry.type === "summon"
          ? 0
          : entry.type === "attack"
            ? COMBAT_TIMING.impact
            : entry.type === "ability"
              ? COMBAT_TIMING.abilityImpact
              : duration);
      if (entry.type === "attack" || entry.type === "ability")
        effectsEnd = Math.max(effectsEnd, commitAt + COMBAT_TIMING.damage);
      timers.push(
        window.setTimeout(() => {
          setDisplay((previous) => {
            if (!previous) return latest;
            if (entry.type === "turn" || entry.type === "victory")
              return latest;
            const players = previous.players.map((player, index) => {
              if (entry.type === "hero_ability" && index === entry.player)
                return { ...player, heroAbilityUses: entry.heroAbilityUses };
              if (
                entry.type === "summon" &&
                index === entry.player &&
                entry.unit
              ) {
                const definition = unitCard(entry.unit, player.deck);
                return {
                  ...player,
                  hand: latest.players[index]!.hand,
                  handCount: latest.players[index]!.handCount,
                  drawCount: latest.players[index]!.drawCount,
                  board: [
                    ...player.board.filter(
                      (u) => u.row !== entry.row || u.depth !== entry.depth,
                    ),
                    { ...entry.unit, card: definition },
                  ],
                };
              }
              if (entry.type === "ability" && index === entry.targetPlayer) {
                return {
                  ...player,
                  ...(entry.runes ? { runes: entry.runes } : {}),
                  ...(entry.pentagrams ? { pentagrams: entry.pentagrams } : {}),
                  ...(entry.heroMaxHp !== undefined
                    ? { heroMaxHp: entry.heroMaxHp }
                    : {}),
                  ...(entry.unit
                    ? {
                        board: player.board.map((unit) =>
                          unit.row === entry.targetRow &&
                          unit.depth === entry.targetDepth &&
                          unit.cardId === entry.targetCardId
                            ? { ...unit, ...entry.unit }
                            : unit,
                        ),
                      }
                    : entry.hp !== undefined
                      ? { heroHp: entry.hp }
                      : {}),
                };
              }
              if (
                (entry.type === "summon" || entry.type === "withdraw") &&
                index === entry.player
              )
                return latest.players[index]!;
              if (entry.type === "death" && index === entry.player)
                return {
                  ...player,
                  ...(entry.runes ? { runes: entry.runes } : {}),
                  ...(entry.pentagrams ? { pentagrams: entry.pentagrams } : {}),
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
                          ? { ...unit, ...(entry.unit ?? {}), hp: entry.hp! }
                          : unit,
                      ),
                    }
                  : { ...player, heroHp: entry.hp! };
              return player;
            });
            return {
              ...previous,
              players: players.map((player) => ({
                ...player,
                board: player.board.map((unit) => ({
                  ...unit,
                  card: {
                    ...unitCard(unit, player.deck),
                    attack: unitAttack(unit, {
                      cards: player.deck,
                      board: player.board,
                    }),
                    health: unitMaxHp(unit, player.deck),
                  },
                })),
              })),
            };
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
