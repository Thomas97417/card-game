import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  missionPeriod,
  type MissionPeriodKind,
  type MissionTrack,
  type MissionView,
} from "@sylve/game/missions";
import { showGameError } from "@/components/game/shared";
import { api } from "@my-better-t-app/backend/convex/_generated/api";
import { VillageHub } from "@/components/hub/village-hub";
import { CurrencyGainProvider } from "@/components/currency-gain";
import { useMineBoard, useMineCollection } from "@/hooks/use-mine-collection";
import { requireGameAuth } from "@/lib/game-auth";
import {
  ChestRevealDialog,
  type ChestReveal,
} from "@/components/play/chest-reveal-dialog";

export const Route = createFileRoute("/hub")({
  beforeLoad: ({ context, location }) =>
    requireGameAuth(context.isAuthenticated, location.href),
  head: () => ({
    meta: [
      { title: "Le refuge des gardiens — Sylve" },
      {
        name: "description",
        content:
          "Retrouve ton refuge : prépare tes decks à l’atelier, découvre les créatures du sanctuaire et rejoins l’arène.",
      },
    ],
    links: [
      { rel: "preload", as: "image", href: "/art/guardian-village-mines.webp" },
    ],
  }),
  component: HubPage,
});

function HubPage() {
  return (
    <CurrencyGainProvider>
      <HubContent />
    </CurrencyGainProvider>
  );
}

function HubContent() {
  const [now, setNow] = useState(Date.now);
  const [pending, setPending] = useState<string | null>(null);
  const [reward, setReward] = useState<ChestReveal | null>(null);
  const mines = useMineBoard(now);
  const { pending: pendingMines, collectResource } = useMineCollection(mines);
  const ensureMines = useMutation(api.collection.ensureMines);
  const inFlight = useRef(false);
  const board = useQuery(api.missions.board, {
    refreshKey: missionPeriod("daily", now).key,
  });
  const claim = useMutation(api.missions.claim);
  const openChest = useMutation(api.missions.openChest);
  const activity = useQuery(api.games.activity);
  const ensureStarter = useMutation(api.decks.ensureStarter);
  useEffect(() => {
    void ensureStarter().then(() => ensureMines()).catch(showGameError);
  }, [ensureStarter, ensureMines]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  async function claimMission(mission: MissionView) {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(mission.id);
    try {
      const result = await claim({
        missionId: mission.id,
        periodKey: mission.periodKey,
        tier: mission.tier,
      });
      if (!result.alreadyClaimed)
        toast.success(
          `+${result.amount} ${result.currency === "emeralds" ? "émeraudes · Palier suivant débloqué !" : "sceaux de mission"}`,
        );
    } catch (error) {
      showGameError(error);
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  }

  async function openMissionChest(
    kind: MissionPeriodKind,
    track: MissionTrack,
    index: number,
  ) {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(`${kind}-chest-${index}`);
    try {
      setReward(await openChest({ kind, periodKey: track.key, index }));
    } catch (error) {
      showGameError(error);
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  }

  return (
    <>
      <VillageHub
        activity={activity}
        mines={{ board: mines, pending: pendingMines, onCollect: collectResource }}
        missions={{
          board,
          now,
          pending,
          onClaim: claimMission,
          onOpenChest: openMissionChest,
        }}
      />
      <ChestRevealDialog reward={reward} onClose={() => setReward(null)} />
    </>
  );
}
