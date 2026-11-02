import * as THREE from 'three';
import {describe,it,expect} from 'vitest';
import {existsSync} from 'node:fs';
import {URL as NodeURL} from 'node:url';
import {FOUNDRY_GOLEM_IDS,FOUNDRY_GOLEMS} from '@sylve/game/foundry';
import {createFoundryGolemArt} from './foundry-golem-art';

describe('les dix silhouettes articulées de la fonderie',()=>{
  it('provides matching generated icons, distinct meshes, moving feet and bounded shared GPU resources',()=>{
    const art=createFoundryGolemArt(false),signatures=new Set<string>(),geometries=new Set<THREE.BufferGeometry>();
    for(const id of FOUNDRY_GOLEM_IDS){
      expect(existsSync(new NodeURL(`../../../public/art/foundry/golems/${id}-v1.webp`,import.meta.url))).toBe(true);
      const model=art.create(id);expect(model.root.name).toBe(`foundry-golem-${id}`);
      const signature:string[]=[];model.root.traverse(o=>{if(o instanceof THREE.Mesh){geometries.add(o.geometry);signature.push(`${o.geometry.type}:${o.position.toArray()}:${o.scale.toArray()}`);}});signatures.add(signature.join('|'));
      model.animate(.3,{speed:FOUNDRY_GOLEMS[id].speed,phase:.2,raging:false,stolen:0});expect(Math.abs(model.root.getObjectByName('golem-left-leg')!.rotation.x)).toBeGreaterThan(.01);
      model.animate(.3,{speed:0,phase:.2,raging:false,stolen:0});expect(Math.abs(model.root.getObjectByName('golem-left-leg')!.rotation.x)).toBe(0);
    }
    expect(signatures.size).toBe(10);expect(geometries.size).toBeLessThan(14);
    let disposed=0;for(const geometry of geometries)geometry.addEventListener('dispose',()=>{disposed++;});art.dispose();expect(disposed).toBe(geometries.size);
  });
});
