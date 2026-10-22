import { BookOpen, Layers, Leaf, Shield } from "lucide-react";
import {
  DEPTHS,
  HERO_HP,
  ROWS,
  type GameEvent,
  type GameView,
} from "@sylve/game";
import { CreaturePortrait } from "./creature-portrait";
import { StatBadge } from "./stat-badge";

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
  canWithdraw,
  combatEvent,
  onPlace,
  onSelectUnit,
}: {
  mine: Player;
  enemy: Player;
  me: number;
  turn: number;
  selected: string | null;
  selectedUnit: string | null;
  hovered: string | null;
  canSummon: boolean;
  canWithdraw: boolean;
  combatEvent: GameEvent | null;
  onPlace: (cardId: string, row: number, depth: number) => void;
  onSelectUnit: (cardId: string) => void;
}) {
  function hero(player: Player, index: number, own: boolean) {
    const hit =
      combatEvent?.type === "attack" &&
      combatEvent.targetPlayer === index &&
      !combatEvent.targetCardId;
    return (
      <div
        className={`hero-panel ${own ? "own" : "enemy"} ${hit ? "hero-hit" : ""}`}
      >
        <div className="hero-crest">
          {own ? <Leaf size={27} /> : <Shield size={27} />}
        </div>
        <div className="hero-info">
          <span className="eyebrow">{own ? "TON HÉROS" : "ADVERSAIRE"}</span>
          <strong>{player.name}</strong>
          <div
            className="hero-health-track"
            aria-label={`${player.heroHp} points de vie sur ${HERO_HP}`}
          >
            <div style={{ width: `${(player.heroHp / HERO_HP) * 100}%` }} />
          </div>
        </div>
        <StatBadge kind="health" value={player.heroHp} />
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
      </div>
    );
  }
  function half(player: Player, playerIndex: number, own: boolean) {
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
          const legal = own && !unit && canSummon && !!selected;
          const removable = own && !!unit && canWithdraw;
          const acting =
            combatEvent?.player === playerIndex &&
            combatEvent.cardId === unit?.cardId;
          const hit =
            combatEvent?.type === "attack" &&
            combatEvent.targetPlayer === playerIndex &&
            combatEvent.targetCardId === unit?.cardId &&
            !!unit;
          return (
            <button
              key={`${row}-${depth}`}
              type="button"
              className={`board-cell ${legal ? "legal" : ""} ${hovered === `${row}-${depth}` && own ? "hovered" : ""} ${unit ? "occupied" : ""} ${removable ? "removable" : ""} ${unit && own && selectedUnit === unit.cardId ? "unit-selected" : ""}`}
              data-own-cell={own && !unit ? "true" : undefined}
              data-row={row}
              data-depth={depth}
              aria-label={`${own ? "Ton camp" : "Camp adverse"}, ligne ${row + 1}, ${depth === 0 ? "avant" : depth === 1 ? "milieu" : "arrière"}${unit ? `, ${unit.card.name}, puissance ${unit.card.attack}, ${unit.hp} PV${removable ? ", sélectionner pour retirer" : ""}` : ", vide"}`}
              aria-disabled={!legal && !removable}
              aria-pressed={
                unit && own ? selectedUnit === unit.cardId : undefined
              }
              onClick={() => {
                if (legal && selected) onPlace(selected, row, depth);
                else if (removable && unit) onSelectUnit(unit.cardId);
              }}
            >
              {unit && (
                <div
                  className={`board-unit ${acting && combatEvent?.type === "attack" ? "attacking" : ""} ${hit ? "taking-hit" : ""} ${acting && combatEvent?.type === "summon" ? "spawning" : ""} ${acting && (combatEvent?.type === "death" || combatEvent?.type === "withdraw") ? "dying" : ""}`}
                >
                  <span className="unit-shadow" />
                  <CreaturePortrait card={unit.card} />
                  <div className="unit-stats">
                    <StatBadge kind="attack" value={unit.card.attack} />
                    <StatBadge
                      kind="health"
                      value={unit.hp}
                      wounded={unit.hp < unit.card.health}
                    />
                  </div>
                  <span className="unit-name">{unit.card.name}</span>
                  {hit && (
                    <span key={combatEvent.seq} className="damage-float">
                      −{combatEvent.damage}
                    </span>
                  )}
                </div>
              )}
              {legal && <span className="place-hint">+ Invoquer</span>}
            </button>
          );
        })}
      </div>
    );
  }
  return (
    <div className="arena-scroll">
      <section className="arena" aria-label="Terrain de duel de la Sylve">
        <div className="arena-heroes">
          {hero(mine, me, true)}
          <div className="arena-round">
            <span>DUEL DE LA SYLVE</span>
            <strong>TOUR {turn}</strong>
            <span>LE CERCLE DES GARDIENS</span>
          </div>
          {hero(enemy, 1 - me, false)}
        </div>
        <div className="board-labels">
          <span>TON TERRITOIRE</span>
          <span>TERRITOIRE ADVERSE</span>
        </div>
        <div className="battlefield">
          {half(mine, me, true)}
          <div className="board-divider" aria-hidden="true">
            <span>❖</span>
          </div>
          {half(enemy, 1 - me, false)}
        </div>
        <div className="board-footnote">
          <span>ARRIÈRE · MILIEU · AVANT</span>
          <span>4 LIGNES · 24 CASES</span>
          <span>AVANT · MILIEU · ARRIÈRE</span>
        </div>
      </section>
    </div>
  );
}
