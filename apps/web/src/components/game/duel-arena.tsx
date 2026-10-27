import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  DEPTHS,
  HERO_HP,
  ROWS,
  combatTypeLabel,
  getCombatType,
  fieldBonus,
  fieldMarkName,
  isDeploymentDepth,
  isMeleeBlocked,
  unitCard,
  unitMaxHp,
  type GameEvent,
  type GameView,
} from "@sylve/game";
import { CreaturePortrait } from "./creature-portrait";
import { StatBadge } from "./stat-badge";
import { GameIcon } from "./game-icon";
import { FieldMark, type FieldMarkKind } from "./field-mark";
import { COMBAT_TIMING } from "./combat-timing";
import {
  AbilityIcon,
  CardAbilityIcons,
  UnitEffectIcons,
  eventIconKind,
} from "./ability-icons";
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

const sealActivations = {
  "Rune de vie": { kind: "rune", stat: "health" },
  "Rune de puissance": { kind: "rune", stat: "attack" },
  "Pentagramme de vie": { kind: "pentagram", stat: "health" },
  "Pentagramme de puissance": { kind: "pentagram", stat: "attack" },
} as const;

function sealActivation(event: GameEvent) {
  if (event.type !== "ability" || !event.unit || (event.amount ?? 0) <= 0)
    return undefined;
  return sealActivations[event.ability as keyof typeof sealActivations];
}

/** Reinforcement coordinates describe the new unit, so its caster is explicit. */
function abilitySource(event: GameEvent | null) {
  if (!event?.ability) return null;
  if (event.type === "hero_ability")
    return { player: event.player, cardId: "hero", row: -1, depth: -1 };
  if (event.type === "summon")
    return event.source ? { ...event.source, player: event.player } : null;
  if (
    event.type !== "ability" ||
    !event.cardId ||
    sealActivation(event) ||
    ["Poison", "Fin de l’entrave", "Fin du bonus temporaire"].includes(event.ability)
  )
    return null;
  if (
    event.cardId !== "hero" &&
    (event.row === undefined || event.depth === undefined || event.row < 0 || event.depth < 0)
  )
    return null;
  return {
    player: event.player,
    cardId: event.cardId,
    row: event.row ?? -1,
    depth: event.depth ?? -1,
  };
}

function abilityPoint(player: number, me: number, row?: number, depth?: number) {
  if (row === undefined || depth === undefined || row < 0 || depth < 0)
    return { x: player === me ? 8 : 92, y: 48 };
  const cell = groundCell(
    row, player === me ? DEPTHS - 1 - depth : DEPTHS + depth,
  );
  return {
    x: parseFloat(cell.impact.left),
    y: parseFloat(cell.impact.top) +
      parseFloat(cell.impact.marginTop) * ARENA_WIDTH / ARENA_HEIGHT,
  };
}

type StatLoss = { stat: "health" | "attack"; amount: number };
type CombatHit = { event: GameEvent; loss?: StatLoss };

