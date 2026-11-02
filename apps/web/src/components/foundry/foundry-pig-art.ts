import * as THREE from 'three';
import { FOUNDRY, FOUNDRY_GOLEMS, BANK_PIG_MOVEMENT, type FoundryGolemId } from '@sylve/game/foundry';
import { createFoundryPigBody, PIG_FOOT_CENTERS } from './foundry-pig-body';

export interface FoundryPigArt {
  root: THREE.Group;
  damage: THREE.Group;
  animate(seconds: number, motion?: { speed: number; phase: number; raging: boolean; stolen: number; distance?: number }): void;
}

/** Original meshes: the reference's round piggy banks, bulging eyes and short four-legged stance. */
export function createFoundryPigArt(mobile: boolean) {
  const geometries: THREE.BufferGeometry[] = [], materials: THREE.Material[] = [], textures: THREE.Texture[] = [];
  const own = <T extends THREE.BufferGeometry>(geometry: T) => { geometries.push(geometry); return geometry; };
  const sphere = own(new THREE.SphereGeometry(1, mobile ? 16 : 24, mobile ? 10 : 16));
  const pigBody = own(createFoundryPigBody(mobile));
  const box = own(new THREE.BoxGeometry(1, 1, 1));
  const cylinder = own(new THREE.CylinderGeometry(1, 1, 1, mobile ? 12 : 20));
  const cone = own(new THREE.ConeGeometry(1, 1, mobile ? 8 : 12));
  const lid = own(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2));
  const earShape = new THREE.Shape();
  earShape.moveTo(-.12, 0); earShape.quadraticCurveTo(-.19, .17, -.12, .38);
  earShape.quadraticCurveTo(-.1, .43, -.05, .39); earShape.quadraticCurveTo(.16, .24, .12, .03); earShape.closePath();
  const ear = own(new THREE.ExtrudeGeometry(earShape, { depth: .065, bevelEnabled: true, bevelThickness: .018, bevelSize: .022, bevelSegments: 1, steps: 1, curveSegments: 5 }));
  const tail = own(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({ length: 23 }, (_, i) => {
    const t = i / 22 * Math.PI * 3.2;
    return new THREE.Vector3(Math.cos(t) * .042, Math.sin(t) * .042, -i / 22 * .12);
  })), 24, .012, 5, false));
  const crack = own(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(-.24, .86, .31), new THREE.Vector3(-.13, .75, .43), new THREE.Vector3(-.19, .64, .46),
    new THREE.Vector3(-.06, .5, .51), new THREE.Vector3(-.1, .39, .45),
  ]), 12, .007, 4, false));
  function paint(color: number, map?: THREE.Texture, metalness = 0) {
    const material = new THREE.MeshStandardMaterial({ color, map: map ?? null, roughness: metalness ? .47 : .76, metalness });
    materials.push(material); return material;
  }
  function pattern(kind: 'wood' | 'confetti' | 'camo') {
    const size = 128, pixels = new Uint8Array(size * size * 4);
    const spots = Array.from({ length: 42 }, (_, i) => ({ x: (i * 47 + 13) % size, y: (i * 71 + 23) % size, r: kind === 'camo' ? 12 : 4 + i % 3 }));
    const palette = kind === 'camo' ? [0x505643, 0x30382b, 0x73765b, 0x454a37] : [0x3f7584, 0xb06b70, 0x92718c, 0xc49752];
    const color = new THREE.Color();
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      if (kind === 'wood') {
        const grain = Math.sin(x * .32 + Math.sin(y * .08) * 1.5) * .07 + Math.sin(x * .91 + y * .04) * .025;
        color.setRGB(.64 + grain, .43 + grain, .27 + grain);
      } else {
        color.setHex(kind === 'camo' ? 0x63694e : 0xf5dcad);
        const spot = spots.findIndex(s => Math.hypot(x - s.x, (y - s.y) * (kind === 'camo' ? 1.4 : 1)) < s.r);
        if (spot >= 0) color.setHex(palette[spot % palette.length]!);
        color.convertLinearToSRGB();
      }
      const offset = (y * size + x) * 4;
      pixels.set([Math.round(color.r * 255), Math.round(color.g * 255), Math.round(color.b * 255), 255], offset);
    }
    const texture = new THREE.DataTexture(pixels, size, size); texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.LinearFilter; texture.needsUpdate = true; textures.push(texture); return texture;
  }
  const pink = paint(0xf1a198), rose = paint(0xda8079), innerEar = paint(0xc56e66), white = paint(0xfff5dc), black = paint(0x161517);
  const wood = paint(0xffffff, pattern('wood')), confetti = paint(0xffffff, pattern('confetti')), camouflage = paint(0xffffff, pattern('camo'));
  const red = paint(0xc93242), charcoal = paint(0x202332), violet = paint(0x423b54), green = paint(0x637e37), straw = paint(0xd3a65d);
  const brass = paint(0xd3aa52, undefined, .35), plum = paint(0x8652a0), turquoise = paint(0x507f85), leather = paint(0x282827), yellow = paint(0xffd36b);
  const shells: Record<FoundryGolemId, THREE.Material> = { copper: pink, sap: rose, stone: wood, amber: confetti, ember: red, shrapnel: camouflage, furnace: charcoal, thorn: violet, thief: green, reinforcement: pink };
  function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D, x: number, y: number, z: number, sx: number, sy = sx, sz = sx) {
    const part = new THREE.Mesh(geometry, material); part.position.set(x, y, z); part.scale.set(sx, sy, sz);
    part.castShadow = true; part.receiveShadow = true; parent.add(part); return part;
  }
  function create(id: FoundryGolemId): FoundryPigArt {
    const root = new THREE.Group(); root.name = `bank-pig-${FOUNDRY_GOLEMS[id].source}`;
    const rig = new THREE.Group(); rig.name = 'pig-motion'; root.add(rig);
    const body = new THREE.Group(); body.name = 'pig-body'; rig.add(body);
    const shell = shells[id];
    mesh(pigBody, shell, body, 0, 0, 0, 1).name = 'pig-belly';
    mesh(box, black, body, 0, 1.002, -.04, .055, .008, .27).name = 'pig-coin-slot';
    const legs: THREE.Group[] = [];
    for (const foot of PIG_FOOT_CENTERS) {
      const leg = new THREE.Group(); leg.name = `pig-leg-${foot.side}-${foot.end}`;
      leg.position.set(foot.x, .245, foot.z); body.add(leg); legs.push(leg);
    }
    mesh(sphere, shell, body, 0, .55, .45, .23, .16, .105).name = 'pig-snout';
    for (const side of [-1, 1]) {
      mesh(sphere, black, body, side * .085, .565, .545, .032, .049, .012).name = 'pig-nostril';
      mesh(sphere, id === 'thief' ? yellow : white, body, side * .25, .755, .345, .16, .165, .153).name = 'pig-eye';
      mesh(sphere, black, body, side * .255, .76, .49, id === 'thief' ? .019 : .039, id === 'thief' ? .06 : .045, .018).name = 'pig-pupil';
      if (id === 'sap' || id === 'ember' || id === 'shrapnel') {
        const eyelid = mesh(lid, shell, body, side * .25, .766, .345, .164, .17, .157);
        eyelid.rotation.z = id === 'ember' ? -side * .32 : id === 'sap' ? -.18 : 0;
      }
      const outer = mesh(ear, shell, body, side * .265, .865, .155, side, 1, 1); outer.rotation.z = -side * .19;
      mesh(ear, id === 'stone' || id === 'thorn' || id === 'furnace' || id === 'thief' || id === 'shrapnel' ? shell : innerEar, outer, 0, .025, .073, .66, .76, .22);
    }
    mesh(tail, shell, body, 0, .57, -.48, 1).name = 'pig-curly-tail';
    if (id === 'sap') {
      const hat = new THREE.Group(); hat.position.set(0, 1.025, .1); hat.rotation.z = -.18; body.add(hat);
      mesh(cylinder, straw, hat, 0, 0, 0, .22, .035, .19); mesh(cylinder, straw, hat, 0, .08, 0, .125, .15, .12);
      mesh(cylinder, turquoise, hat, 0, .045, 0, .13, .035, .125);
      for (let i = 0; i < 5; i++) mesh(sphere, plum, hat, -.13 + Math.sin(i * Math.PI * .4) * .036, .055 + Math.cos(i * Math.PI * .4) * .036, .1, .027, .027, .012);
      mesh(sphere, straw, hat, -.13, .055, .115, .018);
    }
    if (id === 'amber') {
      const hat = mesh(cone, turquoise, body, 0, 1.18, .07, .115, .4, .115); hat.rotation.z = -.16;
      for (let i = 0; i < 3; i++) mesh(cylinder, rose, body, .015 * i, 1.04 + i * .09, .07, .095 - i * .025, .035, .095 - i * .025);
      mesh(sphere, white, body, -.035, 1.39, .07, .036);
    }
    if (id === 'ember') for (const side of [-1, 1]) {
      const horn = mesh(cone, straw, body, side * .16, 1.045, .21, .065, .27, .065); horn.rotation.z = -side * .3; horn.rotation.x = -.35;
    }
    if (id === 'shrapnel') {
      for (const side of [-1, 1]) for (let i = 0; i < 3; i++) mesh(box, leather, body, side * .36, .48 + i * .06, .29, .065, .022, .015);
    }
    if (id === 'furnace') {
      const fuse = mesh(tail, straw, body, 0, 1.045, -.08, 1.15); fuse.rotation.x = Math.PI / 2;
      mesh(sphere, brass, body, 0, 1.11, -.08, .035);
      // A small skull-and-crossbones emblem, made from geometry rather than copied art.
      for (const side of [-1, 1]) {
        const emblem = new THREE.Group(); emblem.position.set(side * .425, .58, -.05); emblem.rotation.y = side * Math.PI / 2; body.add(emblem);
        mesh(sphere, white, emblem, 0, .065, 0, .09, .08, .008);
        for (const x of [-.033, .033]) mesh(sphere, black, emblem, x, .07, .009, .021, .025, .006);
        for (const angle of [-.65, .65]) { const bone = mesh(cylinder, white, emblem, 0, -.065, 0, .014, .23, .014); bone.rotation.z = angle; }
      }
    }
    if (id === 'thorn') for (let row = 0; row < 3; row++) for (let i = 0; i < 5; i++) {
      const angle = -.95 + i * .475, z = -.31 + row * .23;
      const spike = mesh(cone, violet, body, Math.sin(angle) * .4, .59 + Math.cos(angle) * .42, z, .063, .22, .063); spike.rotation.z = -angle;
    }
    if (id === 'thief') {
      const hat = new THREE.Group(); hat.position.set(0, 1.07, .04); hat.rotation.z = .15; body.add(hat);
      mesh(cylinder, leather, hat, 0, -.035, 0, .21, .04, .17); mesh(cone, leather, hat, 0, .15, 0, .13, .38, .115);
      mesh(box, brass, hat, 0, .005, .13, .06, .045, .015);
    }
    if (id === 'reinforcement') {
      mesh(sphere, leather, body, 0, .995, .1, .24, .085, .17);
      for (const side of [-1, 1]) {
        const cuff = mesh(cylinder, leather, legs[side < 0 ? 1 : 3]!, 0, -.16, 0, .107, .065, .112);
        mesh(sphere, brass, cuff, 0, 0, 1, .2, .22, .12);
      }
      for (const x of [-.1, 0, .1]) mesh(sphere, white, body, x, 1.025, .24, .018);
    }
    const coins = new THREE.Group(); coins.visible = false; body.add(coins);
    for (let i = 0; i < 3; i++) mesh(cylinder, brass, coins, .27, .78 + i * .035, -.27, .075, .025, .075);
    const damage = new THREE.Group(); damage.visible = false; body.add(damage);
    mesh(crack, black, damage, 0, 0, 0, 1); const other = mesh(crack, black, damage, .17, .04, -.08, .8); other.rotation.y = .55;
    return { root, damage, animate(seconds, motion) {
      const moving = Math.min(1.5, (motion?.speed ?? 0) / Math.max(.001, FOUNDRY_GOLEMS[id].speed));
      const phase = motion?.distance !== undefined ? motion.distance * Math.PI * 2 / .42 : seconds * 8 * moving + (motion?.phase ?? 0);
      const stride = Math.sin(phase) * Math.min(1, moving), raging = !!motion?.raging;
      // The reference banks hop and tilt as one rigid ceramic object, including all four feet.
      rig.position.y = Math.abs(stride) * BANK_PIG_MOVEMENT.hopHeight * BANK_PIG_MOVEMENT.boardWidth / BANK_PIG_MOVEMENT.sourceWidth / FOUNDRY.fullRelicScale;
      rig.rotation.z = stride * BANK_PIG_MOVEMENT.hopTiltDegrees * Math.PI / 180; body.rotation.x = raging ? .09 : 0;
      coins.visible = (motion?.stolen ?? 0) > 0;
    } };
  }
  function bomb() {
    const root = new THREE.Group(); mesh(sphere, charcoal, root, 0, .18, 0, .2);
    const fuse = mesh(tail, straw, root, 0, .39, 0, 1); fuse.rotation.x = Math.PI / 2;
    mesh(sphere, brass, root, 0, .43, 0, .035); return root;
  }
  const shardGeometry = own(new THREE.TetrahedronGeometry(1));
  return { create, bomb, shard: () => new THREE.Mesh(shardGeometry, white), dispose() {
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
  } };
}
