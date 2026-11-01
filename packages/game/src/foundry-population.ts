/** Numeric reference and explicit family mapping: docs/references/foundry-population-v6.json. */
export const FOUNDRY_POPULATION = { baseTargets: 4, emptyRespawnSeconds: 0.5, orderCosts: [20, 45, 200, 750, 1000] } as const;
export const FOUNDRY_RELIC_PROFILES = {
  "urn": {
    "source": "normalito",
    "hp": 5,
    "unlockOrder": 0,
    "loot": [
      {
        "weight": 66.0,
        "min": 1,
        "max": 3,
        "jackpot": false
      },
      {
        "weight": 30.0,
        "min": 4,
        "max": 6,
        "jackpot": false
      },
      {
        "weight": 4.0,
        "min": 15,
        "max": 22,
        "jackpot": true
      }
    ]
  },
  "runner": {
    "source": "the-tourist",
    "hp": 20,
    "unlockOrder": 1,
    "loot": [
      {
        "weight": 65.0,
        "min": 10,
        "max": 17,
        "jackpot": false
      },
      {
        "weight": 32.0,
        "min": 19,
        "max": 27,
        "jackpot": false
      },
      {
        "weight": 3.0,
        "min": 110,
        "max": 160,
        "jackpot": true
      }
    ]
  },
  "geode": {
    "source": "woody",
    "hp": 70,
    "unlockOrder": 2,
    "loot": [
      {
        "weight": 48.0,
        "min": 42,
        "max": 59,
        "jackpot": false
      },
      {
        "weight": 30.0,
        "min": 67,
        "max": 98,
        "jackpot": false
      },
      {
        "weight": 20.0,
        "min": 120,
        "max": 160,
        "jackpot": false
      },
      {
        "weight": 2.0,
        "min": 420,
        "max": 630,
        "jackpot": true
      }
    ]
  },
  "chaos": {
    "source": "pinata",
    "hp": 105,
    "unlockOrder": 3,
    "loot": [
      {
        "weight": 20.0,
        "min": 1,
        "max": 6,
        "jackpot": false
      },
      {
        "weight": 20.0,
        "min": 15,
        "max": 29,
        "jackpot": false
      },
      {
        "weight": 20.0,
        "min": 59,
        "max": 115,
        "jackpot": false
      },
      {
        "weight": 20.0,
        "min": 145,
        "max": 250,
        "jackpot": false
      },
      {
        "weight": 20.0,
        "min": 365,
        "max": 585,
        "jackpot": true
      }
    ]
  }
} as const;
export type FoundryReferenceRelic = keyof typeof FOUNDRY_RELIC_PROFILES;

export function foundryReferenceDrop(kind: FoundryReferenceRelic, random: () => number, luck = 0, maximum = false) {
  const tiers = FOUNDRY_RELIC_PROFILES[kind].loot;
  if (maximum) return { amount: Math.max(...tiers.map((tier) => tier.max)), jackpot: true };
  const draw = () => {
    let ticket = random() * tiers.reduce((sum, tier) => sum + tier.weight, 0);
    const tier = tiers.find((tier) => (ticket -= tier.weight) < 0) ?? tiers[tiers.length - 1]!;
    return { amount: tier.min + Math.floor(random() * (tier.max - tier.min + 1)), jackpot: tier.jackpot };
  };
  const first = draw();
  if (luck <= 0 || random() >= Math.min(1, luck)) return first;
  const second = draw();
  return second.amount > first.amount ? second : first;
}
