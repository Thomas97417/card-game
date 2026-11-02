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
/** Ten piggy banks; internal IDs and legacy speeds remain stable for saved V14 rounds. V15 movement is in foundry-pig-motion. */
export const FOUNDRY_GOLEMS = {
  copper:golem({name:'Normalito',kind:'urn',source:'normalito',ability:'none',detail:'Tirelire rose aux grands yeux. Alterne marche, zigzags et pauses. Sa destruction peut appeler Brotalito dès la deuxième commande.',hp:3,speed:.014,weight:48,unlock:0,color:0xf1a198,gait:'trot'}),
  sap:golem({name:'The Tourist',kind:'runner',source:'the-tourist',ability:'restore',detail:'Cochon au chapeau fleuri, paresseux : longues pauses, petits déplacements, aucune fuite devant le marteau. Rend jusqu’à 5 stamina à sa destruction.',hp:8,speed:.025,weight:13,unlock:1,color:0xda8079,gait:'hop'}),
  stone:golem({name:'Woody',kind:'geode',source:'woody',ability:'none',detail:'Tirelire en bois. Se déplace très lentement et résiste aux frappes.',hp:18,speed:.006,weight:20,unlock:2,color:0xa87849,gait:'stomp'}),
  amber:golem({name:'Piñata',kind:'chaos',source:'pinata',ability:'fragile',detail:'Tirelire à pois et chapeau de fête. Marche, zigzague et fuit le marteau. Chaque impact a 10 % de chance de la briser instantanément.',hp:28,speed:.013,weight:7,unlock:3,color:0xf5dcad,gait:'skitter'}),
  ember:golem({name:'Angry Piggy',kind:'geode',source:'angry-piggy',ability:'rage',detail:'Cochon rouge à cornes. Enrage 5 s après un impact et charge les autres cochons : 70 % des dégâts de base au contact.',hp:18,speed:.014,weight:7,unlock:2,maxOnDesk:2,color:0xc93242,gait:'charge'}),
  shrapnel:golem({name:'Sgt. Oink',kind:'geode',source:'sgt-oink',ability:'shrapnel',detail:'Cochon camouflage. Patrouille en ligne droite et tourne aux bords. Projette 4 éclats de 2 dégâts à sa destruction, à portée 3,5.',hp:18,speed:.009,weight:6,unlock:3,color:0x63694e,gait:'march'}),
  furnace:golem({name:'Bomb Piggy',kind:'chaos',source:'bomb-piggy',ability:'bomb',detail:'Tirelire noire à mèche. Explose 2 s après sa destruction : rayon 5, 200 % des dégâts de base.',hp:28,speed:.007,weight:5,unlock:4,maxOnDesk:1,color:0x202332,gait:'waddle'}),
  thorn:golem({name:'Spiky',kind:'geode',source:'spiky',ability:'thorns',detail:'Cochon violet hérissé de pointes. Ses épines infligent 5 % des dégâts de base aux voisins au contact, toutes les 0,25 s.',hp:18,speed:.008,weight:6,unlock:3,color:0x423b54,gait:'stomp'}),
  thief:golem({name:'Goblig',kind:'runner',source:'goblig',ability:'steal',detail:'Cochon vert au chapeau noir. Vole les éclats libérés à moins de 5, puis fuit vers le bord. Le briser rapporte 1,5 fois son butin volé.',hp:8,speed:.027,weight:4,unlock:1,maxOnDesk:1,color:0x637e37,gait:'prowl'}),
  reinforcement:golem({name:'Brotalito',kind:'runner',source:'brotalito',ability:'reinforcement',detail:'Cochon rose au bandeau noir. A 70 % de chance d’apparaître après la destruction de Normalito dès la deuxième commande.',hp:8,speed:.018,weight:0,unlock:1,color:0xf1a198,gait:'march'}),
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
