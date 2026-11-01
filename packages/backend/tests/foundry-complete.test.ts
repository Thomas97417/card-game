import { convexTest } from 'convex-test';
import betterAuthTest from '@convex-dev/better-auth/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FOUNDRY_REFERENCE_SKILL_IDS as IDS, foundrySkillReady, buyFoundrySkill, newFoundryCycle, stepFoundry } from '@sylve/game/foundry';
import { api, components } from '../convex/_generated/api';
import schema from '../convex/schema';
const modules=import.meta.glob('../convex/**/*.ts');
function setup(){const t=convexTest(schema,modules);betterAuthTest.register(t);return t;}
async function player(){
 const t=setup(),now=Date.now();
 const user=await t.mutation(components.betterAuth.adapter.create,{input:{model:'user',data:{name:'Complete tree',email:'full-tree@example.invalid',emailVerified:true,createdAt:now,updatedAt:now}}});
 const session=await t.mutation(components.betterAuth.adapter.create,{input:{model:'session',data:{userId:user._id,token:'full-tree',createdAt:now,updatedAt:now,expiresAt:now+86400000}}});
 const client=t.withIdentity({subject:user._id,sessionId:session._id});await client.mutation(api.foundry.ensure,{expectedOwnerId:user._id});
 return {t,client,id:user._id};
}
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-30T12:00:00Z'));});
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();});

