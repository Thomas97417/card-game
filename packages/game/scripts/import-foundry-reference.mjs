/** Public numeric reference only; no executable third-party code or artwork is imported. */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
const expected = { 'skill-tree': 211, 'street-smarts': 67, hammers: 7, 'prestige-items': 22, piggies: 18, bills: 20, gadgets: 6, 'collectible-coins': 10, 'piggy-unlocks': 7 };
const selected = process.argv.find((arg) => arg.startsWith('--category='))?.slice('--category='.length);
if (selected && !(selected in expected)) throw new Error(`Unknown category: ${selected}`);
const omit = new Set(['description', 'img', 'image', 'behavior', 'creditor', 'text']);
function facts(value) {
  if (typeof value === 'string' && /^\$(?:undefined|[0-9a-f]+:)/.test(value)) return undefined;
  if (value === '$-0') return 0;
  if (Array.isArray(value)) return value.map(facts).filter((item) => item !== undefined);
  if (!value || typeof value !== 'object') return value;
  const result = Object.fromEntries(Object.entries(value).filter(([key]) => !omit.has(key)).map(([key, item]) => [key, facts(item)]).filter(([, item]) => item !== undefined));
  if (typeof value.description === 'string') result.effectNumbers = value.description.match(/[+-]?\d+(?:\.\d+)?(?:%|x|s)?/g) ?? [];
  return result;
}
const categories = await Promise.all(Object.entries(expected).filter(([category]) => !selected || category === selected).map(async ([category, count]) => {
  const url = `https://justgameguides.com/game/bills-must-be-paid/${category}`;
  const response = await fetch(url); if (!response.ok) throw new Error(`${category}: ${response.status}`);
  const html = await response.text(), chunks = [];
  for (const match of html.matchAll(/<script[^>]*>(.*?)<\/script>/gs)) {
    const script = match[1]; if (!script.startsWith('self.__next_f.push(')) continue;
    try { const item = JSON.parse(script.slice('self.__next_f.push('.length, -1)); if (typeof item[1] === 'string') chunks.push(item[1]); } catch { /* Ignore non-data scripts. */ }
  }
  const arrays = [];
  const visit = (value) => {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') { if (Array.isArray(value.items) && value.items[0] && typeof value.items[0] === 'object') arrays.push(value.items); Object.values(value).forEach(visit); }
  };
  for (const line of chunks.join('').split('\n')) {
    const match = line.match(/^[0-9a-f]+:(\[.*|\{.*)$/s); if (!match) continue;
    try { visit(JSON.parse(match[1])); } catch { /* Ignore non-JSON Flight records. */ }
  }
  const items = arrays.sort((a, b) => b.length - a.length)[0];
  if (items?.length !== count) throw new Error(`${category}: expected ${count} records, found ${items?.length ?? 0}`);
  return [category, { source: url, declaredUpdated: html.match(/<time dateTime="([^"]+)"/)?.[1] ?? null, retrievedAt: new Date().toISOString(), count, items: items.map(facts) }];
}));
const destination = new URL('../../../docs/references/bills-must-be-paid/build-24759944.json', import.meta.url);
mkdirSync(new URL('.', destination), { recursive: true });
const previous = selected ? JSON.parse(readFileSync(destination, 'utf8')) : { game: 'Bills Must Be Paid', source: 'JustGameGuides (independent, not official)', declaredBuild: '24759944', retrievedAt: new Date().toISOString(), scope: 'Numeric facts, identifiers and prerequisites; editorial prose and artwork excluded. Values are a reference, not imported directly into Sylve balance.', categories: {} };
writeFileSync(destination, JSON.stringify({ ...previous, categories: { ...previous.categories, ...Object.fromEntries(categories) } }, null, 2) + '\n');
console.log(`Saved ${categories.reduce((sum, [, category]) => sum + category.count, 0)} numeric reference records.`);
