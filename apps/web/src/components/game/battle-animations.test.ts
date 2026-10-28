import { afterEach, describe, expect, it, vi } from "vitest";
import { gsap } from "gsap";
import type { GameEvent } from "@sylve/game";
import { combatActorKey, combatFrameTiming, type CombatActor } from "./combat-visuals";
import { COMBAT_TIMING } from "./combat-timing";
import { createBattleFrame, createBattleScene } from "./battle-animations";
import * as pixiEffects from "./pixi-battle-effects";

vi.mock("./pixi-battle-effects", () => ({ createPixiBattleEffects: vi.fn() }));

afterEach(() => {
  gsap.globalTimeline.clear();
  gsap.ticker.sleep();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

function terrain(viewer = 0) {
  const arena = document.createElement("section");
  arena.dataset.combatViewer = String(viewer);
  arena.getBoundingClientRect = () => new DOMRect(20, 10, 1000, 600);
  document.body.appendChild(arena);
  return arena;
}

function actor(arena: HTMLElement, who: CombatActor, x: number, type = "melee") {
  const button = document.createElement("button");
  button.dataset.combatActor = combatActorKey(who);
  button.dataset.combatType = type;
  button.dataset.combatFaction = "nature";
  button.getBoundingClientRect = () => new DOMRect(x, 120, 80, 100);
  Object.defineProperties(button, { clientWidth: { value: 80 }, clientHeight: { value: 100 } });
  const sprite = document.createElement("div");
  sprite.dataset.combatSprite = "";
  button.appendChild(sprite);
  arena.appendChild(button);
  return sprite;
}

function particles() {
  const frame = { impact: vi.fn(), projectile: vi.fn(), destroy: vi.fn() };
  const effects = { frame: vi.fn(() => frame), start: vi.fn(), stop: vi.fn(), onResize: vi.fn<(callback: () => void) => void>(),
    destroy: vi.fn(), canvas: document.createElement("canvas") };
  return { frame, effects };
}

const attack: GameEvent = {
  seq: 1, type: "attack", player: 0, cardId: "guardian:common", row: 0, depth: 0,
  targetPlayer: 1, targetCardId: "guardian:common", targetRow: 0, targetDepth: 0,
  damage: 3, hp: 7,
};

describe("GSAP combat choreography", () => {
  it("starts the Spine reaction at impact and catches up a late rig without delaying HP", () => {
    const arena = terrain();
    const source = { player: 0, cardId: "guardian:common", row: 0, depth: 0 };
    const target = { player: 1, cardId: "guardian:common", row: 0, depth: 0 };
    actor(arena, source, 200);
    actor(arena, target, 600);
    const rig = { pose: vi.fn() };
    const frame = createBattleFrame(arena, [attack], null, rig);
    expect(rig.pose).toHaveBeenCalledWith(source, "melee", 0, undefined);
    frame.timeline.totalTime(0.259, false);
    expect(rig.pose).not.toHaveBeenCalledWith(target, "hit", expect.any(Number), undefined);
    frame.timeline.totalTime(0.26, false);
    expect(rig.pose).toHaveBeenCalledWith(target, "hit", 0, undefined);
    frame.dispose();
    rig.pose.mockClear();
    const late = createBattleFrame(arena, [attack], null, rig, 300);
    expect(rig.pose).toHaveBeenCalledWith(target, "hit", expect.closeTo(0.04), undefined);
    expect(late.timeline.duration()).toBe(combatFrameTiming([attack]).duration / 1000);
    late.dispose();
  });

  it.each([0, 1])("recoils only the targeted copy at the HP impact for viewer %s", (viewer) => {
    const arena = terrain(viewer);
    const source = actor(arena, { player: 0, cardId: "guardian:common", row: 0, depth: 0 }, 200);
    const target = actor(arena, { player: 1, cardId: "guardian:common", row: 0, depth: 0 }, 600);
    const other = actor(arena, { player: 1, cardId: "guardian:common", row: 1, depth: 0 }, 700);
    const frame = createBattleFrame(arena, [attack]);
    expect(frame.timeline.labels.impact).toBe(COMBAT_TIMING.impact / 1000);
    frame.timeline.seek(0.259);
    expect(Number(gsap.getProperty(source, "x"))).not.toBe(0);
    expect(target.style.transform).toBe("");
    frame.timeline.seek(0.3);
    expect(Number(gsap.getProperty(target, "x"))).not.toBe(0);
    expect(other.style.transform).toBe("");
    frame.dispose();
    expect(source.style.transform).toBe("");
    expect(target.style.transform).toBe("");
  });

  it("lands a ranged projectile exactly when damage is committed", () => {
    const arena = terrain();
    actor(arena, { player: 0, cardId: "guardian:common", row: 0, depth: 0 }, 200, "ranged");
    actor(arena, { player: 1, cardId: "guardian:common", row: 0, depth: 0 }, 600);
    const { effects, frame } = particles();
    const animation = createBattleFrame(arena, [attack], effects);
    const shot = frame.projectile.mock.calls[0]!;
    expect(shot[3] + shot[4]).toBeCloseTo(COMBAT_TIMING.impact / 1000);
    expect(frame.impact).toHaveBeenCalledWith(shot[1], expect.any(Number), 0.26, "strike");
    animation.dispose();
    expect(frame.destroy).toHaveBeenCalledOnce();
  });

  it("keeps a blocked attack readable without recoiling its target", () => {
    const arena = terrain();
    actor(arena, { player: 0, cardId: "guardian:common", row: 0, depth: 0 }, 200);
    const target = actor(arena, { player: 1, cardId: "guardian:common", row: 0, depth: 0 }, 600);
    const { effects, frame } = particles();
    const animation = createBattleFrame(arena, [{ ...attack, damage: 0 }], effects);
    animation.timeline.seek(0.3);
    expect(target.style.transform).toBe("");
    expect(frame.impact).toHaveBeenCalledWith(expect.any(Object), expect.any(Number), 0.26, "shield");
    animation.dispose();
  });

  it.each(["hero", "wisp:common"])("keeps all area impacts simultaneous for %s", (caster) => {
    const arena = terrain();
    const events: GameEvent[] = [0, 1, 2].map((row) => ({
      seq: row + 1, type: "ability", abilityBatch: 1, player: 0,
      cardId: caster, row: 0, depth: 2,
      targetPlayer: 1, targetCardId: "guardian:common", targetRow: row, targetDepth: 0,
      ability: "Dégâts magiques", amount: -3,
    }));
    actor(arena, { player: 0, cardId: caster, row: 0, depth: 2 }, 100);
    for (let row = 0; row < 3; row++)
      actor(arena, { player: 1, cardId: "guardian:common", row, depth: 0 }, 600 + row * 30);
    const { effects, frame } = particles();
    const animation = createBattleFrame(arena, events, effects);
    expect(frame.impact.mock.calls.filter((call) => call[2] === 0.18)).toHaveLength(3);
    expect(frame.projectile).toHaveBeenCalledTimes(caster === "hero" ? 3 : 0);
    animation.dispose();
  });

  it("animates a reinforcement separately from its original caster", () => {
    const arena = terrain();
    const caster = actor(arena, { player: 0, cardId: "captain:common", row: 0, depth: 0 }, 200);
    const token = actor(arena, { player: 0, cardId: "token:scout", row: 0, depth: 1 }, 300);
    const event: GameEvent = {
      seq: 1, type: "summon", player: 0, ability: "Renfort",
      cardId: "token:scout", row: 0, depth: 1,
      source: { cardId: "captain:common", row: 0, depth: 0 },
    };
    const animation = createBattleFrame(arena, [event]);
    animation.timeline.seek(0.1);
    expect(Number(gsap.getProperty(caster, "y"))).toBeLessThan(0);
    expect(Number(gsap.getProperty(token, "opacity"))).toBeLessThan(1);
    animation.timeline.seek(0.42);
    expect(caster.style.transform).toBe("");
    expect(token.style.transform).toBe("");
    expect(token.style.opacity).toBe("");
    animation.dispose();
  });

  it("does not send creature or hero effects towards an empty rune", () => {
    const arena = terrain();
    const { effects, frame } = particles();
    const animation = createBattleFrame(arena, [{
      seq: 1, type: "ability", player: 0, cardId: "hero", targetPlayer: 0,
      ability: "Rune de puissance", runes: [{ row: 0, depth: 1, attack: 2 }],
    }], effects);
    expect(frame.projectile).not.toHaveBeenCalled();
    expect(frame.impact.mock.calls.filter((call) => call[2] === 0.18)).toHaveLength(0);
    animation.dispose();
  });
});

describe("battle scene lifecycle", () => {
  it("does not replay a confirmed frame and releases the renderer on exit", async () => {
    const arena = terrain();
    actor(arena, { player: 0, cardId: "guardian:common", row: 0, depth: 0 }, 200);
    const { effects, frame } = particles();
    vi.spyOn(pixiEffects, "createPixiBattleEffects").mockResolvedValue(effects);
    const scene = (await createBattleScene(arena, arena, new AbortController().signal))!;
    scene.play([attack], 0);
    scene.play([{ ...attack }], 0);
    expect(effects.frame).toHaveBeenCalledOnce();
    scene.destroy();
    scene.destroy();
    expect(frame.destroy).toHaveBeenCalledOnce();
    expect(effects.destroy).toHaveBeenCalledOnce();
    expect(arena.dataset.combatMotion).toBeUndefined();
    expect(arena.querySelector<HTMLElement>("[data-combat-sprite]")!.style.transform).toBe("");
  });

  it("discards an initialization completed after the arena unmounted", async () => {
    const arena = terrain();
    const { effects } = particles();
    const controller = new AbortController();
    vi.spyOn(pixiEffects, "createPixiBattleEffects").mockImplementation(async () => {
      controller.abort();
      return effects;
    });
    expect(await createBattleScene(arena, arena, controller.signal)).toBeNull();
    expect(effects.destroy).toHaveBeenCalledOnce();
    expect(arena.dataset.combatMotion).toBeUndefined();
  });

  it("keeps GSAP available if WebGL initialization fails", async () => {
    const arena = terrain();
    actor(arena, { player: 0, cardId: "guardian:common", row: 0, depth: 0 }, 200);
    vi.spyOn(pixiEffects, "createPixiBattleEffects").mockResolvedValue(null);
    const scene = (await createBattleScene(arena, arena, new AbortController().signal))!;
    expect(arena.dataset.combatMotion).toBe("enhanced");
    expect(arena.dataset.combatRenderer).toBeUndefined();
    expect(() => scene.play([attack], 0)).not.toThrow();
    scene.destroy();
  });

  it("drops stale frames after a delayed load and releases a lost WebGL context", async () => {
    const arena = terrain();
    const { effects } = particles();
    vi.spyOn(pixiEffects, "createPixiBattleEffects").mockResolvedValue(effects);
    const scene = (await createBattleScene(arena, arena, new AbortController().signal))!;
    scene.play([attack], combatFrameTiming([attack]).duration + 1);
    expect(effects.frame).not.toHaveBeenCalled();
    effects.canvas.dispatchEvent(new Event("webglcontextlost"));
    expect(effects.destroy).toHaveBeenCalledOnce();
    expect(arena.dataset.combatRenderer).toBeUndefined();
    scene.destroy();
    expect(effects.destroy).toHaveBeenCalledOnce();
  });

  it("clears old anchors on resize and measures the next frame again", async () => {
    const arena = terrain();
    actor(arena, { player: 0, cardId: "guardian:common", row: 0, depth: 0 }, 200);
    const { effects, frame } = particles();
    vi.spyOn(pixiEffects, "createPixiBattleEffects").mockResolvedValue(effects);
    const scene = (await createBattleScene(arena, arena, new AbortController().signal))!;
    scene.play([attack], 0);
    effects.onResize.mock.calls[0]![0]();
    expect(frame.destroy).toHaveBeenCalledOnce();
    scene.play([attack], 0);
    expect(effects.frame).toHaveBeenCalledOnce();
    scene.play([{ ...attack, seq: 2 }], 0);
    expect(effects.frame).toHaveBeenCalledTimes(2);
    scene.destroy();
  });
});
