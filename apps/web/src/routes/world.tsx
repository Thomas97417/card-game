import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { lazy, useEffect, useRef, useState } from "react";
import { api } from "@my-better-t-app/backend/convex/_generated/api";
import type { Id } from "@my-better-t-app/backend/convex/_generated/dataModel";
import { requireGameAuth } from "@/lib/game-auth";
import { stylesheet } from "@/lib/stylesheet";
import { WorldMap } from "@/components/campaign/world-map";
import { showGameError } from "@/components/game/shared";
import { DeferredContent } from "@/components/deferred-content";
import { DialogLoading } from "@/components/dialog-loading";
import type { ChestReveal } from "@/components/play/chest-reveal-dialog";
import worldCss from "@/world.css?url";

const ChestRevealDialog = lazy(() => import("@/components/play/chest-reveal-dialog")
  .then((module) => ({ default: module.ChestRevealDialog })));

export const Route = createFileRoute("/world")({
  beforeLoad: ({ context, location }) => requireGameAuth(context.isAuthenticated, location.href),
  head: () => ({
    meta: [{ title: "La carte du monde — Sylve" }, { name: "description", content: "Quitte la Sylve et explore quatre régions : quarante combats et des trésors à découvrir." }],
    links: [stylesheet(worldCss), { rel: "preload", as: "image", href: "/art/campaign/world-map.webp" }],
  }),
  component: WorldPage,
});

function WorldPage() {
  const navigate = Route.useNavigate();
  const board = useQuery(api.games.campaignBoard, {});
  const activity = useQuery(api.games.activity, {});
  const decks = useQuery(api.decks.list, {});
  const deck = decks?.[0];
  const ensureStarter = useMutation(api.decks.ensureStarter);
  const start = useMutation(api.games.createCampaign);
  const openChest = useMutation(api.games.openCampaignChest);
  const upgrade = useMutation(api.collection.upgrade);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const [reward, setReward] = useState<ChestReveal | null>(null);
  const collection = useQuery(api.collection.list, reward ? {} : "skip");
  useEffect(() => { void ensureStarter().catch(showGameError); }, [ensureStarter]);

  async function launch(region: number, stage: number) {
    if (busy.current || !deck) return;
    busy.current = true;
    setPending(true);
    try {
      const gameId = await start({ deckId: deck._id, region, stage });
      await navigate({ to: "/game/$gameId", params: { gameId } });
    } catch (error) { showGameError(error); }
    finally { busy.current = false; setPending(false); }
  }
  async function reveal(chestId: Id<"campaignChests">) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    try { setReward(await openChest({ chestId })); }
    catch (error) { showGameError(error); }
    finally { busy.current = false; setPending(false); }
  }

  return <>
    <WorldMap board={board} activity={activity} deckReady={!!deck} pending={pending} onStart={launch} onOpenChest={reveal} />
    <DeferredContent active={reward !== null} fallback={<DialogLoading title="Ton coffre d’aventure" onClose={() => setReward(null)} />}>
      <ChestRevealDialog reward={reward} collection={collection} onUpgrade={(variantId) => upgrade({ variantId })} onClose={() => setReward(null)} />
    </DeferredContent>
  </>;
}
