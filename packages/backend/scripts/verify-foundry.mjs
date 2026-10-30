/** Isolated development smoke test: bun scripts/verify-foundry.mjs [--preview] [--keep | --cleanup]. */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import { FOUNDRY, TOOLS, foundryOrderCost, stepFoundry } from "@sylve/game/foundry";
import { planFoundryRunPurchases, preferredFoundryBlessing } from "../../game/src/test-fixtures/foundry-run.ts";
import "dotenv/config";

const cwd = fileURLToPath(new URL("../", import.meta.url));
const fixturePath = `${cwd}.cache/foundry-test-user.json`;
const loopback = (value) => /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(value ?? "");
if (!process.env.CONVEX_DEPLOYMENT?.startsWith("dev:") && !(loopback(process.env.CONVEX_URL) && loopback(process.env.CONVEX_SITE_URL))) throw new Error("Development or isolated local deployments only.");
function cli(fn, args) {
  const result = spawnSync("bunx", ["--bun", "--no-install", "convex", "run", "--codegen", "disable", "--component", "betterAuth", fn, JSON.stringify(args)], { cwd, encoding: "utf8" });
  if (result.status) throw new Error(`Fixture operation failed: ${fn}`);
  return JSON.parse(result.stdout);
}
function cleanup(user) {
  for (const model of ["session", "account", "user"]) cli("adapter:deleteMany", { input: { model, where: [{ field: model === "user" ? "_id" : "userId", value: user.userId }] }, paginationOpts: { cursor: null, numItems: 100 } });
}
if (process.argv.includes("--cleanup")) {
  if (existsSync(fixturePath)) {
    const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
    if (fixture.deployment !== process.env.CONVEX_DEPLOYMENT || !fixture.user.email.startsWith("sylve-foundry-test-")) throw new Error("Fixture identity mismatch.");
    cleanup(fixture.user); unlinkSync(fixturePath);
  }
  console.log("Foundry test account and sessions removed."); process.exit(0);
}
if (existsSync(fixturePath)) throw new Error("Clean up the previous foundry fixture first.");
let user; let keep = false;
const check = (condition, message) => { if (!condition) throw new Error(message); console.log(`PASS ${message}`); };
try {
  const now = Date.now(); const email = `sylve-foundry-test-${randomUUID()}@example.invalid`; const password = randomUUID();
  const doc = cli("adapter:create", { input: { model: "user", data: { name: "Artisan · Test fonderie", email, emailVerified: true, createdAt: now, updatedAt: now } } });
  user = { userId: doc._id, email, password };
  cli("adapter:create", { input: { model: "account", data: { userId: doc._id, accountId: doc._id, providerId: "credential", password: await hashPassword(password), createdAt: now, updatedAt: now } } });
  const response = await fetch(`${process.env.CONVEX_SITE_URL}/api/auth/sign-in/email`, { method: "POST", headers: { "content-type": "application/json", origin: process.env.SITE_URL ?? "http://localhost:3001" }, body: JSON.stringify({ email, password }) });
  if (!response.ok) throw new Error(`Fixture login failed (${response.status}).`);
  const cookie = response.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
  const tokenResponse = await fetch(`${process.env.CONVEX_SITE_URL}/api/auth/convex/token`, { headers: { cookie } });
  if (!tokenResponse.ok) throw new Error("Fixture token exchange failed.");
  const { token } = await tokenResponse.json(); const client = new ConvexHttpClient(process.env.CONVEX_URL); client.setAuth(token);
  const owner = { expectedOwnerId: user.userId };
  await client.mutation(api.foundry.ensure, owner);
  let board = await client.query(api.foundry.board, {});
  check(board.progress.mastery === 0 && board.availableAssistants.includes("dryad"), "A new foundry starts with the free smith and the owned dryad");
  const preview = process.argv.includes("--preview");
  check(board.progress.cycle.economy === 5, "The expanded reference skill tree is active");
  for (let attempt = 0; attempt < (preview ? 2 : 15) && (preview ? board.progress.cycle.shards < TOOLS.swift.cost : board.daily.delivered < 3); attempt++) {
    if (board.progress.cycle.status !== "active") {
      await client.mutation(api.foundry.newChantier, { ...owner, revision: board.progress.revision });
      board = await client.query(api.foundry.board, {});
    }
    const shopping = planFoundryRunPurchases(board.progress.cycle);
    if (shopping.tool) { await client.mutation(api.foundry.purchaseTool, { ...owner, revision: board.progress.revision, tool: shopping.tool }); board = await client.query(api.foundry.board, {}); }
    for (const skill of shopping.skills) { await client.mutation(api.foundry.purchaseSkill, { ...owner, revision: board.progress.revision, skill }); board = await client.query(api.foundry.board, {}); }
    const round = await client.mutation(api.foundry.startRound, { ...owner, revision: board.progress.revision, requestId: randomUUID(), tool: board.progress.cycle.selectedTool ?? "mallet", assistant: "smith" });
    let state = structuredClone(round.state);
    const began = Date.now();
    while (!state.ended) {
      const startTick = state.tick; const inputs = [];
      for (let i = 0; i < FOUNDRY.batchTicks && !state.ended; i++) {
        const target = [...state.targets].sort((a, b) => a.hp - b.hp)[0];
        const input = { x: target.x, z: target.z, active: true }; inputs.push(input); stepFoundry(state, input);
      }
      const delay = state.tick * FOUNDRY.stepMs - (Date.now() - began);
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
      const args = { ...owner, roundId: round._id, startTick, inputs };
      const confirmed = await client.mutation(api.foundry.submitInputs, args);
      if (confirmed.tick !== state.tick || confirmed.shards !== state.shards || confirmed.rng !== state.rng || confirmed.broken !== state.broken || confirmed.hits !== state.hits) throw new Error("Server replay differs from the predicted round.");
      if (state.tick % 200 === 0 || state.ended) console.log(`PASS Server confirms round ${attempt + 1} at ${state.tick} ticks`);
      if (startTick === 0) {
        const retry = await client.mutation(api.foundry.submitInputs, args);
        check(retry.tick === confirmed.tick && retry.shards === confirmed.shards, "An input retry never duplicates loot");
      }
    }
    const finishArgs = { ...owner, roundId: round._id };
    await client.mutation(api.foundry.finishRound, finishArgs); await client.mutation(api.foundry.finishRound, finishArgs);
    board = await client.query(api.foundry.board, {});
    while (board.progress.cycle.status === "active" && board.progress.cycle.roundsLeft === 0 && board.progress.cycle.shards >= foundryOrderCost(board.progress.cycle)) {
      const payment = { ...owner, revision: board.progress.revision, cycleNumber: board.progress.cycle.number, orderIndex: board.progress.cycle.orderIndex };
      await client.mutation(api.foundry.payOrder, payment); await client.mutation(api.foundry.payOrder, payment);
      board = await client.query(api.foundry.board, {});
      await client.mutation(api.foundry.chooseBlessing, { ...owner, revision: board.progress.revision, blessing: preferredFoundryBlessing(board.progress.cycle.choices) });
      board = await client.query(api.foundry.board, {});
      if (board.daily.delivered === 3) break;
    }
  }
  if (preview) check(board.progress.cycle.shards >= TOOLS.swift.cost && !board.round, "Saved first-round shards can purchase Toy Hammer");
  else {
    check(board.daily.claimed && board.pendingReward?.receipt?.reveals.length > 0, "Three deliveries grant a persisted common chest");
    check(board.progress.mastery >= 3 && !board.round, "Deliveries grant mastery for charms and the completed round stays settled");
  }
  if (process.argv.includes("--keep")) {
    mkdirSync(`${cwd}.cache`, { recursive: true });
    writeFileSync(fixturePath, JSON.stringify({ deployment: process.env.CONVEX_DEPLOYMENT, user }, null, 2), { mode: 0o600 }); keep = true;
    console.log("Browser fixture saved in ignored .cache/foundry-test-user.json; run --cleanup when finished.");
  }
} finally { if (user && !keep) cleanup(user); }
