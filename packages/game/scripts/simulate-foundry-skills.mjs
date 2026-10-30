import { writeFileSync } from 'node:fs';
import { FOUNDRY, FOUNDRY_V4_SKILL_IDS as FOUNDRY_REFERENCE_SKILL_IDS, FOUNDRY_V4_SKILLS as FOUNDRY_REFERENCE_SKILLS, TOOL_IDS } from '../src/foundry.ts';
import { simulateFoundryRun } from '../src/test-fixtures/foundry-run.ts';
const seeds=Array.from({length:24},(_,i)=>i+1);
const report={engineVersion:10,economy:4,sourceNodes:211,playableNodes:FOUNDRY_REFERENCE_SKILL_IDS.length,totalSkillCost:Object.values(FOUNDRY_REFERENCE_SKILLS).reduce((s,n)=>s+n.cost,0),settings:{loot:FOUNDRY.referenceLootMultipliers,resistance:FOUNDRY.resistances,orders:FOUNDRY.orderCosts},profiles:{}};
for(const [name,options] of Object.entries({investment:{economy:4},offCenter:{economy:4,missEvery:5,reserveBill:true},noInvestment:{economy:4,invest:false}})) {
 const runs=seeds.map(seed=>simulateFoundryRun(seed,options));
 const acquired=Object.fromEntries(TOOL_IDS.filter(id=>id!=='mallet').map(id=>{
  const rounds=runs.flatMap(r=>r.purchases.filter(p=>p.tool===id).map(p=>p.round));return [id,{count:rounds.length,earliest:rounds.length?Math.min(...rounds):null,latest:rounds.length?Math.max(...rounds):null}];
 }));
 report.profiles[name]={options,...(name==='offCenter'?{description:'Aims at the least crowded corner every fifth swing. Wide hammers or techniques can still connect; this does not claim an exact miss rate.'}:{}),completed:runs.filter(r=>r.status==='completed').length,total:runs.length,acquired,example:runs[0]};
 console.log(`${name}: ${report.profiles[name].completed}/24 successful; golden ${acquired.gilded.count}/24, rounds ${acquired.gilded.earliest}–${acquired.gilded.latest}`);
}
if(report.profiles.investment.completed<23 || report.profiles.offCenter.completed<20 || report.profiles.noInvestment.completed>0)throw new Error('Skill-tree progression outside balance targets');
if(process.argv.includes('--write'))writeFileSync(new URL('../../../docs/references/foundry-skills-v4.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
