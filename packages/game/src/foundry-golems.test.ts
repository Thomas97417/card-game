import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {createFoundryRound,newFoundryCycle,spawnFoundryRelic,stepFoundry,FOUNDRY,RELICS,FOUNDRY_GOLEMS,FOUNDRY_GOLEM_IDS,FOUNDRY_REFERENCE_SKILL_IDS,FOUNDRY_GOLEM_RULES as G,foundryGolemPool,type FoundryGolemId,type FoundryRound,type FoundryFrame} from './foundry';
import {tickFoundryGolemAbilities} from './foundry-golem-behavior';

const miss={x:5.6,z:3.4,active:false};
function arena(ids:FoundryGolemId[]) {
  const r=createFoundryRound(71,newFoundryCycle(),'mallet');r.targets=[];r.stats.critical=0;r.stats.radius=.12;
  r.targets=ids.map((id,index)=>({...spawnFoundryRelic(r,id),x:index*2,z:0,vx:0,vz:0,phase:.2}));
  return r;
}
function strike(r:FoundryRound,index=0){const t=r.targets[index]!;r.nextStrike=r.tick+1;return stepFoundry(r,{x:t.x,z:t.z,active:true});}

describe('les dix golems de forge et les huit capacités des cochons',()=>{
  it('covers every distinct source ability and keeps numerical ability parameters from the reference',()=>{
    const piggies=JSON.parse(readFileSync(new URL('../../../docs/references/bills-must-be-paid/build-24759944.json',import.meta.url),'utf8')).categories.piggies.items;
    const sourceAbilities=piggies.filter((p:{abilities:unknown[]})=>p.abilities.length).map((p:{slug:string})=>p.slug).sort();
    expect(FOUNDRY_GOLEM_IDS.filter(id=>FOUNDRY_GOLEMS[id].ability!=='none').map(id=>FOUNDRY_GOLEMS[id].source).sort()).toEqual(sourceAbilities);
    expect([G.restore,G.fragileChance,G.rageTicks*FOUNDRY.stepMs/1000,G.ramDamage,G.shrapnelPieces,G.shrapnelDamage,G.shrapnelRange,G.fuseTicks*FOUNDRY.stepMs/1000,G.blastRadius,G.blastDamage,G.thornsDamage,G.thornsTicks*FOUNDRY.stepMs/1000,G.stealRadius,G.payback,G.reinforcementChance]).toEqual([5,.1,5,.7,4,2,3.5,2,5,2,.05,.25,5,1.5,.7]);
  });
  it('restores exactly five stamina on a sap destruction, including the final paid swing',()=>{
    const r=arena(['sap']);r.targets[0]!.hp=1;r.concentration=7;strike(r);
    expect(r.concentration).toBe(5);expect(r.ended).toBe(false);expect(r.golems!.broken).toEqual({sap:1});
  });
  it('lets the amber shell shatter on a low-probability draw without the former chaos explosion',()=>{
    const r=arena(['amber','copper']);r.targets[0]!.hp=r.targets[0]!.maxHp=100;r.rng=1;
    const frame=strike(r);expect(r.golems!.broken.amber).toBe(1);expect(r.targets[0]!.golem).toBe('copper');
    expect(r.targets[0]!.hp).toBe(3);expect(frame.effects!.some(e=>e.kind==='shockwave')).toBe(false);
  });
  it('rages for five seconds when hit and rams neighbours for 70% of base damage',()=>{
    const r=arena(['ember','copper']);r.stats.damage=10;r.targets.forEach(t=>{t.hp=t.maxHp=100;});r.targets[1]!.x=.99;
    strike(r);expect(r.targets[0]!.rageUntil!-r.tick).toBe(100);
    r.nextStrike=1e6;const hp=r.targets[1]!.hp;for(let i=0;i<40&&r.targets[1]!.hp===hp;i++)stepFoundry(r,miss);
    expect(hp-r.targets[1]!.hp).toBeCloseTo(7);
  });
  it('emits four shrapnel pieces with flat damage and bounded range',()=>{
    const r=arena(['shrapnel','copper','copper','copper','copper']);r.stats.damage=10;r.targets[0]!.hp=1;
    r.targets.slice(1).forEach((t,i)=>{t.x=[1.5,-1.5,0,0][i]!;t.z=[0,0,1.5,-1.5][i]!;t.hp=t.maxHp=50;});
    const frame=strike(r);expect(frame.effects!.filter(e=>e.kind==='golemShard')).toHaveLength(4);
    expect(r.targets.map(t=>t.hp)).toEqual([48,48,48,48]);
  });
  it('waits the full two-second fuse after the final swing and replays its blast across a checkpoint',()=>{
    const r=arena(['furnace','stone']);r.concentration=7;r.targets[0]!.hp=1;strike(r);
    expect(r.concentration).toBe(0);expect(r.ended).toBe(false);expect(r.golems!.bombs).toHaveLength(1);
    const resumed=JSON.parse(JSON.stringify(r)) as FoundryRound,deadline=r.golems!.bombs[0]!.at;
    while(r.tick<deadline){expect(stepFoundry(resumed,miss)).toEqual(stepFoundry(r,miss));if(r.tick<deadline)expect(r.targets[0]!.hp).toBe(18);}
    expect(r.targets[0]!.hp).toBe(16);expect(r.rogue!.strikes).toBe(1);expect(r.ended).toBe(true);expect(resumed).toEqual(r);
  });
  it('pricks touching targets at the published quarter-second interval',()=>{
    const r=arena(['thorn','copper']);r.stats.damage=10;r.targets[1]!.x=.98;
    const f:FoundryFrame={strike:false,impacts:[],effects:[]};r.tick=1;
    expect(tickFoundryGolemAbilities(r,f,false).map(h=>h.damage)).toEqual([.5]);
    r.tick=5;expect(tickFoundryGolemAbilities(r,f,false)).toHaveLength(0);
    r.tick=6;expect(tickFoundryGolemAbilities(r,f,false).map(h=>h.damage)).toEqual([.5]);
  });
  it('intercepts nearby drops and returns exactly 1.5 times the stolen amount without minting its own base loot',()=>{
    const r=arena(['copper','thief']);r.targets[0]!.hp=1;r.targets[0]!.glowing=true;
    expect(strike(r).impacts[0]!.loot).toBe(0);expect(r.shards).toBe(0);expect(r.targets[0]!.stolen).toBe(22);
    r.targets[0]!.hp=1;expect(strike(r).impacts[0]!.loot).toBe(33);expect(r.shards).toBe(33);
    const empty=arena(['thief']);empty.targets[0]!.hp=1;strike(empty);expect(empty.shards).toBe(0);
  });
  it('lets a laden thief escape at the board edge, retaining an auditable loss counter',()=>{
    const r=arena(['thief']),t=r.targets[0]!;t.stolen=10;t.escapeAt=0;t.x=FOUNDRY.width/2-RELICS[t.kind].radius*FOUNDRY.fullRelicScale;
    stepFoundry(r,miss);expect(r.targets).toHaveLength(0);expect(r.golems).toMatchObject({escaped:1,lost:10});expect(r.broken).toBe(0);
  });
  it('calls the stronger reinforcement after an unlocked copper death without exceeding learned population',()=>{
    const r=arena(['copper']);r.pigs!.xp.copper=54;r.targets[0]!.hp=1;r.targets[0]!.glowing=true;r.rng=1;
    strike(r);expect(r.targets.map(t=>t.golem)).toEqual(['reinforcement']);
    expect(foundryGolemPool(4,[],1)).not.toContain('furnace');
    expect(foundryGolemPool(4,[{golem:'thief'},{golem:'ember'},{golem:'ember'}])).not.toContain('thief');
    expect(foundryGolemPool(4,[{golem:'ember'},{golem:'ember'}])).not.toContain('ember');
    expect(foundryGolemPool(4,[])).not.toContain('reinforcement');
  });
  it('preserves the original movement when replaying a saved V14 round',()=>{
    const paths=new Map<string,string>(),speeds=new Map<string,number>();
    for(const id of ['copper','sap','stone','amber','thief'] as FoundryGolemId[]){const r=arena([id]);r.version=14;r.targets[0]!.vx=.02;r.targets[0]!.vz=0;r.nextStrike=1e6;
      for(let i=0;i<30;i++)stepFoundry(r,miss);const t=r.targets[0]!;paths.set(id,`${t.x.toFixed(5)}:${t.z.toFixed(5)}`);speeds.set(id,Math.hypot(t.vx,t.vz));}
    expect(new Set(paths.values()).size).toBe(5);expect(speeds.get('stone')!).toBeLessThan(speeds.get('copper')!);expect(speeds.get('sap')!).toBeGreaterThan(speeds.get('copper')!);
  });
  it('keeps a complete build exhaustible when passive kills and efficient swings would otherwise generate free stamina',()=>{
    const r=createFoundryRound(191,{...newFoundryCycle(),orderIndex:4,skills:[...FOUNDRY_REFERENCE_SKILL_IDS],blessings:['efficient','recovery','berserk']},'gilded');
    while(!r.ended&&r.tick<20000){const t=r.targets.reduce<FoundryRound['targets'][number]|undefined>((a,b)=>!a||b.hp<a.hp?b:a,undefined);stepFoundry(r,t?{x:t.x,z:t.z,active:true}:miss);}
    expect(r.ended).toBe(true);expect(r.concentration).toBe(0);expect(r.golems!.recovered!).toBeLessThanOrEqual(r.rogue!.reference!.spent*.8+.00001);
  });
});
