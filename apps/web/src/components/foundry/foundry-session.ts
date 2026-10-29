import { FOUNDRY, stepFoundry, validFoundryInput, type FoundryFrame, type FoundryInput, type FoundryRound } from "@sylve/game/foundry";

interface SessionOptions {
  ownerId: string; roundId: string; state: FoundryRound; storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">;
  submit: (startTick: number, inputs: FoundryInput[]) => Promise<FoundryRound>;
  finish: () => Promise<unknown>;
  change: () => void; impact: (frame: FoundryFrame) => void; finished: () => void; error: (message: string) => void;
}
export const foundryDraftKey = (ownerId: string, roundId: string) => `sylve.foundry.v1:${ownerId}:${roundId}`;

/** Owns the local prediction, durable input buffer and serialized acknowledgements. */
export class FoundrySession {
  state: FoundryRound;
  running = false;
  saving = false;
  settled = false;
  private alive = true;
  private confirmedTick: number;
  private inputs: FoundryInput[] = [];
  private lastTime = 0;
  private accumulator = 0;
  private lastNotice = 0;
  private lastPersist = 0;
  private inFlight: Promise<void> | null = null;
  private key: string;
  constructor(private options: SessionOptions) {
    this.state = structuredClone(options.state); this.confirmedTick = this.state.tick;
    this.key = foundryDraftKey(options.ownerId, options.roundId);
    try {
      const draft = JSON.parse(options.storage?.getItem(this.key) ?? "null");
      if (draft?.version === 1 && Number.isSafeInteger(draft.baseTick) && Array.isArray(draft.inputs)
        && draft.inputs.length <= FOUNDRY.maxTicks && draft.inputs.every((input: FoundryInput) => input && validFoundryInput(input))
        && draft.baseTick <= this.confirmedTick && draft.baseTick + draft.inputs.length >= this.confirmedTick) {
        for (const input of draft.inputs.slice(this.confirmedTick - draft.baseTick) as FoundryInput[]) {
          if (this.state.ended) break;
          stepFoundry(this.state, input); this.inputs.push(input);
        }
      }
    } catch { /* A corrupt or unavailable local draft never replaces server state. */ }
  }
  resume(now: number) {
    if (!this.alive || this.settled) return;
    this.running = !this.state.ended; this.lastTime = now; this.accumulator = 0;
    if (this.state.ended) void this.flush();
    this.notify();
  }
  advance(now: number, aim: FoundryInput) {
    if (!this.running || !this.alive) return;
    this.accumulator += Math.min(250, Math.max(0, now - this.lastTime)); this.lastTime = now;
    while (this.accumulator >= FOUNDRY.stepMs && !this.state.ended) {
      this.accumulator -= FOUNDRY.stepMs;
      const input = { x: Math.round(aim.x * 1000) / 1000, z: Math.round(aim.z * 1000) / 1000, active: aim.active };
      // Rounding at a world boundary must never create an invalid coordinate.
      input.x = Math.max(-FOUNDRY.width / 2, Math.min(FOUNDRY.width / 2, input.x));
      input.z = Math.max(-FOUNDRY.depth / 2, Math.min(FOUNDRY.depth / 2, input.z));
      this.inputs.push(input); const frame = stepFoundry(this.state, input); this.options.impact(frame);
    }
    if (now - this.lastPersist >= 500) { this.persist(); this.lastPersist = now; }
    if (this.state.ended) { this.running = false; this.persist(); void this.flush(); }
    else if (this.inputs.length >= FOUNDRY.batchTicks) void this.flush();
    if (now - this.lastNotice >= 100 || this.state.ended) { this.lastNotice = now; this.notify(); }
  }
  pause() { this.running = false; this.accumulator = 0; this.persist(); void this.flush(); this.notify(); }
  persist() {
    try {
      if (this.inputs.length) this.options.storage?.setItem(this.key, JSON.stringify({ version: 1, baseTick: this.confirmedTick, inputs: this.inputs }));
      else this.options.storage?.removeItem(this.key);
    } catch { /* Server checkpoints still work when storage is full or disabled. */ }
  }
  flush(): Promise<void> {
    if (this.inFlight) return this.inFlight;
    if (this.settled) return Promise.resolve();
    this.saving = true; this.notify();
    this.inFlight = this.drain().catch((error: unknown) => {
      this.running = false; this.persist();
      const message = error && typeof error === "object" && "data" in error && typeof error.data === "string"
        ? error.data : error instanceof Error && !error.message.startsWith("[CONVEX")
          ? error.message : "La sauvegarde a été interrompue. Réessaie ou reprends la sauvegarde du serveur.";
      if (this.alive) this.options.error(message);
    }).finally(() => { this.inFlight = null; this.saving = false; this.notify(); });
    return this.inFlight;
  }
  private async drain() {
    while (this.inputs.length) {
      const batch = this.inputs.slice(0, FOUNDRY.batchTicks); const start = this.confirmedTick;
      this.persist();
      const confirmed = await this.options.submit(start, batch);
      const consumed = confirmed.tick - start;
      if (consumed <= 0 || consumed > batch.length || (!confirmed.ended && consumed !== batch.length)) throw new Error("Cette manche a changé dans un autre onglet. Reprends la sauvegarde du serveur.");
      this.confirmedTick = confirmed.tick; this.inputs.splice(0, consumed);
      this.state = structuredClone(confirmed);
      if (confirmed.ended) this.inputs = [];
      else for (const input of this.inputs) { stepFoundry(this.state, input); if (this.state.ended) break; }
      if (this.state.ended) this.running = false;
      this.persist();
    }
    if (this.state.ended && !this.settled) {
      await this.options.finish(); this.settled = true; this.options.storage?.removeItem(this.key);
      if (this.alive) this.options.finished();
    }
  }
  private notify() { if (this.alive) this.options.change(); }
  destroy() { this.running = false; this.persist(); this.alive = false; }
}
