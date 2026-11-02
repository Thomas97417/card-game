import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createFoundryRound, deliverFoundryOrder, foundryPigDistribution, foundryPigLevel, foundryPigLevelXP, foundryPigLootMultiplier,
  foundryPigPool, foundryPigProgress, foundryPigWeight, gainFoundryPigXP, newFoundryCycle, newFoundryPigProgress,
  selectFoundryPig, settleFoundryRound, spawnFoundryRelic, stepFoundry, FOUNDRY_GOLEM_IDS, FOUNDRY_PIG_LEVELS, type FoundryRound } from './foundry';

describe('la progression des cochons', () => {
  it('uses the browser XP curve and a separate counter for each species', () => {
    const reference = JSON.parse(readFileSync(new URL('../../../docs/references/bank-pig-progression-v16.json', import.meta.url), 'utf8'));
    expect(FOUNDRY_PIG_LEVELS.experience).toEqual(reference.levels.experiencePerLevel);
    expect(FOUNDRY_PIG_LEVELS.lootPerLevel).toBe(reference.levels.lootBonusPerLevel);
    const pigs = newFoundryPigProgress();
    gainFoundryPigXP(pigs, 'copper', 19);
    expect(foundryPigLevel(pigs, 'copper')).toBe(0);
    expect(pigs.unlocked).toEqual(['copper']);
    expect(gainFoundryPigXP(pigs, 'copper')).toEqual({before:0, level:1, unlocked:['sap']});
    expect(pigs.xp).toEqual({copper:20});
    expect(pigs.pending).toEqual(['sap']);
    gainFoundryPigXP(pigs, 'sap', 9);
    expect(pigs.xp.sap).toBe(18);
    expect(pigs.unlocked).not.toContain('stone');
    gainFoundryPigXP(pigs, 'sap');
    expect(pigs.unlocked).toContain('stone');
    expect(foundryPigLevel(pigs, 'copper')).toBe(1);
    expect(foundryPigLevelXP(2)).toBe(55);
    expect(foundryPigLevelXP(10)).toBe(4025);
  });
  it('unlocks the next species by levelling its predecessor rather than delivering orders', () => {
    const cycle = {...newFoundryCycle(), orderIndex:4};
    const round = createFoundryRound(12, cycle, 'mallet');
    expect(round.targets.every(pig => pig.golem === 'copper')).toBe(true);
    cycle.shards = 100;
    expect(deliverFoundryOrder({...cycle,orderIndex:0}).pigs).toEqual(cycle.pigs);
    const pigs = newFoundryPigProgress();
    for (const id of ['copper','sap','stone','amber','ember','shrapnel','furnace','thorn'] as const) gainFoundryPigXP(pigs,id,20);
    expect(foundryPigPool(pigs)).toHaveLength(9);
    expect(pigs.unlocked).not.toContain('reinforcement');
    gainFoundryPigXP(pigs,'copper',35);
    expect(pigs.unlocked).toHaveLength(10);
    expect(foundryPigPool(pigs)).not.toContain('reinforcement');
  });
  it('reduces mastered species weights, increases their loot, and keeps normalized probabilities', () => {
    const pigs = newFoundryPigProgress(); gainFoundryPigXP(pigs,'copper',20); pigs.pending=[];
    const before = foundryPigDistribution(pigs);
    gainFoundryPigXP(pigs,'copper',35);
    const after = foundryPigDistribution(pigs);
    expect(after.copper).toBeLessThan(before.copper);
    expect(after.sap).toBeGreaterThan(before.sap);
    expect(foundryPigLootMultiplier(pigs,'copper')).toBe(1.2);
    expect(Object.values(after).reduce((sum,rate)=>sum+rate,0)).toBeCloseTo(1);
    expect(after.stone).toBe(0);
    gainFoundryPigXP(pigs,'copper',100000);
    expect(foundryPigLevel(pigs,'copper')).toBe(10);
    expect(pigs.xp.copper).toBe(4025);
    expect(foundryPigWeight(pigs,'copper')).toBeGreaterThan(0);
  });
  it('guarantees a discovery once and respects pity and population caps', () => {
    const pigs = newFoundryPigProgress(); gainFoundryPigXP(pigs,'copper',20);
    const pity = {};
    expect(selectFoundryPig(pigs,[],0,pity,()=>0)).toBe('sap');
    expect(pigs.pending).toEqual([]);
    for (let i=0;i<8;i++) expect(selectFoundryPig(pigs,[],0,pity,()=>0)).toBe('copper');
    expect(selectFoundryPig(pigs,[],0,pity,()=>0)).toBe('sap');
    pigs.unlocked=[...FOUNDRY_GOLEM_IDS];pigs.pending=['furnace'];
    const live = [{golem:'thief' as const},{golem:'ember' as const},{golem:'ember' as const}];
    for (const id of ['thief','ember','furnace']) expect(foundryPigPool(pigs,live,1)).not.toContain(id);
    selectFoundryPig(pigs,live,1,pity,()=>0);
    expect(pigs.pending).toEqual(['furnace']);
    expect(selectFoundryPig(pigs,live,0,pity,()=>0)).toBe('furnace');
  });
  it('counts each destruction once, unlocks live, and persists the same progress across rounds', () => {
    const cycle = newFoundryCycle(); cycle.pigs!.xp.copper=19;
    const round = createFoundryRound(8,cycle,'mallet');round.targets=[{...spawnFoundryRelic(round,'copper'),x:0,z:0,hp:1}];round.stats.damage=100;round.stats.critical=0;round.nextStrike=0;
    stepFoundry(round,{x:0,z:0,active:true});
    expect(round.pigs!.xp.copper).toBe(20);
    expect(round.golems!.lastProgress).toMatchObject({pig:'copper',level:1,unlocked:['sap']});
    expect(cycle.pigs!.xp.copper).toBe(19);
    stepFoundry(round,{x:0,z:0,active:false});
    expect(round.pigs!.xp.copper).toBe(20);
    round.ended=true;
    const saved=settleFoundryRound(cycle,round), next=createFoundryRound(12,saved,'mallet');
    expect(saved.pigs!.xp.copper).toBe(20);
    expect(next.pigs!.xp.copper).toBe(20);
    expect(next.targets.some(pig=>pig.golem==='sap')).toBe(true);
    expect(newFoundryCycle(2).pigs).toEqual(newFoundryPigProgress());
  });
  it('keeps XP and selections deterministic after serializing a checkpoint', () => {
    const cycle=newFoundryCycle();cycle.pigs!.xp.copper=19;
    const round=createFoundryRound(813,cycle,'mallet');round.stats.damage=100;
    const resumed=JSON.parse(JSON.stringify(round)) as FoundryRound;
    for(let i=0;i<500&&!round.ended;i++) {
      const target=round.targets[0];const input=target?{x:target.x,z:target.z,active:true}:{x:0,z:0,active:false};
      expect(stepFoundry(resumed,input)).toEqual(stepFoundry(round,input));
    }
    expect(resumed).toEqual(round);
    expect(round.pigs!.unlocked).toContain('sap');
  });
  it('preserves existing unlocked species without fabricating experience', () => {
    const legacy={...newFoundryCycle(),pigs:undefined,orderIndex:3};
    const pigs=foundryPigProgress(legacy);
    expect(pigs.xp).toEqual({});
    expect(pigs.unlocked).toContain('thorn');
    expect(pigs.unlocked).not.toContain('furnace');
    const round=createFoundryRound(1,legacy,'mallet');round.version=15;delete round.pigs;
    round.golems!.broken={copper:20,sap:4};round.ended=true;
    const saved=settleFoundryRound(legacy,round);
    expect(saved.pigs!.xp).toEqual({copper:20,sap:8});
    expect(saved.pigs!.unlocked).toEqual(expect.arrayContaining(pigs.unlocked));
  });
  it('replays an independently captured V15 checkpoint with its original movements, draws and rewards',()=>{
    const fixture=JSON.parse(readFileSync(new URL('./test-fixtures/foundry-v15-checkpoint.json',import.meta.url),'utf8'));
    const round=fixture.initial as FoundryRound;
    expect(round.version).toBe(15);
    for(let i=0;i<fixture.steps;i++)stepFoundry(round,{x:Math.sin(i/31)*4.5,z:Math.cos(i/23)*2.5,active:true});
    const rounded=(value:unknown):unknown=>typeof value==='number'?Number(value.toFixed(8)):Array.isArray(value)?value.map(rounded):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,v])=>[key,rounded(v)])):value;
    expect(rounded(round)).toEqual(fixture.expected);
    expect(round.pigs).toBeUndefined();
  });
});
