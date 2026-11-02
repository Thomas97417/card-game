import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FOUNDRY, FOUNDRY_REFERENCE_SKILLS as SKILLS, FOUNDRY_REFERENCE_SKILL_IDS as IDS, FOUNDRY_V4_SKILL_IDS, FOUNDRY_TECHNIQUES as T,
  newFoundryCycle as latestCycle, foundrySkills, foundrySkillReady, buyFoundrySkill, foundryCompleteModifiers, foundryStats, createFoundryRound, stepFoundry,
  foundryStrikeCost, settleFoundryRound, continueFoundryCycle, foundryLootMultiplier, RELICS, type FoundryRound, type FoundrySkillId, type FoundryCycle, type FoundryInput } from './foundry';
const aim={x:0,z:0,active:true}, miss={x:5.6,z:3.4,active:false};
function arena(skills:FoundrySkillId[]=[]):FoundryRound {
 const r=createFoundryRound(17,{...newFoundryCycle(),skills},'mallet');r.stats.critical=0;r.rogue!.capacity=1;
 r.targets=[{...r.targets[0]!,kind:'urn',x:0,z:0,hp:1000,maxHp:1000,vx:0,vz:0}];return r;
}
function hit(r:FoundryRound,input=aim){r.nextStrike=r.tick+1;return stepFoundry(r,input);}
function neighbour(r:FoundryRound,x:number,hp=1000){const t={...r.targets[0]!,id:++r.nextId,x,hp,maxHp:hp};r.targets.push(t);r.rogue!.capacity=r.targets.length;return t;}

