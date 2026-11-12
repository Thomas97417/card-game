import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useConvex, useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  ArrowRight,
  Coins,
  Heart,
  LoaderCircle,
  Pause,
  Play,
  Shield,
  Skull,
  Sparkles,
  Trophy,
  X,
} from "lucide-react";
import { api } from "@my-better-t-app/backend/convex/_generated/api";
import type { Id } from "@my-better-t-app/backend/convex/_generated/dataModel";
import {
  cemeteryStats,
  cemeteryNextChest,
  cemeterySummary,
  cemeteryWeapon,
  cemeteryPassive,
  type CemeteryRun,
  type CemeteryFrame,
  type CemeteryInput,
  type CemeteryUpgradeId,
} from "@sylve/game/cemetery";
import { chestName } from "@sylve/game/chest-types";
import { GameHeader } from "@/components/game-header";
import {
  ChestRevealDialog,
  type ChestReveal,
} from "@/components/play/chest-reveal-dialog";
import {
  CemeteryLobby,
  CemeteryGlyph,
  cemeteryTime,
  cemeteryWeaponBonus,
} from "./cemetery-lobby";
import {
  CemeterySession,
  cemeteryDraftKey,
  cemeteryError,
} from "./cemetery-session";
import { useCemeteryDialog } from "./use-cemetery-dialog";

