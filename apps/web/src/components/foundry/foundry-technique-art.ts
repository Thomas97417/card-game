import * as THREE from 'three';
import type { FoundryEffect } from '@sylve/game/foundry';
import type { createFoundryArt } from './foundry-art';

/** Small reusable pools; spell visuals never influence authoritative simulation. */
export function createFoundryTechniqueArt(scene:THREE.Scene,art:ReturnType<typeof createFoundryArt>,mobile:boolean,reduced:()=>boolean) {
  const cylinder=new THREE.CylinderGeometry(1,1,1,mobile?8:12,1,true);
  const hands=Array.from({length:mobile?4:8},()=>{const group=art.phantomHand();group.visible=false;scene.add(group);return {group,life:0,total:0.35};});
  const rocks=Array.from({length:mobile?12:20},()=>{const group=art.fallingRock();group.visible=false;scene.add(group);return {group,life:0,total:0.4};});
  const shards=Array.from({length:mobile?12:24},()=>{const group=art.shard();group.visible=false;scene.add(group);return {group,life:0,total:.28,x:0,z:0,toX:0,toZ:0};});
  const rays=Array.from({length:mobile?4:8},()=>{const material=new THREE.MeshBasicMaterial({color:0xffe2a0,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide});const group=new THREE.Mesh(cylinder,material);group.visible=false;scene.add(group);return {group,material,life:0,total:0.4,radius:0.1};});
  let hand=0,rock=0,ray=0,shard=0;
  return {
    effect(event:FoundryEffect) {
      if(event.kind==='golemShard'&&!reduced()){const p=shards[shard++%shards.length]!;Object.assign(p,{x:event.x,z:event.z,toX:event.toX??event.x,toZ:event.toZ??event.z,life:p.total});p.group.visible=true;}
      if(event.kind==='phantom') { const p=hands[hand++%hands.length]!;p.group.position.set(event.x,0.8,event.z);p.life=p.total;p.group.visible=true; }
      if(event.kind==='rockfall'&&!reduced()) {const p=rocks[rock++%rocks.length]!;p.group.position.set(event.x,3,event.z);p.total=event.duration??0.4;p.life=p.total;p.group.visible=true;}
      if(event.kind==='ray'){const p=rays[ray++%rays.length]!;p.group.position.set(event.x,2.5,event.z);p.radius=Math.min(0.3,0.06+(event.radius??1)*0.04);p.life=p.total;p.group.visible=true;}
    },
    update(dt:number,active:boolean) {
      for(const p of shards){if(active)p.life=Math.max(0,p.life-dt);p.group.visible=p.life>0;const progress=1-p.life/p.total;p.group.position.set(THREE.MathUtils.lerp(p.x,p.toX,progress),.35+Math.sin(progress*Math.PI)*.4,THREE.MathUtils.lerp(p.z,p.toZ,progress));p.group.scale.set(.06,.12,.06);p.group.rotation.set(progress*8,progress*5,progress*3);}
      for(const p of hands){if(active)p.life=Math.max(0,p.life-dt);p.group.visible=p.life>0;p.group.position.y=reduced()?0.6:0.45+Math.sin(p.life/p.total*Math.PI)*0.55;p.group.scale.setScalar(Math.min(1,p.life*10));}
      for(const p of rocks){if(active)p.life=Math.max(0,p.life-dt);p.group.visible=p.life>0;p.group.position.y=3*(1-(1-p.life/p.total)**2);p.group.scale.setScalar(0.22);if(active&&!reduced())p.group.rotation.set(p.life*4,p.life*2,p.life*3);}
      for(const p of rays){if(active)p.life=Math.max(0,p.life-dt);p.group.visible=p.life>0;p.group.scale.set(p.radius,5,p.radius);p.material.opacity=reduced()?0.25:0.5*p.life/p.total;}
    },
    dispose(){for(const p of [...hands,...rocks,...rays,...shards])scene.remove(p.group);for(const p of rays)p.material.dispose();cylinder.dispose();},
  };
}