describe('les 211 nœuds et leurs mécaniques',()=>{
 it('reproduces every source cost, coordinate, prerequisite and limit break, with no empty or unreachable node',()=>{
  const raw=JSON.parse(readFileSync(new URL('../../../docs/references/bills-must-be-paid/build-24759944.json',import.meta.url),'utf8')).categories['skill-tree'].items;
  expect(IDS).toHaveLength(211);expect(IDS).toEqual(raw.map((n:{slug:string})=>n.slug));expect(IDS.filter(id=>SKILLS[id].limitBreak)).toHaveLength(12);
  expect(Object.fromEntries(['forge','fortune','sap','storm','echo'].map(branch=>[branch,IDS.filter(id=>SKILLS[id].branch===branch).length]))).toEqual({forge:92,fortune:38,sap:21,storm:44,echo:16});
  for(const ref of raw){const n=SKILLS[ref.slug as keyof typeof SKILLS];expect(n.cost).toBe(ref.cost);expect(n.point).toEqual({x:ref.x,y:ref.y});expect(n.requires).toEqual(ref.parents);expect(n.requiresAny).toEqual(ref.anyParents);expect(n.limitBreak).toBe(ref.limitBreak);expect(Object.keys(n.effects).length+Object.keys(n.reference).length+Object.keys(n.complete).length).toBeGreaterThan(0);}
  let cycle:FoundryCycle={...newFoundryCycle(),shards:2000000000},pending=[...IDS];
  while(pending.length){const ready=pending.filter(id=>foundrySkillReady(id,cycle.skills!));expect(ready.length).toBeGreaterThan(0);for(const id of ready)cycle=buyFoundrySkill(cycle,id);pending=pending.filter(id=>!ready.includes(id));}
  expect(cycle.skills).toHaveLength(211);expect(cycle.shards).toBe(645825971);
  expect(foundrySkills({...cycle,economy:4})).toHaveLength(104);expect(()=>buyFoundrySkill({...newFoundryCycle(),economy:4,shards:1e9},'phantom-hand')).toThrow('chantier');
 });
 it('applies the published numerical increments in their actual units, including faster spawns and limit breaks',()=>{
  const m=foundryCompleteModifiers(IDS);expect(m.phantomChance).toBeCloseTo(T.phantom.chance+0.08);expect(m.phantomDamage).toBeCloseTo(1.35);expect(m.phantomTargets).toBe(2);
  expect(m.rayStrikes).toBe(7);expect(m.rayRadius).toBe(5);expect(m.rayDamage).toBe(3);expect(m.deathWaveRadius).toBeCloseTo(2.1);
  expect(m.rockCount).toBe(26);expect(m.rockDamage).toBe(3);expect(m.rockRadius).toBeCloseTo(1.6);expect(m.respawnChance).toBeCloseTo(.45);expect(m.spawnSeconds).toBe(5);
  expect(m.windRestore).toBeCloseTo(.3);expect(m.luckySeven).toBeCloseTo(.16);expect(m.superJackpotChance).toBeCloseTo(.02);expect(m.spawnLootChance).toBeCloseTo(.07);expect(m.spawnLootBonus).toBe(1);
  const c={...newFoundryCycle(),skills:IDS.filter(id=>id.startsWith('limit-break'))},stats=foundryStats(c,'mallet');
  expect(stats.damage).toBeCloseTo(2.5);expect(stats.critical).toBeCloseTo(.16);expect(stats.interval).toBeCloseTo(11/1.15);
 });
 it('strikes unique random targets with phantom hands without charging extra stamina',()=>{
  const r=arena(['phantom-hand','phantom-hand-hits-3']);r.rogue!.complete!.modifiers.phantomChance=1;const other=neighbour(r,4);
  const f=hit(r);expect(f.effects!.filter(e=>e.kind==='phantom')).toHaveLength(2);expect(other.hp).toBe(999.5);expect(r.targets[0]!.hp).toBe(998.5);expect(r.concentration).toBe(99);
 });
 it('fires timed rays on the active fixed-step clock and replays a saved timer exactly',()=>{
  const r=arena(['smite-unlock']);neighbour(r,1);r.rogue!.complete!.modifiers.rayChance=1;r.rogue!.complete!.modifiers.rayRadius=1.5;r.nextStrike=1e6;
  for(let n=0;n<29;n++)stepFoundry(r,miss);const resumed=structuredClone(r);
  for(let n=29;n<59;n++){stepFoundry(r,miss);stepFoundry(resumed,miss);}expect(r.targets[0]!.hp).toBe(1000);
  const f=stepFoundry(r,miss);expect(f).toEqual(stepFoundry(resumed,miss));expect(r).toEqual(resumed);expect(f.effects!.filter(e=>e.kind==='ray')).toHaveLength(1);expect(f.impacts).toHaveLength(2);expect(r.concentration).toBe(100);
 });
 it('schedules falling rocks and enforces the whole storm and calm interval',()=>{
  const r=arena(['rockrain-unlock']);r.rogue!.complete!.modifiers.rockChance=1;
  hit(r);const full=r.rogue!.complete!,until=full.nextStorm;expect(full.rocks).toHaveLength(4);expect(until).toBe(1+T.rocks.fallTicks+T.rocks.stormTicks+T.rocks.calmTicks);
  const impacts:number[]=[];while(r.tick<until-1){const f=stepFoundry(r,aim);if(f.effects!.some(e=>e.kind==='rock'))impacts.push(r.tick);expect(full.nextStorm).toBe(until);}
  expect(impacts).toHaveLength(4);expect(impacts[0]).toBe(1+T.rocks.fallTicks);expect(full.rocks).toHaveLength(0);
  r.nextStrike=until;stepFoundry(r,aim);expect(full.nextStorm).toBeGreaterThan(until);expect(full.rocks).toHaveLength(4);
 });
 it('creates death shockwaves and instant shatters, crediting each destroyed relic once',()=>{
  const r=arena(['smash-shockwave']);r.rogue!.complete!.modifiers.deathWaveChance=1;r.targets[0]!.hp=1;const other=neighbour(r,1.2,20);
  const f=hit(r);expect(other.hp).toBe(19.5);expect(f.effects!.some(e=>e.kind==='shockwave')).toBe(true);expect(r.broken).toBe(1);
  const instant=arena(['smash-one-punch']);instant.rogue!.complete!.modifiers.shatterChance=1;const kill=hit(instant);expect(kill.impacts[0]!.damage).toBe(1000);expect(instant.broken).toBe(1);expect(instant.shards).toBe(kill.impacts[0]!.loot);
 });
 it('guarantees the bright first relic, spreads its glow and pays bonus loot and super jackpots',()=>{
  const bright=createFoundryRound(17,{...newFoundryCycle(),skills:['fortune-capstone']},'mallet');expect(bright.targets[0]!.glowing).toBe(true);expect(bright.targets.filter(t=>t.glowing)).toHaveLength(1);
  const r=arena(['fortune-golden-chain']);r.rogue!.complete!.modifiers.glowingSpreadChance=1;r.targets[0]!.glowing=true;r.targets[0]!.hp=1;const other=neighbour(r,1.1);hit(r);expect(other.glowing).toBe(true);
  const bonus=arena(['fortune-free-loot']);bonus.rogue!.complete!.modifiers.spawnLootChance=1;bonus.targets[0]!.hp=1;hit(bonus);expect(bonus.targets[0]!.bonusLoot).toBe(.25);
  const jackpot=arena(['fortune-el-gordo-unlock']);jackpot.rogue!.complete!.modifiers.superJackpotChance=1;jackpot.targets[0]!.hp=1;jackpot.targets[0]!.bonusLoot=1;
  expect(hit(jackpot).impacts[0]!.loot).toBe(240);expect(jackpot.rogue!.complete!.superJackpots).toBe(1);
 });
 it('protects crit loot and grants the seventh-hit critical and loot effects',()=>{
  for(const critical of [0,1]){const r=arena(['bridge-lucky-strike']);r.rogue!.complete!.modifiers.luckyStrike=1;r.stats.critical=critical;r.targets[0]!.glowing=true;r.targets[0]!.hp=1;expect(hit(r).impacts[0]!.loot).toBe(critical?120:60);}
  const crit=arena(['luck-ritual']);crit.rogue!.complete!.hits=6;crit.rng=1;expect(hit(crit).impacts[0]!.critical).toBe(true);
  const lucky=arena(['luck-seven']);lucky.rogue!.complete!.hits=6;lucky.rng=1;const f=hit(lucky);expect(f.impacts[0]!.broken).toBe(false);expect(f.impacts[0]!.loot).toBeGreaterThan(0);
 });
 it('saves Coin Rain across rounds and pays its reserve on the twentieth destruction',()=>{
  const cycle={...newFoundryCycle(),skills:['jackpotmeter'] as FoundrySkillId[]},r=arena(cycle.skills);
  for(let i=0;i<19;i++){const t=r.targets[0]!;Object.assign(t,{kind:'urn',hp:1,maxHp:1,vx:0,vz:0});hit(r,{x:t.x,z:t.z,active:true});}
  const reserve=r.rogue!.complete!.coinBank;expect(reserve).toBeGreaterThan(0);expect(r.rogue!.complete!.coinCount).toBe(19);r.ended=true;r.concentration=0;
  const saved=settleFoundryRound(cycle,r),next=createFoundryRound(22,saved,'mallet');expect(next.rogue!.complete!.coinBank).toBe(reserve);expect(next.rogue!.complete!.coinCount).toBe(19);
  next.stats.critical=0;next.rogue!.capacity=1;next.targets=[{...next.targets[0]!,kind:'urn',hp:1,maxHp:1,x:0,z:0,vx:0,vz:0}];
  const f=hit(next);expect(f.impacts[0]!.loot).toBeGreaterThan(reserve+29);expect(next.rogue!.complete!.coinBank).toBe(0);expect(next.rogue!.complete!.coinCount).toBe(0);expect(f.effects!.some(e=>e.kind==='coinrain')).toBe(true);
 });
 it('executes low-stamina, combo protection, efficient swings, rage and tantrum conditions',()=>{
  const combo=arena(['endurance-low-stamina-combo-protection','frenzy-high-combo-speed']);combo.concentration=20;combo.rogue!.reference!.combo=10;
  hit(combo,miss);expect(combo.rogue!.reference!.combo).toBe(10);hit(combo,miss);expect(combo.rogue!.reference!.combo).toBe(0);hit(combo);expect(combo.rogue!.complete!.guardUsed).toBe(false);
  const efficient=arena(['bridge-attack-speed-drain-reduction','frenzy-speed-1']);expect(foundryStrikeCost(efficient)).toBeCloseTo(.8);hit(efficient,miss);expect(efficient.concentration).toBeCloseTo(99.2);
  const low=arena(['endurance-low-stamina-damage','endurance-low-stamina-speed']);low.concentration=25;expect(hit(low).impacts[0]!.damage).toBe(1.5);expect(low.nextStrike-low.tick).toBeCloseTo(11/1.25);
  const rage=arena(['frenzy-rage-mode']);rage.rogue!.complete!.modifiers.rageChance=1;rage.rogue!.complete!.hits=6;expect(hit(rage).impacts[0]!.damage).toBe(1);expect(rage.rogue!.complete!.rageUntil).toBe(61);expect(rage.nextStrike-rage.tick).toBeCloseTo(11/1.5);
  const anger=arena(['tantrum','tantrum-long-fuse']);for(let i=0;i<3;i++)hit(anger,miss);expect(anger.rogue!.complete!.tantrumUntil-anger.tick).toBe(100);expect(hit(anger).impacts[0]!.damage).toBe(1.5);
 });
 it('uses Second Wind only once before the final Last Stand and credits its final impacts',()=>{
  const r=arena(['endurance-second-wind','endurance-second-wind-stamina','endurance-second-wind-boost','last-stand','last-stand-damage-1','last-stand-damage-2']);r.concentration=.5;
  const first=hit(r);expect(first.effects!.some(e=>e.kind==='wind')).toBe(true);expect(r.concentration).toBeCloseTo(30);expect(r.ended).toBe(false);expect(r.rogue!.complete!.windUsed).toBe(true);
  const other=neighbour(r,4,2);r.concentration=.25;const final=hit(r);expect(final.effects!.some(e=>e.kind==='lastStand')).toBe(true);expect(final.impacts.find(h=>h.targetId===other.id)!.broken).toBe(true);expect(r.ended).toBe(true);
  const shards=r.shards;expect(stepFoundry(r,aim).impacts).toHaveLength(0);expect(r.shards).toBe(shards);
 });
 it('applies all spawn upgrades, timers and respawn rolls while retaining collision and particle bounds',()=>{
  const c={...newFoundryCycle(),skills:IDS.filter(id=>SKILLS[id].branch==='echo')},r=createFoundryRound(17,c,'mallet');expect(r.targets).toHaveLength(30);
  r.rogue!.complete!.modifiers.respawnChance=1;r.targets[0]!.hp=.1;const t=r.targets[0]!;hit(r,{x:t.x,z:t.z,active:true});expect(r.targets).toHaveLength(31);
  r.nextStrike=1e6;while(r.tick<100)stepFoundry(r,miss);expect(r.targets).toHaveLength(32);
  for(let i=0;i<r.targets.length;i++)for(let j=i+1;j<r.targets.length;j++)expect(Math.hypot(r.targets[i]!.x-r.targets[j]!.x,r.targets[i]!.z-r.targets[j]!.z)).toBeGreaterThan((RELICS[r.targets[i]!.kind].radius+RELICS[r.targets[j]!.kind].radius)*FOUNDRY.fullRelicScale-.03);
 });
 it('keeps a complete build finite and deterministic with at most 32 relics and 26 pending rocks',()=>{
  const r=createFoundryRound(17,{...newFoundryCycle(),orderIndex:4,skills:[...IDS],blessings:['recovery','efficient','berserk']},'gilded'),resumed=structuredClone(r);
  const inputs:FoundryInput[]=[];
  while(!r.ended&&r.tick<15000){const t=r.targets.reduce((a,b)=>a.hp<b.hp?a:b),input={x:t.x,z:t.z,active:true};inputs.push(input);stepFoundry(r,input);expect(r.targets.length).toBeLessThanOrEqual(32);expect(r.rogue!.complete!.rocks.length).toBeLessThanOrEqual(26);}
  expect(r.ended).toBe(true);expect(r.rogue!.complete!.windUsed).toBe(true);expect(r.rogue!.complete!.lastStandUsed).toBe(true);expect(r.tick*50).toBeGreaterThan(75000);
  for(const input of inputs)stepFoundry(resumed,input);expect(resumed).toEqual(r);
 });
 it('continues a successful chantier without new invoices, mastery or a reset of purchased skills',()=>{
  const done={...newFoundryCycle(),status:'completed' as const,orderIndex:5,shards:100000000,skills:[...FOUNDRY_V4_SKILL_IDS]};
  const free=continueFoundryCycle(done);expect(free.freeplay).toBe(true);expect(free.skills).toEqual(done.skills);expect(free.shards).toBe(100000000);
  expect(()=>continueFoundryCycle(newFoundryCycle())).toThrow('cinq commandes');
  const r=createFoundryRound(1,free,'gilded');r.ended=true;r.shards=123;
  const settled=settleFoundryRound(free,r);expect(settled.orderIndex).toBe(5);expect(settled.roundsLeft).toBe(3);expect(settled.freeplayRounds).toBe(1);expect(settled.shards).toBe(100000123);
  expect(foundryLootMultiplier({...settled,freeplayRounds:3})).toBe(240);expect(newFoundryCycle(2).freeplay).toBeUndefined();expect(newFoundryCycle(2).skills).toEqual([]);
 });
});

// Freeze V11 mechanics; V12 population and payouts have dedicated reference tests.
function newFoundryCycle(number = 1): FoundryCycle { return { ...latestCycle(number), economy: 5 }; }
