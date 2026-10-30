/** Full-tree rules. Unpublished initial rates are explicit Sylve defaults, not source facts. */
export const FOUNDRY_COMPLETE_MODIFIERS = {
  phantomChance:0, phantomDamage:0, phantomTargets:0, rayChance:0, rayDamage:0, rayRadius:0, rayStrikes:0,
  deathWaveChance:0, deathWaveDamage:0, deathWaveRadius:0, shatterChance:0, rockChance:0, rockDamage:0, rockRadius:0, rockCount:0,
  luckyCrit:0, luckyStrike:0, coinRain:0, coinGrowth:0, glowingSpreadChance:0, glowingSpreadRange:0, lootDamage:0,
  spawnLootChance:0, spawnLootBonus:0, luckySeven:0, superJackpotChance:0, brightStart:0,
  lowStaminaLoot:0, lowStaminaDamage:0, lowStaminaSpeed:0, windRestore:0, windBoost:0, lastStandDamage:0,
  tantrumDamage:0, tantrumDuration:0, comboSaver:0, efficientSwings:0, comboSpeed:0,
  spawnSeconds:0, respawnChance:0, rageChance:0,
};
export type FoundryCompleteModifiers = typeof FOUNDRY_COMPLETE_MODIFIERS;
export const FOUNDRY_TECHNIQUES = {
  phantom: { chance:0.08, damage:0.5, targets:1 },
  ray: { everyTicks:60, chance:0.1, damage:1, radius:1, strikes:1 },
  deathWave: { chance:0.05, damage:0.5, radius:1.5 },
  shatter: { chance:0.01 },
  rocks: { chance:0.03, damage:1, radius:0.6, count:4, fallTicks:8, stormTicks:40, calmTicks:40 },
  lucky: { everyHits:7, criticalChance:0.25, lootChance:0.25 },
  coins: { growth:0.1, burst:20 },
  glowingSpread: { chance:0.05, range:2 },
  wind: { restore:0.2, boostTicks:100, damage:0.5, cadence:0.5 },
  lowStamina: { threshold:0.25, loot:0.25, damage:0.5, cadence:0.25 },
  tantrum: { misses:3, damage:0.5, ticks:60, extraTicks:40 },
  combo: { speedThreshold:20, cadence:0.25 },
  rage: { everyHits:7, chance:0.2, cadence:0.5 },
  superJackpot: { chance:0.005 },
} as const;
