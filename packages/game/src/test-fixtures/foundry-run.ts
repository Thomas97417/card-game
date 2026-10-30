import { TOOLS, TOOL_IDS, FOUNDRY_SKILLS, buyFoundryTool, buyFoundrySkill, foundrySkillCost, foundryOrderCost,
  FOUNDRY, newFoundryCycle, createFoundryRound, stepFoundry, settleFoundryRound, deliverFoundryOrder, chooseFoundryBlessing,
  type FoundrySkillId, type FoundryTool, type FoundryCycle, type FoundryBlessing } from "../foundry";

const skillPlan: FoundrySkillId[] = ["forge-grip", "fortune-touch", "forge-first", "storm-tempo", "echo-reach", "forge-crit", "echo-wave", "storm-lightning", "sap-breath", "forge-crushing", "storm-burn", "storm-chain", "fortune-geode", "forge-finisher", "forge-mastery", "echo-company", "echo-gathering", "echo-chain", "echo-harmony"];
const perks = ["shockwave", "lightning", "chain", "power", "critical", "efficient", "wildfire", "focus", "reach", "loot", "gilded", "oneShot", "jackpot", "crescendo", "frost", "berserk"];

export function preferredFoundryBlessing(choices: readonly FoundryBlessing[]): FoundryBlessing {
  const rank = (id: string) => perks.indexOf(id) < 0 ? 100 : perks.indexOf(id);
  return [...choices].sort((a, b) => rank(a) - rank(b))[0]!;
}
export function planFoundryRunPurchases(cycle: FoundryCycle, reserveBill = false) {
  const tool = cycle.selectedTool ?? "mallet";
  const reserve = cycle.roundsLeft === 1 && reserveBill ? foundryOrderCost(cycle)! : 0;
  const upgrade = TOOL_IDS.filter((id) => TOOLS[id].cost > TOOLS[tool].cost && TOOLS[id].cost <= cycle.shards - reserve).at(-1);
  if (upgrade) cycle = buyFoundryTool(cycle, upgrade);
  let skillBudget = Math.min(cycle.shards - reserve, Math.max(300, cycle.shards * 0.2)), learned = 0;
  const skills: FoundrySkillId[] = [];
  for (const id of skillPlan) {
    if (learned === 2) break;
    if (!cycle.skills!.includes(id) && FOUNDRY_SKILLS[id].requires.every((p) => cycle.skills!.includes(p as FoundrySkillId)) && foundrySkillCost(cycle, id) <= skillBudget) {
      const cost = foundrySkillCost(cycle, id); cycle = buyFoundrySkill(cycle, id); skillBudget -= cost; learned++; skills.push(id);
    }
  }
  return { cycle, tool: upgrade, skills };
}

/** Deterministic, affordable decisions against moving relics; no state or loot cheats. */
export function simulateFoundryRun(seed: number, options: { invest?: boolean; missEvery?: number; reserveBill?: boolean } = {}) {
  let cycle = newFoundryCycle(1, seed), tool: FoundryTool = "mallet", rounds = 0;
  const purchases: { tool: FoundryTool; round: number }[] = [];
  const history: { round: number; order: number; tool: FoundryTool; income: number; bank: number; skills: number; ticks: number; strikes: number; emptySwings: number }[] = [];
  while (cycle.status === "active") {
    if (options.invest !== false) {
      const planned = planFoundryRunPurchases(cycle, options.reserveBill);
      cycle = planned.cycle;
      if (planned.tool) { tool = planned.tool; purchases.push({ tool, round: rounds + 1 }); }
    }
    const order = cycle.orderIndex + 1, state = createFoundryRound(seed * 7919 + rounds * 9176, cycle, tool, "smith");
    let emptySwings = 0;
    while (!state.ended && state.tick < 30000) {
      const target = state.targets.reduce((a, b) => a.hp < b.hp ? a : b);
      const miss = options.missEvery && state.tick + 1 >= state.nextStrike && state.rogue!.strikes % options.missEvery === options.missEvery - 1;
      let input = { x: target.x, z: target.z, active: true };
      if (miss) {
        const candidates = [-1, 0, 1].flatMap((x) => [-1, 0, 1].map((z) => ({ x: x * FOUNDRY.width / 2, z: z * FOUNDRY.depth / 2, active: false })));
        const clearance = (p: { x: number; z: number }) => Math.min(...state.targets.map((t) => Math.hypot(t.x - p.x, t.z - p.z)));
        input = candidates.sort((a, b) => clearance(b) - clearance(a))[0]!;
        if (clearance(input) <= state.stats.radius + 0.1) throw new Error("No clear missed-swing position in the fixture");
      }
      const frame = stepFoundry(state, input); if (frame.strike && miss) emptySwings++;
    }
    if (!state.ended) throw new Error(`Non-exhausting build in seed ${seed}, order ${order}`);
    cycle = settleFoundryRound(cycle, state); rounds++;
    history.push({ round: rounds, order, tool, income: state.shards, bank: cycle.shards, skills: cycle.skills!.length, ticks: state.tick, strikes: state.rogue!.strikes, emptySwings });
    if (cycle.status === "failed") break;
    if (cycle.roundsLeft === 0) {
      cycle = deliverFoundryOrder(cycle);
      cycle = chooseFoundryBlessing(cycle, preferredFoundryBlessing(cycle.choices));
    }
  }
  return { seed, status: cycle.status, rounds, bank: cycle.shards, purchases, history };
}
