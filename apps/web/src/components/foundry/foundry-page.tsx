import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Hammer, Sparkles, Pause, Play, Volume2, VolumeX, ArrowUpRight, Check, RotateCcw, Wifi, BookOpen, Gem } from "lucide-react";
import { api } from "@my-better-t-app/backend/convex/_generated/api";
import type { Doc } from "@my-better-t-app/backend/convex/_generated/dataModel";
import { ASSISTANTS, BLESSINGS, FOUNDRY, RELICS, ACTIVE_RELIC_KINDS, TOOLS, FOUNDRY_SKILL_IDS, FOUNDRY_RARITY,
  createFoundryRound, newFoundryCycle, foundryOrderCost, foundryStrikeCost, ownsFoundryTool, type FoundryAssistant, type FoundryInput, type FoundryTool } from "@sylve/game/foundry";
import { GameHeader } from "@/components/game-header";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { showGameError } from "@/components/game/shared";
import { FoundrySession, foundryDraftKey } from "./foundry-session";
import { FoundrySkillTree } from "./foundry-skill-tree";
import { FoundryEquipment } from "./foundry-equipment";
import type { FoundryScene } from "./foundry-scene";

const ChestRevealDialog = lazy(() => import("@/components/play/chest-reveal-dialog").then((m) => ({ default: m.ChestRevealDialog })));
type Board = FunctionReturnType<typeof api.foundry.board>;
type Audio = ReturnType<typeof import("./foundry-audio").createFoundryAudio>;
type Phase = "idle" | "countdown" | "running" | "paused";

