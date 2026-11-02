import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { newFoundryCycle, FOUNDRY_REFERENCE_SKILL_IDS, FOUNDRY_REFERENCE_SKILLS, type FoundrySkillId } from "@sylve/game/foundry";
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
    fireEvent.click(screen.getByRole("button", { name: "Poigne de cuivre, 30 éclats" })); expect(onSkill).toHaveBeenCalledWith("forge-grip");
    expect(screen.queryByRole("button", { name: /Premier éclat,/ })).toBeNull();
    view.rerender(<FoundrySkillTree {...props} cycle={cycle(["forge-grip"])} />);
    expect(screen.getByRole("button", { name: "Premier éclat, 60 éclats" })).toBeTruthy(); expect(screen.getByRole("button", { name: "Frappe précise, 60 éclats" })).toBeTruthy();
    expect(screen.queryByText("Brise-sceau")).toBeNull(); expect(screen.queryByText("Cœur du forgeron")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Premier éclat, 60 éclats" })); expect(onSkill).toHaveBeenLastCalledWith("forge-first");
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
  it("pans from a node without accidentally buying it, then allows an ordinary tap", () => {
    render(<FoundrySkillTree {...props} cycle={cycle()} />);
    const stage = screen.getByRole("region", { name: "Grand arbre de compétences" }), node = screen.getByRole("button", { name: "Souffle des fougères, 30 éclats" });
    stage.setPointerCapture = vi.fn();
    const world = stage.querySelector<HTMLElement>(".foundry-map-world")!, initial = world.style.transform;
    fireEvent.pointerDown(node, { pointerId: 1, clientX: 250, clientY: 250, button: 0 }); fireEvent.pointerMove(stage, { pointerId: 1, clientX: 320, clientY: 290 });
    expect(world.style.transform).not.toBe(initial); fireEvent.pointerUp(stage, { pointerId: 1 }); fireEvent.click(node, { detail: 1 });
    expect(onSkill).not.toHaveBeenCalled();
    const zoomBefore = Number(stage.dataset.zoom); fireEvent.click(screen.getByRole("button", { name: "Zoomer dans l’arbre" }), { detail: 1 }); expect(Number(stage.dataset.zoom)).toBeGreaterThan(zoomBefore);
    fireEvent.pointerDown(node, { pointerId: 1, clientX: 250, clientY: 250, button: 0 }); fireEvent.pointerUp(node, { pointerId: 1 }); fireEvent.click(node, { detail: 1 });
    expect(onSkill).toHaveBeenCalledExactlyOnceWith("sap-breath");
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
    fireEvent.click(screen.getByRole('button',{name:'Poigne de cuivre, 1 éclat'}));expect(onSkill).toHaveBeenCalledWith('smash-damage-1');
    view.rerender(<FoundrySkillTree {...props} cycle={{...fresh,shards:99,skills:['smash-damage-1']}} />);
    for(const name of ['Marteau élargi','Main d’ambre','Souffle des fougères','Danse des braises']) expect(screen.getByRole('button',{name:`${name}, 12 éclats`})).toBeTruthy();
    expect(screen.queryByRole('button',{name:/Appel des cochons,/})).toBeNull();expect(screen.queryByRole('button',{name:/Arc de cuivre,/})).toBeNull();
  });
  it('reveals the OR entrance and retains zoom and map navigation for the denser tree', () => {
    render(<FoundrySkillTree {...props} cycle={{...newFoundryCycle(),shards:100,skills:['smash-damage-1','frenzy-speed-1']}} />);
    fireEvent.click(screen.getByRole('button',{name:'Appel des cochons, 30 éclats'}));
    expect(onSkill).toHaveBeenCalledExactlyOnceWith('piggy-spawn-amount');
    const region=screen.getByRole('region',{name:'Grand arbre de compétences'}),initial=Number(region.dataset.zoom);
    fireEvent.click(screen.getByRole('button',{name:'Zoomer dans l’arbre'}));expect(Number(region.dataset.zoom)).toBeGreaterThan(initial);
  });
});

