/** Rebuild the playable adaptation from numeric facts; never imports guide prose or artwork. */
import { readFileSync, writeFileSync } from 'node:fs';
const reference = JSON.parse(readFileSync(new URL('../../../docs/references/bills-must-be-paid/build-24759944.json', import.meta.url), 'utf8')).categories['skill-tree'].items;
const names = {
  'Heavy Handed':'Poigne de cuivre','Bigger Hammer':'Marteau élargi','More Hit Radius':'Cercle élargi','More Damage':'Puissance du foyer','Collateral Damage':'Frappe collective','Crit Chance':'Précision du cristal','More Crit Chance':'Précision accrue','Crit Damage':'Critiques incisifs','More Crit Damage':'Critiques renforcés','First Hit Damage':'Premier contact','More First Hit Damage':'Premier contact renforcé','First Hit Multiplier':'Premier coup décisif','Switch Damage':'Alternance des reliques','Damage per Destroy':'Élan destructeur','Crowd Damage':'Force du nombre','More Crowd Damage':'Force du nombre accrue','Low HP Damage':'Fêlures profondes','Low HP Crits':'Précision des fêlures','Shockwave':'Onde de la forge','Shockwave Chance':'Fréquence des ondes','Shockwave Damage':'Puissance des ondes',
  'Shake the Couch':'Main d’ambre','More Loot':'Moisson d’éclats','Born Lucky':'Bonne étoile','More Luck':'Chance accrue','Super Luck':'Grande fortune','Double Loot':'Double récolte','Glowing Piggies':'Reliques lumineuses','More Glowing Chance':'Lueur persistante','Glowing Bonus':'Éclat lumineux','More Glowing Bonus':'Éclat lumineux accru','Loot per Piggy Type':'Diversité des reliques',
  'Gym Membership':'Souffle des fougères','Energy Drink':'Réserve de sève','More Stamina':'Réserve profonde','Grip Strength':'Prise assurée','Mega Grip':'Poigne économe','Restore Chance':'Sève retrouvée','Stacking Damage':'Échauffement','Speed from Stamina':'Second rythme',
  'Caffeine Addiction':'Danse des braises','Sugar Rush':'Vif-argent','More Speed':'Cadence accrue','Lightning Strike':'Arc de cuivre','Lightning Chance':'Appel de la foudre','Lightning Damage':'Foudre puissante','More Lightning Targets':'Foudre ramifiée','More Lightning Rays':'Arcs multiples','Double Hit':'Double frappe','Combo':'Enchaînement','More Combo Damage':'Enchaînement renforcé','Ignite':'Braises tenaces','Ignite Chance':'Feu persistant','Fire Duration':'Longues braises','Fire Damage':'Braises ardentes','Burning Chain':'Braises voyageuses','Rage Mode':'Fureur du foyer','Rage Chance':'Appel de la fureur','Rage Duration':'Fureur prolongée','Rage Speed':'Cadence furieuse','More Piggies':'Appel des reliques',
};
const mapping = {
  'Flat damage':['flatDamage','dégât fixe',false,true], 'Hammer damage':['power','dégâts',true], 'Hit radius':['flatRadius','de portée',false,true], 'Multi-hit damage':['multiHitDamage','de dégâts si la frappe touche plusieurs reliques',true,true],
  'Crit chance':['critical','points de chance critique',true], 'Crit damage':['criticalDamage','de dégâts critiques',true], 'Damage vs full-HP piggies':['firstHitBonus','de dégâts de base supplémentaires sur une relique intacte',true], 'First hit damage':['firstStrikeDamage','fois les dégâts de la première frappe de la manche',false,true],
  'Damage vs a new piggy type':['switchDamage','de dégâts en changeant de famille de relique',true,true], 'Damage per piggy destroyed':['damageGrowth','de dégâts par destruction, jusqu’à +25 %',true], 'Damage per piggy on screen':['crowdDamage','de dégâts par relique présente',true,true], 'Damage vs low-HP piggies':['lowHpDamage','de dégâts sur les reliques sous 25 % de vie',true,true], 'Crit chance vs low-HP piggies':['lowHpCritical','points de critiques sur les reliques sous 25 % de vie',true,true],
  'Loot':['loot','d’éclats',true], 'Luck':['luck','de chance de retenir le meilleur de deux tirages de butin',true,true], 'Double loot chance':['jackpotChance','points de chance de doubler le butin',true], 'Glowing piggy chance':['glowingChance','points de chance d’apparition lumineuse : valeur maximale du butin',true,true], 'Glowing Bonus chance':['glowingBonusChance','points de chance de bonus sur une relique lumineuse',true,true], 'Glowing Bonus payout':['glowingBonus','de butin lors de ce bonus lumineux',true,true], 'Loot per unlocked piggy':['lootPerType','d’éclats par famille de relique de la fonderie (4 familles)',true,true],
  'Max stamina':['flatStamina','stamina maximale',false,true], 'Stamina drain':['flatDrain','stamina par frappe (minimum final : 0,25)',false,true], 'Stamina restore chance':['recoveryChance','points de chance de récupération à la destruction',true], 'Stamina restored':['recoveryAmount','stamina récupérée lors de ce déclenchement',false], 'Damage per stamina used':['staminaDamage','de dégâts par point de stamina dépensé pendant la manche',true,true], 'Attack speed per stamina used':['staminaSpeed','de cadence par point de stamina dépensé pendant la manche',true,true],
  'Attack speed':['cadence','de cadence',true], 'Lightning chance':['lightningChance','points de chance de foudre',true], 'Lightning damage':['lightningDamage','des dégâts de base pour la foudre',true], 'Lightning targets':['lightningTargets','cibles pour la foudre',false], 'Lightning rays':['lightningRays','arc supplémentaire par déclenchement de foudre',false,true], 'Combo damage':['comboDamage','de dégâts par frappe consécutive réussie ; un coup dans le vide remet le combo à zéro',true,true],
  'Ignite chance':['burnChance','points de chance d’embrasement',true], 'Fire duration':['burnDuration','seconde de braises',false,true], 'Fire damage':['burnDamage','des dégâts de base par pulsation de braises',true], 'Fire spread chance':['fireSpreadChance','points de chance de propagation des braises à la destruction',true,true], 'Fire spread range':['fireSpreadRange','de portée de propagation des braises',false,true], 'Rage chance':['berserkChance','points de chance de fureur à la destruction',true], 'Rage duration':['berserkDuration','seconde de fureur',false], 'Rage attack speed':['rageSpeed','de cadence pendant la fureur',true,true], 'Shockwave chance':['shockwaveChance','points de chance d’onde',true], 'Shockwave damage':['shockwaveDamage','des dégâts de base pour l’onde',true],
};
// These existing combat techniques have unpublished base rates in the numeric reference.
// Their explicit Sylve rates are retained and recorded as adaptations, rather than claimed as source facts.
const unlocks = {
  'smash-impact-wave': { effects:{shockwaveChance:.1,shockwaveDamage:.45}, reference:{globalWave:1}, detail:'10 % de chance par frappe : une onde touche toutes les reliques pour 45 % des dégâts de base.' },
  'frenzy-blitz': { effects:{lightningChance:.12,lightningDamage:.45}, detail:'12 % de chance par frappe : la foudre touche 2 autres reliques pour 45 % des dégâts de base.' },
  'frenzy-double-tap': { reference:{doubleHitChance:.1}, detail:'10 % de chance de répéter gratuitement l’impact direct. Cette répétition ne consomme pas de stamina et ne modifie pas le combo.' },
  'frenzy-rage-mode': { effects:{berserkChance:.03}, detail:'3 % de chance par destruction : 3 s de fureur, dégâts +20 %, cadence +50 %, coût de stamina divisé par deux.' },
  'burn-unlock': { effects:{burnChance:.15,burnDamage:.2}, detail:'15 % de chance d’embraser la cible pendant 3 s : 20 % des dégâts de base toutes les 0,5 s.' },
  'piggy-spawn-amount': { effects:{capacity:2}, detail:'Deux reliques supplémentaires sur l’établi, jusqu’à seize simultanément.' },
  'piggy-spawn-amount-2': { effects:{capacity:2}, detail:'Deux autres reliques supplémentaires sur l’établi, jusqu’à seize simultanément.' },
};
let included = reference.filter(n => !n.limitBreak && (unlocks[n.slug] || n.stats.length && n.stats.every(s => mapping[s.label])));
for (;;) {
  const known=new Set(included.map(n=>n.slug));
  const next=included.filter(n=>n.parents.every(p=>known.has(p)) && (!n.anyParents.length || n.anyParents.some(p=>known.has(p))));
  if(next.length===included.length)break; included=next;
}
const counts=new Map(), branches={Smash:'forge',Fortune:'fortune',Endurance:'sap',Frenzy:'storm',Piggy:'echo'};
const lines=included.map(n=>{
  if(!names[n.name])throw new Error(`Missing translation: ${n.name}`);
  const rank=(counts.get(n.name)??0)+1; counts.set(n.name,rank);
  const effects={}, extra={}, details=[];
  for(const stat of n.stats){
    if(!mapping[stat.label] && unlocks[n.slug])continue;
    const [key,label,percent,isExtra]=mapping[stat.label]; let value=Number(stat.value.replace(/[^\d.+-]/g,''));
    if(percent)value/=100;
    if(key==='firstStrikeDamage')value-=1;
    if(key==='berserkDuration')value*=20;
    (isExtra?extra:effects)[key]=value;
    const shown = stat.value.replace('.',',').replace(label.startsWith('points') ? '%' : /x$/, '');
    details.push(`${shown} ${label}.`);
  }
  const special=unlocks[n.slug];
  Object.assign(effects,special?.effects); Object.assign(extra,special?.reference);
  const node={name:names[n.name]+(rank>1?` ${rank}`:''),branch:branches[n.branch],detail:special?.detail??details.join(' '),cost:n.cost,requires:n.parents,requiresAny:n.anyParents,kind:n.type==='Unlock'?'technique':n.type==='Passive'?'passive':'upgrade',effects,reference:extra,source:`skill-tree/${n.slug}`,originalName:n.name,point:{x:n.x,y:n.y},...(special&&n.branch!=='Piggy'?{adaptation:'Probabilités et puissance initiales adaptées à la fonderie ; le relevé public ne chiffre pas ces paramètres de départ.'}:{}),...(['Luck','First hit damage','Stamina drain','Stamina restored','Loot per unlocked piggy'].some(label=>n.stats.some(s=>s.label===label))?{adaptation:'Transposition à la fonderie : quatre familles de reliques, seuil bas à 25 %, coût minimal de 0,25 stamina et récupération bornée à la moitié de la dépense. La chance favorise le meilleur de deux tirages.'}:{})};
  return `  ${JSON.stringify(n.slug)}: ${JSON.stringify(node)},`;
});
const header=`/** Generated by scripts/generate-foundry-skills.mjs. Numeric reference: build 24759944. */\nimport type { FoundryBranch, FoundryModifiers } from './foundry-catalog';\nexport const FOUNDRY_REFERENCE_MODIFIERS = { flatDamage:0, flatRadius:0, flatStamina:0, flatDrain:0, multiHitDamage:0, switchDamage:0, firstStrikeDamage:0, lowHpDamage:0, lowHpCritical:0, crowdDamage:0, staminaDamage:0, staminaSpeed:0, comboDamage:0, doubleHitChance:0, burnDuration:0, rageSpeed:0, fireSpreadChance:0, fireSpreadRange:0, lightningRays:0, luck:0, glowingChance:0, glowingBonusChance:0, glowingBonus:0, lootPerType:0, globalWave:0 };\nexport type FoundryReferenceModifiers = typeof FOUNDRY_REFERENCE_MODIFIERS;\nexport interface FoundryReferenceSkill { name:string; branch:FoundryBranch; detail:string; cost:number; requires:string[]; requiresAny:string[]; kind:'upgrade'|'passive'|'technique'; effects:Partial<FoundryModifiers>; reference:Partial<FoundryReferenceModifiers>; source:string; originalName:string; point:{x:number;y:number}; adaptation?:string }\nconst node = (spec:FoundryReferenceSkill) => spec;\nexport const FOUNDRY_REFERENCE_SKILLS = {\n`;
writeFileSync(new URL('../src/foundry-skill-reference.ts',import.meta.url),header+lines.map(l=>l.replace(/: (\{.*\}),$/,': node($1),')).join('\n')+'\n};\nexport type FoundryReferenceSkillId = keyof typeof FOUNDRY_REFERENCE_SKILLS;\nexport const FOUNDRY_REFERENCE_SKILL_IDS = Object.keys(FOUNDRY_REFERENCE_SKILLS) as FoundryReferenceSkillId[];\n');
console.log(`Generated ${included.length} playable source skills; preserved prices, numerical modifiers, positions and AND/OR prerequisites.`);
