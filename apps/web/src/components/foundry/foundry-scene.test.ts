import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFoundryRound, newFoundryCycle, type FoundryInput } from '@sylve/game/foundry';
import { createFoundryScene } from './foundry-scene';
import { aimAtFoundry, foundryViewport } from './foundry-projection';

const rendered = vi.hoisted(() => ({ loop: null as ((time: number) => void) | null, world: null as THREE.Scene | null, camera: null as THREE.PerspectiveCamera | null }));
vi.mock('three', async importOriginal => ({ ...await importOriginal<typeof THREE>(), WebGLRenderer: class {
  domElement = document.createElement('canvas');
  shadowMap = { enabled: false, type: 0 };
  setPixelRatio() {} setClearColor() {} setSize() {} setViewport() {} clear() {} dispose() {}
  setAnimationLoop(loop: ((time: number) => void) | null) { rendered.loop = loop; }
  render(world: THREE.Scene, camera: THREE.PerspectiveCamera) { rendered.world = world; rendered.camera = camera; }
} }));

let cleanup: (() => void) | undefined;
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.spyOn(performance, 'now').mockReturnValue(1000);
});
afterEach(() => { cleanup?.(); cleanup = undefined; vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function scene(playing = true) {
  const host = document.createElement('div'); document.body.append(host);
  Object.defineProperties(host, { clientWidth: { value: 1280 }, clientHeight: { value: 720 } });
  host.getBoundingClientRect = () => new DOMRect(13, 17, 1280, 720);
  const round = createFoundryRound(91, newFoundryCycle(), 'mallet');
  round.targets = [{ ...round.targets[0]!, x: 0, z: 0, vx: 0, vz: 0 }];
  let input: FoundryInput = { x: 0, z: 0, active: true };
  const view = createFoundryScene(host, { state: () => round, input: () => input, active: () => playing, frame() {}, sound() {}, contextLost() {} });
  cleanup = () => { view.destroy(); host.remove(); };
  rendered.loop!(1000);
  return { view, aim(next: FoundryInput) { input = next; }, active(next: boolean) { playing = next; } };
}

describe('la visée libre du marteau', () => {
  it('hides the hammer and freezes its pose outside active play, then restores aiming on resume', () => {
    const { aim, active } = scene(false);
    const head = rendered.world!.getObjectByName('foundry-hammer-head')!;
    const hammer = head.parent!, face = head.children.find(child => child.type === 'Object3D')!;
    expect(hammer.visible).toBe(false);
    active(true); rendered.loop!(1010);
    expect(hammer.visible).toBe(true);
    const position = hammer.position.clone(), rotation = hammer.quaternion.clone();
    active(false); aim({ x: 3, z: -2, active: true }); rendered.loop!(1100);
    expect(hammer.visible).toBe(false);
    expect(hammer.position.toArray()).toEqual(position.toArray()); expect(hammer.quaternion.toArray()).toEqual(rotation.toArray());
    active(true); rendered.loop!(1200);
    expect(hammer.visible).toBe(true);
    const contact = face.getWorldPosition(new THREE.Vector3());
    expect(contact.x).toBeCloseTo(3, 8); expect(contact.z).toBeCloseTo(-2, 8);
  });
  it('projects onto the counter even when the pointer crosses the visible pig', () => {
    const { view } = scene(), viewport = foundryViewport(1280, 720), camera = rendered.camera!;
    const screen = new THREE.Vector3(0, .58, 0).project(camera);
    const x = 13 + viewport.left + (screen.x + 1) / 2 * viewport.width;
    const y = 17 + viewport.top + (1 - screen.y) / 2 * viewport.height;
    const expected = aimAtFoundry(x, y, { left: 13, top: 17 }, viewport, camera);
    expect(Math.hypot(expected.x, expected.z)).toBeGreaterThan(.2);
    expect(view.aim(x, y)).toEqual(expected);
  });
  it('keeps following pointer movement through anticipation, impact and recovery', () => {
    const { view, aim } = scene();
    view.impact({ strike: true, strikePosition: { x: 0, z: 0 }, impacts: [] });
    const head = rendered.world!.getObjectByName('foundry-hammer-head')!;
    const face = head.children.find(child => child.type === 'Object3D')!;
    for (const elapsed of [10, 35, 80, 120, 200]) {
      const input = { x: elapsed / 100, z: -elapsed / 200, active: true }; aim(input);
      rendered.loop!(1000 + elapsed);
      const actual = face.getWorldPosition(new THREE.Vector3());
      expect(actual.x).toBeCloseTo(input.x, 8); expect(actual.z).toBeCloseTo(input.z, 8);
    }
  });
});
