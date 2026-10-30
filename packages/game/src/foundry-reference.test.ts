import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FOUNDRY_V4_SKILLS as FOUNDRY_REFERENCE_SKILLS, FOUNDRY_V4_SKILL_IDS as FOUNDRY_REFERENCE_SKILL_IDS, foundrySkills, foundrySkillReady, foundryStats, foundrySkillCost, foundryStrikeCost,
  buyFoundrySkill, createFoundryRound, newFoundryCycle as latestCycle, stepFoundry, type FoundryCycle, type FoundrySkillId, type FoundryRound } from './foundry';

const aim = { x: 0, z: 0, active: true }, miss = { x: 5.6, z: 3.4, active: false };
function arena(skills: FoundrySkillId[] = []): FoundryRound {
  const r = createFoundryRound(91, { ...newFoundryCycle(), skills }, 'mallet', 'smith'); r.stats.critical = 0;
  r.targets = [{ ...r.targets[0]!, kind:'urn', x:0, z:0, hp:1000, maxHp:1000, vx:0, vz:0 }]; return r;
}
function strike(r: FoundryRound, input = aim) { for (;;) { const f=stepFoundry(r,input); if(f.strike || r.ended)return f; } }

describe('les compétences de référence de la fonderie', () => {
  it('preserves source costs, coordinates, all/any prerequisites and a single reachable root', () => {
    const source = JSON.parse(readFileSync(new URL('../../../docs/references/bills-must-be-paid/build-24759944.json',import.meta.url),'utf8')).categories['skill-tree'].items;
    expect(source).toHaveLength(211); expect(FOUNDRY_REFERENCE_SKILL_IDS).toHaveLength(104);
    const cycle = newFoundryCycle(); expect(cycle.economy).toBe(4); expect(foundrySkills(cycle)).toHaveLength(104);
    expect(foundrySkills(cycle).filter(id=>foundrySkillReady(id,[]))).toEqual(['smash-damage-1']);
    for(const id of FOUNDRY_REFERENCE_SKILL_IDS) {
      const node=FOUNDRY_REFERENCE_SKILLS[id], ref=source.find((s:{slug:string})=>s.slug===id);
      expect(foundrySkillCost(cycle,id)).toBe(ref.cost); expect(node.point).toEqual({x:ref.x,y:ref.y});
      expect(node.requires).toEqual(ref.parents); expect(node.requiresAny).toEqual(ref.anyParents);
      expect(Object.keys(node.effects).length+Object.keys(node.reference).length).toBeGreaterThan(0);
    }
    let funded:FoundryCycle={...cycle,shards:100000000}; let remaining=[...FOUNDRY_REFERENCE_SKILL_IDS];
    while(remaining.length) {
      const ready=remaining.filter(id=>foundrySkillReady(id,funded.skills!)); expect(ready.length).toBeGreaterThan(0);
      for(const id of ready) funded=buyFoundrySkill(funded,id);
      remaining=remaining.filter(id=>!ready.includes(id));
    }
    expect(funded.skills).toHaveLength(104); expect(funded.shards).toBe(100000000-40290579);
  });
  it('charges 1 then the original branch prices and applies flat damage, range, stamina and percentages correctly', () => {
    let c={...newFoundryCycle(),shards:1000};
    expect(foundryStats(c,'mallet','smith').damage).toBe(1);
    expect(()=>buyFoundrySkill(c,'fortune-loot-1')).toThrow('reliés');
    c=buyFoundrySkill(c,'smash-damage-1'); expect(c.shards).toBe(999); expect(foundryStats(c,'mallet','smith').damage).toBe(2);
    expect(()=>buyFoundrySkill(c,'smash-damage-1')).toThrow('déjà');
    for(const id of ['smash-hit-radius','endurance-stamina-1','frenzy-speed-1','fortune-loot-1'] as const)c=buyFoundrySkill(c,id);
    const stats=foundryStats(c,'mallet','smith'); expect(c.shards).toBe(951);
    expect(stats.radius).toBeCloseTo(1.32); expect(stats.concentration).toBe(120); expect(stats.interval).toBeCloseTo(11/1.25); expect(stats.loot).toBeCloseTo(1.35);
    expect(()=>buyFoundrySkill(c,'forge-grip')).toThrow('chantier');
  });
  it('accepts either original Piggy entrance but requires both converging critical paths', () => {
    for(const entrance of ['smash-hit-radius','frenzy-speed-1'] as const) {
      let c=buyFoundrySkill({...newFoundryCycle(),shards:100},'smash-damage-1');c=buyFoundrySkill(c,entrance);c=buyFoundrySkill(c,'piggy-spawn-amount');
      expect(c.shards).toBe(57); expect(createFoundryRound(1,c,'mallet','smith').targets).toHaveLength(14);
    }
    const c={...newFoundryCycle(),shards:1000000,skills:['smash-brutal-2'] as FoundrySkillId[]};
    expect(()=>buyFoundrySkill(c,'smash-low-health-critical-chance')).toThrow('reliés');
    expect(buyFoundrySkill({...c,skills:[...c.skills,'smash-critical-chance-2']},'smash-low-health-critical-chance').shards).toBe(600000);
  });
  it('applies first-hit, crowd, switch and consecutive-hit bonuses to real impacts and resets combos on a miss', () => {
    const first=arena(['fresh-meat','first-hit-multiplier']); strike(first,miss);
    expect(strike(first).impacts[0]!.damage).toBeCloseTo(2.5); expect(strike(first).impacts[0]!.damage).toBe(1);
    const crowd=arena(['collateral-damage']);crowd.stats.radius=2;
    crowd.targets.push({...crowd.targets[0]!,id:2,x:1.5}); expect(strike(crowd).impacts.map(h=>h.damage)).toEqual([1.25,1.25]);
    const combo=arena(['frenzy-combo']);expect(strike(combo).impacts[0]!.damage).toBe(1);expect(strike(combo).impacts[0]!.damage).toBeCloseTo(1.02);
    strike(combo,miss);expect(combo.rogue!.reference!.combo).toBe(0);expect(strike(combo).impacts[0]!.damage).toBe(1);
    const switched=arena(['different-piggy-damage']);strike(switched);switched.targets[0]!.kind='runner';expect(strike(switched).impacts[0]!.damage).toBeCloseTo(1.25);
  });
  it('repeats a double impact without extra stamina or duplicate loot, and keeps broad shockwaves useful', () => {
    const r=arena(['frenzy-double-tap']);r.rogue!.reference!.modifiers.doubleHitChance=1;
    expect(strike(r).impacts).toHaveLength(2);expect(r.concentration).toBe(99);expect(r.rogue!.reference!.combo).toBe(1);
    const single=arena(['frenzy-double-tap']);single.rogue!.reference!.modifiers.doubleHitChance=1;single.targets[0]!.hp=1;
    const frame=strike(single);expect(frame.impacts).toHaveLength(1);expect(single.broken).toBe(1);expect(single.shards).toBe(frame.impacts[0]!.loot);
    const wave=arena(['smash-impact-wave']);wave.rogue!.modifiers.shockwaveChance=1;
    wave.targets.push({...wave.targets[0]!,id:2,x:-4,z:-2});expect(strike(wave).impacts.some(h=>h.targetId===2)).toBe(true);
  });
  it('scales damage and speed with spent stamina, retains a positive strike cost and eventually exhausts a full build', () => {
    const growth=arena(['warm-up','frenzy-speed-per-stamina-used']);const first=strike(growth);const interval=growth.nextStrike-growth.tick;
    expect(first.impacts[0]!.damage).toBe(1);expect(strike(growth).impacts[0]!.damage).toBeCloseTo(1.02);expect(growth.nextStrike-growth.tick).toBeLessThanOrEqual(interval);
    const round=createFoundryRound(91,{...newFoundryCycle(),orderIndex:4,skills:[...FOUNDRY_REFERENCE_SKILL_IDS],blessings:['efficient','recovery','berserk']},'gilded','smith');
    expect(foundryStrikeCost(round)).toBe(0.25);
    while(!round.ended && round.tick<15000) { const t=round.targets.reduce((a,b)=>a.hp<b.hp?a:b);stepFoundry(round,{x:t.x,z:t.z,active:true}); }
    expect(round.ended).toBe(true);expect(round.concentration).toBe(0);expect(round.rogue!.reference!.spent).toBeGreaterThan(0);expect(round.rogue!.recoveryReserve).toBeGreaterThanOrEqual(0);
  });
  it('marks luminous relics, pays their highest loot tier and serializes new combat state deterministically', () => {
    const round=arena(['fortune-golden']);round.targets[0]!.glowing=true;round.targets[0]!.hp=1;
    expect(strike(round).impacts[0]!.loot).toBe(60);
    const full=createFoundryRound(191,{...newFoundryCycle(),skills:[...FOUNDRY_REFERENCE_SKILL_IDS]},'gilded','smith'), resumed=structuredClone(full);
    for(let n=0;n<150;n++){const t=full.targets[0]!,input={x:t.x,z:t.z,active:true};expect(stepFoundry(full,input)).toEqual(stepFoundry(resumed,input));}
    expect(full).toEqual(resumed);
    const old={...newFoundryCycle(),economy:3 as const,skills:['forge-grip'] as FoundrySkillId[]};
    expect(createFoundryRound(1,old,'swift','smith').version).toBe(9);expect(createFoundryRound(1,old,'swift','smith').rogue!.reference).toBeUndefined();
    expect(foundrySkillCost(old,'forge-grip')).toBe(300);expect(newFoundryCycle(2).skills).toEqual([]);
  });
});

function newFoundryCycle(number = 1): FoundryCycle { return { ...latestCycle(number), economy: 4 }; }
