import { writeFileSync } from 'node:fs';
import { FOUNDRY_REFERENCE_SKILLS as SKILLS,FOUNDRY_REFERENCE_SKILL_IDS as IDS,FOUNDRY } from '../src/foundry.ts';
import { simulateFoundryRun } from '../src/test-fixtures/foundry-run.ts';
const report={engineVersion:11,economy:5,nodes:IDS.length,totalSkillCost:Object.values(SKILLS).reduce((n,s)=>n+s.cost,0),settings:{loot:FOUNDRY.referenceLootMultipliers,orders:FOUNDRY.orderCosts},profiles:{}};
for(const [name,options] of Object.entries({investment:{},offCenter:{missEvery:5,reserveBill:true},noInvestment:{invest:false}})){
 const runs=Array.from({length:24},(_,n)=>simulateFoundryRun(n+1,options));const golden=runs.flatMap(r=>r.purchases.filter(p=>p.tool==='gilded').map(p=>p.round));
 report.profiles[name]={options,completed:runs.filter(r=>r.delivered===5).length,total:24,golden:{count:golden.length,earliest:golden.length?Math.min(...golden):null,latest:golden.length?Math.max(...golden):null},example:runs[0]};
 console.log(`${name}: ${report.profiles[name].completed}/24 delivered, golden ${golden.length}/24`);
}
const free=[1,7,17].map(seed=>simulateFoundryRun(seed,{freeplayRounds:40,stopWhenMastered:true}));
report.freeplay=free.map(r=>({seed:r.seed,delivered:r.delivered,learned:r.learned,rounds:r.rounds,freeRounds:r.freeRounds,bank:r.bank}));
for(const r of report.freeplay)console.log(`freeplay ${r.seed}: ${r.learned}/211 nodes, ${r.freeRounds} free rounds, ${r.bank} shards left`);
if(report.profiles.investment.completed<23||report.profiles.offCenter.completed<20||report.profiles.noInvestment.completed>0||free.some(r=>r.learned!==211))throw Error('Full-tree progression outside expected targets');
if(process.argv.includes('--write'))writeFileSync(new URL('../../../docs/references/foundry-complete-v5.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
