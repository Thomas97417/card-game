import { BookOpen, Layers, Leaf, Shield } from "lucide-react";
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
  turn,
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
  turn: number;
  selected: string | null;
  selectedUnit: string | null;
  hovered: string | null;
  canSummon: boolean;
  combatEvent: GameEvent | null;
  onPlace: (cardId: string, row: number, depth: number) => void;
  onInspectUnit: (cardId: string, playerIndex: number) => void;
  onInspectHero: (playerIndex: number) => void;
}) {
  function hero(player: Player, own: boolean) {
    return (
      <button
        type="button"
        className={`hero-panel ${own ? "own" : "enemy"}`}
        aria-label={`Voir les caractéristiques et le deck de ${player.name}`}
        aria-haspopup="dialog"
        onClick={() => onInspectHero(own ? me : 1 - me)}
      >
        <div className="hero-crest">
          {own ? <Leaf size={27} /> : <Shield size={27} />}
        </div>
        <div className="hero-info">
          <span className="eyebrow">{own ? "TON HÉROS" : "ADVERSAIRE"}</span>
          <strong>{player.name}</strong>
        </div>
        <div className="hero-piles">
          <span title="Cartes en main">
            <BookOpen size={13} />
            {player.handCount}
          </span>
          <span title="Pioche">
            <Layers size={13} />
            {player.drawCount}
          </span>
          <span title="Défausse">↻ {player.discardCount}</span>
        </div>
      </button>
    );
  }
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
          {hit && (
            <span key={combatEvent.seq} className="damage-float">
              −{combatEvent.damage}
            </span>
          )}
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
          const legal = own && !unit && canSummon && !!selectedCard &&
            isDeploymentDepth(selectedCard, depth);
          const blocked = !!unit && isMeleeBlocked(
            unit, player.board, player.board.map((entry) => entry.card),
          );
          const zone = depth === 0
            ? "corps à corps, vers l’ennemi"
            : depth === DEPTHS - 1
              ? "à distance, vers le héros"
              : "partagée, corps à corps et à distance";
          const acting =
            combatEvent?.player === playerIndex &&
            combatEvent.cardId === unit?.cardId;
          const hit =
            combatEvent?.type === "attack" &&
            combatEvent.targetPlayer === playerIndex &&
            combatEvent.targetCardId === unit?.cardId &&
            !!unit;
          return (
            <div
              key={`${row}-${depth}`}
              className={`projected-cell ${unit ? "occupied" : ""} ${unit && own && selectedUnit === unit.cardId ? "unit-selected" : ""}`}
              style={{ ...cell.bounds, zIndex: row + 1 }}
            >
              <button
                type="button"
                className={`board-cell ${legal && hovered === `${row}-${depth}` ? "drop-target" : ""}`}
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
                  else if (unit) onInspectUnit(unit.cardId, playerIndex);
                }}
              />
              {unit && (
                <button
                  type="button"
                  className="board-unit-control"
                  style={cell.unit}
                  aria-label={`${unit.card.name}, ${combatTypeLabel(unit.card)}, puissance ${unit.card.attack}, ${unit.hp} PV${blocked ? ", bloquée par une unité au corps à corps devant elle" : ""}, voir les informations`}
                  aria-haspopup="dialog"
                  onClick={() => onInspectUnit(unit.cardId, playerIndex)}
                >
                  <div
                    className={`board-unit ${blocked ? "blocked" : ""} ${acting && combatEvent?.type === "attack" ? "attacking" : ""} ${hit ? "taking-hit" : ""} ${acting && combatEvent?.type === "summon" ? "spawning" : ""} ${acting && (combatEvent?.type === "death" || combatEvent?.type === "withdraw") ? "dying" : ""}`}
                  >
                    <span className="unit-shadow" />
                    <CreaturePortrait card={unit.card} />
                    <div className="unit-stats">
                      <StatBadge kind="attack" value={unit.card.attack} combatType={getCombatType(unit.card)} />
                      <StatBadge
                        kind="health"
                        value={unit.hp}
                        wounded={unit.hp < unit.card.health}
                      />
                    </div>
                    <span className="unit-role" aria-hidden="true">
                      <GameIcon kind={getCombatType(unit.card)} size={17} />
                      {blocked && "Bloquée"}
                    </span>
                    <span className="unit-name">{unit.card.name}</span>
                    {hit && (
                      <span key={combatEvent.seq} className="damage-float">
                        −{combatEvent.damage}
                      </span>
                    )}
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
      <section className="arena" aria-label="Terrain de duel de la Sylve">
        <svg
          className="arena-ground"
          viewBox={`0 0 ${ARENA_WIDTH} ${ARENA_HEIGHT}`}
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
        <div className="arena-heroes">
          {hero(mine, true)}
          <div className="arena-round">
            <span>DUEL DE LA SYLVE</span>
            <strong>TOUR {turn}</strong>
            <span>LE CERCLE DES GARDIENS</span>
          </div>
          {hero(enemy, false)}
        </div>
        <div className="battlefield">
          {half(mine, me, true)}
          <div className="board-divider" aria-hidden="true">
            <span>❖</span>
          </div>
          {half(enemy, 1 - me, false)}
        </div>
        {heroFigure(mine, me, true)}
        {heroFigure(enemy, 1 - me, false)}
        <div className="board-footnote">
          <span>DISTANCE · MIXTE · CORPS À CORPS</span>
          <span>{ROWS} LIGNES · {ROWS * DEPTHS * 2} CASES</span>
          <span>CORPS À CORPS · MIXTE · DISTANCE</span>
        </div>
      </section>
    </div>
  );
}