export function FoundryPage() {
  const [refreshKey, refresh] = useState(Date.now);
  const incomingBoard = useQuery(api.foundry.board, { refreshKey });
  // GameAuthGate remounts this entire subtree when the account changes.
  // Keep its last board while a fresh time subscription is being established.
  const savedBoard = useRef<Board | undefined>(undefined);
  if (incomingBoard) savedBoard.current = incomingBoard;
  const board = incomingBoard ?? savedBoard.current;
  const ensure = useMutation(api.foundry.ensure);
  const startRound = useMutation(api.foundry.startRound);
  const submit = useMutation(api.foundry.submitInputs);
  const finish = useMutation(api.foundry.finishRound);
  const purchaseSkill = useMutation(api.foundry.purchaseSkill);
  const purchaseCharm = useMutation(api.foundry.purchaseCharm);
  const purchaseTool = useMutation(api.foundry.purchaseTool);
  const equipTool = useMutation(api.foundry.equipTool);
  const abandon = useMutation(api.foundry.abandonChantier);
  const pay = useMutation(api.foundry.payOrder);
  const choose = useMutation(api.foundry.chooseBlessing);
  const restart = useMutation(api.foundry.newChantier);
  const acknowledge = useMutation(api.foundry.acknowledgeReward);
  const upgradeCard = useMutation(api.collection.upgrade);
  const collection = useQuery(api.collection.list, board?.pendingReward ? {} : "skip");
  const [tool, setTool] = useState<FoundryTool>("mallet");
  const [assistant, setAssistant] = useState<FoundryAssistant>("smith");
  const [phase, setPhase] = useState<Phase>("idle");
  const [countdown, setCountdown] = useState(3);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [graphicsError, setGraphicsError] = useState(false);
  const [notice, setNotice] = useState("");
  const [sound, setSound] = useState(true);
  const [help, setHelp] = useState(false);
  const [equipment, setEquipment] = useState(false);
  const [tree, setTree] = useState<"tree" | "charms" | null>(null);
  const [closing, setClosing] = useState(false);
  const [, tick] = useState(0);
  const host = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const scene = useRef<FoundryScene | null>(null);
  const audio = useRef<Audio | null>(null);
  const session = useRef<FoundrySession | null>(null);
  const attachedId = useRef<string | null>(null);
  const completed = useRef(new Set<string>());
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const aim = useRef<FoundryInput>({ x: 0, z: 0, active: false });
  const preview = useRef(createFoundryRound(20261029, newFoundryCycle(), "mallet", "smith"));
  const latest = useRef({ board, tool, assistant }); latest.current = { board, tool, assistant };
  const alive = useRef(true);
  const actionLock = useRef(false);
  const localOwner = useRef<string | null>(null);

  function stopCountdown() { if (countdownTimer.current) clearInterval(countdownTimer.current); countdownTimer.current = null; }
  function pause() { stopCountdown(); aim.current.active = false; session.current?.pause(); if (session.current) setPhase("paused"); audio.current?.setHidden(true); }
  function attach(round: Doc<"foundryRounds">, ownerId: string, discardDraft = false) {
    if (session.current && attachedId.current === round._id) return;
    session.current?.destroy();
    let storage: Storage | undefined;
    try { storage = window.localStorage; if (discardDraft) storage.removeItem(foundryDraftKey(ownerId, round._id)); } catch { /* Private browsing can disable storage. */ }
    const runtime = new FoundrySession({ ownerId, roundId: round._id, state: round.state, storage,
      submit: (startTick, inputs) => submit({ expectedOwnerId: ownerId, roundId: round._id, startTick, inputs }),
      finish: () => finish({ expectedOwnerId: ownerId, roundId: round._id }),
      change: () => { if (alive.current && localOwner.current === ownerId) { tick((n) => n + 1); if (session.current?.state.ended && !session.current.settled) setPhase("paused"); } },
      impact: (frame) => scene.current?.impact(frame),
      finished: () => {
        completed.current.add(round._id);
        if (alive.current && localOwner.current === ownerId) { session.current?.destroy(); session.current = null; attachedId.current = null; setPhase("idle"); }
      },
      error: (message) => { if (alive.current && localOwner.current === ownerId) { setNotice(message); setPhase("paused"); } },
    });
    session.current = runtime; attachedId.current = round._id; setPhase("paused");
    setTool(round.state.tool); setAssistant(round.state.assistant);
  }
  function attachedSession(id: string) { return attachedId.current === id ? session.current : null; }
  function begin() {
    if (!session.current || !ready || graphicsError) return;
    stopCountdown(); setNotice(""); audio.current?.unlock(); audio.current?.setHidden(false);
    setCountdown(3); setPhase("countdown"); let remaining = 3;
    countdownTimer.current = setInterval(() => {
      remaining--; setCountdown(remaining);
      if (!remaining) { stopCountdown(); session.current?.resume(performance.now()); setPhase(session.current?.state.ended ? "paused" : "running"); stage.current?.focus(); }
    }, 1000);
  }
  useEffect(() => {
    if (!board) return;
    if (localOwner.current && localOwner.current !== board.ownerId) {
      stopCountdown(); session.current?.destroy(); session.current = null; attachedId.current = null; completed.current.clear(); setPhase("idle"); setTool("mallet"); setAssistant("smith");
    }
    localOwner.current = board.ownerId;
    if (!board.progress) void ensure({ expectedOwnerId: board.ownerId }).catch(showGameError);
    if (board.round && !completed.current.has(board.round._id) && attachedId.current !== board.round._id) attach(board.round, board.ownerId);
    if (!board.round && session.current && !session.current.saving) { session.current.destroy(); session.current = null; attachedId.current = null; setPhase("idle"); }
    if (!board.round && !session.current && board.progress) {
      const selected = board.progress.cycle.selectedTool ?? "mallet";
      setTool(ownsFoundryTool(board.progress.cycle, board.progress.mastery, selected) ? selected : "mallet");
    }
  }, [board, ensure]);
  useEffect(() => {
    const saved = latest.current.board?.progress;
    if (!session.current) preview.current = createFoundryRound(20261029, saved?.cycle ?? newFoundryCycle(), tool, assistant, saved?.charms ?? []);
  }, [tool, assistant, board?.progress]);
  useEffect(() => {
    alive.current = true; let cancelled = false; let localScene: FoundryScene | null = null; let localAudio: Audio | null = null;
    try { setSound(localStorage.getItem("sylve.foundry.sound") !== "off"); } catch { /* Use default sound preference. */ }
    void Promise.all([import("./foundry-scene"), import("./foundry-audio")]).then(([graphics, sounds]) => {
      if (cancelled || !host.current) return;
      try {
        localAudio = sounds.createFoundryAudio(); audio.current = localAudio;
        try { localAudio.setEnabled(localStorage.getItem("sylve.foundry.sound") !== "off"); } catch { /* Default enabled. */ }
        localScene = graphics.createFoundryScene(host.current, {
          state: () => session.current?.state ?? preview.current,
          input: () => aim.current,
          active: () => session.current?.running ?? false,
          frame: (now) => session.current?.advance(now, aim.current),
          sound: (critical, broken) => audio.current?.play(critical, broken),
          contextLost: () => { session.current?.pause(); setReady(false); setGraphicsError(true); setPhase(session.current ? "paused" : "idle"); },
        });
        scene.current = localScene; setReady(true);
      } catch { localAudio?.destroy(); setGraphicsError(true); }
    }).catch(() => { if (!cancelled) setGraphicsError(true); });
    const hidden = () => { if (document.hidden) pause(); else refresh(Date.now()); };
    const leaving = () => { session.current?.pause(); };
    const offline = () => { pause(); setNotice("Connexion interrompue. Ta manche est en pause et tes frappes sont conservées sur cet appareil."); };
    document.addEventListener("visibilitychange", hidden); window.addEventListener("pagehide", leaving); window.addEventListener("offline", offline);
    const timer = setInterval(() => refresh(Date.now()), 30_000);
    return () => {
      cancelled = true; alive.current = false; stopCountdown(); clearInterval(timer);
      session.current?.pause(); session.current?.destroy(); session.current = null; attachedId.current = null;
      document.removeEventListener("visibilitychange", hidden); window.removeEventListener("pagehide", leaving); window.removeEventListener("offline", offline);
      localScene?.destroy(); localAudio?.destroy(); scene.current = null; audio.current = null;
    };
  }, []);
  async function action(fn: (board: Board) => Promise<unknown>) {
    const current = latest.current.board;
    if (!current || actionLock.current) return;
    actionLock.current = true; setBusy(true); setNotice("");
    try { await fn(current); } catch (error) { if (localOwner.current === current.ownerId) showGameError(error); }
    finally { actionLock.current = false; if (alive.current) setBusy(false); }
  }
  async function start() {
    audio.current?.unlock();
    await action(async (current) => {
      if (!current.progress) return;
      const round = await startRound({ expectedOwnerId: current.ownerId, revision: current.progress.revision, requestId: crypto.randomUUID(), tool, assistant });
      if (!alive.current || localOwner.current !== current.ownerId) return;
      if (!attachedSession(round._id)) attach(round, current.ownerId);
      begin();
    });
  }
  const progress = board?.progress; const cycle = progress?.cycle;
  const runtime = session.current; const live = runtime?.state;
  const inRound = !!board?.round || !!runtime;
  const locked = busy || inRound || !!cycle?.choices.length || cycle?.status !== "active";
  const orderCost = cycle ? foundryOrderCost(cycle) : undefined;
  const dailyProgress = Math.min(3, board?.daily.delivered ?? 0);
  const endState = cycle?.status === "failed" || cycle?.status === "abandoned" || (cycle?.status === "completed" && !cycle.choices.length);
  function revision(current: Board) { return { expectedOwnerId: current.ownerId, revision: current.progress!.revision }; }
  function move(event: React.PointerEvent<HTMLDivElement>) {
    if (event.target !== host.current && !(event.target instanceof HTMLCanvasElement) && !event.currentTarget.hasPointerCapture?.(event.pointerId)) { aim.current.active = false; return; }
    if (event.pointerType !== "mouse" && !event.buttons) return;
    const next = scene.current?.aim(event.clientX, event.clientY);
    if (next && (next.active || (session.current?.state.version ?? FOUNDRY.version) < 5)) aim.current = next;
  }
  function keys(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") { event.preventDefault(); pause(); return; }
    const directions: Record<string, [number, number]> = { ArrowLeft: [-0.28, 0], ArrowRight: [0.28, 0], ArrowUp: [0, -0.28], ArrowDown: [0, 0.28] };
    const direction = directions[event.key]; if (!direction || !runtime?.running) return;
    event.preventDefault(); aim.current = scene.current?.nudge(aim.current, direction[0], direction[1]) ?? aim.current;
  }
  return (
    <main className="foundry-page" data-phase={phase} data-in-round={inRound}>
      <img className="foundry-background" src="/art/foundry-interior-v1.webp" alt="" aria-hidden="true" draggable={false} />
      <div className="foundry-background-shade" aria-hidden="true" />
      {!inRound && <><GameHeader />
      <div className="foundry-heading">
        <div><span className="foundry-eyebrow">L’art du feu et du vivant</span><h1>La Fonderie des Échos</h1><p>Brise les reliques. Honore les commandes. Fais vibrer le refuge.</p></div>
        <div className="foundry-meta"><span title={`${Math.max(0, (progress?.mastery ?? 0) - (progress?.masterySpent ?? 0))} points disponibles pour les talismans`}><Sparkles size={15} /><strong>{progress?.mastery ?? 0}</strong> maîtrise</span><button type="button" onClick={() => { pause(); setHelp(true); }} aria-expanded={help}><BookOpen size={16} /> Guide</button></div>
      </div></>}

      <div className="foundry-layout">
        <section className="foundry-play-column" aria-label="Établi de la fonderie">
          <div className="foundry-viewport" ref={stage} tabIndex={0} role="application" aria-label="Établi en trois dimensions. Déplace la souris ou les flèches pour frapper. Échap pour mettre en pause."
            onKeyDown={keys} onPointerMove={move} onPointerDown={(e) => { if (e.target !== host.current && !(e.target instanceof HTMLCanvasElement)) return; e.currentTarget.setPointerCapture(e.pointerId); move(e); }}
            onPointerUp={(e) => { if (e.pointerType !== "mouse") aim.current.active = false; }} onPointerCancel={() => { aim.current.active = false; }} onLostPointerCapture={() => { aim.current.active = false; }} onPointerLeave={(e) => { if (e.pointerType === "mouse") aim.current.active = false; }}>
            <div className="foundry-canvas" ref={host} />
            <div className="foundry-stage-top"><span className="foundry-stage-label"><span className={phase === "running" ? "is-lit" : ""} />{phase === "running" ? "La forge résonne" : "L’établi des anciens"}</span><button type="button" aria-label={sound ? "Couper le son" : "Activer le son"} onClick={() => { const next = !sound; setSound(next); audio.current?.setEnabled(next); audio.current?.unlock(); try { localStorage.setItem("sylve.foundry.sound", next ? "on" : "off"); } catch { /* Optional preference. */ } }}>{sound ? <Volume2 size={17} /> : <VolumeX size={17} />}</button></div>
            {live && <div className="foundry-run-hud"><div><span>Stamina</span><strong>{Math.max(0, Math.ceil(live.concentration))}<small> / {live.stats.concentration}</small></strong><div className="foundry-focus-track" role="progressbar" aria-label="Stamina" aria-valuemin={0} aria-valuemax={live.stats.concentration} aria-valuenow={Math.max(0, live.concentration)}><i style={{ width: `${live.concentration / live.stats.concentration * 100}%` }} /></div>{live.version >= 6 && <span className="foundry-strike-cost">{new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 3 }).format(foundryStrikeCost(live))} stamina / coup</span>}</div><div className="foundry-run-shards"><Gem size={18} /><strong>{live.shards}</strong><span>éclats</span></div></div>}
            {live?.rogue && <div className="foundry-active-effects" aria-live="polite">{live.rogue.frenzyUntil > live.tick && <span className="is-fury">ϟ Fureur · {((live.rogue.frenzyUntil - live.tick) / 20).toFixed(1)} s</span>}{live.rogue.frozenUntil > live.tick && <span className="is-frozen">❄ Gel · {((live.rogue.frozenUntil - live.tick) / 20).toFixed(1)} s</span>}{live.rogue.burns.length > 0 && <span>♨ {live.rogue.burns.length} reliques embrasées</span>}{live.rogue.jackpots > 0 && <span>✦ {live.rogue.jackpots} jackpots</span>}</div>}
            {!ready && !graphicsError && <div className="foundry-curtain"><span className="foundry-loading-orb" /><p>Les braises s’éveillent…</p></div>}
            {graphicsError && <div className="foundry-curtain"><Hammer size={34} /><h2>L’établi 3D est indisponible</h2><p>La fonderie a besoin de WebGL 2. Essaie un navigateur récent avec l’accélération graphique activée.</p><Link to="/hub" className="foundry-primary">Retour au refuge</Link></div>}
            {ready && phase === "idle" && !inRound && <div className="foundry-intro-overlay"><span className="foundry-stamp"><Hammer size={24} /></span><h2>{endState ? cycle?.status === "completed" ? "Un refuge qui rayonne" : "Chaque écho nous apprend" : "À chaque frappe, un nouvel écho"}</h2><p>{endState ? cycle?.status === "completed" ? "Les cinq commandes sont livrées. Tes outils et ta maîtrise t’accompagnent pour la suite." : "Le chantier est clos. Tes outils et ta maîtrise restent acquis." : "Les reliques attendent ton marteau. Choisis ton outil, puis entre dans la danse."}</p><button type="button" className="foundry-primary" disabled={locked || !cycle?.roundsLeft} onClick={start}><Play size={16} />{busy ? "Préparation…" : "Commencer une manche"}</button><span className="foundry-controls-hint">Souris · doigt maintenu · flèches</span></div>}
            {phase === "countdown" && <div className="foundry-countdown" aria-live="assertive"><strong key={countdown}>{countdown}</strong><span>Prépare ton marteau</span></div>}
            {phase === "paused" && ready && <div className="foundry-curtain foundry-pause"><Pause size={26} /><h2>{live?.ended ? "Les derniers éclats se déposent" : "Un souffle entre deux frappes"}</h2><p>{runtime?.saving ? "Sauvegarde de la manche en cours…" : notice || "La stamina et les échéances sont en pause."}</p><button type="button" className="foundry-primary" onClick={begin} disabled={!!runtime?.saving}><Play size={16} />{live?.ended ? "Terminer la sauvegarde" : "Reprendre la manche"}</button>{notice && board?.round && <button type="button" className="foundry-quiet" onClick={() => { session.current?.destroy(); session.current = null; attachedId.current = null; attach(board.round!, board.ownerId, true); setNotice(""); }}>Reprendre la sauvegarde du serveur</button>}</div>}
            {phase === "running" && <button type="button" className="foundry-pause-button" onClick={pause}><Pause size={16} /> Pause</button>}
            {phase === "idle" && ready && <div className="foundry-viewport-caption">Pierre ancienne, cuivre vivant, savoir oublié.</div>}
          </div>
          <div className="foundry-under-stage"><span><Wifi size={13} />{runtime?.saving ? "Sauvegarde…" : inRound ? "Manche sauvegardée au fil des frappes" : "Progression sauvegardée"}</span><span>{live ? `${live.broken} reliques · ${live.criticals} critiques` : "Des manches courtes, des choix qui comptent"}</span></div>

          {!inRound && <div className="foundry-preparation"><button type="button" aria-label="Choisir les outils et compagnons" disabled={inRound || busy} onClick={() => setEquipment(true)}><Hammer size={17} /><span><strong>{TOOLS[tool].name}</strong><small>Marteaux à acheter et compagnons</small></span><img src={`/art/characters/${ASSISTANTS[assistant].art}.webp`} alt={ASSISTANTS[assistant].short} /><ArrowUpRight size={15} /></button></div>}
          {!inRound && <button type="button" className="foundry-mobile-orders" onClick={() => { pause(); sidebar.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" }); }}>Commandes et améliorations <ArrowUpRight size={14} /></button>}
        </section>
        {!inRound && <aside className="foundry-sidebar" ref={sidebar} aria-label="Commandes et améliorations">
          <section className="foundry-order"><div className="foundry-section-title"><span>Chantier {cycle?.number ?? 1}</span><span>{Math.min(5, cycle?.orderIndex ?? 0)} / 5 livrées</span></div><div className="foundry-shard-total"><Gem size={23} /><strong>{cycle?.shards ?? 0}</strong><span>éclats disponibles</span></div>
            <div className="foundry-order-divider" />
            <span className="foundry-eyebrow">Une commande du refuge</span><h2>{endState ? cycle?.status === "completed" ? "Le cœur du refuge s’éveille" : "Le feu s’est assoupi" : FOUNDRY.orders[cycle?.orderIndex ?? 0] ?? "Dernière bénédiction"}</h2>
            <p>{endState ? "Ouvre un nouveau chantier avec tes outils permanents." : "Les gardiens comptent sur les éclats que tu libères."}</p>
            {orderCost !== undefined && <><div className="foundry-order-price"><span>À livrer</span><b>{orderCost}<Gem size={15} /></b></div><div className="foundry-order-track"><i style={{ width: `${Math.min(100, (cycle?.shards ?? 0) / orderCost * 100)}%` }} /></div><div className={`foundry-deadline ${cycle?.roundsLeft === 0 ? "is-urgent" : ""}`}>{cycle?.roundsLeft === 0 ? "Échéance atteinte · livre avant de continuer" : `${cycle?.roundsLeft ?? 2} manches avant l’échéance`}</div></>}
            {endState ? <button type="button" className="foundry-primary" disabled={busy} onClick={() => action((b) => restart(revision(b)))}><RotateCcw size={15} /> Nouveau chantier</button> : <button type="button" className="foundry-primary" disabled={locked || orderCost === undefined || (cycle?.shards ?? 0) < orderCost} onClick={() => action((b) => pay({ ...revision(b), cycleNumber: b.progress!.cycle.number, orderIndex: b.progress!.cycle.orderIndex }))}>Livrer la commande <ArrowUpRight size={16} /></button>}
          </section>
          {progress?.lastSummary && !inRound && <div className="foundry-summary" role="status"><Sparkles size={22} /><div><strong>Dernière récolte</strong><span>{progress.lastSummary.broken} reliques · {progress.lastSummary.criticals} critiques · {Math.round(progress.lastSummary.seconds)} secondes</span></div><b>+{progress.lastSummary.shards}<small> éclats</small></b></div>}
          <section className="foundry-daily"><img src="/art/chests/common.webp" onError={(e) => { e.currentTarget.src = "/art/ui/rewards-gift.webp"; }} alt="" /><div><span className="foundry-eyebrow">Le présent du refuge</span><h2>{board?.daily.claimed ? "Ton coffre est reçu" : "Un coffre, chaque jour"}</h2><p>{board?.daily.claimed ? "La forge reste ouverte pour ta maîtrise." : `${dailyProgress} / 3 commandes livrées aujourd’hui`}</p><div className="foundry-daily-dots" aria-label={`${dailyProgress} commandes sur trois`}>{[1, 2, 3].map((n) => <i key={n} className={dailyProgress >= n ? "is-complete" : ""}>{dailyProgress >= n && <Check size={11} />}</i>)}</div><small>Réinitialisation à minuit · heure de Paris</small></div></section>
          <section className="foundry-build-panel"><span className="foundry-eyebrow">Un build pour ce chantier</span><h2>Les voies de l’Écho</h2><p>{cycle?.skills?.length ?? 0} / {FOUNDRY_SKILL_IDS.length} savoirs appris · {cycle?.blessings.length ?? 0} bénédictions</p><div className="foundry-build-branches" aria-hidden="true"><span>◆</span><span>❋</span><span>ϟ</span><span>✦</span><span>◎</span></div><button type="button" className="foundry-primary" disabled={!cycle} onClick={() => { pause(); setTree("tree"); }}>Ouvrir l’arbre de compétences <ArrowUpRight size={15} /></button><button type="button" className="foundry-mastery-button" disabled={!cycle} onClick={() => { pause(); setTree("charms"); }}><Sparkles size={15} /><span>Talismans permanents<small>{progress?.charms?.length ?? 0} acquis · {Math.max(0, (progress?.mastery ?? 0) - (progress?.masterySpent ?? 0))} points disponibles</small></span><ArrowUpRight size={14} /></button></section>
          {!!cycle?.blessings.length && <section className="foundry-blessings"><h2>Les échos qui t’accompagnent</h2><div>{cycle.blessings.map((id, i) => <span key={`${id}-${i}`} title={BLESSINGS[id].detail}>{BLESSINGS[id].symbol}<small>{BLESSINGS[id].name}</small></span>)}</div></section>}
          {cycle?.status === "active" && <button type="button" className="foundry-close-cycle" disabled={inRound || busy || !!cycle.choices.length} onClick={() => setClosing(true)}>Clore ce chantier et préparer le suivant</button>}
          <p className="foundry-lore">« Chaque relique porte un souvenir. À toi de lui rendre sa voix. »<span>— Le Forgeron de la citadelle</span></p>
        </aside>}
      </div>
      {!inRound && tree && cycle && <FoundrySkillTree key={tree} open onOpenChange={(open) => { if (!open) setTree(null); }} initialTab={tree} cycle={cycle} mastery={progress?.mastery ?? 0} masterySpent={progress?.masterySpent ?? 0} charms={progress?.charms ?? []} locked={locked} busy={busy} inRound={inRound} onSkill={(skill) => action((b) => purchaseSkill({ ...revision(b), skill }))} onCharm={(charm) => action((b) => purchaseCharm({ ...revision(b), charm }))} />}
      <Dialog open={closing && !inRound} onOpenChange={setClosing}><DialogContent className="foundry-preparation-dialog"><DialogTitle>Transmettre ce savoir</DialogTitle><p className="foundry-dialog-intro">Les éclats, savoirs et bénédictions de ce chantier seront perdus. Tu conserves ta maîtrise, tes outils et tes talismans pour le prochain essai.</p><button type="button" className="foundry-primary" disabled={busy} onClick={() => action(async (b) => { await abandon(revision(b)); setClosing(false); })}>Clore le chantier</button><button type="button" className="foundry-quiet" onClick={() => setClosing(false)}>Continuer ce chantier</button></DialogContent></Dialog>
      <Dialog open={help && !inRound} onOpenChange={setHelp}>
        <DialogContent className="foundry-preparation-dialog"><DialogTitle>Les gestes de l’artisan</DialogTitle>
          <section className="foundry-guide" aria-label="Guide de la fonderie"><p><strong>Le marteau frappe à sa cadence, même dans le vide.</strong> Déplace la souris ou glisse le doigt pour viser. Les flèches déplacent aussi la visée. Chaque coup consomme de la stamina, même dans le vide. Elle ne diminue pas entre les frappes. La manche continue tant qu’il en reste : les améliorations de récupération peuvent la prolonger. Le maillet commence à 1 dégât hors critique ; les améliorations renforcent ensuite ses frappes. Échap met en pause.</p><p>Chaque commande te donne trois manches. Entre deux manches, dépense tes éclats dans les marteaux du chantier ou les cinq voies de l’arbre, ou garde-les pour la livraison. Les marteaux achetés sont conservés jusqu’à la clôture du chantier ; les outils du refuge restent débloqués pour toujours. Chaque livraison propose trois bénédictions, dont une technique. Certains pactes donnent un bonus en échange d’un malus. Les savoirs et bénédictions durent ce chantier ; la maîtrise, les outils et les talismans restent acquis.</p><div>{ACTIVE_RELIC_KINDS.map((id) => <span key={id}><i style={{ background: `#${RELICS[id].color.toString(16)}` }} /><strong>{RELICS[id].name}</strong> · {RELICS[id].detail}</span>)}</div></section>
        </DialogContent>
      </Dialog>
      <Dialog open={equipment && !inRound} onOpenChange={setEquipment}>
        <DialogContent className="foundry-preparation-dialog foundry-equipment-dialog"><DialogTitle>Préparer la manche</DialogTitle><p className="foundry-dialog-intro">Investis tes éclats dans un marteau, puis choisis ton compagnon.</p>
          {cycle && <FoundryEquipment cycle={cycle} mastery={progress?.mastery ?? 0} charms={progress?.charms ?? []} tool={tool} assistant={assistant} assistants={board?.availableAssistants ?? []} locked={locked || !cycle.roundsLeft}
            onTool={(id, purchase) => action(async (b) => { await (purchase ? purchaseTool : equipTool)({ ...revision(b), tool: id }); setTool(id); })} onAssistant={setAssistant} />}
          <button type="button" className="foundry-primary" onClick={() => setEquipment(false)}>Prêt pour la forge <Check size={16} /></button>
        </DialogContent>
      </Dialog>
      {notice && phase !== "paused" && <p className="foundry-notice" role="status">{notice}</p>}
      <Dialog open={!inRound && !!cycle?.choices.length && !board?.pendingReward} onOpenChange={() => {}}>
        <DialogContent className="foundry-blessing-popup" showCloseButton={false}>
          <section className="foundry-blessing-dialog"><span className="foundry-eyebrow">Une commande honorée, un savoir partagé</span><DialogTitle>Le refuge te remercie</DialogTitle><p>Choisis une bénédiction pour ce chantier.</p><div>{cycle?.choices.map((id) => <button type="button" autoFocus={id === cycle.choices[0]} key={id} disabled={busy} onClick={() => action((b) => choose({ ...revision(b), blessing: id }))}><small className={`foundry-perk-rarity rarity-${BLESSINGS[id].rarity}`}>{FOUNDRY_RARITY[BLESSINGS[id].rarity].name} · {BLESSINGS[id].kind === "pact" ? "Pacte" : BLESSINGS[id].kind === "technique" ? "Technique" : "Renfort"}</small><b>{BLESSINGS[id].symbol}</b><strong>{BLESSINGS[id].name}</strong><span>{BLESSINGS[id].detail}</span><small className="foundry-perk-level">{BLESSINGS[id].maxStacks > 1 ? `Niveau ${1 + (cycle.blessings.filter((owned) => owned === id).length)} / ${BLESSINGS[id].maxStacks}` : "Effet unique pour ce chantier"}</small></button>)}</div></section>
        </DialogContent>
      </Dialog>
      {!inRound && board?.pendingReward?.receipt && <Suspense fallback={<div className="foundry-modal-backdrop"><p>Le coffre du refuge s’ouvre…</p></div>}><ChestRevealDialog reward={board.pendingReward.receipt} collection={collection} onUpgrade={(variantId) => upgradeCard({ variantId })} onClose={() => action((b) => acknowledge({ expectedOwnerId: b.ownerId, rewardId: b.pendingReward!._id }))} /></Suspense>}
    </main>
  );
}
