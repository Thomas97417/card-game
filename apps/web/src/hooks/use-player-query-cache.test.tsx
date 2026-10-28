import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConvexQueryClient, convexQuery } from "@convex-dev/react-query";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import type { ConvexReactClient } from "convex/react";
import { getFunctionName } from "convex/server";
import type { FunctionReference } from "convex/server";
import { api } from "@my-better-t-app/backend/convex/_generated/api";
import { resolveCard } from "@sylve/game";
import { PLAYER_QUERY_OPTIONS } from "./use-player-query-cache";

function liveQueryClient() {
  const values = new Map<string, unknown>();
  const listeners = new Map<string, Set<() => void>>();
  const pending = new Map<string, ((value: unknown) => void)[]>();
  const convex = {
    query: vi.fn((reference: FunctionReference<"query">) => {
      const name = getFunctionName(reference);
      if (values.has(name)) return Promise.resolve(values.get(name));
      return new Promise((resolve) => {
        pending.set(name, [...(pending.get(name) ?? []), resolve]);
      });
    }),
    watchQuery: vi.fn((reference: FunctionReference<"query">) => {
      const name = getFunctionName(reference);
      return {
        localQueryResult: () => values.get(name),
        onUpdate: (callback: () => void) => {
          const callbacks = listeners.get(name) ?? new Set();
          callbacks.add(callback);
          listeners.set(name, callbacks);
          return () => callbacks.delete(callback);
        },
      };
    }),
  };
  const bridge = new ConvexQueryClient(convex as unknown as ConvexReactClient);
  const client = new QueryClient({
    defaultOptions: { queries: { queryFn: bridge.queryFn(), queryKeyHashFn: bridge.hashFn(), retry: false } },
  });
  bridge.connect(client);
  return {
    client,
    convex,
    listeners,
    push(value: unknown) {
      const name = getFunctionName(api.collection.list);
      values.set(name, value);
      for (const resolve of pending.get(name) ?? []) resolve(value);
      pending.delete(name);
      for (const callback of listeners.get(name) ?? []) callback();
    },
    dispose() { client.clear(); bridge.unsubscribe?.(); },
  };
}

const collectionOptions = { ...convexQuery(api.collection.list, {}), ...PLAYER_QUERY_OPTIONS };
function Collection() {
  const { data } = useQuery(collectionOptions);
  return <output aria-label="Collection">{data ? `${data[0]?.card.level}:${data[0]?.copies}` : "Chargement"}</output>;
}
const owned = (level: number, copies: number) => [{ card: resolveCard("fox:rare", level), copies }];
let cache: ReturnType<typeof liveQueryClient>;
afterEach(() => { cleanup(); cache?.dispose(); });

describe("live player query cache", () => {
  it("keeps the Convex subscription while away and shows the latest cached collection immediately on return", async () => {
    cache = liveQueryClient();
    cache.push(owned(1, 100));
    const view = (show: boolean) => (
      <QueryClientProvider client={cache.client}>{show ? <Collection /> : <div>Village</div>}</QueryClientProvider>
    );
    const { rerender } = render(view(true));
    await waitFor(() => expect(screen.getByLabelText("Collection").textContent).toBe("1:100"));
    rerender(view(false));
    expect(cache.listeners.get("collection:list")?.size).toBe(1);
    act(() => cache.push(owned(2, 80)));
    rerender(view(true));
    expect(screen.getByLabelText("Collection").textContent).toBe("2:80");
    expect(cache.convex.query).toHaveBeenCalledOnce();
    expect(cache.convex.watchQuery).toHaveBeenCalledOnce();
    act(() => cache.push(owned(3, 60)));
    await waitFor(() => expect(screen.getByLabelText("Collection").textContent).toBe("3:60"));
  });

  it("waits for real data on a cold visit instead of caching a fabricated empty collection", async () => {
    cache = liveQueryClient();
    render(<QueryClientProvider client={cache.client}><Collection /></QueryClientProvider>);
    expect(screen.getByLabelText("Collection").textContent).toBe("Chargement");
    await act(async () => cache.push(owned(1, 100)));
    await waitFor(() => expect(screen.getByLabelText("Collection").textContent).toBe("1:100"));
  });

  it("releases the retained Convex subscription when the session cache is cleared", async () => {
    cache = liveQueryClient();
    cache.push(owned(1, 100));
    const { unmount } = render(<QueryClientProvider client={cache.client}><Collection /></QueryClientProvider>);
    await waitFor(() => expect(screen.getByLabelText("Collection").textContent).toBe("1:100"));
    unmount();
    expect(cache.listeners.get("collection:list")?.size).toBe(1);
    cache.client.clear();
    expect(cache.listeners.get("collection:list")?.size).toBe(0);
    cache.push(owned(2, 80));
    expect(cache.client.getQueryData(collectionOptions.queryKey)).toBeUndefined();
  });
});
