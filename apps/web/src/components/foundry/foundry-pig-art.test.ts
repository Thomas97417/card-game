import * as THREE from 'three';
import {describe,it,expect} from 'vitest';
import {existsSync} from 'node:fs';
import {URL as NodeURL} from 'node:url';
import {FOUNDRY_GOLEM_IDS,FOUNDRY_GOLEMS} from '@sylve/game/foundry';
import {createFoundryPigArt} from './foundry-pig-art';

describe('les dix tirelires de la banque',()=>{
  it('provides matching rendered icons, distinct piggy banks, four feet and rigid-body hopping and bounded shared GPU resources',()=>{
    const art=createFoundryPigArt(false),signatures=new Set<string>(),geometries=new Set<THREE.BufferGeometry>();
    for(const id of FOUNDRY_GOLEM_IDS){
      expect(existsSync(new NodeURL(`../../../public/art/bank/piggies/${id}-v1.webp`,import.meta.url))).toBe(true);
      const model=art.create(id);expect(model.root.name).toBe(`bank-pig-${FOUNDRY_GOLEMS[id].source}`);
      expect(model.root.getObjectByName('pig-snout')).toBeTruthy();expect(model.root.getObjectByName('pig-coin-slot')).toBeTruthy();expect(model.root.getObjectByName('pig-body')!.children.filter(o=>o.name.startsWith('pig-leg-'))).toHaveLength(4);
      const signature:string[]=[];model.root.traverse(o=>{if(o instanceof THREE.Mesh){geometries.add(o.geometry);signature.push(`${o.geometry.type}:${o.position.toArray()}:${o.scale.toArray()}:${o.material instanceof THREE.MeshStandardMaterial?o.material.color.getHexString():''}`);}});signatures.add(signature.join('|'));
      model.animate(.3,{speed:FOUNDRY_GOLEMS[id].speed,phase:.2,raging:false,stolen:0});expect(Math.abs(model.root.getObjectByName('pig-motion')!.position.y)).toBeGreaterThan(.01);
      model.animate(.3,{speed:0,phase:.2,raging:false,stolen:0});expect(Math.abs(model.root.getObjectByName('pig-motion')!.position.y)).toBe(0);
    }
    expect(signatures.size).toBe(10);expect(geometries.size).toBeLessThan(14);
    let disposed=0;for(const geometry of geometries)geometry.addEventListener('dispose',()=>{disposed++;});art.dispose();expect(disposed).toBe(geometries.size);
  });
});