export function CemeteryPage() {
  const board = useQuery(api.cemetery.board, {}),
    convex = useConvex(),
    ensure = useMutation(api.cemetery.ensure),
    [, redraw] = useReducer((n) => n + 1, 0);
  const [session, setSession] = useState<CemeterySession | null>(null),
    [runId, setRunId] = useState<Id<"cemeteryRuns"> | null>(null),
    [inGame, setInGame] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [reward, setReward] = useState<ChestReveal | null>(null),
    [lobbyTab, setLobbyTab] = useState<"play" | "upgrades">("play");
  const frameSink = useRef<(frame: CemeteryFrame) => void>(() => {}),
    lock = useRef(false);
  const collection = useQuery(api.collection.list, reward ? {} : "skip"),
    upgradeCard = useMutation(api.collection.upgrade);
  useEffect(() => {
    if (board && !board.progress)
      void ensure({ expectedOwnerId: board.ownerId }).catch((e) =>
        setError(cemeteryError(e)),
      );
  }, [board?.ownerId, !!board?.progress, ensure]);
  useEffect(
    () => () => {
      if (session) {
        void session.pause();
        session.destroy();
      }
    },
    [session],
  );
  useEffect(() => {
    if (
      session &&
      board &&
      session.state.heroId &&
      board.ownerId !== ownerRef.current
    ) {
      session.destroy();
      setSession(null);
      setRunId(null);
      setInGame(false);
      setError(null);
    }
  }, [board?.ownerId, session]);
  const ownerRef = useRef("");
  const retained = session && runId && board?.ownerId === ownerRef.current &&
    (!board.activeRun || board.activeRun.id === runId);
  const activeRun = retained
    ? session.state.ended ? null : {
        id: runId,
        seconds: session.state.tick / 20,
        level: session.state.level,
      }
    : board?.activeRun ?? null;
  const showGame = inGame && !!session;
  async function action(fn: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(cemeteryError(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function enter(resumeId?: Id<"cemeteryRuns">, discardDraft = false) {
    if (!lock.current && !discardDraft && resumeId === runId && retained && !session.state.ended) {
      setError(null);
      setInGame(true);
      return;
    }
    await action(async () => {
      const current = await convex.query(api.cemetery.board, {});
      if (!current.progress) return;
      const ownerId = current.ownerId;
      const record = resumeId
        ? await convex.query(api.cemetery.run, { runId: resumeId })
        : await convex.mutation(api.cemetery.startRun, {
            expectedOwnerId: ownerId,
            revision: current.progress.revision,
            requestId: crypto.randomUUID(),
            leaseId: crypto.randomUUID(),
          });
      const id = record._id;
      if (discardDraft)
        try {
          localStorage.removeItem(cemeteryDraftKey(ownerId, id));
        } catch {
          /* optional */
        }
      session?.destroy();
      ownerRef.current = ownerId;
      let storage: Storage | undefined;
      try {
        storage = window.localStorage;
      } catch {
        /* optional */
      }
      const next = new CemeterySession({
        ownerId,
        runId: id,
        leaseId: record.leaseId,
        state: record.state as CemeteryRun,
        storage,
        submit: async (leaseId, startTick, inputs) => {
          const r = await convex.mutation(api.cemetery.submitInputs, {
            expectedOwnerId: ownerId,
            runId: id,
            leaseId,
            startTick,
            inputs,
          });
          return { ...r, state: r.state as CemeteryRun };
        },
        resume: async (leaseId, expectedLeaseId, expectedTick) =>
          (
            await convex.mutation(api.cemetery.resumeRun, {
              expectedOwnerId: ownerId,
              runId: id,
              leaseId,
              expectedLeaseId,
              expectedTick,
            })
          ).state as CemeteryRun,
        pause: (leaseId, expectedTick) =>
          convex.mutation(api.cemetery.pauseRun, {
            expectedOwnerId: ownerId,
            runId: id,
            leaseId,
            expectedTick,
          }),
        choose: async (leaseId, serial, choice) =>
          (
            await convex.mutation(api.cemetery.chooseUpgrade, {
              expectedOwnerId: ownerId,
              runId: id,
              leaseId,
              serial,
              choice,
              resume: true,
            })
          ).state as CemeteryRun,
        finish: () =>
          convex.mutation(api.cemetery.finishRun, {
            expectedOwnerId: ownerId,
            runId: id,
          }),
        change: redraw,
        frame: (frame) => frameSink.current(frame),
        error: setError,
      });
      setRunId(id);
      setSession(next);
      setInGame(true);
    });
  }
  async function open(id: string) {
    await action(async () => {
      if (!board) return;
      setReward(
        await convex.mutation(api.cemetery.openReward, {
          expectedOwnerId: board.ownerId,
          runId: id as Id<"cemeteryRuns">,
        }),
      );
    });
  }
  async function buy(
    id: CemeteryUpgradeId,
    rank: number,
    currency: "gold" | "emeralds",
  ) {
    await action(async () => {
      if (board)
        await convex.mutation(api.cemetery.purchaseUpgrade, {
          expectedOwnerId: board.ownerId,
          upgrade: id,
          expectedRank: rank,
          currency,
        });
    });
  }
  function menu(tab: "play" | "upgrades" = "play") {
    // Keep the session alive while its ordered checkpoint queue drains.
    // The lobby and an immediate return use the same predicted state.
    if (session) void session.pause();
    setInGame(false);
    setLobbyTab(tab);
    setError(null);
  }
  const onFrame = useCallback((sink: (frame: CemeteryFrame) => void) => {
    frameSink.current = sink;
  }, []);
  return (
    <main className={`cemetery-page ${showGame ? "is-playing" : ""}`}>
      {!showGame && <GameHeader className="cemetery-header" />}
      {!board ? (
        <div className="cemetery-loading" role="status">
          <LoaderCircle size={28} className="animate-spin" />
          Le puits s’éveille…
        </div>
      ) : showGame && session ? (
        <CemeteryGame
          session={session}
          busy={busy}
          error={error}
          onError={setError}
          onFrame={onFrame}
          onMenu={() => void menu()}
          onImprove={() => void menu("upgrades")}
          onReplay={() => void enter()}
          onOpen={() => runId && void open(runId)}
          rewardOpened={!board.pendingRewards.some((r) => r.id === runId)}
          onReload={() => runId && void enter(runId, true)}
        />
      ) : (
        <CemeteryLobby
          key={lobbyTab}
          initialTab={lobbyTab}
          heroId={board.heroId}
          gold={board.gold}
          emeralds={board.emeralds}
          upgrades={board.progress?.upgrades ?? {}}
          bestSeconds={board.progress?.bestSeconds ?? 0}
          activeRun={activeRun}
          pendingRewards={board.pendingRewards}
          busy={busy}
          initialized={!!board.progress && !(retained && session.state.ended && !session.settled)}
          onStart={() => void enter()}
          onResume={() => activeRun && void enter(activeRun.id)}
          onAbandon={() =>
            void action(async () => {
              if (activeRun) {
                const current = retained && activeRun.id === runId ? session : null;
                if (current) await current.pause();
                await convex.mutation(api.cemetery.abandonRun, {
                  expectedOwnerId: board.ownerId,
                  runId: activeRun.id,
                });
                if (current) {
                  current.destroy();
                  setSession(null);
                  setRunId(null);
                }
              }
            })
          }
          onOpen={(id) => void open(id)}
          onBuy={(id, rank, currency) => void buy(id, rank, currency)}
        />
      )}
      {error && !showGame && (
        <div role="alert" className="cemetery-error">
          {error}
          {retained && (
            <button
              type="button"
              disabled={session.saving}
              onClick={() => {
                setError(null);
                void session.flush().catch(() => {});
              }}
            >
              Réessayer la sauvegarde
            </button>
          )}
          <button
            type="button"
            aria-label="Fermer le message"
            onClick={() => setError(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
      <ChestRevealDialog
        reward={reward}
        collection={collection}
        onUpgrade={(variantId) => upgradeCard({ variantId })}
        onClose={() => setReward(null)}
      />
    </main>
  );
}

interface GameProps {
  session: CemeterySession;
  busy: boolean;
  error: string | null;
  rewardOpened: boolean;
  onError: (e: string | null) => void;
  onFrame: (fn: (f: CemeteryFrame) => void) => void;
  onMenu: () => void;
  onImprove: () => void;
  onReplay: () => void;
  onOpen: () => void;
  onReload: () => void;
}
export function CemeteryGame({
  session,
  busy,
  error,
  rewardOpened,
  onError,
  onFrame,
  onMenu,
  onImprove,
  onReplay,
  onOpen,
  onReload,
}: GameProps) {
  const host = useRef<HTMLDivElement>(null),
    input = useRef<CemeteryInput>({ x: 0, y: 0 }),
    [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false);
  const [stick, setStick] = useState({ x: 0, y: 0 });
  const root = useRef<HTMLDivElement>(null);
  const dialogKey = session.state.ended
    ? "results"
    : session.state.choices.length
      ? `choice-${session.state.choiceSerial}`
      : (ready && !session.running) || failed
        ? "pause"
        : "";
  useCemeteryDialog(
    root,
    dialogKey
      ? dialogKey === "results" ? `${dialogKey}:${session.saving}` : dialogKey
      : "",
  );
  useEffect(() => {
    let alive = true,
      raf = 0,
      scene:
        | Awaited<
            ReturnType<
              (typeof import("./cemetery-scene"))["createCemeteryScene"]
            >
          >
        | undefined;
    const empty = () => {
      if (input.current.x || input.current.y) {
        input.current = { x: 0, y: 0 };
        setStick({ x: 0, y: 0 });
      }
    };
    void import("./cemetery-scene")
      .then(({ createCemeteryScene }) =>
        createCemeteryScene(host.current!, session.state.heroId),
      )
      .then((result) => {
        if (!alive) {
          result.destroy();
          return;
        }
        scene = result;
        onFrame((f) => result.damage(f, performance.now()));
        setReady(true);
        void session.resume(performance.now());
        const loop = (now: number) => {
          if (!alive) return;
          session.advance(now, input.current);
          result.render(session.state, now);
          if (!session.running) empty();
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      })
      .catch(() => {
        if (alive) {
          setFailed(true);
          onError(
            "Le rendu du cimetière n’a pas pu démarrer. Vérifie que l’accélération graphique est disponible, puis réessaie.",
          );
        }
      });
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      onFrame(() => {});
      scene?.destroy();
    };
  }, [session, onFrame]);
  useEffect(() => {
    const keys = new Set<string>();
    const reset = () => {
      keys.clear();
      input.current = { x: 0, y: 0 };
      setStick({ x: 0, y: 0 });
    };
    const update = () => {
      input.current = {
        x:
          (Number(["d", "arrowright"].some((k) => keys.has(k))) -
            Number(["a", "q", "arrowleft"].some((k) => keys.has(k)))) *
          1000,
        y:
          (Number(["s", "arrowdown"].some((k) => keys.has(k))) -
            Number(["w", "z", "arrowup"].some((k) => keys.has(k)))) *
          1000,
      };
    };
    const down = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === "escape") {
        if (session.running) {
          reset();
          void session.pause();
        }
        return;
      }
      if (
        !session.running ||
        ![
          "z",
          "q",
          "s",
          "d",
          "w",
          "a",
          "arrowup",
          "arrowleft",
          "arrowdown",
          "arrowright",
        ].includes(key)
      )
        return;
      e.preventDefault();
      keys.add(key);
      update();
    };
    const up = (e: KeyboardEvent) => {
      keys.delete(e.key.toLowerCase());
      update();
    };
    const hide = () => {
      if (document.visibilityState !== "visible") {
        reset();
        void session.pause();
      }
    };
    const blur = () => {
      reset();
      void session.pause();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", hide);
    return () => {
      reset();
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", hide);
    };
  }, [session]);
  const s = session.state,
    stats = cemeteryStats(s),
    seconds = s.tick / 20,
    next = cemeteryNextChest(seconds),
    summary = cemeterySummary(s);
  function moveStick(e: ReactPointerEvent<HTMLDivElement>) {
    if (!session.running || !e.currentTarget.hasPointerCapture(e.pointerId))
      return;
    const box = e.currentTarget.getBoundingClientRect(),
      x = e.clientX - box.left - box.width / 2,
      y = e.clientY - box.top - box.height / 2,
      d = Math.max(38, Math.hypot(x, y));
    setStick({ x: (x / d) * 38, y: (y / d) * 38 });
    input.current = {
      x: Math.round((x / d) * 1000),
      y: Math.round((y / d) * 1000),
    };
  }
  const resetStick = () => {
    input.current = { x: 0, y: 0 };
    setStick({ x: 0, y: 0 });
  };
  return (
    <div className="cemetery-game" ref={root}>
      <div ref={host} className="cemetery-canvas" />
      <div className="cemetery-game-top">
        <button
          type="button"
          className="cemetery-round-button"
          onClick={() => {
            void session.pause();
          }}
          aria-label="Mettre en pause"
        >
          <Pause size={20} />
        </button>
        <div className="cemetery-live-time">
          <span>SURVIE</span>
          <strong>{cemeteryTime(seconds)}</strong>
        </div>
        <span className="cemetery-kills">
          <Skull size={16} />
          {s.kills}
        </span>
      </div>
      <div className="cemetery-vitals">
        <div className="cemetery-vital">
          <Heart size={15} />
          <div
            role="progressbar"
            aria-label="Vie"
            aria-valuemin={0}
            aria-valuemax={Math.round(stats.maxHealth)}
            aria-valuenow={Math.ceil(s.health)}
          >
            <span
              style={{
                width: `${Math.max(0, (s.health / stats.maxHealth) * 100)}%`,
              }}
            />
          </div>
          <strong>
            {Math.ceil(s.health)} / {Math.round(stats.maxHealth)}
          </strong>
        </div>
        {stats.maxShield > 0 && (
          <div className="cemetery-vital is-shield">
            <Shield size={14} />
            <div
              role="progressbar"
              aria-label="Bouclier"
              aria-valuemin={0}
              aria-valuemax={stats.maxShield}
              aria-valuenow={Math.round(s.shield)}
            >
              <span
                style={{ width: `${(s.shield / stats.maxShield) * 100}%` }}
              />
            </div>
            <strong>
              {Math.round(s.shield)} / {stats.maxShield}
            </strong>
          </div>
        )}
      </div>
      <div className="cemetery-xp">
        <span style={{ width: `${Math.min(100, (s.xp / s.nextXp) * 100)}%` }} />
        <strong>Niv. {s.level}</strong>
      </div>
      <div className="cemetery-run-inventory">
        <div aria-label="Armes équipées">
          {s.weapons.map((w) => {
            const spec = cemeteryWeapon(w.id);
            return (
              <span
                key={w.id}
                title={`${w.evolved ? spec.evolvedName : spec.name} · ${w.evolved ? "Évolution" : `Niveau ${w.level}`}`}
                className={w.evolved ? "is-evolved" : ""}
              >
                <CemeteryGlyph name={spec.glyph} size={19} />
                <small>{w.evolved ? "✧" : w.level}</small>
              </span>
            );
          })}
        </div>
        <div aria-label="Objets passifs équipés">
          {s.passives.map((p) => (
            <span
              key={p.id}
              title={`${cemeteryPassive(p.id).name} · Niveau ${p.level}`}
            >
              <CemeteryGlyph name={cemeteryPassive(p.id).glyph} size={16} />
              <small>{p.level}</small>
            </span>
          ))}
        </div>
      </div>
      <div className="cemetery-run-reward">
        <img
          src={`/art/chests/${summary.rarity}.webp`}
          alt={chestName(summary.rarity)}
        />
        <div>
          <strong>{chestName(summary.rarity)}</strong>
          <span>
            {next
              ? `${chestName(next.rarity)} à ${cemeteryTime(next.at)}`
              : "Le meilleur coffre est atteint"}
          </span>
        </div>
        <span className="cemetery-run-gold">
          <Coins size={15} />
          {Math.floor(s.gold)}
        </span>
      </div>
      <div
        className="cemetery-joystick"
        aria-label="Joystick de déplacement"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          moveStick(e);
        }}
        onPointerMove={moveStick}
        onPointerUp={(e) => {
          e.currentTarget.releasePointerCapture(e.pointerId);
          resetStick();
        }}
        onPointerCancel={resetStick}
        onLostPointerCapture={resetStick}
      >
        <span style={{ transform: `translate(${stick.x}px,${stick.y}px)` }} />
      </div>
      {!ready && !failed && (
        <div className="cemetery-modal-shade">
          <div className="cemetery-loading" role="status">
            <LoaderCircle size={28} className="animate-spin" />
            Les ombres prennent forme…
          </div>
        </div>
      )}
      {s.ended ? (
        <div className="cemetery-modal-shade">
          <section
            className="cemetery-modal cemetery-results"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cemetery-result-title"
          >
            <span className="cemetery-eyebrow">LA NUIT A EU RAISON DE TOI</span>
            <h2 id="cemetery-result-title">Les ombres se souviendront.</h2>
            <strong className="cemetery-result-time">
              {cemeteryTime(summary.seconds)}
            </strong>
            <div className="cemetery-result-stats">
              <span>
                <Skull size={17} />
                <strong>{summary.kills}</strong>ennemis
              </span>
              <span>
                <Sparkles size={17} />
                <strong>{summary.level}</strong>niveau
              </span>
              <span>
                <Trophy size={17} />
                <strong>{summary.bosses}</strong>boss
              </span>
            </div>
            <img
              className="cemetery-result-chest"
              src={`/art/chests/${summary.rarity}.webp`}
              alt={chestName(summary.rarity)}
            />
            <p>
              {chestName(summary.rarity)}
              <br />
              <small>
                Cartes pour ta collection · Or du coffre + {summary.gold} or
                ramassé
              </small>
            </p>
            <button
              type="button"
              className="cemetery-primary"
              disabled={busy || !session.settled || rewardOpened}
              onClick={onOpen}
            >
              {!session.settled ? (
                <>
                  <LoaderCircle className="animate-spin" size={18} />
                  Sauvegarde du bilan…
                </>
              ) : rewardOpened ? (
                "Coffre ouvert"
              ) : (
                <>
                  Ouvrir mon coffre
                  <ArrowRight size={18} />
                </>
              )}
            </button>
            <div className="cemetery-result-actions">
              <button
                type="button"
                disabled={!session.settled || busy}
                onClick={onImprove}
              >
                <Sparkles size={16} />
                Améliorer
              </button>
              <button
                type="button"
                disabled={!session.settled || busy}
                onClick={onReplay}
              >
                <Play size={16} />
                Rejouer
              </button>
            </div>
            <button
              type="button"
              className="cemetery-text-button"
              onClick={onMenu}
            >
              Retour au menu
            </button>
            {!session.settled && error && (
              <button
                type="button"
                className="cemetery-text-button"
                onClick={() => {
                  onError(null);
                  void session.flush().catch(() => {});
                }}
              >
                Réessayer la sauvegarde
              </button>
            )}
          </section>
        </div>
      ) : s.choices.length ? (
        <div className="cemetery-modal-shade">
          <section
            className="cemetery-level-up"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cemetery-choice-title"
          >
            <h2 id="cemetery-choice-title" className="cemetery-eyebrow">NIVEAU {s.level}</h2>
            <div className="cemetery-choice-grid">
              {s.choices.map((id) => {
                const serial = s.choiceSerial;
                const weapon = id.startsWith("weapon:")
                    ? cemeteryWeapon(
                        id.slice(7) as Parameters<typeof cemeteryWeapon>[0],
                      )
                    : null,
                  passive = id.startsWith("passive:")
                    ? cemeteryPassive(
                        id.slice(8) as Parameters<typeof cemeteryPassive>[0],
                      )
                    : null;
                const held = weapon
                  ? s.weapons.find((w) => w.id === weapon.id)
                  : passive
                    ? s.passives.find((p) => p.id === passive.id)
                    : null;
                return (
                  <button
                    type="button"
                    key={`${s.choiceSerial}:${id}`}
                    onClick={() => {
                      onError(null);
                      void session.choose(id, serial);
                    }}
                  >
                    <span className="cemetery-choice-type">
                      {weapon
                        ? held
                          ? "AMÉLIORATION D’ARME"
                          : "NOUVELLE ARME"
                        : passive
                          ? held
                            ? "OBJET AMÉLIORÉ"
                            : "NOUVEL OBJET"
                          : "RÉCUPÉRATION"}
                    </span>
                    <span className="cemetery-choice-icon">
                      <CemeteryGlyph
                        name={
                          weapon?.glyph ??
                          passive?.glyph ??
                          (id === "gold" ? "coins" : "heart")
                        }
                        size={42}
                      />
                    </span>
                    <h3>
                      {weapon?.name ??
                        passive?.name ??
                        (id === "gold" ? "Bourse d’or" : "Soin du refuge")}
                    </h3>
                    <p>
                      {(weapon && held
                        ? cemeteryWeaponBonus(weapon.id, held.level)
                        : weapon?.description) ??
                        passive?.description ??
                        (id === "gold"
                          ? "Gagne 25 pièces d’or, avec tes bonus de cupidité."
                          : "Récupère 30 PV, avec tes bonus de récupération.")}
                    </p>
                    <span className="cemetery-choice-level">
                      {weapon || passive
                        ? `Niveau ${held ? held.level + 1 : 1}`
                        : "Choisir"}
                      <ArrowRight size={16} />
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      ) : (
        ((ready && !session.running) || failed) && (
          <div className="cemetery-modal-shade">
            <section
              className="cemetery-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="cemetery-pause-title"
            >
              <span className="cemetery-eyebrow">LE TEMPS EST SUSPENDU</span>
              <h2 id="cemetery-pause-title">Un instant de répit.</h2>
              <p>La nuit t’attend. Reprends quand tu es prêt.</p>
              <button
                type="button"
                className="cemetery-primary"
                disabled={failed}
                onClick={() => {
                  onError(null);
                  void session.resume(performance.now());
                }}
              >
                <Play size={18} />
                Reprendre
              </button>
              <button
                type="button"
                className="cemetery-text-button"
                onClick={onMenu}
              >
                <ArrowLeft size={16} />
                Retour au menu
              </button>
              {failed && (
                <button
                  type="button"
                  className="cemetery-text-button"
                  onClick={onReload}
                >
                  Réessayer le chargement
                </button>
              )}
            </section>
          </div>
        )
      )}
      {error && (
        <div className="cemetery-error" role="alert">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => {
              onError(null);
              onReload();
            }}
          >
            Reprendre la sauvegarde du serveur
          </button>
        </div>
      )}
    </div>
  );
}
