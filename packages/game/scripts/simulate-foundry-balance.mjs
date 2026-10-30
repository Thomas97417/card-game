import { writeFileSync } from "node:fs";
import { FOUNDRY, TOOL_IDS, TOOLS } from "../src/foundry.ts";
import { simulateFoundryRun } from "../src/test-fixtures/foundry-run.ts";

const seeds = Array.from({ length: 24 }, (_, i) => i + 1);
const profiles = {
  investment: { economy: 3 },
  careful: { economy: 3, missEvery: 5, reserveBill: true },
  noInvestment: { economy: 3, invest: false },
};
const report = { engineVersion: 9, economy: 3, seeds, settings: {
  orders: FOUNDRY.orderCosts, lootMultipliers: FOUNDRY.lootMultipliers, resistances: FOUNDRY.resistances, skillCosts: FOUNDRY.skillCosts,
}, profiles: {} };
for (const [name, options] of Object.entries(profiles)) {
  const runs = seeds.map((seed) => simulateFoundryRun(seed, options));
  const acquisitions = Object.fromEntries(TOOL_IDS.filter((id) => id !== "mallet").map((id) => {
    const rounds = runs.flatMap((r) => r.purchases.filter((p) => p.tool === id).map((p) => p.round));
    return [id, { cost: TOOLS[id].cost, acquired: rounds.length, earliestRound: rounds.length ? Math.min(...rounds) : null, latestRound: rounds.length ? Math.max(...rounds) : null }];
  }));
  report.profiles[name] = { options, completed: runs.filter((r) => r.status === "completed").length, total: runs.length, acquisitions,
    firstRoundIncome: { min: Math.min(...runs.map((r) => r.history[0].income)), max: Math.max(...runs.map((r) => r.history[0].income)) },
    example: runs[0],
  };
  console.log(`${name}: ${report.profiles[name].completed}/${runs.length} completed; golden hammer ${acquisitions.gilded.acquired}/${runs.length}`);
}
if (report.profiles.investment.completed < 23 || report.profiles.careful.completed < 20 || report.profiles.investment.acquisitions.gilded.acquired < 18 || report.profiles.noInvestment.completed > 0) throw new Error("Foundry progression no longer meets the documented balance targets.");
if (process.argv.includes("--write")) {
  writeFileSync(new URL("../../../docs/references/foundry-economy-v3.json", import.meta.url), JSON.stringify(report, null, 2) + "\n");
}
