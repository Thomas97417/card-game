import {
  CEMETERY,
  stepCemetery,
  validCemeteryInput,
  type CemeteryRun,
  type CemeteryInput,
  type CemeteryFrame,
} from "@sylve/game/cemetery";

interface Options {
  ownerId: string;
  runId: string;
  leaseId: string;
  state: CemeteryRun;
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">;
  submit: (
    leaseId: string,
    startTick: number,
    inputs: CemeteryInput[],
  ) => Promise<{ state: CemeteryRun; acceptedTick: number }>;
  resume: (leaseId: string) => Promise<CemeteryRun>;
  pause: (leaseId: string) => Promise<unknown>;
  choose: (
    leaseId: string,
    serial: number,
    choice: string,
  ) => Promise<CemeteryRun>;
  finish: () => Promise<unknown>;
  change: () => void;
  frame: (frame: CemeteryFrame) => void;
  error: (message: string) => void;
}
export const cemeteryDraftKey = (ownerId: string, runId: string) =>
  `sylve.cemetery.v1:${ownerId}:${runId}`;
export function cemeteryError(error: unknown) {
  return error &&
    typeof error === "object" &&
    "data" in error &&
    typeof error.data === "string"
    ? error.data
    : error instanceof Error && !error.message.startsWith("[CONVEX")
      ? error.message
      : "La sauvegarde est interrompue. Réessaie ou reprends la sauvegarde du serveur.";
}
/** The engine advances only while playing; network acknowledgements are serialized. */
export class CemeterySession {
  state: CemeteryRun;
  running = false;
  saving = false;
  settled = false;
  private alive = true;
  private confirmedTick: number;
  private inputs: CemeteryInput[] = [];
  private key: string;
  private leaseId: string;
  private lastTime = 0;
  private accumulator = 0;
  private lastNotice = 0;
  private lastPersist = 0;
  private inFlight: Promise<void> | null = null;
  private pauseTask: Promise<void> | null = null;
  private transition = false;
  constructor(private options: Options) {
    this.state = structuredClone(options.state);
    this.confirmedTick = this.state.tick;
    this.leaseId = options.leaseId;
    this.key = cemeteryDraftKey(options.ownerId, options.runId);
    try {
      const draft = JSON.parse(options.storage?.getItem(this.key) ?? "null");
      if (
        draft?.version === 1 &&
        draft.leaseId === this.leaseId &&
        Number.isSafeInteger(draft.baseTick) &&
        draft.baseTick >= 0 &&
        draft.baseTick <= this.confirmedTick &&
        Array.isArray(draft.inputs) &&
        draft.inputs.length <= CEMETERY.maxDraftInputs &&
        draft.baseTick + draft.inputs.length >= this.confirmedTick &&
        draft.inputs.every(validCemeteryInput)
      ) {
        for (const input of draft.inputs.slice(
          this.confirmedTick - draft.baseTick,
        ) as CemeteryInput[]) {
          if (this.state.ended || this.state.choices.length) break;
          stepCemetery(this.state, input);
          this.inputs.push(input);
        }
      }
    } catch {
      /* A corrupt draft cannot replace a server checkpoint. */
    }
  }
  async resume(now: number) {
    if (!this.alive || this.running || this.transition || this.settled) return;
    this.transition = true;
    this.saving = true;
    this.notify();
    try {
      if (this.pauseTask) await this.pauseTask;
      await this.flush();
      if (this.state.ended || this.state.choices.length) return;
      const lease = crypto.randomUUID();
      const state = await this.options.resume(lease);
      if (!this.alive) return;
      this.leaseId = lease;
      this.state = structuredClone(state);
      this.confirmedTick = state.tick;
      this.lastTime = now;
      this.accumulator = 0;
      this.running = !state.ended && !state.choices.length;
    } catch (error) {
      this.options.error(cemeteryError(error));
    } finally {
      this.transition = false;
      this.saving = false;
      this.notify();
    }
  }
  advance(now: number, input: CemeteryInput) {
    if (!this.alive || !this.running) return;
    this.accumulator += Math.min(200, Math.max(0, now - this.lastTime));
    this.lastTime = now;
    while (
      this.accumulator >= CEMETERY.stepMs &&
      !this.state.ended &&
      !this.state.choices.length
    ) {
      this.accumulator -= CEMETERY.stepMs;
      const value = { x: Math.round(input.x), y: Math.round(input.y) };
      this.inputs.push(value);
      this.options.frame(stepCemetery(this.state, value));
      if (this.inputs.length >= CEMETERY.maxDraftInputs) {
        this.running = false;
        this.persist();
        this.options.error(
          "La connexion tarde à confirmer la partie. Reprends après sa sauvegarde.",
        );
        break;
      }
    }
    if (now - this.lastPersist >= 250) {
      this.persist();
      this.lastPersist = now;
    }
    if (this.state.ended || this.state.choices.length) {
      this.running = false;
      this.persist();
      void this.flush().catch(() => {});
    } else if (this.inputs.length >= CEMETERY.batchTicks)
      void this.flush().catch(() => {});
    if (now - this.lastNotice >= 100 || !this.running) {
      this.lastNotice = now;
      this.notify();
    }
  }
  pause(): Promise<void> {
    this.running = false;
    this.accumulator = 0;
    this.persist();
    this.notify();
    if (this.pauseTask) return this.pauseTask;
    this.pauseTask = (async () => {
      await this.flush();
      if (!this.settled) await this.options.pause(this.leaseId);
    })()
      .catch((error) => {
        if (this.alive) this.options.error(cemeteryError(error));
      })
      .finally(() => {
        this.pauseTask = null;
        this.notify();
      });
    return this.pauseTask;
  }
  async choose(choice: string) {
    if (!this.alive || this.transition) return;
    this.transition = true;
    this.saving = true;
    this.notify();
    try {
      await this.flush();
      const state = await this.options.choose(
        this.leaseId,
        this.state.choiceSerial,
        choice,
      );
      this.state = structuredClone(state);
      this.confirmedTick = state.tick;
    } catch (error) {
      this.options.error(cemeteryError(error));
    } finally {
      this.transition = false;
      this.saving = false;
      this.notify();
    }
    if (!this.state.choices.length && !this.state.ended)
      await this.resume(performance.now());
  }
  persist() {
    try {
      if (this.inputs.length)
        this.options.storage?.setItem(
          this.key,
          JSON.stringify({
            version: 1,
            leaseId: this.leaseId,
            baseTick: this.confirmedTick,
            inputs: this.inputs,
          }),
        );
      else this.options.storage?.removeItem(this.key);
    } catch {
      /* Continue with server checkpoints when local storage is unavailable. */
    }
  }
  flush(): Promise<void> {
    if (this.inFlight) return this.inFlight;
    if (this.settled) return Promise.resolve();
    this.saving = true;
    this.notify();
    this.inFlight = this.drain()
      .catch((error: unknown) => {
        this.running = false;
        this.persist();
        if (this.alive) this.options.error(cemeteryError(error));
        throw error;
      })
      .finally(() => {
        this.inFlight = null;
        this.saving = this.transition;
        this.notify();
      });
    return this.inFlight;
  }
  private async drain() {
    while (this.inputs.length) {
      const batch = this.inputs.slice(0, CEMETERY.batchTicks),
        start = this.confirmedTick;
      this.persist();
      const result = await this.options.submit(this.leaseId, start, batch),
        consumed = result.acceptedTick - start;
      if (
        consumed <= 0 ||
        consumed > batch.length ||
        result.state.tick !== result.acceptedTick ||
        (!result.state.ended &&
          !result.state.choices.length &&
          consumed !== batch.length)
      )
        throw new Error(
          "Cette partie est pilotée dans un autre onglet. Reprends la sauvegarde du serveur.",
        );
      this.confirmedTick = result.acceptedTick;
      this.inputs.splice(0, consumed);
      this.state = structuredClone(result.state);
      if (this.state.ended || this.state.choices.length) this.inputs = [];
      else
        for (const input of this.inputs) {
          stepCemetery(this.state, input);
          if (this.state.ended || this.state.choices.length) break;
        }
      if (this.state.ended || this.state.choices.length) this.running = false;
      this.persist();
    }
    if (this.state.ended && !this.settled) {
      await this.options.finish();
      this.settled = true;
      this.options.storage?.removeItem(this.key);
    }
  }
  private notify() {
    if (this.alive) this.options.change();
  }
  destroy() {
    this.running = false;
    this.persist();
    this.alive = false;
  }
}
