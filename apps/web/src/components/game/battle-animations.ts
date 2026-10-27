import { gsap } from "gsap";
import { DEPTHS, type GameEvent } from "@sylve/game";
import { ARENA_HEIGHT, ARENA_WIDTH, projectCellPoint } from "./arena-layout";
import { eventIconKind } from "./ability-icons";
import {
  abilityOrigins, abilitySource, combatActorKey, combatFrameTiming,
  type CombatActor,
} from "./combat-visuals";
import {
  createPixiBattleEffects,
  type BattleEffectFrame, type BattlePoint, type ImpactStyle, type PixiBattleEffects,
} from "./pixi-battle-effects";

const motionProperties = "transform,opacity,filter";
const factionColors: Record<string, number> = {
  nature: 0xb2ed93, order: 0xffdc8b, chaos: 0xe9a0ee,
};

function impactAppearance(event: GameEvent): { color: number; style: ImpactStyle } {
  const icon = eventIconKind(event);
  if (["mental-shield", "block", "immunity", "evasion"].includes(icon ?? "") ||
    (event.type === "attack" && event.damage === 0))
    return { color: 0xa9ddff, style: "shield" };
  if (["heal", "regeneration", "life-rune", "vitality"].includes(icon ?? "") &&
    (event.amount ?? 0) >= 0)
    return { color: 0xb2f29b, style: "heal" };
  if (icon === "freeze") return { color: 0xb4eeff, style: "magic" };
  if (icon === "poison") return { color: 0xbbe268, style: "magic" };
  if (icon === "vampirism" || (event.type === "ability" && (event.amount ?? 0) < 0))
    return { color: 0xffa38b, style: "magic" };
  return { color: 0xffdfa0, style: event.type === "attack" ? "strike" : "magic" };
}

