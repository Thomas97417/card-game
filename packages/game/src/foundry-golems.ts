import type { RelicKind } from './foundry';

export const FOUNDRY_GOLEM_IDS = ['copper','sap','stone','amber','ember','shrapnel','furnace','thorn','thief','reinforcement'] as const;
export type FoundryGolemId = typeof FOUNDRY_GOLEM_IDS[number];
export type FoundryGolemAbility = 'none'|'restore'|'fragile'|'rage'|'shrapnel'|'bomb'|'thorns'|'steal'|'reinforcement';
interface GolemDefinition {
  name: string; kind: Exclude<RelicKind,'spring'>; source: string; ability: FoundryGolemAbility;
  detail: string; hp: number; speed: number; weight: number; unlock: number; maxOnDesk: number; color: number;
  gait: 'trot'|'hop'|'stomp'|'skitter'|'charge'|'march'|'waddle'|'prowl';
}
const golem = (spec: Omit<GolemDefinition,'maxOnDesk'> & {maxOnDesk?:number}): GolemDefinition => ({maxOnDesk:0,...spec});
/** All eight distinct piggy abilities, with Sylve silhouettes, HP, loot families and encounter progression. */
export const FOUNDRY_GOLEMS = {
  copper:golem({name:'Golem de cuivre',kind:'urn',source:'normalito',ability:'none',detail:'Trottine sur l’établi. Dès la deuxième commande, sa destruction peut appeler un renfort.',hp:3,speed:.014,weight:48,unlock:0,color:0xc88a50,gait:'trot'}),
  sap:golem({name:'Golem de sève',kind:'runner',source:'the-tourist',ability:'restore',detail:'Bondit pour esquiver le marteau. Rend jusqu’à 5 stamina à sa destruction, dans la réserve de récupération de la manche.',hp:8,speed:.025,weight:13,unlock:1,color:0x67b98c,gait:'hop'}),
  stone:golem({name:'Golem de pierre',kind:'geode',source:'woody',ability:'none',detail:'Avance à petits pas lourds. Sa carapace résiste aux frappes.',hp:18,speed:.006,weight:20,unlock:2,color:0x84a4a0,gait:'stomp'}),
  amber:golem({name:'Golem d’ambre',kind:'chaos',source:'pinata',ability:'fragile',detail:'Tremble et sautille. Chaque impact a 10 % de chance de briser sa carapace instantanément.',hp:28,speed:.013,weight:7,unlock:3,color:0xe3af4e,gait:'skitter'}),
  ember:golem({name:'Golem de braise',kind:'geode',source:'angry-piggy',ability:'rage',detail:'Enrage 5 s après un impact et charge les autres golems : 70 % des dégâts de base au contact.',hp:18,speed:.014,weight:7,unlock:2,maxOnDesk:2,color:0xe66e3d,gait:'charge'}),
  shrapnel:golem({name:'Golem de grenaille',kind:'geode',source:'sgt-oink',ability:'shrapnel',detail:'Marche en cadence. À sa destruction, projette 4 éclats infligeant 2 dégâts, à portée 3,5.',hp:18,speed:.009,weight:6,unlock:3,color:0x9daab2,gait:'march'}),
  furnace:golem({name:'Golem de fournaise',kind:'chaos',source:'bomb-piggy',ability:'bomb',detail:'Se dandine. Son noyau explose 2 s après sa destruction : rayon 5, 200 % des dégâts de base.',hp:28,speed:.007,weight:5,unlock:4,maxOnDesk:1,color:0xf39b44,gait:'waddle'}),
  thorn:golem({name:'Golem d’épines',kind:'geode',source:'spiky',ability:'thorns',detail:'Se déplace lentement. Ses épines infligent 5 % des dégâts de base aux voisins au contact, toutes les 0,25 s.',hp:18,speed:.008,weight:6,unlock:3,color:0x8bac68,gait:'stomp'}),
  thief:golem({name:'Golem chapardeur',kind:'runner',source:'goblig',ability:'steal',detail:'Vole les éclats libérés à moins de 5, puis fuit vers le bord. Le démonter rapporte 1,5 fois son butin volé.',hp:8,speed:.027,weight:4,unlock:1,maxOnDesk:1,color:0xc5aa6d,gait:'prowl'}),
  reinforcement:golem({name:'Golem de renfort',kind:'runner',source:'brotalito',ability:'reinforcement',detail:'Accourt avec de grands pas. A 70 % de chance d’apparaître après la destruction d’un golem de cuivre dès la deuxième commande.',hp:8,speed:.018,weight:0,unlock:1,color:0xd29b55,gait:'march'}),
} as const;
export const FOUNDRY_GOLEM_RULES = {
  restore:5, fragileChance:.1, rageTicks:100, ramDamage:.7, ramCooldownTicks:10,
  shrapnelPieces:4, shrapnelDamage:2, shrapnelRange:3.5,
  fuseTicks:40, blastRadius:5, blastDamage:2,
  thornsDamage:.05, thornsTicks:5, stealRadius:5, payback:1.5, escapeGraceTicks:20, reinforcementChance:.7,
} as const;
/** Sylve safeguard shared by Tourist recovery and learned random refunds; fixed one-shot bonuses stay separate. */
export const FOUNDRY_GOLEM_BALANCE={recoveryRefundLimit:.8} as const;
export const LEGACY_GOLEM: Record<RelicKind,FoundryGolemId> = {urn:'copper',runner:'sap',geode:'stone',chaos:'amber',spring:'sap'};

export function foundryGolemPool(stage:number, live:readonly {golem?:FoundryGolemId}[], pendingBombs=0) {
  return FOUNDRY_GOLEM_IDS.filter(id=>{
    const spec=FOUNDRY_GOLEMS[id];
    return spec.unlock<=stage && spec.weight>0 && (!spec.maxOnDesk || live.filter(t=>t.golem===id).length+(id==='furnace'?pendingBombs:0)<spec.maxOnDesk);
  });
}
