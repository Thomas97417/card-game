import type { OptimisticLocalStore } from "convex/browser";
import type { FunctionArgs } from "convex/server";
import { api } from "@my-better-t-app/backend/convex/_generated/api";
import { legalPlacements } from "@sylve/game";

/** Show only the placement locally; draws and combat still come from the server.
 * Convex reconciles this preview automatically on success or rejection. */
export function optimisticallyPlayCard(
  store: OptimisticLocalStore,
  args: FunctionArgs<typeof api.games.playCard>,
) {
  const queryArgs = { gameId: args.gameId };
  const game = store.getQuery(api.games.get, queryArgs);
  if (
    !game ||
    game.status !== "active" ||
    game.turn !== args.expectedTurn ||
    game.activePlayer !== game.me ||
    game.hasSummoned ||
    game.turnEndsAt <= Date.now()
  )
    return;

  const player = game.players[game.me]!;
  const card = player.hand.find((entry) => entry.id === args.cardId);
  if (
    !card ||
    !legalPlacements(card, player.board).some(
      (position) => position.row === args.row && position.depth === args.depth,
    )
  )
    return;

  store.setQuery(api.games.get, queryArgs, {
    ...game,
    hasSummoned: true,
    players: game.players.map((entry, index) =>
      index === game.me
        ? {
            ...entry,
            board: [
              ...entry.board,
              {
                cardId: card.id,
                card,
                row: args.row,
                depth: args.depth,
                hp: card.health,
              },
            ],
          }
        : entry,
    ),
  });
}
