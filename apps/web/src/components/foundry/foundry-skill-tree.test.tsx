import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { newFoundryCycle, type FoundrySkillId } from "@sylve/game/foundry";
import { FoundrySkillTree } from "./foundry-skill-tree";

const onSkill = vi.fn();
const props = { open: true, onOpenChange: vi.fn(), mastery: 3, masterySpent: 0, charms: [], locked: false, busy: false, inRound: false, onSkill, onCharm: vi.fn() };
const cycle = (skills: FoundrySkillId[] = []) => ({ ...legacyCycle(), shards: 300, skills });
beforeEach(() => {
  vi.stubGlobal("PointerEvent", class extends MouseEvent {
    pointerId: number; pointerType: string;
    constructor(type: string, init: MouseEventInit & { pointerId?: number; pointerType?: string }) { super(type, init); this.pointerId = init.pointerId ?? 1; this.pointerType = init.pointerType ?? "mouse"; }
  });
});
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); });
describe("l’arbre explorable de la fonderie", () => {
  it("shows all branches together, keeps future skills out of the DOM, and reveals the next nodes after a confirmed purchase", () => {
    const view = render(<FoundrySkillTree {...props} cycle={cycle()} />);
    expect(screen.getByRole("region", { name: "Grand arbre de compétences" })).toBeTruthy();
    for (const label of ["Poigne de cuivre", "Souffle des fougères", "Danse des braises", "Main d’ambre", "Cercle d’écoute"]) expect(screen.getByRole("button", { name: `${label}, 30 éclats` })).toBeTruthy();
    expect(screen.queryByText("Cœur du forgeron")).toBeNull(); expect(screen.queryByRole("button", { name: /Premier éclat,/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Apprendre Poigne de cuivre" })); expect(onSkill).toHaveBeenCalledWith("forge-grip");
    expect(screen.queryByRole("button", { name: /Premier éclat,/ })).toBeNull();
    view.rerender(<FoundrySkillTree {...props} cycle={cycle(["forge-grip"])} />);
    expect(screen.getByRole("button", { name: "Premier éclat, 60 éclats" })).toBeTruthy(); expect(screen.getByRole("button", { name: "Frappe précise, 60 éclats" })).toBeTruthy();
    expect(screen.queryByText("Brise-sceau")).toBeNull(); expect(screen.queryByText("Cœur du forgeron")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Premier éclat, 60 éclats" })); expect(screen.getByRole("button", { name: "Apprendre Premier éclat" })).toBeTruthy();
  });
  it("zooms by buttons, wheel and keyboard, and restores the overall view", () => {
    render(<FoundrySkillTree {...props} cycle={cycle()} />);
    const stage = screen.getByRole("region", { name: "Grand arbre de compétences" }), initial = Number(stage.dataset.zoom);
    fireEvent.click(screen.getByRole("button", { name: "Zoomer dans l’arbre" })); expect(Number(stage.dataset.zoom)).toBeGreaterThan(initial);
    fireEvent.click(screen.getByRole("button", { name: "Dézoomer l’arbre" })); expect(Number(stage.dataset.zoom)).toBe(initial);
    fireEvent.wheel(stage, { deltaY: -100, clientX: 300, clientY: 200 }); expect(Number(stage.dataset.zoom)).toBeGreaterThan(initial);
    const world = stage.querySelector<HTMLElement>(".foundry-map-world")!, before = world.style.transform;
    fireEvent.keyDown(stage, { key: "ArrowRight" }); expect(world.style.transform).not.toBe(before);
    fireEvent.keyDown(stage, { key: "Home" }); expect(Number(stage.dataset.zoom)).toBe(initial);
    stage.scrollTop = 90; stage.scrollLeft = 35; fireEvent.scroll(stage); expect(stage.scrollTop).toBe(0); expect(stage.scrollLeft).toBe(0);
  });
  it("pans from a node without accidentally selecting it, then allows an ordinary tap", () => {
    render(<FoundrySkillTree {...props} cycle={cycle()} />);
    const stage = screen.getByRole("region", { name: "Grand arbre de compétences" }), node = screen.getByRole("button", { name: "Souffle des fougères, 30 éclats" });
    stage.setPointerCapture = vi.fn();
    const world = stage.querySelector<HTMLElement>(".foundry-map-world")!, initial = world.style.transform;
    fireEvent.pointerDown(node, { pointerId: 1, clientX: 250, clientY: 250, button: 0 }); fireEvent.pointerMove(stage, { pointerId: 1, clientX: 320, clientY: 290 });
    expect(world.style.transform).not.toBe(initial); fireEvent.pointerUp(stage, { pointerId: 1 }); fireEvent.click(node, { detail: 1 });
    expect(screen.getByRole("heading", { name: "Poigne de cuivre" })).toBeTruthy(); expect(onSkill).not.toHaveBeenCalled();
    const zoomBefore = Number(stage.dataset.zoom); fireEvent.click(screen.getByRole("button", { name: "Zoomer dans l’arbre" }), { detail: 1 }); expect(Number(stage.dataset.zoom)).toBeGreaterThan(zoomBefore);
    fireEvent.pointerDown(node, { pointerId: 1, clientX: 250, clientY: 250, button: 0 }); fireEvent.pointerUp(node, { pointerId: 1 }); fireEvent.click(node, { detail: 1 });
    expect(screen.getByRole("heading", { name: "Souffle des fougères" })).toBeTruthy();
  });
  it("pinches around two fingers, then releases the gesture cleanly", () => {
    render(<FoundrySkillTree {...props} cycle={cycle()} />);
    const stage = screen.getByRole("region", { name: "Grand arbre de compétences" }), initial = Number(stage.dataset.zoom); stage.setPointerCapture = vi.fn();
    fireEvent.pointerDown(stage, { pointerId: 1, pointerType: "touch", clientX: 200, clientY: 200, button: 0 }); fireEvent.pointerDown(stage, { pointerId: 2, pointerType: "touch", clientX: 400, clientY: 200, button: 0 });
    fireEvent.pointerMove(stage, { pointerId: 2, pointerType: "touch", clientX: 600, clientY: 220 }); expect(Number(stage.dataset.zoom)).toBeGreaterThan(initial);
    fireEvent.pointerCancel(stage, { pointerId: 2 }); fireEvent.pointerCancel(stage, { pointerId: 1 }); expect(stage.dataset.dragging).toBe("false");
  });
});

// Saved V8 chantiers keep their original prices, profiles and simulation.
function legacyCycle(number = 1, seed?: number): ReturnType<typeof newFoundryCycle> { return { ...newFoundryCycle(number, seed), economy: 2 as const }; }

describe('l’arbre de référence', () => {
  it('starts with the 1-shard common root and reveals the four source entrances only after confirmation', () => {
    const fresh={...newFoundryCycle(),shards:100}; const view=render(<FoundrySkillTree {...props} cycle={fresh} />);
    expect(screen.getByRole('button',{name:'Poigne de cuivre, 1 éclat'})).toBeTruthy();
    expect(screen.queryByRole('button',{name:'Main d’ambre, 12 éclats'})).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Apprendre Poigne de cuivre'}));expect(onSkill).toHaveBeenCalledWith('smash-damage-1');
    view.rerender(<FoundrySkillTree {...props} cycle={{...fresh,shards:99,skills:['smash-damage-1']}} />);
    for(const name of ['Marteau élargi','Main d’ambre','Souffle des fougères','Danse des braises']) expect(screen.getByRole('button',{name:`${name}, 12 éclats`})).toBeTruthy();
    expect(screen.queryByRole('button',{name:/Appel des reliques,/})).toBeNull();expect(screen.queryByRole('button',{name:/Arc de cuivre,/})).toBeNull();
  });
  it('reveals the OR entrance and retains zoom and map navigation for the denser tree', () => {
    render(<FoundrySkillTree {...props} cycle={{...newFoundryCycle(),shards:100,skills:['smash-damage-1','frenzy-speed-1']}} />);
    fireEvent.click(screen.getByRole('button',{name:'Appel des reliques, 30 éclats'}));
    expect(screen.getByText('Un de ces savoirs suffit')).toBeTruthy();
    expect((screen.getByRole('button',{name:'Apprendre Appel des reliques'}) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole('button',{name:'Apprendre Appel des reliques'}));expect(onSkill).toHaveBeenCalledWith('piggy-spawn-amount');
    const region=screen.getByRole('region',{name:'Grand arbre de compétences'}),initial=Number(region.dataset.zoom);
    fireEvent.click(screen.getByRole('button',{name:'Zoomer dans l’arbre'}));expect(Number(region.dataset.zoom)).toBeGreaterThan(initial);
  });
});
