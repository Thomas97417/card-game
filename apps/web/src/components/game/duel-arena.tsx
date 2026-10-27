import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
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
  heroPortrait,
  heroDefinition,
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
import { useBattleAnimations } from "./use-battle-animations";
import { abilityOrigins, abilitySource, combatActorKey, combatFrameTiming, sealActivation } from "./combat-visuals";
import {
  AbilityIcon,
  CardAbilityIcons,
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

function appliedStatLoss(
  event: GameEvent,
  player: Player,
): StatLoss | undefined {
  if (event.type !== "ability" || (event.amount ?? 0) >= 0 || !event.unit)
    return undefined;
  const before = player.board.find(
    (unit) =>
      unit.cardId === event.targetCardId &&
      unit.row === event.targetRow &&
      unit.depth === event.targetDepth,
  );
  if (!before) return undefined;
  const base = unitCard(before, player.deck);
  const attack =
    (before.attack ?? base.attack) - (event.unit.attack ?? base.attack);
  if (attack > 0) return { stat: "attack", amount: attack };
  const health = Math.max(
    before.hp - event.unit.hp,
    unitMaxHp(before, player.deck) - unitMaxHp(event.unit, player.deck),
  );
  if (health > 0) return { stat: "health", amount: health };
  const icon = eventIconKind(event);
  if (icon === "weaken" || icon === "power")
    return { stat: "attack", amount: 0 };
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
  combatEvents,
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
  combatEvents?: readonly GameEvent[];
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
  const events = useMemo(
    () => combatEvents ?? (combatEvent ? [combatEvent] : []),
    [combatEvents, combatEvent],
  );
  const arena = useRef<HTMLElement>(null);
  const effectsLayer = useRef<HTMLDivElement>(null);
  useBattleAnimations(arena, effectsLayer, events);
  const sources = abilityOrigins(events).map((event) => abilitySource(event)!);
  const current = events[0];
  function heroFigure(player: Player, index: number, own: boolean) {
    const hit = events.some((event) =>
      (event.type === "attack" || event.type === "ability") &&
      event.targetPlayer === index &&
      !event.targetCardId && !event.runes && !event.pentagrams,
    );
    const casting = sources.some((source) => source.player === index && source.cardId === "hero");
    return (
      <div
        className={`hero-slot ${own ? "own" : "enemy"}`}
        role="group"
        aria-label={player.name}
      >
        <button
          type="button"
          data-combat-actor={combatActorKey({ player: index, cardId: "hero" })}
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
            data-combat-sprite=""
            key={casting ? current!.seq : "idle"}
            src={heroPortrait(player.heroId, !own)}
            alt={
              player.heroId
                ? heroDefinition(player.heroId).name
                : own
                  ? "Gardien de la Sylve"
                  : "Gardien mécanique d’ambre"
            }
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
          const markLabel =
            mark && seal && bonus
              ? `${fieldMarkName(mark, seal)} : +${bonus.value} ${bonus.stat === "block" ? "blocage" : bonus.stat === "health" ? "PV actuels et maximum" : "attaque"}, ${mark === "pentagram" ? "à chaque début de tour du porteur, sans bonus à la pose" : rune?.activated ? "bonus déjà accordé" : "immédiatement à l’arrivée"}`
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
          const acting = events.find((event) =>
            event.player === playerIndex && event.cardId === unit?.cardId &&
            event.row === row && event.depth === depth,
          );
          const casting = !!unit && sources.some((source) =>
            source.player === playerIndex && source.cardId === unit.cardId &&
            source.row === row && source.depth === depth,
          );
          const hit = !!unit && events.some((event) =>
            (event.type === "attack" || (event.type === "ability" && (event.amount ?? 0) < 0)) &&
            event.targetPlayer === playerIndex && event.targetCardId === unit.cardId &&
            (event.targetRow === undefined || event.targetRow === row) &&
            (event.targetDepth === undefined || event.targetDepth === depth),
          );
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
                  showBonus={!unit}
                />
              )}
              {unit && (
                <button
                  type="button"
                  className="board-unit-control"
                  data-combat-actor={combatActorKey({ player: playerIndex, cardId: unit.cardId, row, depth })}
                  data-combat-type={getCombatType(unit.card)}
                  data-combat-faction={unit.card.faction}
                  style={cell.unit}
                  aria-label={`${unit.card.name}, ${unit.fieldObject ? "bâtiment neutre" : combatTypeLabel(unit.card)}, puissance ${unit.card.attack}, ${unit.hp} PV${blocked ? ", bloquée par un allié devant elle" : ""}, voir les informations`}
                  aria-haspopup="dialog"
                  onClick={() => onInspectUnit(unit, playerIndex)}
                >
                  <div
                    data-combat-sprite=""
                    key={casting || hit || acting ? current!.seq : "idle"}
                    data-field-object={unit.fieldObject}
                    className={`board-unit ${unit.fieldObject ? "neutral-building" : ""} ${blocked ? "blocked" : ""} ${casting ? "ability-casting" : ""} ${acting?.type === "attack" ? "attacking" : ""} ${hit ? "taking-hit" : ""} ${acting?.type === "summon" ? "spawning" : ""} ${acting?.type === "death" || acting?.type === "withdraw" ? "dying" : ""}`}
                  >
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
                    <CardAbilityIcons
                      card={unit.card}
                      className="unit-ability-icons"
                      showLocked={false}
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
        ref={arena}
        className="arena"
        data-combat-viewer={me}
        aria-label="Terrain de duel de la Sylve"
        style={
          {
            "--damage-duration": `${COMBAT_TIMING.damage}ms`,
            "--cast-duration": `${current?.type === "hero_ability" ? COMBAT_TIMING.heroAbility : COMBAT_TIMING.ability}ms`,
            "--cast-impact": `${current?.type === "summon" ? COMBAT_TIMING.summon : COMBAT_TIMING.abilityImpact}ms`,
            "--hit-delay": `${current?.type === "ability" ? COMBAT_TIMING.abilityImpact : COMBAT_TIMING.impact}ms`,
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
        <div ref={effectsLayer} className="battle-pixi-layer" aria-hidden="true" />
        <CombatEffects events={events} mine={mine} enemy={enemy} me={me} />
      </section>
    </div>
  );
}

/** Damage stays on the terrain after the impact, including when its target dies. */
function CombatEffects({
  events,
  mine,
  enemy,
  me,
}: {
  events: readonly GameEvent[];
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
    // Capture every target before the frame commits, preserving engine order
    // when a reaction modifies a unit more than once in the same activation.
    const view = currentView.current;
    const targets = new Map([[view.me, view.mine], [1 - view.me, view.enemy]]);
    const incoming: CombatHit[] = [];
    for (const event of events) {
      if (event.type !== "attack" &&
        (event.type !== "ability" || ((event.runes || event.pentagrams) && !event.unit)) &&
        (event.type !== "summon" || !event.ability)) continue;
      const targetPlayer = event.targetPlayer ?? event.player;
      const player = targets.get(targetPlayer)!;
      const loss = appliedStatLoss(event, player);
      if (event.unit)
        targets.set(targetPlayer, {
          ...player,
          board: player.board.map((unit) =>
            unit.cardId === event.targetCardId && unit.row === event.targetRow && unit.depth === event.targetDepth
              ? { ...unit, ...event.unit } : unit,
          ),
        });
      if (loss?.amount === 0) continue;
      incoming.push({ event, loss });
    }
    if (!incoming.length) return;
    const delay = combatFrameTiming(events).impact;
    const timer = window.setTimeout(() => {
      setHits((previous) => {
        const seen = new Set(previous.map((hit) => hit.event.seq));
        return [...previous, ...incoming.filter((hit) => !seen.has(hit.event.seq))];
      });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [events]);
  const removeHit = useCallback((sequence: number) => {
    setHits((previous) => previous.filter((hit) => hit.event.seq !== sequence));
  }, []);
  return (
    <div
      className="combat-effects"
      aria-live="polite"
      aria-relevant="additions"
    >
      {abilityOrigins(events).map((event) => (
        <AbilityOrigin key={event.seq} event={event} targets={events} mine={mine} enemy={enemy} me={me} />
      ))}
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
          ? seal || loss
            ? cell.aboveUnit
            : cell.impact
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

function AbilityOrigin({ event, targets, mine, enemy, me }: {
  event: GameEvent;
  targets: readonly GameEvent[];
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
  const rays = source.cardId === "hero" ? targets.flatMap((target) => {
    const caster = abilitySource(target);
    if (caster?.cardId !== "hero" || caster.player !== source.player) return [];
    const position = target.type === "summon"
      ? abilityPoint(target.player, me, target.row, target.depth)
      : target.type === "ability" && target.targetPlayer !== undefined &&
          !((target.runes || target.pentagrams) && !target.unit)
        ? abilityPoint(target.targetPlayer, me, target.targetRow, target.targetDepth)
        : null;
    return position && (position.x !== origin.x || position.y !== origin.y)
      ? [{ ...position, seq: target.seq }] : [];
  }) : [];
  const icon = event.heroAbility === "call_to_arms" || event.type === "summon"
    ? "reinforcement"
    : event.heroAbility === "heavenly_power" ? "temporary" : eventIconKind(event) ?? "power";
  return (
    <>
      {rays.length > 0 && (
        <svg
          className="ability-trail" viewBox="0 0 100 100"
          preserveAspectRatio="none" aria-hidden="true"
        >
          {rays.map((target) => (
            <line key={target.seq}
              x1={origin.x} y1={origin.y} x2={target.x} y2={target.y}
              pathLength={1} vectorEffect="non-scaling-stroke"
            />
          ))}
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
        {source.cardId === "hero" && (
          <span className="ability-origin-label">
            <AbilityIcon kind={icon} size={20} />
            <span>
              <strong>{caster}</strong>
              <small>{event.ability}</small>
            </span>
          </span>
        )}
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
    ? loss.stat === "attack"
      ? "weaken"
      : "vitality"
    : (eventIconKind(hit) ??
      (hit.type === "attack" && hit.damage === 0 && hit.unit?.block
        ? "block"
        : undefined));
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
      className={`damage-float ${hit.type !== "attack" ? "combat-bonus" : ""} ${hit.type === "ability" && (hit.amount ?? 0) > 0 ? "positive-effect" : ""} ${seal ? `seal-gain seal-gain-${seal.stat}` : ""} ${loss ? "stat-loss" : ""}`}
      style={position}
      aria-label={
        hit.type === "ability" || hit.type === "summon"
          ? `${targetName} : ${hit.ability}${amount === undefined ? "" : ` ${amount > 0 ? "+" : ""}${amount}`}${stat ? (stat === "health" ? " PV" : " puissance") : ""}`
          : `${targetName} subit ${hit.damage} dégâts`
      }
    >
      {stat ? (
        <span className="stat-change-value">
          <strong>
            {loss ? "−" : "+"}
            {Math.abs(amount ?? 0)}
          </strong>
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
