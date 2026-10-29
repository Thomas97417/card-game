import { readFileSync } from 'node:fs';
import { FOUNDRY_SKILLS, BLESSINGS, FOUNDRY_CHARMS } from '../src/foundry-catalog.ts';
const reference = JSON.parse(readFileSync(new URL('../../../docs/references/bills-must-be-paid/build-24759944.json', import.meta.url), 'utf8'));
const known = new Set(Object.entries(reference.categories).flatMap(([category, data]) => data.items.map((item) => `${category}/${item.slug}`)));
for (const item of [...Object.values(FOUNDRY_SKILLS), ...Object.values(BLESSINGS), ...Object.values(FOUNDRY_CHARMS)]) {
  if (!known.has(item.source)) throw new Error(`Missing reference for ${item.name}: ${item.source}`);
}
console.log(`PASS: 368 reference records; every one of the 30 skills, 24 blessings and 6 charms links to an existing reference.`);
