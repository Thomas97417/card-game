/** V12 population/payout progression check; V11's original report stays frozen. */
import { readFileSync, writeFileSync } from 'node:fs';
import { simulateFoundryRun } from '../src/test-fixtures/foundry-run.ts';
const runs = Array.from({ length: 24 }, (_, index) => simulateFoundryRun(index + 1, { economy: 6, reserveBill: true }));
const result = { engineVersion: 12, economy: 6, seeds: 24, completed: runs.filter(run => run.delivered === 5).length,
  scope: 'Automated aiming and affordable purchases through five Sylve deliveries; not a claim about human completion time or full-game parity.',
  runs: runs.map(({ seed, delivered, rounds, learned, bank, purchases, history }) => ({ seed, delivered, rounds, learned, bank, purchases, firstRoundIncome: history[0].income })) };
console.log(`${result.completed}/${result.seeds} source-population chantiers completed with purchases and reserved delivery funds.`);
if (result.completed !== 24) throw new Error('One of the reference-population progression cases no longer completes.');
if (process.argv.includes('--write')) {
  const path = new URL('../../../docs/references/foundry-population-v6.json', import.meta.url);
  const reference = JSON.parse(readFileSync(path, 'utf8')); reference.simulation = result;
  writeFileSync(path, JSON.stringify(reference, null, 2) + '\n');
}
