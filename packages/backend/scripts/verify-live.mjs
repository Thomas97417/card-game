/** Development-only integration check. Creates its own isolated test users.
 * bun scripts/verify-live.mjs [--keep] | bun scripts/verify-live.mjs --cleanup
 */
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  unlinkSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { ConvexClient, ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import { getCombatType, legalPlacements } from "@sylve/game";
import { chooseComputerMove, PRACTICE_DEADLINE } from "@sylve/game/practice";
import "dotenv/config";

const cwd = fileURLToPath(new URL("../", import.meta.url));
const fixturePath = `${cwd}.cache/live-test-users.json`;
const site = process.env.CONVEX_SITE_URL;
const cloud = process.env.CONVEX_URL;
const origin = process.env.SITE_URL ?? "http://localhost:3001";
if (!process.env.CONVEX_DEPLOYMENT?.startsWith("dev:"))
  throw new Error("This check is restricted to a configured dev: deployment.");
function cli(fn, args, component = "betterAuth") {
  const result = spawnSync(
    "bunx",
    [
      "--bun",
      "convex",
      "run",
      "--codegen",
      "disable",
      "--component",
      component,
      fn,
      JSON.stringify(args),
    ],
    { cwd, encoding: "utf8" },
  );
  if (result.status !== 0)
    throw new Error(`Development fixture operation failed: ${fn}`);
  return JSON.parse(result.stdout);
}
function deleteUser(user) {
  for (const [model, field, value] of [
    ["session", "userId", user.userId],
    ["account", "userId", user.userId],
    ["user", "_id", user.userId],
  ]) {
    cli("adapter:deleteMany", {
      input: { model, where: [{ field, value }] },
      paginationOpts: { cursor: null, numItems: 100 },
    });
  }
}
if (process.argv.includes("--cleanup")) {
  if (existsSync(fixturePath)) {
    const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
    if (fixture.deployment !== process.env.CONVEX_DEPLOYMENT)
      throw new Error("Fixture deployment mismatch.");
    for (const user of fixture.users) {
      await closeFixtureActivity(user);
      deleteUser(user);
    }
    unlinkSync(fixturePath);
  }
  console.log("Live test sessions and users removed.");
  process.exit(0);
}
if (existsSync(fixturePath))
  throw new Error("Clean up the previous fixtures with --cleanup first.");
const users = [];
function check(value, message) {
  if (!value) throw new Error(message);
  console.log(`PASS ${message}`);
}
async function login(user) {
  const response = await fetch(`${site}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({ email: user.email, password: user.password }),
  });
  if (!response.ok)
    throw new Error(`Fixture sign-in failed (${response.status}).`);
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  const tokenResponse = await fetch(`${site}/api/auth/convex/token`, {
    headers: { cookie },
  });
  if (!tokenResponse.ok) throw new Error("Fixture token exchange failed.");
  const { token } = await tokenResponse.json();
  const client = new ConvexHttpClient(cloud);
  client.setAuth(token);
  return { client, token };
}
async function closeFixtureActivity(user) {
  try {
    const { client } = await login(user);
    const activity = await client.query(api.games.activity, {});
    if (activity.status === "active" && activity.gameId)
      await client.mutation(api.games.surrender, { gameId: activity.gameId });
    else if (activity.status === "waiting" && activity.gameId)
      await client.mutation(api.games.cancelPrivate, {
        gameId: activity.gameId,
      });
    if (activity.queued) await client.mutation(api.matchmaking.cancel, {});
  } catch {
    /* A partially cleaned fixture may already have no auth account. */
  }
}
let keep = false;
try {
  for (const name of ["Alice", "Bastien"]) {
    const now = Date.now();
    const email = `sylve-test-${name.toLowerCase()}-${randomUUID()}@example.invalid`;
    const password = randomUUID();
    const doc = cli("adapter:create", {
      input: {
        model: "user",
        data: {
          name: `${name} · Test`,
          email,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        },
      },
    });
    const fixture = { userId: doc._id, email, password };
    users.push(fixture);
    cli("adapter:create", {
      input: {
        model: "account",
        data: {
          userId: doc._id,
          accountId: doc._id,
          providerId: "credential",
          password: await hashPassword(password),
          createdAt: now,
          updatedAt: now,
        },
      },
    });
  }
  const sessions = await Promise.all(users.map(login));
  const clients = sessions.map((s) => s.client);
  const deckIds = await Promise.all(
    clients.map((client) => client.mutation(api.decks.ensureStarter, {})),
  );
  check(
    (await clients[0].query(api.collection.list, {})).length === 4 &&
      (await clients[0].query(api.decks.list, {}))[0].cardIds.length === 4,
    "The account starts with four owned common variants",
  );
  const invitation = await clients[0].mutation(api.games.createPrivate, {
    deckId: deckIds[0],
  });
  const gameId = await clients[1].mutation(api.games.joinPrivate, {
    code: invitation.code,
    deckId: deckIds[1],
  });
  check(
    gameId === invitation.gameId,
    "Private invitation joins both accounts into one game",
  );
  let view = await clients[0].query(api.games.get, { gameId });
  check(
    view.players[1].hand.length === 0 && !("drawPile" in view.players[1]),
    "Opponent private information remains hidden",
  );
  const actor = view.activePlayer;
  const own = await clients[actor].query(api.games.get, { gameId });
  const watcher = new ConvexClient(cloud);
  watcher.setAuth(async () => sessions[1 - actor].token);
  let stop;
  const received = new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Live synchronization timed out")),
      15000,
    );
    stop = watcher.onUpdate(
      api.games.get,
      { gameId },
      (update) => {
        if (update.players[actor].board.length) {
          clearTimeout(timeout);
          resolve();
        }
      },
      reject,
    );
  });
  await clients[actor].mutation(api.games.playCard, {
    gameId,
    cardId: own.players[actor].hand[0].id,
    row: 0,
    depth: getCombatType(own.players[actor].hand[0]) === "melee" ? 0 : 2,
    expectedTurn: own.turn,
  });
  await received;
  stop();
  await watcher.close();
  console.log("PASS WebSocket synchronizes a summon to the second session");
  const reconnected = await login(users[0]);
  const restored = await reconnected.client.query(api.games.get, { gameId });
  check(
    restored.players[actor].board.length === 1,
    "A new authenticated session restores the persisted game",
  );
  await clients[0].mutation(api.games.surrender, { gameId });
  check(
    (await clients[1].query(api.games.get, { gameId })).winner === 1,
    "Surrender ends the game for both players",
  );
  check(
    (await clients[1].query(api.chests.list, {})).chests.length === 0,
    "Friendly victories do not grant chests",
  );
  await clients[0].mutation(api.matchmaking.enqueue, { deckId: deckIds[0] });
  const paired = await clients[1].mutation(api.matchmaking.enqueue, {
    deckId: deckIds[1],
  });
  check(
    paired.gameId &&
      (await clients[0].query(api.games.activity, {})).gameId === paired.gameId,
    "Random matchmaking pairs the two accounts",
  );
  let turns = 0;
  for (; turns < 100; turns++) {
    view = await clients[0].query(api.games.get, { gameId: paired.gameId });
    if (view.status === "finished") break;
    const active = view.activePlayer;
    const current = await clients[active].query(api.games.get, {
      gameId: paired.gameId,
    });
    const player = current.players[active];
    const enemy = current.players[1 - active];
    const moves = [...player.hand]
      .sort((a, b) => b.attack - a.attack)
      .flatMap((card) =>
        legalPlacements(card, player.board)
          .sort(
            (a, b) =>
              enemy.board.filter((u) => u.row === a.row).length -
              enemy.board.filter((u) => u.row === b.row).length,
          )
          .map((cell) => ({ cardId: card.id, ...cell })),
      );
    if (moves[0])
      await clients[active].mutation(api.games.playCard, {
        gameId: paired.gameId,
        ...moves[0],
        expectedTurn: current.turn,
      });
    else
      await clients[active].mutation(api.games.endTurn, {
        gameId: paired.gameId,
        expectedTurn: current.turn,
      });
  }
  check(
    view.status === "finished" && view.players.some((p) => p.heroHp === 0),
    `A complete duel reaches a hero defeat (${turns} turns)`,
  );
  const winner = clients[view.winner];
  const inventory = await winner.query(api.chests.list, {});
  check(
    inventory.chests.length === 1 &&
      !Object.hasOwn(inventory.chests[0], "contents") &&
      inventory.chests[0].unlockAt > inventory.serverNow,
    "The public winner receives one sealed chest with a server deadline and hidden loot",
  );
  let earlyOpeningBlocked = false;
  try {
    await winner.mutation(api.chests.open, {
      chestId: inventory.chests[0]._id,
    });
  } catch {
    earlyOpeningBlocked = true;
  }
  check(earlyOpeningBlocked, "Opening before the server deadline is rejected");
  const soloProgressBefore = (await clients[0].query(api.chests.list, {}))
    .victoryChest.wins;
  const soloId = await clients[0].mutation(api.games.createSolo, {
    deckId: deckIds[0],
  });
  let solo = await clients[0].query(api.games.get, { gameId: soloId });
  check(
    solo.mode === "solo" &&
      solo.activePlayer === 0 &&
      solo.turnEndsAt === PRACTICE_DEADLINE,
    "Persistent solo starts the human first without a deadline",
  );
  let soloTurns = 0;
  for (; soloTurns < 200 && solo.status !== "finished"; soloTurns++) {
    if (solo.activePlayer === 1)
      await clients[0].mutation(api.games.soloTurn, {
        gameId: soloId,
        expectedTurn: solo.turn,
      });
    else {
      const move = chooseComputerMove(solo, Math.random);
      if (move)
        await clients[0].mutation(api.games.playCard, {
          gameId: soloId,
          ...move,
          expectedTurn: solo.turn,
        });
      else
        await clients[0].mutation(api.games.endTurn, {
          gameId: soloId,
          expectedTurn: solo.turn,
        });
    }
    solo = await clients[0].query(api.games.get, { gameId: soloId });
  }
  check(
    solo.status === "finished" &&
      (solo.winner !== 0 || solo.reward?.status === "awarded"),
    `A complete server solo ends and grants its eligible reward (${soloTurns} turns)`,
  );
  let victory = (await clients[0].query(api.chests.list, {})).victoryChest;
  check(
    victory.wins ===
      Math.min(3, soloProgressBefore + (solo.winner === 0 ? 1 : 0)),
    "The solo result updates the recurring common chest exactly once",
  );
  while (victory.wins < 3) {
    await clients[0].mutation(api.matchmaking.enqueue, { deckId: deckIds[0] });
    const extra = await clients[1].mutation(api.matchmaking.enqueue, {
      deckId: deckIds[1],
    });
    await clients[1].mutation(api.games.surrender, { gameId: extra.gameId });
    victory = (await clients[0].query(api.chests.list, {})).victoryChest;
  }
  const slotsBefore = (await clients[0].query(api.chests.list, {})).chests
    .length;
  const bonus = await clients[0].mutation(api.chests.openVictory, {
    cycle: victory.cycle,
  });
  const reset = (await clients[0].query(api.chests.list, {})).victoryChest;
  check(
    bonus.rarity === "common" &&
      bonus.reveals.length > 0 &&
      reset.wins === 0 &&
      reset.cycle === victory.cycle + 1,
    "Three victories open a common chest and restart the counter immediately",
  );
  const afterClaim = JSON.stringify(
    await clients[0].query(api.collection.list, {}),
  );
  await clients[0].mutation(api.chests.openVictory, { cycle: victory.cycle });
  check(
    JSON.stringify(await clients[0].query(api.collection.list, {})) ===
      afterClaim &&
      (await clients[0].query(api.chests.list, {})).chests.length ===
        slotsBefore,
    "Retrying a victory-chest claim neither duplicates cards nor changes combat slots",
  );
  if (process.argv.includes("--keep")) {
    const room = await clients[0].mutation(api.games.createPrivate, {
      deckId: deckIds[0],
    });
    await clients[1].mutation(api.games.joinPrivate, {
      code: room.code,
      deckId: deckIds[1],
    });
    mkdirSync(`${cwd}.cache`, { recursive: true });
    writeFileSync(
      fixturePath,
      JSON.stringify(
        {
          deployment: process.env.CONVEX_DEPLOYMENT,
          users,
          gameId: room.gameId,
        },
        null,
        2,
      ),
      { mode: 0o600 },
    );
    keep = true;
    console.log(
      "Browser fixtures saved in the ignored .cache directory; run --cleanup when finished.",
    );
  }
} finally {
  if (!keep)
    for (const user of users) {
      await closeFixtureActivity(user);
      deleteUser(user);
    }
}
