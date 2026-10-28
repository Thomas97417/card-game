import { afterEach, describe, expect, it, vi } from "vitest";
import { Container, MeshSimple, type Application } from "pixi.js";
import { gsap } from "gsap";
import { createSpineActor } from "./spine-battle-rig";
import { createSpinePortraitRenderer } from "./spine-portrait-renderer";

// Pixi probes Canvas2D blend support at import; no renderer is initialized here.
vi.hoisted(() => { vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null); });

afterEach(() => { gsap.ticker.sleep(); vi.restoreAllMocks(); document.body.replaceChildren(); });

function portrait(loaded = true) {
  const control = document.createElement("button");
  control.innerHTML = '<span data-combat-sprite><span data-combat-rig><img src="/art/characters/guardian.webp" width="256" height="256"></span></span>';
  control.getBoundingClientRect = () => new DOMRect(100, 200, 120, 132);
  const image = control.querySelector("img")!;
  Object.defineProperties(image, { naturalWidth: { configurable: true, value: loaded ? 512 : 0 }, naturalHeight: { configurable: true, value: loaded ? 512 : 0 } });
  document.body.appendChild(control);
  const actor = createSpineActor(control.querySelector<HTMLElement>("[data-combat-rig]")!);
  return { actor, control, image };
}
function meshes(container: Container): MeshSimple[] {
  return container.children.flatMap((child) => child instanceof MeshSimple ? [child] : meshes(child));
}
function scene() {
  const host = document.createElement("div");
  Object.defineProperties(host, { clientWidth: { value: 1000 }, clientHeight: { value: 600 } });
  host.getBoundingClientRect = () => new DOMRect(0, 0, 1000, 600);
  const stage = new Container();
  const renderer = createSpinePortraitRenderer({ stage } as Application, host, vi.fn());
  return { renderer, stage };
}

describe("articulated portrait resources", () => {
  it("shares textures, keeps each weighted mesh independent and frees GPU geometry and textures on exit", () => {
    const { renderer, stage } = scene();
    const first = portrait();
    const second = portrait();
    const a = renderer.attach(first.control, first.actor);
    const b = renderer.attach(second.control, second.actor);
    const [meshA, meshB] = meshes(stage);
    expect(first.actor.body.dataset.spineMesh).toBe("ready");
    expect(meshA!.texture).toBe(meshB!.texture);
    expect(meshA!.geometry).not.toBe(meshB!.geometry);
    const before = Array.from(meshB!.vertices);
    first.actor.pose("melee", 0.26);
    a.update();
    expect(Array.from(meshA!.vertices)).not.toEqual(before);
    expect(Array.from(meshB!.vertices)).toEqual(before);
    const geometry = vi.spyOn(meshA!.geometry, "destroy");
    const texture = vi.spyOn(meshA!.texture, "destroy");
    a.destroy(); a.destroy();
    expect(geometry).toHaveBeenCalledExactlyOnceWith(true);
    expect(texture).not.toHaveBeenCalled();
    expect(first.actor.body.dataset.spineMesh).toBeUndefined();
    renderer.destroy(); renderer.destroy(); b.destroy();
    expect(second.actor.body.dataset.spineMesh).toBeUndefined();
    expect(texture).toHaveBeenCalledExactlyOnceWith(true);
    expect(stage.children).toHaveLength(0);
    first.actor.destroy(); second.actor.destroy();
  });

  it("leaves the image visible until loaded and ignores loading that finishes after removal", () => {
    const { renderer, stage } = scene();
    const first = portrait(false);
    const a = renderer.attach(first.control, first.actor);
    expect(first.actor.body.dataset.spineMesh).toBeUndefined();
    Object.defineProperties(first.image, { naturalWidth: { value: 512 }, naturalHeight: { value: 512 } });
    first.image.dispatchEvent(new Event("load"));
    expect(first.actor.body.dataset.spineMesh).toBe("ready");
    a.destroy();
    const late = portrait(false);
    const b = renderer.attach(late.control, late.actor);
    b.destroy();
    Object.defineProperties(late.image, { naturalWidth: { value: 512 }, naturalHeight: { value: 512 } });
    late.image.dispatchEvent(new Event("load"));
    expect(late.actor.body.dataset.spineMesh).toBeUndefined();
    expect(meshes(stage)).toHaveLength(0);
    renderer.destroy(); first.actor.destroy(); late.actor.destroy();
  });
});
