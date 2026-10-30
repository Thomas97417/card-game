import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createFoundryTechniqueArt } from './foundry-technique-art';
import type { createFoundryArt } from './foundry-art';

describe('les effets 3D des techniques',()=>{
 it('recycles a bounded pool, suspends falling objects in pause, then releases every scene object',()=>{
  const scene=new THREE.Scene(),geometry=new THREE.SphereGeometry(.2,8,6),material=new THREE.MeshBasicMaterial();
  const art={phantomHand:()=>new THREE.Group(),fallingRock:()=>new THREE.Mesh(geometry,material)} as unknown as ReturnType<typeof createFoundryArt>;
  const pool=createFoundryTechniqueArt(scene,art,true,()=>false),size=scene.children.length;
  for(let n=0;n<100;n++){pool.effect({kind:'rockfall',x:0,z:0,duration:.4});pool.effect({kind:'phantom',x:0,z:0});pool.effect({kind:'ray',x:0,z:0});}
  expect(scene.children).toHaveLength(size);expect(size).toBe(20);pool.update(.2,true);
  const rock=scene.children.find(o=>o instanceof THREE.Mesh&&o.geometry===geometry)!;expect(rock.position.y).toBeCloseTo(2.25);
  pool.update(10,false);expect(rock.position.y).toBeCloseTo(2.25);pool.update(1,true);expect(scene.children.every(o=>!o.visible)).toBe(true);
  const ray=scene.children.find(o=>o instanceof THREE.Mesh&&o.geometry!==geometry) as THREE.Mesh;const dispose=vi.spyOn(ray.geometry,'dispose');pool.dispose();expect(scene.children).toHaveLength(0);expect(dispose).toHaveBeenCalledOnce();geometry.dispose();material.dispose();
 });
 it('suppresses falling animation under reduced motion while retaining a quiet ray cue',()=>{
  const scene=new THREE.Scene(),g=new THREE.SphereGeometry(.2,8,6),m=new THREE.MeshBasicMaterial(),art={phantomHand:()=>new THREE.Group(),fallingRock:()=>new THREE.Mesh(g,m)} as unknown as ReturnType<typeof createFoundryArt>;
  const pool=createFoundryTechniqueArt(scene,art,true,()=>true);pool.effect({kind:'rockfall',x:0,z:0});pool.effect({kind:'ray',x:0,z:0});pool.update(.1,true);
  expect(scene.children.filter(o=>o.visible)).toHaveLength(1);const visible=scene.children.find(o=>o.visible) as THREE.Mesh;expect((visible.material as THREE.MeshBasicMaterial).opacity).toBe(.25);pool.dispose();g.dispose();m.dispose();
 });
});