describe('la disponibilité et les informations des savoirs', () => {
  const funded = () => ({ ...newFoundryCycle(), shards: 12, skills: ['smash-damage-1'] as FoundrySkillId[] });

  it('uses the whole map for icons and keeps names and prices exclusively in the information card', () => {
    render(<FoundrySkillTree {...props} cycle={funded()} />);
    const map = screen.getByRole('region', { name: 'Grand arbre de compétences' });
    for (const node of map.querySelectorAll('.foundry-map-node')) {
      expect(node.textContent).toBe('');
      expect(node.querySelector('[title]')).toBeNull();
    }
    expect(screen.queryByLabelText('Les cinq voies de l’arbre')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Savoir sélectionné' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Retour à l’établi' })).toBeNull();
    expect(screen.queryByText('Les savoirs et bénédictions composent ton build de chantier.')).toBeNull();
    expect(screen.getByRole('button', { name: 'Fermer la fenêtre' })).toBeTruthy();
  });

  it('highlights exactly affordable skills, then grays the remaining nodes after a confirmed purchase', () => {
    const base = funded(), view = render(<FoundrySkillTree {...props} cycle={base} />);
    const node = () => screen.getByRole('button', { name: 'Main d’ambre, 12 éclats' });
    expect(screen.getByRole('button', { name: 'Poigne de cuivre, acquis' }).dataset.purchaseState).toBe('owned');
    for (const name of ['Marteau élargi', 'Main d’ambre', 'Souffle des fougères', 'Danse des braises']) expect(screen.getByRole('button', { name: `${name}, 12 éclats` }).dataset.purchaseState).toBe('available');
    fireEvent.click(node());
    expect(onSkill).toHaveBeenCalledWith('fortune-loot-1');
    expect(node().dataset.purchaseState).toBe('available');
    const purchased = { ...base, shards: 0, skills: [...base.skills, 'fortune-loot-1'] as FoundrySkillId[] };
    view.rerender(<FoundrySkillTree {...props} cycle={purchased} />);
    expect(screen.getByRole('button', { name: 'Main d’ambre, acquis' }).dataset.purchaseState).toBe('owned');
    const remaining = screen.getByRole('button', { name: 'Marteau élargi, 12 éclats' });
    expect(remaining.dataset.purchaseState).toBe('unaffordable');
    fireEvent.click(remaining);
    expect(onSkill).toHaveBeenCalledTimes(1);
    expect(remaining.getAttribute('aria-disabled')).toBe('true');
    view.rerender(<FoundrySkillTree {...props} cycle={{ ...purchased, shards: 12 }} />);
    expect(remaining.dataset.purchaseState).toBe('available');
    expect(remaining.getAttribute('aria-disabled')).toBe('false');
  });

  it('shows a hover card with the effect and price without selecting or purchasing the hovered skill', async () => {
    render(<FoundrySkillTree {...props} cycle={funded()} />);
    const node = screen.getByRole('button', { name: 'Main d’ambre, 12 éclats' });
    fireEvent.mouseEnter(node); fireEvent.mouseMove(node);
    const card = await screen.findByRole('tooltip');
    expect(within(card).getByRole('heading', { name: 'Main d’ambre' })).toBeTruthy();
    expect(within(card).getByText('+35% d’éclats.')).toBeTruthy();
    expect(within(card).getByText('12')).toBeTruthy();
    expect(within(card).getByText('Disponible à l’achat')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Savoir sélectionné' })).toBeNull();
    expect(onSkill).not.toHaveBeenCalled();
    fireEvent.keyDown(node, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
    expect(props.onOpenChange).not.toHaveBeenCalled();
  });

  it('keeps unaffordable nodes inspectable by keyboard and displays the missing currency', async () => {
    const base = { ...funded(), shards: 11 };
    const view = render(<FoundrySkillTree {...props} cycle={base} />);
    const node = screen.getByRole('button', { name: 'Main d’ambre, 12 éclats' });
    expect(node.dataset.purchaseState).toBe('unaffordable');
    act(() => node.focus());
    const card = await screen.findByRole('tooltip');
    expect(within(card).getByText('Il manque 1 éclat.')).toBeTruthy();
    expect(node.getAttribute('aria-describedby')).toBe(card.id);
    view.rerender(<FoundrySkillTree {...props} cycle={funded()} />);
    expect(node.dataset.purchaseState).toBe('available');
    expect(within(await screen.findByRole('tooltip')).getByText('Disponible à l’achat')).toBeTruthy();
    view.rerender(<FoundrySkillTree {...props} cycle={base} />);
    fireEvent.click(node);
    expect(node.getAttribute('aria-disabled')).toBe('true');
    expect(onSkill).not.toHaveBeenCalled();
  });

  it('does not advertise a purchase while the round or another purchase prevents learning', () => {
    const base = funded(), view = render(<FoundrySkillTree {...props} inRound cycle={base} />);
    const node = screen.getByRole('button', { name: 'Main d’ambre, 12 éclats' });
    expect(node.dataset.purchaseState).toBe('unavailable');
    fireEvent.click(node);
    expect(onSkill).not.toHaveBeenCalled();
    view.rerender(<FoundrySkillTree {...props} busy cycle={base} />);
    expect(node.dataset.purchaseState).toBe('unavailable');
    view.rerender(<FoundrySkillTree {...props} cycle={base} />);
    expect(node.dataset.purchaseState).toBe('available');
  });
});


describe("l’arbre complet de 211 nœuds",()=>{
  it("renders every learned node and keeps their information available without buying again",async ()=>{
    render(<FoundrySkillTree {...props} cycle={{...newFoundryCycle(),shards:100000000,skills:[...FOUNDRY_REFERENCE_SKILL_IDS]}} />);
    expect(screen.getByRole('region',{name:'Grand arbre de compétences'}).querySelectorAll('.foundry-map-node')).toHaveLength(211);expect(screen.getByRole('region',{name:'Grand arbre de compétences'}).querySelectorAll('[data-limit-break=true]')).toHaveLength(12);
    const node=FOUNDRY_REFERENCE_SKILLS['limit-break-damage-3'];fireEvent.click(screen.getByRole('button',{name:`${node.name}, acquis`}));
    const card=await screen.findByRole('tooltip');
    expect(within(card).getByText(/Limite de branche/)).toBeTruthy();expect(within(card).getByRole('heading',{name:node.name})).toBeTruthy();expect(within(card).getByText('Savoir acquis')).toBeTruthy();expect(onSkill).not.toHaveBeenCalled();
  });
  it("keeps the source prerequisites for new attacks and reveals the next frontier after learning them",()=>{
    const base={...newFoundryCycle(),shards:5000,skills:['smash-damage-1','smash-hit-radius','collateral-damage'] as FoundrySkillId[]};
    const view=render(<FoundrySkillTree {...props} cycle={base} />);
    fireEvent.click(screen.getByRole('button',{name:'Main spectrale, 1 000 éclats'}));expect(onSkill).toHaveBeenCalledWith('phantom-hand');
    expect(screen.queryByRole('button',{name:/Appel spectral,/})).toBeNull();
    view.rerender(<FoundrySkillTree {...props} cycle={{...base,skills:[...base.skills,'phantom-hand']}} />);expect(screen.getByRole('button',{name:'Appel spectral, 1 600 éclats'})).toBeTruthy();
  });
});