/** Paused timelines make the visual impact seekable on the playback's clock. */
export function createBattleFrame(
  arena: HTMLElement,
  events: readonly GameEvent[],
  effects?: Pick<PixiBattleEffects, "frame"> | null,
) {
  const { duration, impact } = combatFrameTiming(events);
  const end = duration / 1000;
  const at = impact / 1000;
  const timeline = gsap.timeline({ paused: true }).addLabel("impact", at);
  timeline.to({}, { duration: end }, 0);
  const frame: BattleEffectFrame | undefined = effects?.frame(timeline);
  const touched = new Set<HTMLElement>();
  const bounds = arena.getBoundingClientRect();
  const viewer = Number(arena.dataset.combatViewer ?? 0);
  const actors = new Map(
    [...arena.querySelectorAll<HTMLElement>("[data-combat-actor]")]
      .map((element) => [element.dataset.combatActor!, element] as const),
  );
  const elementFor = (actor: CombatActor) => actors.get(combatActorKey(actor));
  const spriteFor = (actor: CombatActor) => {
    const sprite = elementFor(actor)?.querySelector<HTMLElement>("[data-combat-sprite]");
    if (sprite) touched.add(sprite);
    return sprite;
  };
  function pointFor(actor: CombatActor): BattlePoint {
    const element = elementFor(actor);
    if (element && bounds.width && bounds.height) {
      const box = element.getBoundingClientRect();
      return {
        x: (box.left + box.width / 2 - bounds.left) / bounds.width * ARENA_WIDTH,
        y: (box.top + box.height * 0.55 - bounds.top) / bounds.height * ARENA_HEIGHT,
      };
    }
    if (actor.cardId === "hero" || actor.row === undefined || actor.depth === undefined ||
      actor.row < 0 || actor.depth < 0)
      return { x: ARENA_WIDTH * (actor.player === viewer ? 0.08 : 0.92), y: ARENA_HEIGHT * 0.48 };
    const column = actor.player === viewer ? DEPTHS - 1 - actor.depth : DEPTHS + actor.depth;
    return projectCellPoint(actor.row, column, 0.5, 0.6);
  }
  function restore(sprite: HTMLElement, when: number) {
    timeline.set(sprite, { clearProps: motionProperties }, when);
  }
  function recoil(actor: CombatActor, color: number) {
    const sprite = spriteFor(actor);
    if (!sprite) return;
    const direction = actor.player === viewer ? -1 : 1;
    const shift = Math.max(3, (elementFor(actor)?.clientWidth ?? 70) * 0.07);
    timeline.to(sprite, {
      x: direction * shift, rotation: direction * 3,
      filter: `brightness(1.45) drop-shadow(0 0 7px #${color.toString(16).padStart(6, "0")})`,
      duration: 0.045, ease: "power2.out",
    }, at);
    timeline.to(sprite, { x: 0, rotation: 0, filter: "brightness(1)", duration: 0.12, ease: "power2.out" }, at + 0.045);
    restore(sprite, Math.min(end - 0.005, at + 0.17));
  }

  for (const event of abilityOrigins(events)) {
    const source = abilitySource(event)!;
    const sprite = spriteFor(source);
    const color = factionColors[elementFor(source)?.dataset.combatFaction ?? ""] ?? 0xffdfa0;
    frame?.impact(pointFor(source), color, 0, "magic");
    if (!sprite) continue;
    const prepare = Math.min(0.2, end * 0.4);
    timeline.to(sprite, {
      y: -Math.max(4, (elementFor(source)?.clientHeight ?? 100) * 0.05),
      scale: 1.055, duration: prepare, ease: "power2.out",
    }, 0);
    timeline.to(sprite, { y: 0, scale: 1, duration: Math.max(0.05, end - prepare - 0.015), ease: "power2.inOut" }, prepare);
    restore(sprite, end - 0.005);
  }

  for (const event of events) {
    const actor: CombatActor = {
      player: event.player, cardId: event.cardId ?? "hero", row: event.row, depth: event.depth,
    };
    if (event.type === "attack") {
      const target: CombatActor = {
        player: event.targetPlayer ?? 1 - event.player,
        cardId: event.targetCardId ?? "hero", row: event.targetRow, depth: event.targetDepth,
      };
      const sourcePoint = pointFor(actor);
      const targetPoint = pointFor(target);
      const source = elementFor(actor);
      const sprite = spriteFor(actor);
      const direction = Math.sign(targetPoint.x - sourcePoint.x) || (event.player === viewer ? 1 : -1);
      const ranged = source?.dataset.combatType === "ranged";
      if (sprite) {
        const width = source?.clientWidth || 80;
        const lunge = ranged ? direction * 3 : direction * Math.min(width * 0.65,
          Math.abs(targetPoint.x - sourcePoint.x) / ARENA_WIDTH * bounds.width * 0.35);
        timeline.to(sprite, { x: -direction * Math.min(12, width * 0.1), rotation: -direction * 3,
          scaleY: 0.97, duration: 0.1, ease: "power2.in" }, 0);
        timeline.to(sprite, { x: lunge, rotation: direction * 2, scaleY: 1.03,
          duration: Math.max(0.01, at - 0.1), ease: "power3.in" }, 0.1);
        timeline.to(sprite, { x: 0, rotation: 0, scaleY: 1, duration: 0.3, ease: "power3.out" }, at + 0.055);
        restore(sprite, at + 0.36);
      }
      const appearance = impactAppearance(event);
      if (ranged) {
        const color = factionColors[source?.dataset.combatFaction ?? ""] ?? 0xffdfa0;
        frame?.projectile(sourcePoint, targetPoint, color, 0.08, Math.max(0.01, at - 0.08));
      }
      frame?.impact(targetPoint, appearance.color, at, appearance.style);
      if ((event.damage ?? 0) > 0) recoil(target, appearance.color);
    } else if (event.type === "ability") {
      // Creating an empty field mark has no creature/hero target.
      if ((event.runes || event.pentagrams) && !event.unit) continue;
      if (["Fin de l’entrave", "Fin du bonus temporaire", "Fin du gel"].includes(event.ability ?? "")) continue;
      const target: CombatActor = {
        player: event.targetPlayer ?? event.player,
        cardId: event.targetCardId ?? "hero", row: event.targetRow, depth: event.targetDepth,
      };
      const appearance = impactAppearance(event);
      const source = abilitySource(event);
      if (source?.cardId === "hero" && combatActorKey(source) !== combatActorKey(target))
        frame?.projectile(pointFor(source), pointFor(target), appearance.color, 0.02, Math.max(0.01, at - 0.02));
      frame?.impact(pointFor(target), appearance.color, at, appearance.style);
      if ((event.amount ?? 0) < 0) recoil(target, appearance.color);
    } else if (event.type === "summon" || event.type === "death" || event.type === "withdraw") {
      const sprite = spriteFor(actor);
      frame?.impact(pointFor(actor), event.type === "summon" ? 0xc9ed9c : 0xe6c99b, 0,
        event.type === "summon" ? "summon" : "death");
      if (!sprite) continue;
      if (event.type === "summon") {
        timeline.fromTo(sprite, { y: 16, scale: 0.65, opacity: 0 },
          { y: 0, scale: 1, opacity: 1, duration: Math.max(0.05, end - 0.015), ease: "back.out(1.5)" }, 0);
        restore(sprite, end - 0.005);
      } else {
        timeline.to(sprite, { y: -18, scale: 0.8, opacity: 0,
          duration: Math.max(0.05, end - 0.015), ease: "power2.in" }, 0);
      }
    }
  }
  return {
    timeline,
    dispose(restore = true) {
      timeline.kill();
      frame?.destroy();
      if (restore && touched.size) gsap.set([...touched], { clearProps: motionProperties });
    },
  };
}

