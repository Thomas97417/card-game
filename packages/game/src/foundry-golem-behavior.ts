import { FOUNDRY, RELICS, type FoundryRound, type FoundryRelic, type FoundryInput, type FoundryFrame } from './foundry';
import { FOUNDRY_GOLEMS as G, FOUNDRY_GOLEM_RULES as R } from './foundry-golems';

export interface GolemHit {target:FoundryRelic;damage:number;critical:false}
export function moveFoundryGolems(state:FoundryRound,input:FoundryInput) {
  for(const target of state.targets) {
    if(!target.golem)continue;
    const spec=G[target.golem], time=state.tick*FOUNDRY.stepMs/1000;
    let angle=Math.atan2(target.vz,target.vx)+Math.sin(time*.7+target.phase)*.009;
    let speed=spec.speed;
    if(spec.gait==='hop')speed*=.45+.75*Math.abs(Math.sin(time*5+target.phase));
    if(spec.gait==='stomp'||spec.gait==='waddle')speed*=.6+.4*Math.abs(Math.sin(time*2.2+target.phase));
    if(spec.gait==='skitter')angle+=Math.sin(time*9+target.phase)*.06;
    if(target.golem==='sap'&&input.active&&Math.hypot(target.x-input.x,target.z-input.z)<1.6)angle=Math.atan2(target.z-input.z,target.x-input.x);
    if(target.golem==='ember'&&(target.rageUntil??0)>state.tick) {
      const neighbour=state.targets.filter(t=>t.id!==target.id).sort((a,b)=>Math.hypot(a.x-target.x,a.z-target.z)-Math.hypot(b.x-target.x,b.z-target.z)||a.id-b.id)[0];
      if(neighbour)angle=Math.atan2(neighbour.z-target.z,neighbour.x-target.x);speed*=1.8;
    }
    if(target.golem==='thief'&&(target.stolen??0)>0) {
      angle=Math.abs(target.x)/(FOUNDRY.width/2)>Math.abs(target.z)/(FOUNDRY.depth/2)?(target.x<0?Math.PI:0):(target.z<0?-Math.PI/2:Math.PI/2);
      speed*=1.5;
    }
    target.vx=Math.cos(angle)*speed;target.vz=Math.sin(angle)*speed;
  }
}

export function tickFoundryGolemAbilities(state:FoundryRound,frame:FoundryFrame,frozen:boolean):GolemHit[] {
  const hits:GolemHit[]=[], full=state.golems!;
  for(const bomb of full.bombs)if(bomb.at<=state.tick) {
    for(const target of state.targets)if(Math.hypot(target.x-bomb.x,target.z-bomb.z)<=R.blastRadius)hits.push({target,damage:state.stats.damage*R.blastDamage,critical:false});
    frame.effects!.push({kind:'shockwave',x:bomb.x,z:bomb.z,radius:R.blastRadius});
  }
  full.bombs=full.bombs.filter(b=>b.at>state.tick);
  if(frozen)return hits;
  const escaped=new Set<number>();
  for(const target of state.targets) {
    if(target.golem==='thief'&&(target.stolen??0)>0&&state.tick>=(target.escapeAt??Infinity)) {
      const radius=RELICS[target.kind].radius*FOUNDRY.fullRelicScale;
      if(Math.abs(target.x)>=FOUNDRY.width/2-radius-.005||Math.abs(target.z)>=FOUNDRY.depth/2-radius-.005) {
        escaped.add(target.id);full.escaped++;full.lost+=target.stolen!;continue;
      }
    }
    const angry=target.golem==='ember'&&(target.rageUntil??0)>state.tick, thorns=target.golem==='thorn';
    if((!angry&&!thorns)||(target.nextAbility??0)>state.tick)continue;
    const touching=state.targets.filter(other=>other.id!==target.id&&Math.hypot(other.x-target.x,other.z-target.z)<=(RELICS[target.kind].radius+RELICS[other.kind].radius)*FOUNDRY.fullRelicScale+.02);
    if(touching.length) {
      target.nextAbility=state.tick+(angry?R.ramCooldownTicks:R.thornsTicks);
      for(const other of touching)hits.push({target:other,damage:state.stats.damage*(angry?R.ramDamage:R.thornsDamage),critical:false});
    }
  }
  if(escaped.size)state.targets=state.targets.filter(t=>!escaped.has(t.id));
  return hits.filter(hit=>!escaped.has(hit.target.id));
}

/** Goblig's coins are intercepted at their drop location, before instant collection. */
export function collectFoundryGolemLoot(state:FoundryRound,target:FoundryRelic,amount:number,destroyed:Set<number>) {
  const thief=state.targets.filter(t=>t.golem==='thief'&&t.id!==target.id&&!destroyed.has(t.id)&&Math.hypot(t.x-target.x,t.z-target.z)<=R.stealRadius)
    .sort((a,b)=>Math.hypot(a.x-target.x,a.z-target.z)-Math.hypot(b.x-target.x,b.z-target.z)||a.id-b.id)[0];
  if(!thief)return amount;
  thief.stolen=(thief.stolen??0)+amount;
  thief.escapeAt??=state.tick+R.escapeGraceTicks;
  return 0;
}
