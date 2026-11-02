import { FOUNDRY, RELICS, ACTIVE_RELIC_KINDS, foundryRandom, spawnFoundryRelic, confineFoundryRelic, resolveFoundryContacts,
  foundryToolStrikeCost, type FoundryRound, type FoundryInput, type FoundryFrame, type FoundryRelic } from './foundry';
import { FOUNDRY_TECHNIQUES as T } from './foundry-complete-rules';
import { FOUNDRY_POPULATION, foundryReferenceDrop } from './foundry-population';
import { FOUNDRY_GOLEMS, FOUNDRY_GOLEM_RULES as G, FOUNDRY_GOLEM_BALANCE } from './foundry-golems';
import { moveFoundryGolems, tickFoundryGolemAbilities, collectFoundryGolemLoot } from './foundry-golem-behavior';

export function completeCadence(state: FoundryRound): number {
  const rogue=state.rogue!, ref=rogue.reference!, full=rogue.complete!, m=full.modifiers;
  const low=state.concentration/state.stats.concentration<=T.lowStamina.threshold;
  const fury=rogue.frenzyUntil>state.tick, rage=full.rageUntil>state.tick;
  return Math.max(0.3,full.baseCadence + ref.spent*ref.modifiers.staminaSpeed + (fury||rage ? T.rage.cadence+ref.modifiers.rageSpeed:0)
    + (low?m.lowStaminaSpeed:0) + (full.windUntil>state.tick?T.wind.cadence:0) + (ref.combo>=T.combo.speedThreshold?m.comboSpeed:0));
}
export function completeStrikeCost(state: FoundryRound): number {
  const rogue=state.rogue!, full=rogue.complete!;
  const raw=foundryToolStrikeCost(state.tool,rogue.modifiers.drain,rogue.frenzyUntil>state.tick,state.stats.stamina);
  return Math.max(0.25,raw/(full.modifiers.efficientSwings?Math.max(1,completeCadence(state)):1));
}