describe('les 211 savoirs sur le serveur',()=>{
 it('validates the final Limit Break purchase and replays a complete build, restored checkpoints and its reserve once',async()=>{
  const {t,client,id}=await player();let b=await client.query(api.foundry.board,{});expect(b.progress!.cycle.economy).toBe(6);
  let funded={...newFoundryCycle(),shards:2000000000},pending=IDS.filter(id=>id!=='limit-break-damage-3');
  while(pending.length){const ready=pending.filter(skill=>foundrySkillReady(skill,funded.skills!));expect(ready.length).toBeGreaterThan(0);for(const skill of ready)funded=buyFoundrySkill(funded,skill);pending=pending.filter(skill=>!ready.includes(skill));}
  await t.run(ctx=>ctx.db.patch(b.progress!._id,{cycle:funded}));let revision=0;
  await client.mutation(api.foundry.purchaseSkill,{expectedOwnerId:id,revision:revision++,skill:'limit-break-damage-3'});
  b=await client.query(api.foundry.board,{});expect(b.progress!.cycle.skills).toHaveLength(211);expect(b.progress!.cycle.shards).toBe(645825971);
  await client.mutation(api.foundry.purchaseTool,{expectedOwnerId:id,revision:revision++,tool:'gilded'});
  const round=await client.mutation(api.foundry.startRound,{expectedOwnerId:id,revision,requestId:'all-211',tool:'gilded'});expect(round.state.version).toBe(13);expect(round.state.targets).toHaveLength(22);
  const expected=structuredClone(round.state);let lastArgs;
  while(!expected.ended){
   if(expected.tick===320){
    // A restored checkpoint from the same legal simulation exercises final exhaustion without repeating every intermediate database write.
    const checkpoints=[];while(!expected.ended){checkpoints.push(structuredClone(expected));if(checkpoints.length>80)checkpoints.shift();const target=expected.targets.reduce<(typeof expected.targets)[number]|undefined>((a,b)=>!a||b.hp<a.hp?b:a,undefined);stepFoundry(expected,target?{x:target.x,z:target.z,active:true}:{x:0,z:0,active:false});}
    Object.assign(expected,checkpoints[0]!);await t.run(ctx=>ctx.db.patch(round._id,{state:structuredClone(expected)}));
   }
   const startTick=expected.tick,inputs=[];for(let n=0;n<40&&!expected.ended;n++){const target=expected.targets.reduce<(typeof expected.targets)[number]|undefined>((a,b)=>!a||b.hp<a.hp?b:a,undefined),input=target?{x:target.x,z:target.z,active:true}:{x:0,z:0,active:false};inputs.push(input);stepFoundry(expected,input);}vi.setSystemTime(round.startedAt+expected.tick*50);
   lastArgs={expectedOwnerId:id,roundId:round._id,startTick,inputs};expect(await client.mutation(api.foundry.submitInputs,lastArgs)).toEqual(expected);expect(await client.mutation(api.foundry.submitInputs,lastArgs)).toEqual(expected);
  }
  expect(expected.rogue!.complete!.windUsed).toBe(true);expect(expected.rogue!.complete!.lastStandUsed).toBe(true);expect(await client.mutation(api.foundry.submitInputs,lastArgs!)).toEqual(expected);
  const finish={expectedOwnerId:id,roundId:round._id};await client.mutation(api.foundry.finishRound,finish);await client.mutation(api.foundry.finishRound,finish);
  b=await client.query(api.foundry.board,{});expect(b.progress!.cycle.shards).toBe(635825971+expected.shards);expect(b.progress!.cycle.coinBank).toBe(expected.rogue!.complete!.coinBank);expect(b.progress!.cycle.coinCount).toBe(expected.rogue!.complete!.coinCount);expect(b.progress!.mastery).toBe(0);
 },20000);
 it('continues after five real deliveries idempotently and grants no extra mastery or daily reward in freeplay',async()=>{
  const {t,client,id}=await player();let b=await client.query(api.foundry.board,{});
  await expect(client.mutation(api.foundry.continueChantier,{expectedOwnerId:id,revision:0,cycleNumber:1})).rejects.toThrow('cinq commandes');
  await t.run(ctx=>ctx.db.patch(b.progress!._id,{cycle:{...b.progress!.cycle,shards:10000000}}));
  for(let order=0;order<5;order++){
   b=await client.query(api.foundry.board,{});await client.mutation(api.foundry.payOrder,{expectedOwnerId:id,revision:b.progress!.revision,cycleNumber:1,orderIndex:order});
   b=await client.query(api.foundry.board,{});
   if(order===4)await expect(client.mutation(api.foundry.continueChantier,{expectedOwnerId:id,revision:b.progress!.revision,cycleNumber:1})).rejects.toThrow('bénédiction');
   await client.mutation(api.foundry.chooseBlessing,{expectedOwnerId:id,revision:b.progress!.revision,blessing:b.progress!.cycle.choices[0]!});
  }
  b=await client.query(api.foundry.board,{});const original=b.progress!,gold=await client.query(api.collection.gold,{}),args={expectedOwnerId:id,revision:original.revision,cycleNumber:1};
  await Promise.all([client.mutation(api.foundry.continueChantier,args),client.mutation(api.foundry.continueChantier,args)]);
  b=await client.query(api.foundry.board,{});expect(b.progress!.revision).toBe(original.revision+1);expect(b.progress!.cycle).toMatchObject({freeplay:true,orderIndex:5,roundsLeft:3,shards:original.cycle.shards});
  await expect(client.mutation(api.foundry.continueChantier,{...args,expectedOwnerId:'another-user'})).rejects.toThrow('autre compte');
  await expect(client.mutation(api.foundry.payOrder,{expectedOwnerId:id,revision:b.progress!.revision,cycleNumber:1,orderIndex:5})).rejects.toThrow('honorées');
  const round=await client.mutation(api.foundry.startRound,{expectedOwnerId:id,revision:b.progress!.revision,requestId:'freeplay',tool:'mallet'});
  await t.run(ctx=>ctx.db.patch(round._id,{state:{...round.state,ended:true,concentration:0,shards:123}}));await client.mutation(api.foundry.finishRound,{expectedOwnerId:id,roundId:round._id});
  b=await client.query(api.foundry.board,{});expect(b.progress!.cycle).toMatchObject({freeplay:true,freeplayRounds:1,roundsLeft:3,orderIndex:5,shards:original.cycle.shards+123});expect(b.progress!.mastery).toBe(5);expect(b.daily.delivered).toBe(3);expect(await client.query(api.collection.gold,{})).toBe(gold);
 });
});
