import { useCallback, useEffect, useState, type CSSProperties } from "react";
import {
  DEPTHS,
  HERO_HP,
  ROWS,
  combatTypeLabel,
  getCombatType,
  isDeploymentDepth,
  isMeleeBlocked,
  type GameEvent,
  type GameView,
} from "@sylve/game";
import { CreaturePortrait } from "./creature-portrait";
import { StatBadge } from "./stat-badge";
import { GameIcon } from "./game-icon";
import { COMBAT_TIMING } from "./combat-timing";
import {
  ARENA_CELLS,
  ARENA_CORNERS,
  ARENA_WIDTH,
  ARENA_HEIGHT,
  groundCell,
  groundPoints,
  projectGround,
} from "./arena-layout";

type Player = GameView["players"][number];

export function DuelArena({
  mine,
  enemy,
  me,
  selected,
  selectedUnit,
  hovered,
  canSummon,
  combatEvent,
  onPlace,
  onInspectUnit,
  onInspectHero,
}: {
  mine: Player;
  enemy: Player;
  me: number;
  selected: string | null;
  selectedUnit: string | null;
  hovered: string | null;
  canSummon: boolean;
  combatEvent: GameEvent | null;
  onPlace: (cardId: string, row: number, depth: number) => void;
  onInspectUnit: (unit: Player["board"][number], playerIndex: number) => void;
  onInspectHero: (playerIndex: number) => void;
}) {
  function heroFigure(player: Player, index: number, own: boolean) {
    const hit =
      combatEvent?.type === "attack" &&
      combatEvent.targetPlayer === index &&
      !combatEvent.targetCardId;
    return (
      <div
        className={`hero-slot ${own ? "own" : "enemy"}`}
        role="group"
        aria-label={`${own ? "Ton héros" : "Héros adverse"}, ${player.name}`}
      >
        <button
          type="button"
          className={`hero-figure ${hit ? "hero-hit" : ""}`}
          aria-label={`Voir ${own ? "ton héros" : "le héros adverse"}, ${player.name}, ${player.heroHp} PV`}
          aria-haspopup="dialog"
          onClick={() => onInspectHero(index)}
        >
          <span className="hero-ground-shadow" />
          <img
            src={`/art/heroes/${own ? "hero-sylve" : "hero-amber"}.webp`}
            alt={own ? "Gardien de la Sylve" : "Gardien mécanique d’ambre"}
            width={320}
            height={400}
            draggable={false}
          />
          <StatBadge
            kind="health"
            value={player.heroHp}
            wounded={player.heroHp < HERO_HP}
          />
        </button>
      </div>
    );
  }
  function half(player: Player, playerIndex: number, own: boolean) {
    const selectedCard = mine.hand.find((card) => card.id === selected);
    return (
      <div
        className={`board-half ${own ? "own" : "enemy"}`}
        role="group"
        aria-label={own ? "Ton camp" : "Camp adverse"}
      >
        {Array.from({ length: ROWS * DEPTHS }, (_, index) => {
          const row = Math.floor(index / DEPTHS);
          const depth = own ? DEPTHS - 1 - (index % DEPTHS) : index % DEPTHS;
          const unit = player.board.find(
            (entry) => entry.row === row && entry.depth === depth,
          );
          const column = own ? index % DEPTHS : DEPTHS + (index % DEPTHS);
          const cell = groundCell(row, column);
          const legal =
            own &&
            !unit &&
            canSummon &&
            !!selectedCard &&
            isDeploymentDepth(selectedCard, depth);
          const blocked =
            !!unit &&
            isMeleeBlocked(
              unit,
              player.board,
              player.board.map((entry) => entry.card),
            );
          const zone =
            depth === 0
              ? "corps à corps, vers l’ennemi"
              : depth === DEPTHS - 1
                ? "à distance, vers le héros"
                : "partagée, corps à corps et à distance";
          const acting =
            combatEvent?.player === playerIndex &&
            combatEvent.cardId === unit?.cardId &&
            combatEvent.row === row &&
            combatEvent.depth === depth;
          const hit =
            combatEvent?.type === "attack" &&
            combatEvent.targetPlayer === playerIndex &&
            combatEvent.targetCardId === unit?.cardId &&
            (combatEvent.targetRow === undefined ||
              combatEvent.targetRow === row) &&
            (combatEvent.targetDepth === undefined ||
              combatEvent.targetDepth === depth) &&
            !!unit;
          return (
            <div
              key={`${row}-${depth}`}
              className={`projected-cell ${unit ? "occupied" : ""} ${unit && own && selectedUnit === `${row}-${depth}` ? "unit-selected" : ""}`}
              style={{ ...cell.bounds, zIndex: row + 1 }}
            >
              <button
                type="button"
                className={`board-cell ${legal ? "legal-placement" : ""} ${legal && hovered === `${row}-${depth}` ? "drop-target" : ""}`}
                style={{ clipPath: cell.clipPath }}
                data-own-cell={own && !unit ? "true" : undefined}
                data-row={row}
                data-depth={depth}
                aria-label={`${own ? "Ton camp" : "Camp adverse"}, ligne ${row + 1}, colonne ${DEPTHS - depth}, zone ${zone}${unit ? `, ${unit.card.name}, ${combatTypeLabel(unit.card)}, puissance ${unit.card.attack}, ${unit.hp} PV${blocked ? ", bloquée par une unité au corps à corps devant elle" : ""}` : ", vide"}`}
                aria-disabled={!legal && !unit}
                aria-haspopup={unit ? "dialog" : undefined}
                tabIndex={unit ? -1 : 0}
                onClick={() => {
                  if (legal && selected) onPlace(selected, row, depth);
                  else if (unit) onInspectUnit(unit, playerIndex);
                }}
              >
                {legal && (
                  <span className="placement-hint" aria-hidden="true">
                    <GameIcon kind={getCombatType(selectedCard!)} size={23} />
                  </span>
                )}
              </button>
              {unit && (
                <button
                  type="button"
                  className="board-unit-control"
                  style={cell.unit}
                  aria-label={`${unit.card.name}, ${combatTypeLabel(unit.card)}, puissance ${unit.card.attack}, ${unit.hp} PV${blocked ? ", bloquée par une unité au corps à corps devant elle" : ""}, voir les informations`}
                  aria-haspopup="dialog"
                  onClick={() => onInspectUnit(unit, playerIndex)}
                >
                  <div
                    className={`board-unit ${blocked ? "blocked" : ""} ${acting && combatEvent?.type === "attack" ? "attacking" : ""} ${hit ? "taking-hit" : ""} ${!own && acting && combatEvent?.type === "summon" ? "spawning" : ""} ${acting && (combatEvent?.type === "death" || combatEvent?.type === "withdraw") ? "dying" : ""}`}
                  >
                    <span className="unit-shadow" />
                    <CreaturePortrait card={unit.card} />
                    <div className="unit-stats">
                      <StatBadge
                        kind="attack"
                        value={unit.card.attack}
                        combatType={getCombatType(unit.card)}
                      />
                      <StatBadge
                        kind="health"
                        value={unit.hp}
                        wounded={unit.hp < unit.card.health}
                      />
                    </div>
                    <span className="unit-name">{unit.card.name}</span>
                  </div>
                </button>
              )}
            </div>
          );
        })}
      </div>
    );
  }
  return (
    <div className="arena-scroll">
      <section
        className="arena"
        aria-label="Terrain de duel de la Sylve"
        style={
          { "--damage-duration": `${COMBAT_TIMING.damage}ms` } as CSSProperties
        }
      >
        <svg
          className="arena-ground"
          viewBox={`0 0 ${ARENA_WIDTH} ${ARENA_HEIGHT}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="arena-seam" x1="0" y1="0" x2="0.3" y2="1">
              <stop offset="0" stopColor="#806f48" stopOpacity="0.18" />
              <stop offset="0.5" stopColor="#c8b37d" stopOpacity="0.4" />
              <stop offset="1" stopColor="#685b3d" stopOpacity="0.26" />
            </linearGradient>
          </defs>
          <image
            href="/art/duel-arena-overhead.webp"
            width={ARENA_WIDTH}
            height={ARENA_HEIGHT}
          />
          {ARENA_CELLS.map((cell) => (
            <polygon
              key={`${cell.row}-${cell.column}`}
              className="ground-tile"
              points={cell.polygon}
            />
          ))}
          <polygon
            className="ground-outline"
            points={groundPoints(ARENA_CORNERS)}
          />
          <polyline
            className="ground-frontier"
            points={groundPoints([
              projectGround(0.5, 0),
              projectGround(0.5, 1),
            ])}
          />
        </svg>
        <div className="battlefield">
          {half(mine, me, true)}
          {half(enemy, 1 - me, false)}
        </div>
        {heroFigure(mine, me, true)}
        {heroFigure(enemy, 1 - me, false)}
        <CombatEffects event={combatEvent} mine={mine} enemy={enemy} me={me} />
      </section>
    </div>
  );
}

/** Damage stays on the terrain after the impact, including when its target dies. */
function CombatEffects({
  event,
  mine,
  enemy,
  me,
}: {
  event: GameEvent | null;
  mine: Player;
  enemy: Player;
  me: number;
}) {
  const [hits, setHits] = useState<GameEvent[]>([]);
  useEffect(() => {
    if (event?.type !== "attack") return;
    const timer = window.setTimeout(() => {
      setHits((previous) =>
        previous.some((hit) => hit.seq === event.seq)
          ? previous
          : [...previous, event],
      );
    }, COMBAT_TIMING.impact);
    return () => window.clearTimeout(timer);
  }, [event]);
  const removeHit = useCallback((sequence: number) => {
    setHits((previous) => previous.filter((hit) => hit.seq !== sequence));
  }, []);
  return (
    <div
      className="combat-effects"
      aria-live="polite"
      aria-relevant="additions"
    >
      {hits.map((hit) => {
        const own = hit.targetPlayer === me;
        const player = own ? mine : enemy;
        const target = player.deck.find((card) => card.id === hit.targetCardId);
        const position =
          hit.targetCardId &&
          hit.targetRow !== undefined &&
          hit.targetDepth !== undefined
            ? groundCell(
                hit.targetRow,
                own ? DEPTHS - 1 - hit.targetDepth : DEPTHS + hit.targetDepth,
              ).impact
            : { left: own ? "8%" : "92%", top: "66%", marginTop: "-10vw" };
        return (
          <DamageNumber
            key={hit.seq}
            hit={hit}
            position={position}
            targetName={target?.name ?? player.name}
            onComplete={removeHit}
          />
        );
      })}
    </div>
  );
}

function DamageNumber({
  hit,
  position,
  targetName,
  onComplete,
}: {
  hit: GameEvent;
  position: CSSProperties;
  targetName: string;
  onComplete: (sequence: number) => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(
      () => onComplete(hit.seq),
      COMBAT_TIMING.damage,
    );
    return () => window.clearTimeout(timer);
  }, [hit.seq, onComplete]);
  return (
    <span
      className="damage-float"
      style={position}
      aria-label={`${targetName} subit ${hit.damage} dégâts`}
    >
      −{hit.damage}
    </span>
  );
}
