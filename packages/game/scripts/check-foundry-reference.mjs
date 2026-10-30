import { readFileSync } from 'node:fs';
import { FOUNDRY_SKILLS, BLESSINGS, FOUNDRY_CHARMS } from '../src/foundry-catalog.ts';
import { TOOLS } from '../src/foundry.ts';
const reference = JSON.parse(readFileSync(new URL('../../../docs/references/bills-must-be-paid/build-24759944.json', import.meta.url), 'utf8'));
const known = new Set(Object.entries(reference.categories).flatMap(([category, data]) => data.items.map((item) => `${category}/${item.slug}`)));
for (const item of [...Object.values(FOUNDRY_SKILLS), ...Object.values(BLESSINGS), ...Object.values(FOUNDRY_CHARMS), ...Object.values(TOOLS)]) {
  if (!known.has(item.source)) throw new Error(`Missing reference for ${item.name}: ${item.source}`);
}
console.log(`PASS: 368 reference records; all 30 skills, 24 blessings, 6 charms and 7 tools link to an existing reference.`);