export async function createBattleScene(arena: HTMLElement, host: HTMLElement, signal: AbortSignal) {
  let effects = await createPixiBattleEffects(host, signal);
  if (signal.aborted) { effects?.destroy(); return null; }
  const active = new Set<ReturnType<typeof createBattleFrame>>();
  const played = new Set<string>();
  let destroyed = false;
  arena.dataset.combatMotion = "enhanced";
  if (effects) arena.dataset.combatRenderer = "webgl";
  const clear = () => {
    for (const frame of active) frame.dispose();
    active.clear();
    // A death can finish before React removes its sprite at the frame boundary.
    const sprites = arena.querySelectorAll<HTMLElement>("[data-combat-sprite]");
    if (sprites.length) gsap.set(sprites, { clearProps: motionProperties });
    effects?.stop();
  };
  // Sprite height depends on width. Discard in-flight anchors on rotation or
  // resize; the next frame measures the new DOM positions before animating.
  effects?.onResize(clear);
  const contextLost = () => {
    clear();
    effects?.destroy();
    effects = null;
    delete arena.dataset.combatRenderer;
  };
  const canvas = effects?.canvas;
  canvas?.addEventListener("webglcontextlost", contextLost);
  return {
    play(events: readonly GameEvent[], elapsed: number) {
      if (destroyed || !events.length || document.hidden) return;
      const key = events.map((event) => event.seq).join(":");
      const { duration } = combatFrameTiming(events);
      if (played.has(key) || !duration || elapsed >= duration) return;
      played.add(key);
      if (played.size > 128) played.delete(played.values().next().value!);
      const frame = createBattleFrame(arena, events, effects);
      active.add(frame);
      effects?.start();
      frame.timeline.eventCallback("onComplete", () => {
        active.delete(frame);
        frame.dispose(false);
        if (!active.size) effects?.stop();
      });
      frame.timeline.play(Math.max(0, elapsed) / 1000);
    },
    clear,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      clear();
      canvas?.removeEventListener("webglcontextlost", contextLost);
      effects?.destroy();
      delete arena.dataset.combatMotion;
      delete arena.dataset.combatRenderer;
    },
  };
}

export type BattleScene = NonNullable<Awaited<ReturnType<typeof createBattleScene>>>;
