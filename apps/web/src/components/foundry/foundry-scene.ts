import * as THREE from "three";
import { RELICS, type FoundryFrame, type FoundryInput, type FoundryRelic, type FoundryRound, type RelicKind } from "@sylve/game/foundry";

import { aimAtFoundry, fitFoundryCamera, foundryViewport, nudgeFoundryAim } from "./foundry-projection";

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
  renderer.toneMappingExposure = 1.24;
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = false;
  renderer.domElement.setAttribute("aria-hidden", "true");
  host.append(renderer.domElement);

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
  const material = (color: number, metalness = 0, roughness = 0.7, emissive = 0) => {
    const m = new THREE.MeshStandardMaterial({ color, metalness, roughness, emissive, emissiveIntensity: emissive ? 0.7 : 0 });
    materials.add(m); return m;
  };
  const darkOak = material(0x322c25);
  const copper = material(0xb58349, 0.72, 0.3); const copperDark = material(0x536965, 0.65, 0.55);
  const stone = material(0x626963); const darkStone = material(0x333e3c);
  const crystal = material(0x79ddd1, 0.25, 0.18, 0x27796f);
  const cube = geometry(new THREE.BoxGeometry(1, 1, 1));
  const cylinder = geometry(new THREE.CylinderGeometry(1, 1, 1, 12));
  const sphere = geometry(new THREE.IcosahedronGeometry(1, 1));
  const spike = geometry(new THREE.ConeGeometry(1, 1, 6));
  const ringGeo = geometry(new THREE.TorusGeometry(1, 0.035, 6, 40));
  const shadowMaterial = new THREE.MeshBasicMaterial({ color: 0x0a1311, transparent: true, opacity: 0.23, depthWrite: false }); materials.add(shadowMaterial);
  const shadowGeo = geometry(new THREE.CircleGeometry(0.55, 24));
  function mesh(g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) {
    const obj = new THREE.Mesh(g, m); obj.position.set(x, y, z); obj.scale.set(sx, sy, sz);
    obj.castShadow = true; obj.receiveShadow = true; parent.add(obj); return obj;
  }
  scene.add(new THREE.HemisphereLight(0xd1e9dc, 0x302118, 2.1));
  const sun = new THREE.DirectionalLight(0xffd9a5, 3.2); sun.position.set(-5, 13, 7); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -9; sun.shadow.camera.right = 9;
  sun.shadow.camera.top = 9; sun.shadow.camera.bottom = -9; sun.shadow.normalBias = 0.04; scene.add(sun);
  const rim = new THREE.DirectionalLight(0x75c7c6, 1.7); rim.position.set(5, 5, -7); scene.add(rim);

  // Only relics, tools and their shadows sit over the illustrated worktop.
  const contactMaterial = new THREE.ShadowMaterial({ opacity: 0.24 }); materials.add(contactMaterial);
  const worktop = new THREE.Mesh(geometry(new THREE.PlaneGeometry(30, 30)), contactMaterial);
  worktop.rotation.x = -Math.PI / 2; worktop.position.y = -0.025;
  worktop.receiveShadow = true; scene.add(worktop);

  const urnGeo = geometry(new THREE.LatheGeometry([
    new THREE.Vector2(0.2, 0), new THREE.Vector2(0.23, 0.08), new THREE.Vector2(0.45, 0.24),
    new THREE.Vector2(0.47, 0.5), new THREE.Vector2(0.29, 0.76), new THREE.Vector2(0.25, 0.85), new THREE.Vector2(0.3, 0.91),
  ], 16));
  const relicMaterials = Object.fromEntries(Object.entries(RELICS).map(([id, r]) => [id, material(r.color, id === "geode" || id === "chaos" ? 0.32 : 0.08, 0.4, id === "spring" ? 0x193d24 : id === "chaos" ? 0x371b48 : 0)])) as Record<RelicKind, THREE.MeshStandardMaterial>;
  const geodeGeo = geometry(new THREE.DodecahedronGeometry(0.55));
  const crackMaterial = new THREE.LineBasicMaterial({ color: 0x171e20, transparent: true, opacity: 0.9 }); materials.add(crackMaterial);
  const crackGeo = geometry(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-0.25, 0.8, 0.3), new THREE.Vector3(0.05, 0.6, 0.48), new THREE.Vector3(-0.07, 0.44, 0.49), new THREE.Vector3(0.24, 0.25, 0.4),
  ]));
  const relics = new Map<number, { group: THREE.Group; crack: THREE.Line; kick: number }>();
  function makeRelic(t: FoundryRelic) {
    const group = new THREE.Group(); const mat = relicMaterials[t.kind];
    const shadow = mesh(shadowGeo, shadowMaterial, group, 0, 0.012, 0); shadow.rotation.x = -Math.PI / 2; shadow.castShadow = false;
    if (t.kind === "urn") {
      mesh(urnGeo, mat, group, 0, 0, 0);
      const band = mesh(ringGeo, copper, group, 0, 0.63, 0, 0.4, 0.4, 0.4); band.rotation.x = Math.PI / 2;
      mesh(cylinder, darkOak, group, 0, 0.87, 0, 0.19, 0.02, 0.19);
    } else if (t.kind === "geode") {
      const rock = mesh(geodeGeo, stone, group, 0, 0.49, 0, 1.12, 0.9, 1); rock.rotation.z = 0.2;
      for (let i = 0; i < 5; i++) {
        const c = mesh(spike, mat, group, Math.cos(i * 1.7) * 0.3, 0.67, Math.sin(i * 1.7) * 0.3, 0.17, 0.75 + i * 0.06, 0.17);
        c.rotation.z = Math.cos(i * 2) * 0.35;
      }
    } else if (t.kind === "runner") {
      mesh(sphere, mat, group, 0, 0.53, 0, 0.42, 0.45, 0.35);
      for (const x of [-0.24, 0.24]) {
        const leg = mesh(cube, copperDark, group, x, 0.15, 0, 0.12, 0.32, 0.16); leg.rotation.z = x;
        mesh(sphere, crystal, group, x * 0.6, 0.61, 0.3, 0.065, 0.09, 0.06);
      }
      const crest = mesh(spike, copper, group, 0, 0.98, 0, 0.14, 0.35, 0.14); crest.rotation.z = 0.3;
    } else if (t.kind === "spring") {
      mesh(cylinder, darkStone, group, 0, 0.13, 0, 0.47, 0.23, 0.47);
      mesh(sphere, mat, group, 0, 0.48, 0, 0.32, 0.5, 0.32);
      for (let i = 0; i < 3; i++) {
        const leaf = mesh(sphere, mat, group, Math.cos(i * 2.1) * 0.35, 0.3, Math.sin(i * 2.1) * 0.35, 0.32, 0.08, 0.16); leaf.rotation.y = -i * 2.1;
      }
      mesh(sphere, crystal, group, 0, 0.94, 0, 0.14, 0.18, 0.14);
    } else {
      mesh(sphere, mat, group, 0, 0.55, 0, 0.42, 0.48, 0.42);
      for (let i = 0; i < 3; i++) { const r = mesh(ringGeo, copperDark, group, 0, 0.55, 0, 0.57, 0.57, 0.57); r.rotation.set(i * 1.1, i * 0.7, i * 0.9); }
      mesh(spike, mat, group, 0, 1.13, 0, 0.16, 0.4, 0.16);
    }
    const crack = new THREE.Line(crackGeo, crackMaterial); group.add(crack);
    scene.add(group); const item = { group, crack, kick: -1000 }; relics.set(t.id, item); return item;
  }
  const cursorMaterial = new THREE.MeshBasicMaterial({ color: 0xf9d78b, transparent: true, opacity: 0.65, depthWrite: false }); materials.add(cursorMaterial);
  const cursor = new THREE.Mesh(ringGeo, cursorMaterial); cursor.rotation.x = -Math.PI / 2; scene.add(cursor);
  const hammer = new THREE.Group(); scene.add(hammer);
  mesh(cylinder, darkOak, hammer, 0, 0.2, 0, 0.105, 1.9, 0.105);
  for (let i = 0; i < 4; i++) mesh(cylinder, copperDark, hammer, 0, -0.45 + i * 0.16, 0, 0.12, 0.045, 0.12);
  const head = mesh(cube, copper, hammer, 0, 1.15, 0, 1.15, 0.6, 0.65);
  mesh(cube, copperDark, hammer, 0, 1.15, 0, 0.4, 0.67, 0.72);
  const resonanceRing = mesh(ringGeo, crystal, hammer, 0, 1.15, 0, 0.5, 0.5, 0.5); resonanceRing.rotation.y = Math.PI / 2;

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
  const queued: { frame: FoundryFrame; at: number }[] = [];
  let strikeAt = -1000; let shakeAt = -1000; let destroyed = false; let lastTime = 0;
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
      while (queued.length && queued[0]!.at <= time) {
        const next = queued.shift()!;
        const critical = next.frame.impacts.some((hit) => hit.critical);
        options.sound(critical, next.frame.impacts.some((hit) => hit.broken));
        if (!motion.matches) shakeAt = critical ? time : shakeAt;
        for (const hit of next.frame.impacts) {
          const obj = relics.get(hit.targetId); if (obj) obj.kick = time;
          emit(hit.x, hit.z, RELICS[hit.kind].color, hit.broken ? 8 : 3, false);
          if (hit.loot) emit(hit.x, hit.z, 0xffd878, Math.min(7, hit.loot), true);
        }
      }
      const alive = new Set(round.targets.map((t) => t.id));
      // Keep a shattered relic visible during the hammer's anticipation, until
      // the matching sound and fragments land on the actual impact frame.
      for (const [id, item] of relics) if (!alive.has(id) && !queued.some((event) => event.frame.impacts.some((hit) => hit.targetId === id))) {
        scene.remove(item.group); relics.delete(id);
      }
      for (const t of round.targets) {
        const item = relics.get(t.id) ?? makeRelic(t); const elapsed = (time - item.kick) / 1000;
        const kick = elapsed < 0.25 ? Math.sin(elapsed * 30) * Math.exp(-elapsed * 13) * 0.13 : 0;
        item.group.position.set(t.x, kick, t.z);
        item.group.rotation.y = t.phase + (t.kind === "runner" ? Math.atan2(t.vx, t.vz) : 0);
        item.group.rotation.z = kick;
        item.crack.visible = t.hp < t.maxHp * 0.75;
        if (t.kind === "runner" && active && !motion.matches) item.group.position.y += Math.abs(Math.sin(time * 0.013 + t.phase)) * 0.08;
      }
      cursor.visible = aim.active && active;
      cursor.position.set(aim.x, 0.026, aim.z); cursor.scale.setScalar(round.stats.radius);
      hammer.visible = aim.active || !active;
      const elapsed = (time - strikeAt) / 1000;
      const swing = elapsed >= 0 && elapsed < 0.28 ? Math.sin(Math.min(1, elapsed / 0.12) * Math.PI / 2) * Math.exp(-Math.max(0, elapsed - 0.12) * 12) : 0;
      hammer.position.set(aim.x + 0.3, 1.65 - swing * 0.65, aim.z + 0.65);
      hammer.rotation.set(-0.55 - swing * 1.65, 0, -0.42 + swing * 0.2);
      head.scale.x = round.tool === "swift" ? 0.7 : round.tool === "resonance" ? 1.3 : 1.15;
      resonanceRing.visible = round.tool === "resonance";
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
      particleMesh.instanceMatrix.needsUpdate = true;
      if (particleMesh.instanceColor) particleMesh.instanceColor.needsUpdate = true;
      camera.position.copy(cameraBase);
      if (!motion.matches && time - shakeAt < 160) camera.position.x += Math.sin((time - shakeAt) * 0.1) * 0.035;
      camera.lookAt(target);
      renderer.setViewport(0, 0, canvasWidth, canvasHeight); renderer.clear();
      renderer.setViewport(viewport.left, canvasHeight - viewport.top - viewport.height, viewport.width, viewport.height);
      renderer.render(scene, camera);
    });
  } catch (error) {
    renderer.dispose(); observer.disconnect(); host.replaceChildren();
    geometries.forEach((g) => g.dispose()); materials.forEach((m) => m.dispose()); throw error;
  }
  return {
    aim(clientX, clientY) {
      return aimAtFoundry(clientX, clientY, host.getBoundingClientRect(), viewport, camera);
    },
    nudge(input, dx, dz) { return nudgeFoundryAim(input, dx, dz, viewport.portrait); },
    impact(frame) { if (!frame.strike) return; strikeAt = performance.now(); queued.push({ frame, at: strikeAt + 80 }); },
    destroy() {
      if (destroyed) return; destroyed = true;
      renderer.setAnimationLoop(null); observer.disconnect();
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      queued.length = 0; particleMesh.dispose(); sun.shadow.dispose();
      geometries.forEach((g) => g.dispose()); materials.forEach((m) => m.dispose());
      scene.clear(); renderer.dispose(); renderer.domElement.remove();
    },
  };
}
