/** Keep impacts readable before the next creature acts. Durations are in ms. */
export const COMBAT_TIMING = {
  attack: 1000,
  impact: 260,
  ability: 360,
  abilityImpact: 180,
  heroAbility: 800,
  death: 380,
  summon: 420,
  withdraw: 320,
  damage: 1600,
  settle: 100,
  computerThink: 1000,
} as const;