function appliedStatLoss(event: GameEvent, player: Player): StatLoss | undefined {
  if (event.type !== "ability" || (event.amount ?? 0) >= 0 || !event.unit)
    return undefined;
  const before = player.board.find((unit) =>
    unit.cardId === event.targetCardId &&
    unit.row === event.targetRow && unit.depth === event.targetDepth,
  );
  if (!before) return undefined;
  const base = unitCard(before, player.deck);
  const attack = (before.attack ?? base.attack) - (event.unit.attack ?? base.attack);
  if (attack > 0) return { stat: "attack", amount: attack };
  const health = Math.max(
    before.hp - event.unit.hp,
    unitMaxHp(before, player.deck) - unitMaxHp(event.unit, player.deck),
  );
  if (health > 0) return { stat: "health", amount: health };
  const icon = eventIconKind(event);
  if (icon === "weaken" || icon === "power") return { stat: "attack", amount: 0 };
  if (icon === "vitality") return { stat: "health", amount: 0 };
  return undefined;
}

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
  onInspectField,
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
  onInspectField: (
    kind: FieldMarkKind,
    playerIndex: number,
    row: number,
    depth: number,
  ) => void;
}) {
  const source = abilitySource(combatEvent);
  function heroFigure(player: Player, index: number, own: boolean) {
    const hit =
      (combatEvent?.type === "attack" || combatEvent?.type === "ability") &&
      combatEvent.targetPlayer === index &&
      !combatEvent.targetCardId && !combatEvent.runes && !combatEvent.pentagrams;
    const casting = source?.player === index && source.cardId === "hero";
    return (
      <div
        className={`hero-slot ${own ? "own" : "enemy"}`}
        role="group"
        aria-label={player.name}
      >
        <button
          type="button"
          className={`hero-figure ${hit ? "hero-hit" : ""} ${casting ? "ability-casting" : ""}`}
          aria-label={`Voir ${player.name}, ${player.heroHp} PV`}
          aria-haspopup="dialog"
          onClick={() => onInspectHero(index)}
        >
          <span className="hero-ground-shadow" />
          {player.heroLevel !== undefined && (
            <span className="hero-level-badge">Niv. {player.heroLevel}</span>
          )}
          <img
            key={casting ? combatEvent!.seq : "idle"}
            src={`/art/heroes/${own ? "hero-sylve" : "hero-amber"}.webp`}
            alt={own ? "Gardien de la Sylve" : "Gardien mécanique d’ambre"}
            width={320}
            height={400}
            draggable={false}
          />
          <StatBadge
            kind="health"
            value={player.heroHp}
            wounded={player.heroHp < (player.heroMaxHp ?? HERO_HP)}
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
          const baseCard = unit ? unitCard(unit, player.deck) : undefined;
          const rune = player.runes?.find(
            (r) => r.row === row && r.depth === depth,
          );
          const pentagram = player.pentagrams?.find(
            (p) => p.row === row && p.depth === depth,
          );
          const mark = rune ? "rune" : pentagram ? "pentagram" : null;
          const seal = rune ?? pentagram;
          const bonus = seal ? fieldBonus(seal) : null;
          const markLabel = mark && seal && bonus
            ? `${fieldMarkName(mark, seal)} : +${bonus.value} ${bonus.stat === "health" ? "PV actuels et maximum" : "attaque"}, ${mark === "pentagram" ? "à chaque début de tour du porteur, sans bonus à la pose" : rune?.activated ? "bonus déjà accordé" : "immédiatement à l’arrivée"}`
            : "";
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
          const casting =
            !!unit && source?.player === playerIndex &&
            source.cardId === unit.cardId && source.row === row && source.depth === depth;
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
              className={`projected-cell ${unit ? "occupied" : ""} ${mark && !unit ? "marked-cell" : ""} ${unit && own && selectedUnit === `${row}-${depth}` ? "unit-selected" : ""}`}
              style={{ ...cell.bounds, zIndex: row + 1 }}
            >
              <button
                type="button"
                className={`board-cell ${legal ? "legal-placement" : ""} ${legal && hovered === `${row}-${depth}` ? "drop-target" : ""}`}
                style={{ clipPath: cell.clipPath }}
                data-own-cell={own && !unit ? "true" : undefined}
                data-row={row}
                data-depth={depth}
                aria-label={`${own ? "Ton camp" : "Camp adverse"}, ligne ${row + 1}, colonne ${DEPTHS - depth}, zone ${zone}${unit ? `, ${unit.fieldObject ? "bâtiment neutre, " : ""}${unit.card.name}, ${combatTypeLabel(unit.card)}, puissance ${unit.card.attack}, ${unit.hp} PV${blocked ? ", bloquée par un allié devant elle" : ""}` : mark ? `, ${markLabel}` : ", vide"}`}
                title={!unit && mark ? markLabel : undefined}
                aria-disabled={!legal && !unit && !mark}
                aria-haspopup={unit || (mark && !legal) ? "dialog" : undefined}
                tabIndex={unit ? -1 : 0}
                onClick={() => {
                  if (legal && selected) onPlace(selected, row, depth);
                  else if (unit) onInspectUnit(unit, playerIndex);
                  else if (mark) onInspectField(mark, playerIndex, row, depth);
                }}
              >
                {legal && (
                  <span className="placement-hint" aria-hidden="true">
                    <GameIcon kind={getCombatType(selectedCard!)} size={23} />
                  </span>
                )}
              </button>
              {mark && bonus && (
                <FieldMark
                  kind={mark}
                  stat={bonus.stat}
                  amount={bonus.value}
                  activated={rune?.activated}
                />
              )}
              {unit && (
                <button
                  type="button"
                  className="board-unit-control"
                  style={cell.unit}
                  aria-label={`${unit.card.name}, ${unit.fieldObject ? "bâtiment neutre" : combatTypeLabel(unit.card)}, puissance ${unit.card.attack}, ${unit.hp} PV${blocked ? ", bloquée par un allié devant elle" : ""}, voir les informations`}
                  aria-haspopup="dialog"
                  onClick={() => onInspectUnit(unit, playerIndex)}
                >
                  <div
                    key={casting ? combatEvent!.seq : "idle"}
                    data-field-object={unit.fieldObject}
                    className={`board-unit ${unit.fieldObject ? "neutral-building" : ""} ${blocked ? "blocked" : ""} ${casting ? "ability-casting" : ""} ${acting && combatEvent?.type === "attack" ? "attacking" : ""} ${hit ? "taking-hit" : ""} ${!own && acting && combatEvent?.type === "summon" ? "spawning" : ""} ${acting && (combatEvent?.type === "death" || combatEvent?.type === "withdraw") ? "dying" : ""}`}
                  >
                    <span className="unit-shadow" />
                    <CreaturePortrait card={unit.card} />
                    <div className="unit-stats">
                      {!unit.fieldObject && (
                        <StatBadge
                          kind="attack"
                          value={unit.card.attack}
                          baseValue={baseCard?.attack}
                          combatType={getCombatType(unit.card)}
                        />
                      )}
                      <StatBadge
                        kind="health"
                        value={unit.hp}
                        baseValue={baseCard?.health}
                        wounded={unit.hp < unit.card.health}
                      />
                    </div>
                    <span className="unit-name">{unit.card.name}</span>
                    <CardAbilityIcons
                      card={unit.card}
                      className="unit-ability-icons"
                      showLocked={false}
                      onBoard
                    />
                    <UnitEffectIcons
                      unit={unit}
                      cards={player.deck}
                      blocked={blocked}
                    />
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
          {
            "--damage-duration": `${COMBAT_TIMING.damage}ms`,
            "--cast-duration": `${combatEvent?.type === "hero_ability" ? COMBAT_TIMING.heroAbility : COMBAT_TIMING.ability}ms`,
            "--cast-impact": `${combatEvent?.type === "summon" ? COMBAT_TIMING.summon : COMBAT_TIMING.abilityImpact}ms`,
          } as CSSProperties
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
  const [hits, setHits] = useState<CombatHit[]>([]);
  const currentView = useRef({ mine, enemy, me });
  useEffect(() => {
    currentView.current = { mine, enemy, me };
  }, [mine, enemy, me]);
  useEffect(() => {
    if (
      !event ||
      (event.type !== "attack" &&
        (event.type !== "ability" || (event.runes && !event.unit)) &&
        (event.type !== "summon" || !event.ability))
    )
      return;
    // Capture the target before the playback commits this ability's snapshot.
    const view = currentView.current;
    const player = (event.targetPlayer ?? event.player) === view.me ? view.mine : view.enemy;
    const loss = appliedStatLoss(event, player);
    if (loss?.amount === 0) return;
    const timer = window.setTimeout(
      () => {
        setHits((previous) =>
          previous.some((hit) => hit.event.seq === event.seq)
            ? previous
            : [...previous, { event, loss }],
        );
      },
      event.type === "ability"
        ? COMBAT_TIMING.abilityImpact
        : event.type === "summon"
          ? 0
          : COMBAT_TIMING.impact,
    );
    return () => window.clearTimeout(timer);
  }, [event]);
  const removeHit = useCallback((sequence: number) => {
    setHits((previous) => previous.filter((hit) => hit.event.seq !== sequence));
  }, []);
  return (
    <div
      className="combat-effects"
      aria-live="polite"
      aria-relevant="additions"
    >
      {event && (
        <AbilityOrigin key={event.seq} event={event} mine={mine} enemy={enemy} me={me} />
      )}
      {hits.map(({ event: hit, loss }) => {
        const own = (hit.targetPlayer ?? hit.player) === me;
        const player = own ? mine : enemy;
        const target =
          player.deck.find((card) => card.id === hit.targetCardId) ??
          player.board.find((u) => u.cardId === hit.targetCardId)?.card ??
          hit.unit?.definition;
        const row =
          hit.targetRow ?? (hit.type === "summon" ? hit.row : undefined);
        const depth =
          hit.targetDepth ?? (hit.type === "summon" ? hit.depth : undefined);
        const seal = sealActivation(hit);
        const cell =
          row !== undefined && depth !== undefined
            ? groundCell(row, own ? DEPTHS - 1 - depth : DEPTHS + depth)
            : undefined;
        const position = cell
          ? seal || loss ? cell.aboveUnit : cell.impact
          : { left: own ? "8%" : "92%", top: "66%", marginTop: "-10vw" };
        return (
          <Fragment key={hit.seq}>
            {(seal || loss) && cell && (
              <span
                className={`seal-activation seal-activation-${loss?.stat ?? seal!.stat} ${loss ? "stat-loss-glow" : ""}`}
                data-seal-kind={seal?.kind}
                data-stat={loss?.stat ?? seal?.stat}
                style={cell.bounds}
                aria-hidden="true"
              >
                <span className="seal-glow-floor" />
                <span className="seal-glow-column" />
                {Array.from({ length: 4 }, (_, index) => (
                  <span key={index} className="seal-glow-spark" />
                ))}
              </span>
            )}
            <DamageNumber
              hit={hit}
              loss={loss}
              position={position}
              targetName={target?.name ?? player.name}
              onComplete={removeHit}
            />
          </Fragment>
        );
      })}
    </div>
  );
}

function AbilityOrigin({ event, mine, enemy, me }: {
  event: GameEvent;
  mine: Player;
  enemy: Player;
  me: number;
}) {
  const source = abilitySource(event);
  if (!source) return null;
  const player = source.player === me ? mine : enemy;
  const caster = source.cardId === "hero"
    ? player.name
    : player.board.find((unit) =>
        unit.cardId === source.cardId && unit.row === source.row && unit.depth === source.depth,
      )?.card.name ?? player.deck.find((card) => card.id === source.cardId)?.name;
  if (!caster) return null;
  const origin = abilityPoint(source.player, me, source.row, source.depth);
  const target = event.type === "summon"
    ? abilityPoint(event.player, me, event.row, event.depth)
    : event.type === "ability" && event.targetPlayer !== undefined &&
        !((event.runes || event.pentagrams) && !event.unit)
      ? abilityPoint(event.targetPlayer, me, event.targetRow, event.targetDepth)
      : null;
  const icon = event.heroAbility === "call_to_arms" || event.type === "summon"
    ? "reinforcement"
    : event.heroAbility === "heavenly_power" ? "temporary" : eventIconKind(event) ?? "power";
  return (
    <>
      {target && (target.x !== origin.x || target.y !== origin.y) && (
        <svg
          className="ability-trail" viewBox="0 0 100 100"
          preserveAspectRatio="none" aria-hidden="true"
        >
          <line
            x1={origin.x} y1={origin.y} x2={target.x} y2={target.y}
            pathLength={1} vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}
      <div
        className="ability-origin"
        data-player={source.player}
        data-own={source.player === me}
        data-card-id={source.cardId}
        data-row={source.row}
        data-depth={source.depth}
        style={{ left: `${origin.x}%`, top: `${origin.y}%` }}
        aria-label={`${caster} utilise ${event.ability}`}
      >
        <span className="ability-origin-ring" aria-hidden="true" />
        <span className="ability-origin-label">
          <AbilityIcon kind={icon} size={20} />
          <span>
            <strong>{caster}</strong>
            <small>{event.ability}</small>
          </span>
        </span>
      </div>
    </>
  );
}

function DamageNumber({
  hit,
  loss,
  position,
  targetName,
  onComplete,
}: {
  hit: GameEvent;
  loss?: StatLoss;
  position: CSSProperties;
  targetName: string;
  onComplete: (sequence: number) => void;
}) {
  const icon = loss
    ? loss.stat === "attack" ? "weaken" : "vitality"
    : eventIconKind(hit) ??
    (hit.type === "attack" && hit.damage === 0 && hit.unit?.block
      ? "block"
      : undefined);
  const seal = sealActivation(hit);
  const stat = loss?.stat ?? seal?.stat;
  const amount = loss ? -loss.amount : hit.amount;
  useEffect(() => {
    const timer = window.setTimeout(
      () => onComplete(hit.seq),
      COMBAT_TIMING.damage,
    );
    return () => window.clearTimeout(timer);
  }, [hit.seq, onComplete]);
  return (
    <span
      className={`damage-float ${hit.type === "ability" && (hit.amount ?? 0) > 0 ? "positive-effect" : ""} ${seal ? `seal-gain seal-gain-${seal.stat}` : ""} ${loss ? "stat-loss" : ""}`}
      style={position}
      aria-label={
        hit.type === "ability" || hit.type === "summon"
          ? `${targetName} : ${hit.ability}${amount === undefined ? "" : ` ${amount > 0 ? "+" : ""}${amount}`}${stat ? stat === "health" ? " PV" : " puissance" : ""}`
          : `${targetName} subit ${hit.damage} dégâts`
      }
    >
      {icon && <AbilityIcon kind={icon} size={30} />}
      {stat ? (
        <span className="stat-change-value">
          <strong>{loss ? "−" : "+"}{Math.abs(amount ?? 0)}</strong>
          <small>{stat === "health" ? "PV" : "puissance"}</small>
        </span>
      ) : hit.type === "summon" ? (
        <small className="effect-word">Renfort</small>
      ) : icon === "mental-shield" && (hit.damage ?? hit.amount) === 0 ? (
        <small className="effect-word">Protégée</small>
      ) : hit.type === "ability" ? (
        `${(hit.amount ?? 0) > 0 ? "+" : "−"}${Math.abs(hit.amount ?? 0)}`
      ) : (
        `−${hit.damage}`
      )}
    </span>
  );
}
