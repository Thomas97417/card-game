/** Current population, stamina and payout report; V11's original report stays frozen. */
import { readFileSync, writeFileSync } from 'node:fs';
import { simulateFoundryRun } from '../src/test-fixtures/foundry-run.ts';
import { FOUNDRY_POPULATION, FOUNDRY_PACING } from '../src/foundry-population.ts';
import { FOUNDRY } from '../src/foundry.ts';
const runs = Array.from({ length: 24 }, (_, index) => simulateFoundryRun(index + 1, { economy: 6, reserveBill: true }));
const result = { engineVersion: FOUNDRY.version, economy: 6, seeds: 24, completed: runs.filter(run => run.delivered === 5).length,
  firstOrderCompleted: runs.filter(run => run.delivered >= 1).length,
  baseStamina: FOUNDRY_POPULATION.baseStamina, baseStrikeCost: FOUNDRY_POPULATION.baseStrikeCost,
  pacing: FOUNDRY_PACING,
  scope: 'Automated aiming and affordable purchases through five Sylve deliveries; not a claim about human completion time or full-game parity.',
  runs: runs.map(({ seed, delivered, rounds, learned, bank, purchases, history }) => ({ seed, delivered, rounds, learned, bank, purchases, firstRoundIncome: history[0].income, firstRoundStrikes: history[0].strikes })) };
console.log(`${result.firstOrderCompleted}/${result.seeds} first orders paid; ${result.completed}/${result.seeds} five-order chantiers completed with purchases and reserved delivery funds.`);
if (process.argv.includes('--write')) {
  const path = new URL('../../../docs/references/foundry-population-v6.json', import.meta.url);
  const reference = JSON.parse(readFileSync(path, 'utf8')); reference.simulation = result;
  writeFileSync(path, JSON.stringify(reference, null, 2) + '\n');
}
// The original 24/24 completion baseline used a 1-point swing cost, not the sourced 7.
// Report the whole progression honestly while checking the opening bill remains payable.
if (result.firstOrderCompleted !== result.seeds) throw new Error('An opening bill is no longer affordable with the source stamina.');
