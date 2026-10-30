import * as THREE from "three";
import { RELICS, type FoundryEffect, type FoundryFrame, type FoundryInput, type FoundryRelic, type FoundryRound } from "@sylve/game/foundry";

import { createFoundryArt, type FoundryRelicArt } from "./foundry-art";
import { FOUNDRY_IMPACT_DELAY_MS, poseFoundryHammer } from "./foundry-hammer";
import { aimAtFoundry, fitFoundryCamera, foundryViewport, nudgeFoundryAim } from "./foundry-projection";
import { createFoundryCombatText } from "./foundry-combat-text";

export interface FoundryScene {
  aim(clientX: number, clientY: number): FoundryInput;
  nudge(input: FoundryInput, dx: number, dz: number): FoundryInput;
  impact(frame: FoundryFrame): void;
  destroy(): void;
}
interface SceneOptions {
  state: () => FoundryRound;
  input: () => FoundryInput;
  active: () => boolean;
  frame: (now: number) => void;
  sound: (critical: boolean, broken: boolean) => void;
  contextLost: () => void;
}
interface Particle { life: number; total: number; x: number; y: number; z: number; vx: number; vy: number; vz: number; loot: boolean; scale: number; color: THREE.Color }

/** Rendering is cosmetic. Only the shared, fixed-step engine resolves collisions. */
export function createFoundryScene(host: HTMLElement, options: SceneOptions): FoundryScene {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  const mobile = window.matchMedia("(pointer: coarse)").matches;
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.4 : 1.8));
  renderer.shadowMap.enabled = !mobile;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = false;
  renderer.domElement.setAttribute("aria-hidden", "true");
  host.append(renderer.domElement);
  const combatText = createFoundryCombatText(host, mobile ? 40 : 72);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(39, 1, 0.1, 100);
  const cameraBase = new THREE.Vector3();
  const target = new THREE.Vector3(0, 0, 0);
  let viewport = foundryViewport(1, 1);
  let canvasWidth = 1;
  let canvasHeight = 1;
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const geometry = <T extends THREE.BufferGeometry>(g: T) => { geometries.add(g); return g; };
  const art = createFoundryArt(mobile);
  const ringGeo = geometry(new THREE.TorusGeometry(1, 0.025, 8, 64));
  scene.add(new THREE.HemisphereLight(0xffe9c9, 0x61452a, 1.8));
  const sun = new THREE.DirectionalLight(0xffdea9, 2.4); sun.position.set(-5, 13, 7); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -9; sun.shadow.camera.right = 9;
  sun.shadow.camera.top = 9; sun.shadow.camera.bottom = -9; sun.shadow.normalBias = 0.04; sun.shadow.radius = 3; scene.add(sun);
  const rim = new THREE.DirectionalLight(0xa9d7bd, 0.65); rim.position.set(5, 5, -7); scene.add(rim);

  // Only relics, tools and their shadows sit over the illustrated worktop.
  const contactMaterial = new THREE.ShadowMaterial({ opacity: 0.12 }); materials.add(contactMaterial);
  const worktop = new THREE.Mesh(geometry(new THREE.PlaneGeometry(30, 30)), contactMaterial);
  worktop.rotation.x = -Math.PI / 2; worktop.position.y = -0.025;
  worktop.receiveShadow = true; scene.add(worktop);

  const iceMaterial = new THREE.MeshBasicMaterial({ color: 0xa2e0e0, transparent: true, opacity: 0.48, depthWrite: false });
  const burnMaterial = new THREE.MeshBasicMaterial({ color: 0xffaf62, transparent: true, opacity: 0.6, depthWrite: false });
  const glowMaterial = new THREE.MeshBasicMaterial({ color: 0xffdf76, transparent: true, opacity: 0.7, depthWrite: false });
  materials.add(iceMaterial); materials.add(burnMaterial); materials.add(glowMaterial);
  const relics = new Map<number, { group: THREE.Group; model: FoundryRelicArt; ice: THREE.Mesh; burn: THREE.Mesh; glow: THREE.Mesh; kick: number }>();
  function makeRelic(t: FoundryRelic) {
    const group = new THREE.Group(); const model = art.relic(t.kind);
    const ice = new THREE.Mesh(ringGeo, iceMaterial); const burn = new THREE.Mesh(ringGeo, burnMaterial);
    ice.rotation.x = burn.rotation.x = -Math.PI / 2; ice.position.y = 0.04; burn.position.y = 0.07;
    ice.scale.setScalar(RELICS[t.kind].radius + 0.04); burn.scale.setScalar(RELICS[t.kind].radius * 0.8);
    const glow = new THREE.Mesh(ringGeo, glowMaterial); glow.rotation.x = -Math.PI / 2; glow.position.y = 0.055; glow.scale.setScalar(RELICS[t.kind].radius + 0.12); glow.visible = !!t.glowing;
    group.position.set(t.x, 0, t.z); group.add(art.shadow(), ice, burn, glow, model.root);
    scene.add(group); const item = { group, model, ice, burn, glow, kick: -1000 }; relics.set(t.id, item); return item;
  }
  const cursorMaterial = new THREE.MeshBasicMaterial({ color: 0xf9d78b, transparent: true, opacity: 0.65, depthWrite: false }); materials.add(cursorMaterial);
  const cursor = new THREE.Mesh(ringGeo, cursorMaterial); cursor.rotation.x = -Math.PI / 2; scene.add(cursor);
  const hammer = art.hammer(); scene.add(hammer.root);

  const maxParticles = mobile ? 100 : 200;
  const particleMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }); materials.add(particleMaterial);
  const particleMesh = new THREE.InstancedMesh(geometry(new THREE.TetrahedronGeometry(1)), particleMaterial, maxParticles);
  particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); particleMesh.frustumCulled = false; scene.add(particleMesh);
  const particles: Particle[] = Array.from({ length: maxParticles }, () => ({ life: 0, total: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, loot: false, scale: 0, color: new THREE.Color() }));
  let particleIndex = 0;
  const dummy = new THREE.Object3D();
  function emit(x: number, z: number, color: number, count: number, loot: boolean) {
    for (let i = 0; i < count; i++) {
      const p = particles[particleIndex++ % maxParticles]!; const angle = i / count * Math.PI * 2;
      Object.assign(p, { life: loot ? 0.9 : 0.7, total: loot ? 0.9 : 0.7, x, y: 0.5, z,
        vx: Math.cos(angle) * (1.4 + i % 3), vz: Math.sin(angle) * (1.2 + i % 3), vy: 2.2 + i % 4, loot, scale: loot ? 0.1 : 0.06 + (i % 3) * 0.025 });
      p.color.setHex(color);
    }
  }
  const waves = Array.from({ length: mobile ? 8 : 16 }, () => {
    const mat = new THREE.MeshBasicMaterial({ color: 0xe4c68c, transparent: true, opacity: 0, depthWrite: false }); materials.add(mat);
    const ring = new THREE.Mesh(ringGeo, mat); ring.rotation.x = -Math.PI / 2; ring.visible = false; scene.add(ring);
    return { ring, mat, life: 0, total: 0.6, radius: 1 };
  });
  const beams = Array.from({ length: mobile ? 4 : 8 }, () => {
    const g = geometry(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(18), 3)));
    const mat = new THREE.LineBasicMaterial({ color: 0xc6eff5, transparent: true, opacity: 0, depthWrite: false }); materials.add(mat);
    const line = new THREE.Line(g, mat); line.visible = false; line.frustumCulled = false; scene.add(line);
    return { line, mat, life: 0 };
  });
  let waveIndex = 0, beamIndex = 0;
  function effect(event: FoundryEffect) {
    if (event.kind === "burn") { emit(event.x, event.z, 0xffa95a, mobile ? 3 : 6, false); return; }
    if (event.kind === "frenzy" || event.kind === "jackpot") { emit(event.x, event.z, event.kind === "frenzy" ? 0xffcb83 : 0xffdf86, mobile ? 5 : 10, event.kind === "jackpot"); return; }
    if (motion.matches) return;
    if (event.kind === "lightning") {
      const beam = beams[beamIndex++ % beams.length]!; const attribute = beam.line.geometry.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < 6; i++) {
        const t = i / 5; const bend = i === 0 || i === 5 ? 0 : (i % 2 ? 0.11 : -0.11);
        attribute.setXYZ(i, THREE.MathUtils.lerp(event.x, event.toX ?? event.x, t) + bend, 0.65 + Math.sin(t * Math.PI) * 0.2, THREE.MathUtils.lerp(event.z, event.toZ ?? event.z, t) - bend);
      }
      attribute.needsUpdate = true; beam.life = 0.24; beam.line.visible = true; return;
    }
    const wave = waves[waveIndex++ % waves.length]!;
    wave.life = wave.total; wave.radius = event.radius ?? 2; wave.ring.position.set(event.x, 0.035, event.z);
    wave.mat.color.setHex(event.kind === "freeze" ? 0x9bd9e2 : 0xdfc18b); wave.ring.visible = true;
  }
  const queued: { frame: FoundryFrame; at: number }[] = [];
  let strikeAt = -1000; let strikeAim: FoundryInput | null = null; let shakeAt = -1000; let destroyed = false; let lastTime = 0; let visualSeconds = 0; let wasFrozen = false; let freezeVisualTime = 0;
  const textPoint = new THREE.Vector3();
  const resize = () => {
    canvasWidth = Math.max(1, host.clientWidth); canvasHeight = Math.max(1, host.clientHeight);
    renderer.setSize(canvasWidth, canvasHeight, false);
    viewport = foundryViewport(canvasWidth, canvasHeight);
    cameraBase.copy(fitFoundryCamera(camera, viewport));
  };
  const observer = new ResizeObserver(resize); observer.observe(host); resize();
  const onContextLost = (event: Event) => { event.preventDefault(); options.contextLost(); };
  renderer.domElement.addEventListener("webglcontextlost", onContextLost);
  try {
    renderer.setAnimationLoop((time) => {
      if (destroyed) return;
      const dt = Math.min(0.05, lastTime ? (time - lastTime) / 1000 : 0); lastTime = time;
      options.frame(time);
      const round = options.state(); const aim = options.input(); const active = options.active();
      if (active && !motion.matches) visualSeconds += dt;
      while (queued.length && queued[0]!.at <= time) {
        const next = queued.shift()!;
        const critical = next.frame.impacts.some((hit) => hit.critical);
        if (next.frame.strike || next.frame.impacts.length) options.sound(critical, next.frame.impacts.some((hit) => hit.broken));
        next.frame.effects?.forEach(effect);
        if (!motion.matches) shakeAt = critical ? time : shakeAt;
        for (const hit of next.frame.impacts) {
          combatText.impact(hit);
          const obj = relics.get(hit.targetId); if (obj) obj.kick = time;
          emit(hit.x, hit.z, RELICS[hit.kind].color, hit.broken ? 8 : 3, false);
          if (hit.loot) emit(hit.x, hit.z, 0xffd878, Math.min(7, hit.loot), true);
        }
      }
      const frozen = !!round.rogue && round.rogue.frozenUntil > round.tick;
      if (frozen && !wasFrozen) freezeVisualTime = visualSeconds;
      wasFrozen = frozen;
      const modelTime = frozen ? freezeVisualTime : visualSeconds;
      const burning = new Set(round.rogue?.burns.map((burn) => burn.id) ?? []);
      const alive = new Set(round.targets.map((t) => t.id));
      // Keep a shattered relic visible during the hammer's anticipation, until
      // the matching sound and fragments land on the actual impact frame.
      for (const [id, item] of relics) if (!alive.has(id) && !queued.some((event) => event.frame.impacts.some((hit) => hit.targetId === id))) {
        scene.remove(item.group); relics.delete(id);
      }
      for (const t of round.targets) {
        const item = relics.get(t.id) ?? makeRelic(t); const elapsed = (time - item.kick) / 1000;
        const kick = elapsed < 0.25 ? Math.sin(elapsed * 30) * Math.exp(-elapsed * 13) * 0.13 : 0;
        // Independent visual easing would let two separated discs overlap.
        item.group.position.set(t.x, 0, t.z);
        const dance = motion.matches ? 0 : Math.sin(modelTime * (t.kind === "runner" ? 8 : 2.2) + t.phase);
        const hover = motion.matches ? 0 : t.kind === "chaos" ? 0.055 : t.kind === "runner" ? 0.035 : 0.016;
        item.model.root.position.y = kick + hover + dance * hover;
        const heading = t.kind === "runner" ? Math.atan2(t.vx, t.vz) : t.phase;
        item.model.root.rotation.set(0, heading, kick + dance * (t.kind === "chaos" ? 0.05 : 0.025));
        item.model.damage.visible = t.hp < t.maxHp * 0.75;
        item.model.animate(motion.matches ? 0 : modelTime);
        item.ice.visible = frozen; item.burn.visible = burning.has(t.id); item.glow.visible = !!t.glowing;
      }
      cursor.visible = (round.version >= 5 || aim.active) && active;
      cursor.position.set(aim.x, 0.026, aim.z); cursor.scale.setScalar(round.stats.radius);
      hammer.root.visible = round.version >= 5 || aim.active || !active;
      hammer.tool(round.tool, round.version < 9);
      const elapsed = time - strikeAt;
      poseFoundryHammer(hammer, strikeAim && elapsed <= FOUNDRY_IMPACT_DELAY_MS + 50 ? strikeAim : aim, elapsed);
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]!;
        if (p.life > 0) {
          p.life -= dt;
          if (p.loot && p.life < 0.6) {
            p.x += (5.6 - p.x) * dt * 6; p.y += (3.4 - p.y) * dt * 6; p.z += (-3.4 - p.z) * dt * 6;
          } else { p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vy -= 9 * dt; }
          dummy.position.set(p.x, Math.max(0.06, p.y), p.z); dummy.rotation.set(p.life * 8, p.life * 3, i);
          dummy.scale.setScalar(p.scale * Math.max(0, Math.min(1, p.life * 5)));
        } else dummy.scale.setScalar(0);
        dummy.updateMatrix(); particleMesh.setMatrixAt(i, dummy.matrix); particleMesh.setColorAt(i, p.color);
      }
      for (const wave of waves) {
        if (active) wave.life = Math.max(0, wave.life - dt);
        wave.ring.visible = wave.life > 0;
        wave.ring.scale.setScalar(wave.radius * (0.25 + (1 - wave.life / wave.total) * 0.75));
        wave.mat.opacity = wave.life / wave.total * 0.48;
      }
      for (const beam of beams) {
        if (active) beam.life = Math.max(0, beam.life - dt);
        beam.line.visible = beam.life > 0; beam.mat.opacity = beam.life / 0.24;
      }
      particleMesh.instanceMatrix.needsUpdate = true;
      if (particleMesh.instanceColor) particleMesh.instanceColor.needsUpdate = true;
      camera.position.copy(cameraBase);
      if (!motion.matches && time - shakeAt < 160) camera.position.x += Math.sin((time - shakeAt) * 0.1) * 0.035;
      camera.lookAt(target);
      camera.updateMatrixWorld();
      if (!active && !round.tick) combatText.clear();
      combatText.render(active ? dt : 0, (x, z) => {
        textPoint.set(x, 0.8, z).project(camera);
        return { x: viewport.left + (textPoint.x + 1) / 2 * viewport.width, y: viewport.top + (1 - textPoint.y) / 2 * viewport.height,
          visible: Math.abs(textPoint.x) <= 1.1 && Math.abs(textPoint.y) <= 1.1 && textPoint.z >= -1 && textPoint.z <= 1 };
      }, motion.matches);
      renderer.setViewport(0, 0, canvasWidth, canvasHeight); renderer.clear();
      renderer.setViewport(viewport.left, canvasHeight - viewport.top - viewport.height, viewport.width, viewport.height);
      renderer.render(scene, camera);
    });
  } catch (error) {
    combatText.destroy(); renderer.dispose(); observer.disconnect(); host.replaceChildren();
    geometries.forEach((g) => g.dispose()); materials.forEach((m) => m.dispose()); art.dispose(); throw error;
  }
  return {
    aim(clientX, clientY) {
      return aimAtFoundry(clientX, clientY, host.getBoundingClientRect(), viewport, camera);
    },
    nudge(input, dx, dz) { return nudgeFoundryAim(input, dx, dz, viewport.portrait); },
    impact(frame) {
      if (!frame.strike && !frame.impacts.length && !frame.effects?.length) return;
      const now = performance.now(); if (frame.strike) { strikeAt = now; strikeAim = frame.strikePosition ? { ...frame.strikePosition, active: true } : null; }
      queued.push({ frame, at: now + (frame.strike ? FOUNDRY_IMPACT_DELAY_MS : 0) }); queued.sort((a, b) => a.at - b.at);
    },
    destroy() {
      if (destroyed) return; destroyed = true;
      renderer.setAnimationLoop(null); observer.disconnect();
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      queued.length = 0; particleMesh.dispose(); sun.shadow.dispose();
      geometries.forEach((g) => g.dispose()); materials.forEach((m) => m.dispose());
      combatText.destroy(); art.dispose(); scene.clear(); renderer.dispose(); renderer.domElement.remove();
    },
  };
}
