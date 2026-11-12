import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Container, Sprite, Texture, Assets } from "pixi.js";
import { createCemeteryRun, type CemeteryEnemy, type CemeteryProjectile } from "@sylve/game/cemetery";
import { heroDefinition } from "@sylve/game/hero-metadata";
import { createCemeteryScene } from "./cemetery-scene";
import { cemeteryPickupArt, cemeteryWeaponArt } from "./cemetery-art";

vi.hoisted(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});
const applications = vi.hoisted(() => [] as { stage: Container }[]);
vi.mock("pixi.js", async (importOriginal) => {
  const pixi = await importOriginal<typeof import("pixi.js")>();
  return {
    ...pixi,
    Application: class {
      stage = new pixi.Container();
      screen = { width: 1280, height: 800 };
      canvas = document.createElement("canvas");
      renderer = { render: vi.fn() };
      constructor() { applications.push(this); }
      async init() {}
      destroy() {
        this.canvas.remove();
        this.stage.destroy({ children: true });
      }
    },
  };
});

// Keep Pixi's actual containers, sprites and depth sorting; only omit the GPU.
function paintOrder(container: Container): Sprite[] {
  container.sortChildren();
  return container.children.flatMap((child) =>
    child instanceof Sprite ? [child] : paintOrder(child),
  );
}
const scenes: Awaited<ReturnType<typeof createCemeteryScene>>[] = [];
const textures = new Map<string, Texture>();
beforeEach(() => {
  applications.length = 0;
  // The scene uses Pixi's single-asset overload, not the array overload.
  vi.spyOn(Assets, "load").mockImplementation((async (source: string) => {
    const texture = new Texture({ source: Texture.WHITE.source });
    textures.set(source, texture);
    return texture;
  }) as typeof Assets.load);
});
afterEach(() => {
  scenes.splice(0).forEach((scene) => scene.destroy());
  textures.forEach((texture) => texture.destroy());
  textures.clear();
  vi.restoreAllMocks();
});

describe("l’affichage des personnages au cimetière", () => {
  it("updates merged XP art and removes collected sprites without destroying shared textures", async () => {
    const scene = await createCemeteryScene(document.createElement("div"), "sylve");
    scenes.push(scene);
    const state = createCemeteryRun(17);
    state.y = -300;
    state.pickups = [
      {id:1,kind:"xp",x:0,y:-350,value:1,eligible:false},
      {id:2,kind:"xp",x:50,y:-350,value:1,eligible:false},
    ];
    scene.render(state,0);
    const blue = textures.get(cemeteryPickupArt("xp"))!;
    const shared = vi.spyOn(blue, "destroy");
    const gems = paintOrder(applications[0]!.stage).filter(sprite=>sprite.texture===blue);
    expect(gems).toHaveLength(2);
    expect(gems[0]!.height).toBeGreaterThanOrEqual(26);
    state.pickups[0]!.value = 10;
    state.pickups.splice(1,1);
    scene.render(state,0);
    expect(gems[0]!.texture).toBe(textures.get(cemeteryPickupArt("xp",10)));
    expect(gems[0]!.height).toBeGreaterThan(26);
    expect(gems[1]!.destroyed).toBe(true);
    expect(shared).not.toHaveBeenCalled();
    state.pickups=[];
    scene.render(state,0);
    expect(gems[0]!.destroyed).toBe(true);
  });
  it("uses weapon artwork for projectiles and releases them after their last frame", async()=>{
    const scene=await createCemeteryScene(document.createElement("div"),"sylve");scenes.push(scene);
    const state=createCemeteryRun(17);
    const projectile: CemeteryProjectile={id:1,weapon:"bible",mode:"orbit",x:100,y:0,vx:0,vy:0,damage:1,radius:12,age:0,life:5,delay:0,remaining:1,pulseAt:0,hits:[],angle:0,orbit:40,hitDelay:0,evolved:false,critical:false};
    state.projectiles=[projectile];
    scene.render(state,0);
    const sprite=paintOrder(applications[0]!.stage).find(s=>s.texture===textures.get(cemeteryWeaponArt("bible")))!;
    expect(sprite).toBeTruthy();
    projectile.evolved=true;scene.render(state,0);
    expect(sprite.texture).toBe(textures.get(cemeteryWeaponArt("bible",true)));
    state.projectiles=[];scene.render(state,0);expect(sprite.destroyed).toBe(true);
  });
  it("keeps the scene usable when an optional collectible illustration cannot load",async()=>{
    vi.spyOn(Assets,"load").mockImplementation((async(src:string)=>{
      if(src.includes('/items/'))throw new Error('image unavailable');
      const texture=new Texture({source:Texture.WHITE.source});textures.set(src,texture);return texture;
    }) as typeof Assets.load);
    const scene=await createCemeteryScene(document.createElement("div"),"sylve");scenes.push(scene);
    const state=createCemeteryRun(17);state.pickups=[{id:1,kind:"xp",x:0,y:0,value:1,eligible:false}];
    expect(()=>scene.render(state,0)).not.toThrow();
  });
  it.each([-600, -100, 100, 600])(
    "keeps heroes and enemies above the scenery at world Y=%s, with depth ordered by their feet",
    async (y) => {
      const host = document.createElement("div");
      const scene = await createCemeteryScene(host, "sylve");
      scenes.push(scene);
      const state = createCemeteryRun(17);
      state.y = y;
      state.enemies = ([
        { id: 1, kind: "revenant", x: -100, y: y - 50 },
        { id: 2, kind: "bat", x: 100, y: y + 50 },
      ] as const).map((enemy): CemeteryEnemy => ({
        ...enemy, hp: 10, maxHp: 10, radius: 18,
        damage: 1, speed: 20, born: 0, knockback: 0,
      }));
      const order = () => paintOrder(applications[0]!.stage).map((sprite) =>
        [...textures].find(([, texture]) => texture === sprite.texture)?.[0],
      );
      const background = "/art/cemetery/interior-v1.webp";
      const hero = heroDefinition("sylve").portrait;
      const revenant = "/art/cemetery/revenant-v1.webp";
      const bat = "/art/cemetery/bat-v1.webp";

      scene.render(state, 0);
      expect(order()).toEqual([background, revenant, hero, bat]);

      // Crossing an enemy changes their relative depth without hiding either.
      state.y = y + 100;
      scene.render(state, 1000);
      expect(order()).toEqual([background, revenant, bat, hero]);
    },
  );
});
