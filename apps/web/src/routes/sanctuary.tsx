import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "@my-better-t-app/backend/convex/_generated/api";
import { Sanctuary } from "@/components/sanctuary/sanctuary";
import { useEmeraldBalance } from "@/components/emerald-balance";
import { showGameError } from "@/components/game/shared";
import { requireGameAuth } from "@/lib/game-auth";

export const Route = createFileRoute("/sanctuary")({
  beforeLoad: ({ context, location }) =>
    requireGameAuth(context.isAuthenticated, location.href),
  head: () => ({
    meta: [{ title: "Le sanctuaire — Sylve" }],
    links: [{ rel: "preload", as: "image", href: "/art/sanctuary.webp" }],
  }),
  component: SanctuaryPage,
});

function SanctuaryPage() {
  const emeralds = useEmeraldBalance();
  const latest = useQuery(api.sanctuary.latest);
  const summon = useMutation(api.sanctuary.summon);
  const chestSlots = useQuery(api.chests.list);
  const unlockChestSlot = useMutation(api.sanctuary.unlockChestSlot);
  const collection = useQuery(api.collection.list);
  const league = useQuery(api.collection.league);
  const upgrade = useMutation(api.collection.upgrade);
  const ensureStarter = useMutation(api.decks.ensureStarter);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let mounted = true;
    void ensureStarter()
      .then(() => {
        if (mounted) setReady(true);
      })
      .catch(showGameError);
    return () => {
      mounted = false;
    };
  }, [ensureStarter]);
  return (
    <Sanctuary
      emeralds={emeralds}
      ready={ready && !!chestSlots && !!league}
      peakTrophies={league?.peakTrophies}
      latest={latest}
      collection={collection}
      onSummon={summon}
      purchasedChestSlots={chestSlots?.purchasedSlots}
      onUnlockChestSlot={(slot) => unlockChestSlot({ slot })}
      onUpgrade={(variantId) => upgrade({ variantId })}
    />
  );
}