/** V11 keeps its original refills and payouts; V12 uses the sourced population and loot. */
export function stepFoundryComplete(state: FoundryRound,input:FoundryInput):FoundryFrame {
  const frame:FoundryFrame={strike:false,impacts:[],effects:[]}, rogue=state.rogue!, ref=rogue.reference!, full=rogue.complete!;
  const mods=rogue.modifiers, extra=ref.modifiers, m=full.modifiers;state.tick++;
  const roll=(chance:number)=>chance>0&&foundryRandom(state)<Math.min(1,chance);
  const low=()=>state.concentration/state.stats.concentration<=T.lowStamina.threshold;
  const base=()=>state.stats.damage*(1+Math.min(0.25,state.broken*mods.damageGrowth))*(rogue.frenzyUntil>state.tick?1.2:1)
    *(1+ref.spent*extra.staminaDamage+Math.max(0,ref.combo-1)*extra.comboDamage+state.targets.length*extra.crowdDamage
      + Math.max(0,state.stats.loot-1+Math.min(0.25,state.broken*mods.lootGrowth))*m.lootDamage
      + (low()?m.lowStaminaDamage:0)+(full.windUntil>state.tick?T.wind.damage:0)+(full.tantrumUntil>state.tick?m.tantrumDamage:0));
  const choose=(count:number)=>{
    const pool=[...state.targets],result:FoundryRelic[]=[];
    while(pool.length&&result.length<count)result.push(pool.splice(Math.floor(foundryRandom(state)*pool.length),1)[0]!);
    return result;
  };
  if(mods.freezeChance>0&&state.tick>=rogue.nextFreeze){rogue.nextFreeze=state.tick+FOUNDRY.freezeEveryTicks;if(roll(mods.freezeChance)){rogue.frozenUntil=state.tick+FOUNDRY.freezeTicks;frame.effects!.push({kind:'freeze',x:0,z:0,radius:7});}}
  const frozen=rogue.frozenUntil>state.tick;
  if(!frozen){if(state.golems)moveFoundryGolems(state,input);for(const target of state.targets){target.x+=target.vx;target.z+=target.vz;confineFoundryRelic(target,FOUNDRY.fullRelicScale);}resolveFoundryContacts(state.targets,true,FOUNDRY.fullRelicScale);}
  type Hit={target:FoundryRelic;damage:number;critical:boolean;direct?:boolean;shatter?:boolean;shake?:boolean};
  const queue:Hit[]=[];
  if(state.golems)queue.push(...tickFoundryGolemAbilities(state,frame,frozen));
  const area=(x:number,z:number,radius:number,damage:number)=>{for(const target of state.targets)if(Math.hypot(target.x-x,target.z-z)<=radius)queue.push({target,damage,critical:false});};
  const ignite=(target:FoundryRelic)=>{
    const until=state.tick+FOUNDRY.burnTicks+extra.burnDuration*20, previous=rogue.burns.find(b=>b.id===target.id);
    if(previous)previous.until=Math.max(previous.until,until);else rogue.burns.push({id:target.id,until,next:state.tick+FOUNDRY.burnEveryTicks});
    frame.effects!.push({kind:'burn',x:target.x,z:target.z});
  };
  for(const burn of rogue.burns)if(burn.until>=state.tick&&burn.next<=state.tick){burn.next=state.tick+FOUNDRY.burnEveryTicks;const target=state.targets.find(t=>t.id===burn.id);if(target)queue.push({target,damage:base()*mods.burnDamage,critical:false});}
  if(m.spawnSeconds>0){if(!full.nextSpawn)full.nextSpawn=Math.round(m.spawnSeconds*20);if(state.tick>=full.nextSpawn){full.pendingSpawns++;full.nextSpawn+=Math.round(m.spawnSeconds*20);}}
  if(state.tick>=full.nextRay){full.nextRay=state.tick+T.ray.everyTicks;if(roll(m.rayChance))for(const target of choose(m.rayStrikes)){area(target.x,target.z,m.rayRadius,base()*m.rayDamage);frame.effects!.push({kind:'ray',x:target.x,z:target.z,radius:m.rayRadius});}}
  const direct=state.targets.filter(t=>Math.hypot(t.x-input.x,t.z-input.z)<=state.stats.radius);
  if(state.tick>=state.nextStrike&&(state.version<14||state.concentration>0)){
    frame.strike=true;frame.strikePosition={x:input.x,z:input.z};rogue.strikes++;
    const cost=completeStrikeCost(state), spent=Math.min(state.concentration,cost);ref.spent+=spent;rogue.recoveryReserve=(rogue.recoveryReserve??0)+spent*FOUNDRY.recoveryRefundLimit;
    state.concentration=Math.max(0,state.concentration-cost);
    if(direct.length){full.hits++;full.misses=0;ref.combo++;full.guardUsed=false;}
    else{
      full.misses++;
      if(low()&&m.comboSaver&&!full.guardUsed&&ref.combo>0)full.guardUsed=true;else{ref.combo=0;full.guardUsed=false;}
      if(m.tantrumDamage>0&&full.misses>=T.tantrum.misses){full.tantrumUntil=state.tick+m.tantrumDuration;full.misses=0;frame.effects!.push({kind:'tantrum',x:input.x,z:input.z});}
    }
    const seventh=direct.length>0&&full.hits%T.lucky.everyHits===0;
    if(seventh&&roll(m.rageChance)){full.rageUntil=state.tick+FOUNDRY.berserkTicks+mods.berserkDuration;frame.effects!.push({kind:'frenzy',x:input.x,z:input.z});}
    state.nextStrike=(rogue.strikes===1?state.tick:state.nextStrike)+Math.max(2,state.stats.interval*full.baseCadence/completeCadence(state));
    const first=direct.length>0&&!ref.firstHitUsed, twice=direct.length>0&&roll(extra.doubleHitChance), shake=seventh&&m.luckySeven>0&&roll(T.lucky.lootChance);
    if(first)ref.firstHitUsed=true;
    for(const target of direct){
      const wounded=target.hp/target.maxHp<0.25, critical=roll(state.stats.critical+(wounded?extra.lowHpCritical:0)+(seventh&&m.luckyCrit?T.lucky.criticalChance:0));
      const damage=base()*((critical?Math.max(1.2,2+mods.criticalDamage):1)+(target.hp===target.maxHp?mods.firstHitBonus:0)+(wounded?extra.lowHpDamage:0)
        +(direct.length>1?extra.multiHitDamage:0)+(ref.previousKind&&ref.previousKind!==target.kind?extra.switchDamage:0))*(first?1+extra.firstStrikeDamage:1);
      queue.push({target,damage,critical,direct:true,shatter:roll(m.shatterChance),shake});if(twice)queue.push({target,damage,critical,direct:true});
      if(roll(mods.burnChance))ignite(target);
    }
    if(direct.length){
      ref.previousKind=direct[0]!.kind;
      if(roll(m.phantomChance))for(const target of choose(m.phantomTargets)){queue.push({target,damage:base()*m.phantomDamage,critical:false});frame.effects!.push({kind:'phantom',x:target.x,z:target.z});}
      if(roll(mods.lightningChance)){
        const targets=state.targets.filter(t=>!direct.includes(t)&&Math.hypot(t.x-input.x,t.z-input.z)<=4).sort((a,b)=>Math.hypot(a.x-input.x,a.z-input.z)-Math.hypot(b.x-input.x,b.z-input.z)||a.id-b.id).slice(0,2+mods.lightningTargets);
        for(let ray=0;ray<1+extra.lightningRays;ray++)for(const target of targets){queue.push({target,damage:base()*mods.lightningDamage,critical:false});frame.effects!.push({kind:'lightning',x:input.x,z:input.z,toX:target.x,toZ:target.z});}
      }
      if(state.tick>=full.nextStorm&&roll(m.rockChance)){
        full.stormUntil=state.tick+T.rocks.fallTicks+T.rocks.stormTicks;full.nextStorm=full.stormUntil+T.rocks.calmTicks;
        for(let i=0;i<m.rockCount;i++){
          const x=Math.max(-FOUNDRY.width/2,Math.min(FOUNDRY.width/2,input.x+(foundryRandom(state)*2-1)*1.8));
          const z=Math.max(-FOUNDRY.depth/2,Math.min(FOUNDRY.depth/2,input.z+(foundryRandom(state)*2-1)*1.8));
          full.rocks.push({at:state.tick+T.rocks.fallTicks+Math.floor(i*T.rocks.stormTicks/m.rockCount),x,z,announced:false});
        }
      }
    }
    const firstWave=mods.firstWave>0&&rogue.strikes===1;
    if(firstWave||(direct.length>0&&roll(mods.shockwaveChance))){const radius=extra.globalWave?14:2+mods.shockwaveRadius;area(input.x,input.z,radius,base()*(firstWave?1:mods.shockwaveDamage));frame.effects!.push({kind:'shockwave',x:input.x,z:input.z,radius});}
  }
  for(const rock of full.rocks){
    if(!rock.announced&&state.tick>=rock.at-T.rocks.fallTicks){rock.announced=true;frame.effects!.push({kind:'rockfall',x:rock.x,z:rock.z,radius:m.rockRadius,duration:T.rocks.fallTicks/20});}
    if(state.tick>=rock.at){area(rock.x,rock.z,m.rockRadius,base()*m.rockDamage);frame.effects!.push({kind:'rock',x:rock.x,z:rock.z,radius:m.rockRadius});}
  }
  full.rocks=full.rocks.filter(r=>r.at>state.tick);
  const destroyed=new Set<number>();let index=0;
  const restore=(amount:number)=>{state.concentration=Math.min(state.stats.concentration,state.concentration+amount);};
  const refund=(amount:number)=>{
    const actual=state.golems?Math.max(0,Math.min(amount,ref.spent*FOUNDRY_GOLEM_BALANCE.recoveryRefundLimit-(state.golems.recovered??0))):amount;
    restore(actual);if(state.golems)state.golems.recovered=(state.golems.recovered??0)+actual;return actual;
  };
  const lootRoll=(target:FoundryRelic)=>{if(state.version>=12&&target.kind!=='spring')return foundryReferenceDrop(target.kind,()=>foundryRandom(state),extra.luck,!!target.glowing).amount;const [min,max]=RELICS[target.kind].loot;let n=min+Math.floor(foundryRandom(state)*(max-min+1));if(roll(extra.luck))n=Math.max(n,min+Math.floor(foundryRandom(state)*(max-min+1)));return target.glowing?max:n;};
  while(true){
    if(index>=queue.length){
      if(state.concentration<0.00001){
        if(m.windRestore>0&&!full.windUsed){full.windUsed=true;restore(state.stats.concentration*m.windRestore);if(m.windBoost)full.windUntil=state.tick+T.wind.boostTicks;frame.effects!.push({kind:'wind',x:0,z:0,radius:3});}
        else if(m.lastStandDamage>0&&!full.lastStandUsed){full.lastStandUsed=true;area(0,0,14,base()*m.lastStandDamage);frame.effects!.push({kind:'lastStand',x:0,z:0,radius:14});if(index<queue.length)continue;}
      }
      break;
    }
    const hit=queue[index++]!,target=hit.target;if(destroyed.has(target.id)||hit.damage<=0)continue;
    const shatter=hit.shatter||(target.golem==='amber'&&roll(G.fragileChance));
    const intact=target.hp===target.maxHp, damage=shatter?Math.max(target.hp,hit.damage):hit.damage*(frozen?1+mods.freezeDamage:1);
    target.hp=Math.max(0,target.hp-damage);if(hit.critical&&mods.execute>0&&target.hp/target.maxHp<=mods.execute)target.hp=0;
    const broken=target.hp===0;let loot=0;state.hits++;if(hit.critical)state.criticals++;
    if(target.golem==='ember'&&!broken)target.rageUntil=state.tick+G.rageTicks;
    if(hit.shake){loot=target.golem==='thief'?0:Math.max(1,Math.round(lootRoll(target)*state.stats.loot*(rogue.wealth??1)*m.luckySeven));if(state.golems)loot=collectFoundryGolemLoot(state,target,loot,destroyed);state.shards+=loot;frame.effects!.push({kind:'coinrain',x:target.x,z:target.z});}
    if(broken){
      destroyed.add(target.id);state.broken++;
      if(state.brokenByKind)state.brokenByKind[target.kind]=(state.brokenByKind[target.kind]??0)+1;
      if(state.golems&&target.golem)state.golems.broken[target.golem]=(state.golems.broken[target.golem]??0)+1;
      const bonus=1+(hit.critical?mods.criticalLoot:0)+(target.kind==='geode'?mods.geodeLoot:0)+extra.lootPerType*ACTIVE_RELIC_KINDS.length
        +(intact&&hit.direct?mods.oneShotLoot:0)+Math.min(0.25,(state.broken-1)*mods.lootGrowth)+(low()?m.lowStaminaLoot:0)+(target.bonusLoot??0);
      const superJackpot=roll(m.superJackpotChance),jackpot=superJackpot||roll(Math.max(mods.jackpotChance,hit.critical?m.luckyStrike:0));
      const sourced = state.version >= 12 && target.kind !== 'spring'
        ? foundryReferenceDrop(target.kind, () => foundryRandom(state), extra.luck, superJackpot || !!target.glowing)
        : undefined;
      const amount=sourced?.amount ?? (superJackpot?RELICS[target.kind].loot[1]:lootRoll(target));
      const luminous=target.glowing&&roll(extra.glowingBonusChance)?1+extra.glowingBonus:1;
      let payment=Math.max(1,Math.round(amount*state.stats.loot*(rogue.wealth??1)*bonus*(jackpot?2:1)*luminous));
      if(target.golem==='thief')payment=Math.round((target.stolen??0)*G.payback);
      if(state.golems)payment=collectFoundryGolemLoot(state,target,payment,destroyed);
      if(m.coinRain&&payment>0){full.coinBank+=Math.max(1,Math.round(payment*m.coinGrowth));full.coinCount++;if(full.coinCount>=T.coins.burst){payment+=full.coinBank;full.coinBank=0;full.coinCount=0;frame.effects!.push({kind:'coinrain',x:target.x,z:target.z});}}
      loot+=payment;state.shards+=payment;
      if(target.golem!=='thief'&&(jackpot || sourced?.jackpot)){rogue.jackpots++;if(superJackpot)full.superJackpots++;frame.effects!.push({kind:'jackpot',x:target.x,z:target.z});}
      if(roll(m.respawnChance))full.pendingSpawns++;
      if(target.glowing&&roll(m.glowingSpreadChance))for(const neighbour of state.targets)if(!destroyed.has(neighbour.id)&&Math.hypot(neighbour.x-target.x,neighbour.z-target.z)<=m.glowingSpreadRange)neighbour.glowing=true;
      if(state.broken===1)restore(mods.firstKillRecovery);
      if(target.golem==='sap'){const actual=refund(Math.min(G.restore,state.stats.concentration-state.concentration));rogue.recoveryReserve=Math.max(0,(rogue.recoveryReserve??0)-actual);}
      if(target.golem==='copper'&&(rogue.relicStage??0)>=FOUNDRY_GOLEMS.reinforcement.unlock&&roll(G.reinforcementChance))state.golems!.reinforcements++;
      if(target.golem==='furnace')state.golems!.bombs.push({at:state.tick+G.fuseTicks,x:target.x,z:target.z});
      if(target.golem==='shrapnel') {
        const neighbours=state.targets.filter(t=>!destroyed.has(t.id)&&Math.hypot(t.x-target.x,t.z-target.z)<=G.shrapnelRange)
          .sort((a,b)=>Math.hypot(a.x-target.x,a.z-target.z)-Math.hypot(b.x-target.x,b.z-target.z)||a.id-b.id).slice(0,G.shrapnelPieces);
        for(let piece=0;piece<G.shrapnelPieces;piece++){
          const neighbour=neighbours[piece],angle=target.phase+piece*Math.PI/2;
          if(neighbour)queue.push({target:neighbour,damage:G.shrapnelDamage,critical:false});
          frame.effects!.push({kind:'golemShard',x:target.x,z:target.z,toX:neighbour?.x??target.x+Math.cos(angle)*G.shrapnelRange,toZ:neighbour?.z??target.z+Math.sin(angle)*G.shrapnelRange});
        }
      }
      if(roll(mods.recoveryChance)){const recovery=refund(Math.min(Math.max(2,mods.recoveryAmount),rogue.recoveryReserve??0,state.stats.concentration-state.concentration));rogue.recoveryReserve=(rogue.recoveryReserve??0)-recovery;}
      if(rogue.burns.some(b=>b.id===target.id)&&roll(extra.fireSpreadChance))for(const neighbour of state.targets)if(!destroyed.has(neighbour.id)&&Math.hypot(neighbour.x-target.x,neighbour.z-target.z)<=extra.fireSpreadRange)ignite(neighbour);
      if(roll(mods.berserkChance)){rogue.frenzyUntil=Math.max(rogue.frenzyUntil,state.tick+FOUNDRY.berserkTicks+mods.berserkDuration);frame.effects!.push({kind:'frenzy',x:target.x,z:target.z});}
      if(roll(m.deathWaveChance)){area(target.x,target.z,m.deathWaveRadius,base()*m.deathWaveDamage);frame.effects!.push({kind:'shockwave',x:target.x,z:target.z,radius:m.deathWaveRadius});}
      const legacyChaos=state.version<14&&target.kind==='chaos';
      if(legacyChaos||roll(mods.chainChance)){area(target.x,target.z,2,legacyChaos?5*rogue.pressure:base()*mods.chainDamage);frame.effects!.push({kind:'shockwave',x:target.x,z:target.z,radius:2});}
    }
    frame.impacts.push({x:target.x,z:target.z,targetId:target.id,kind:target.kind,damage,critical:hit.critical,broken,loot,...(target.golem?{golem:target.golem}:{})});
  }
  if(state.version >= 12){
    const nextId=state.nextId;
    if(destroyed.size)state.targets=state.targets.filter(t=>!destroyed.has(t.id));
    // A destruction creates a free slot, never an unconditional replacement.
    full.pendingSpawns=Math.min(rogue.capacity,full.pendingSpawns);
    if(state.concentration>0){
      if(state.golems){state.golems.reinforcements=Math.min(rogue.capacity,state.golems.reinforcements);while(state.golems.reinforcements>0&&state.targets.length<rogue.capacity){state.targets.push(spawnFoundryRelic(state,'reinforcement'));state.golems.reinforcements--;}}
      while(full.pendingSpawns>0&&state.targets.length<rogue.capacity){state.targets.push(spawnFoundryRelic(state));full.pendingSpawns--;}
      if(state.targets.length){full.nextEmptySpawn=0;}
      else if(!full.nextEmptySpawn){full.nextEmptySpawn=state.tick+Math.round(FOUNDRY_POPULATION.emptyRespawnSeconds*1000/FOUNDRY.stepMs);}
      else if(state.tick>=full.nextEmptySpawn){state.targets.push(spawnFoundryRelic(state));full.nextEmptySpawn=0;}
      if(destroyed.size||state.nextId!==nextId)resolveFoundryContacts(state.targets,false,FOUNDRY.fullRelicScale);
    }
  }else if(destroyed.size||full.pendingSpawns){
    state.targets=state.targets.filter(t=>!destroyed.has(t.id));while(state.targets.length<rogue.capacity)state.targets.push(spawnFoundryRelic(state));
    while(full.pendingSpawns>0&&state.targets.length<FOUNDRY.fullMaxTargets){state.targets.push(spawnFoundryRelic(state));full.pendingSpawns--;}
    resolveFoundryContacts(state.targets,false,FOUNDRY.fullRelicScale);
  }
  rogue.burns=rogue.burns.filter(b=>b.until>=state.tick&&!destroyed.has(b.id));
  if(state.concentration<0.00001)state.concentration=0;state.ended=state.concentration===0&&!(state.golems?.bombs.length);return frame;
}
