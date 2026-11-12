import {
  CEMETERY,
  stepCemetery,
  chooseCemeteryUpgrade,
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
  resume: (leaseId: string, expectedLeaseId?: string, expectedTick?: number) => Promise<CemeteryRun>;
  pause: (leaseId: string, expectedTick?: number) => Promise<unknown>;
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
interface PendingChoice {
  type: "choice";
  tick: number;
  serial: number;
  choice: string;
}
type PendingCommand = PendingChoice | { type: "pause"; tick: number } | { type: "resume"; tick: number };
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
  private commands: PendingCommand[] = [];
  private activeCommand: PendingCommand | null = null;
  private key: string;
  private leaseId: string;
  private lastTime = 0;
  private accumulator = 0;
  private lastNotice = 0;
  private lastPersist = 0;
  private inFlight: Promise<void> | null = null;
  private transition = false;
  private connected = false;
  private wantsPlay = false;
  private failed = false;
  private inputClock: { tick: number; at: number } | null = null;
  constructor(private options: Options) {
    this.state = structuredClone(options.state);
    this.confirmedTick = this.state.tick;
    this.leaseId = options.leaseId;
    this.key = cemeteryDraftKey(options.ownerId, options.runId);
    try {
      const draft = JSON.parse(options.storage?.getItem(this.key) ?? "null");
      if (
        (draft?.version === 1 || draft?.version === 2 || draft?.version === 3) &&
        draft.leaseId === this.leaseId &&
        Number.isSafeInteger(draft.baseTick) &&
        draft.baseTick >= 0 &&
        draft.baseTick <= this.confirmedTick &&
        Array.isArray(draft.inputs) &&
        draft.inputs.length <= CEMETERY.maxDraftInputs &&
        draft.baseTick + draft.inputs.length >= this.confirmedTick &&
        draft.inputs.every(validCemeteryInput) &&
        (draft.version === 1 ||
          (draft.version === 3 && this.validCommands(draft.commands, draft.baseTick + draft.inputs.length) &&
            draft.inputs.length + draft.commands.filter((c: PendingCommand) => c.type === "choice").length <= CEMETERY.maxDraftInputs) ||
          (draft.version === 2 &&
          (this.validChoices(draft.choices, draft.baseTick + draft.inputs.length) &&
            draft.inputs.length + draft.choices.length <= CEMETERY.maxDraftInputs)))
      ) {
        this.inputs = draft.inputs.slice(
          this.confirmedTick - draft.baseTick,
        ) as CemeteryInput[];
        this.commands = draft.version === 3 ? draft.commands : draft.version === 2
          ? draft.choices.map((choice: Omit<PendingChoice, "type">) => ({ ...choice, type: "choice" })) : [];
        this.rebuild(options.state);
      }
    } catch {
      /* A corrupt draft cannot replace a server checkpoint. */
      this.state = structuredClone(options.state);
      this.inputs = [];
      this.commands = [];
    }
  }
  async resume(now: number) {
    if (!this.alive || this.running || this.settled || this.state.ended) return;
    this.wantsPlay = true;
    if (this.connected && !this.failed) {
      if (this.state.choices.length) return;
      if (this.pendingInputs >= CEMETERY.maxDraftInputs) {
        this.options.error("La connexion tarde à confirmer la partie. Reprends après sa sauvegarde.");
        return;
      }
      this.running = true;
      this.lastTime = now;
      this.accumulator = 0;
      this.enqueueControl("resume");
      this.persist();
      this.notify();
      await this.flush().catch(() => {});
      return;
    }
    if (this.transition) return;
    const started = performance.now();
    this.transition = true;
    this.connected = false;
    this.saving = true;
    this.notify();
    try {
      await this.flush();
      this.failed = false;
      if (this.state.ended || this.state.choices.length) {
        this.connected = true;
        return;
      }
      const lease = crypto.randomUUID();
      const state = await this.options.resume(lease);
      if (!this.alive) {
        await this.options.pause(lease, state.tick);
        return;
      }
      this.leaseId = lease;
      this.connected = true;
      this.state = structuredClone(state);
      this.confirmedTick = state.tick;
      this.inputClock = null;
      this.lastTime = now + performance.now() - started;
      this.accumulator = 0;
      this.running = this.wantsPlay && !state.ended && !state.choices.length;
      if (!this.wantsPlay) {
        this.enqueueControl("pause");
        this.persist();
        void this.flush().catch(() => {});
      }
    } catch (error) {
      this.failed = true;
      this.wantsPlay = false;
      if (this.alive) this.options.error(cemeteryError(error));
    } finally {
      this.transition = false;
      this.saving = this.inFlight !== null;
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
      if (this.pendingInputs >= CEMETERY.maxDraftInputs) {
        this.running = false;
        this.wantsPlay = false;
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
    this.wantsPlay = false;
    this.running = false;
    this.accumulator = 0;
    if (this.connected && !this.settled) this.enqueueControl("pause");
    this.persist();
    this.notify();
    if (!this.connected) return Promise.resolve();
    return this.flush().catch(() => {});
  }
  async choose(
    choice: string,
    serial = this.state.choiceSerial,
    now = performance.now(),
  ) {
    if (
      !this.alive ||
      serial !== this.state.choiceSerial ||
      !this.state.choices.includes(choice as CemeteryRun["choices"][number])
    ) return;
    if (this.pendingInputs >= CEMETERY.maxDraftInputs) {
      this.options.error("La connexion tarde à confirmer la partie. Reprends après sa sauvegarde.");
      return;
    }
    try {
      const state = structuredClone(this.state);
      chooseCemeteryUpgrade(state, choice);
      this.commands.push({ type: "choice", tick: this.state.tick, serial, choice });
      this.state = state;
      this.wantsPlay = true;
      this.lastTime = now;
      this.accumulator = 0;
      this.running = this.connected && !this.failed && !state.ended &&
        !state.choices.length && this.pendingInputs < CEMETERY.maxDraftInputs;
      if (this.pendingInputs >= CEMETERY.maxDraftInputs)
        this.options.error("La connexion tarde à confirmer la partie. Reprends après sa sauvegarde.");
      // Persist the selection before closing the dialog or sending a request.
      this.persist();
      this.notify();
      await this.flush();
    } catch (error) {
      if (!this.failed) this.options.error(cemeteryError(error));
    }
  }
  persist() {
    try {
      if (this.inputs.length || this.commands.length)
        this.options.storage?.setItem(
          this.key,
          JSON.stringify({
            version: 3,
            leaseId: this.leaseId,
            baseTick: this.confirmedTick,
            inputs: this.inputs,
            commands: this.commands,
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
        this.wantsPlay = false;
        this.failed = true;
        this.persist();
        if (this.alive) this.options.error(cemeteryError(error));
        throw error;
      })
      .finally(() => {
        this.activeCommand = null;
        this.inFlight = null;
        this.saving = this.transition;
        this.notify();
      });
    return this.inFlight;
  }
  private async drain() {
    while (this.inputs.length || this.commands.length) {
      const command = this.commands[0];
      if (command && command.tick <= this.confirmedTick) {
        this.activeCommand = command;
        if (command.type === "pause") {
          await this.options.pause(this.leaseId, this.confirmedTick);
        } else {
          const state = command.type === "resume"
            ? await this.options.resume(this.leaseId, this.leaseId, this.confirmedTick)
            : await this.options.choose(this.leaseId, command.serial, command.choice);
          if (state.tick !== this.confirmedTick)
            throw new Error("Cette partie est pilotée dans un autre onglet. Reprends la sauvegarde du serveur.");
          this.commands.shift();
          this.activeCommand = null;
          // Only uploads wait for the server's new elapsed-time budget.
          this.inputClock = { tick: state.tick, at: performance.now() };
          this.rebuild(state);
          this.persist();
          continue;
        }
        this.commands.shift();
        this.activeCommand = null;
        this.persist();
        continue;
      }
      const batch = this.inputs.slice(0, Math.min(
          CEMETERY.batchTicks, command ? command.tick - this.confirmedTick : Infinity,
        )),
        start = this.confirmedTick;
      if (!batch.length) throw new Error("Le brouillon de cette partie est incohérent. Reprends la sauvegarde du serveur.");
      this.persist();
      if (this.inputClock) {
        const deadline = this.inputClock.at + (start + batch.length - this.inputClock.tick) * CEMETERY.stepMs;
        const delay = deadline - performance.now();
        if (delay > 0) await new Promise<void>((resolve) => setTimeout(resolve, delay));
      }
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
      this.rebuild(result.state);
      this.persist();
    }
    if (this.state.ended && !this.settled) {
      await this.options.finish();
      this.settled = true;
      this.options.storage?.removeItem(this.key);
    }
  }
  private get pendingInputs() {
    return this.inputs.length + this.commands.filter((command) => command.type === "choice").length;
  }
  private enqueueControl(type: "pause" | "resume") {
    const last = this.commands[this.commands.length - 1];
    const command: PendingCommand = { type, tick: this.state.tick };
    // Rapid toggles at the same checkpoint need only their final state.
    // A request already in flight is immutable and must be acknowledged first.
    if (last?.type === type && last.tick === command.tick) return;
    if (last && last.type !== "choice" && last.tick === command.tick && last !== this.activeCommand) {
      const previous = this.commands[this.commands.length - 2];
      if (previous?.type === type && previous.tick === command.tick) this.commands.pop();
      else this.commands[this.commands.length - 1] = command;
    } else this.commands.push(command);
  }
  private validCommands(value: unknown, endTick: number): value is PendingCommand[] {
    if (!Array.isArray(value) || value.length > CEMETERY.maxDraftInputs * 3 + 2) return false;
    let lastSerial = 0;
    return value.every((command: PendingCommand, index) => {
      if (!command || !Number.isSafeInteger(command.tick) || command.tick < 0 || command.tick > endTick ||
          (index && value[index - 1].tick > command.tick)) return false;
      if (command.type === "pause" || command.type === "resume") return true;
      if (command.type !== "choice" || !Number.isSafeInteger(command.serial) || command.serial <= lastSerial ||
          typeof command.choice !== "string" || command.choice.length > 80) return false;
      lastSerial = command.serial;
      return true;
    });
  }
  private validChoices(value: unknown, endTick: number): value is PendingChoice[] {
    if (!Array.isArray(value) || value.length > CEMETERY.maxDraftInputs) return false;
    return value.every((choice: PendingChoice, index) =>
      choice && Number.isSafeInteger(choice.tick) && choice.tick >= 0 &&
      choice.tick <= endTick && Number.isSafeInteger(choice.serial) &&
      choice.serial > 0 && typeof choice.choice === "string" && choice.choice.length <= 80 &&
      (!index || (value[index - 1].tick <= choice.tick && value[index - 1].serial < choice.serial)),
    );
  }
  private rebuild(confirmed: CemeteryRun) {
    const state = structuredClone(confirmed);
    let index = 0;
    const applyChoices = () => {
      while (this.commands[index] && this.commands[index]!.tick <= state.tick) {
        const choice = this.commands[index++]!;
        if (choice.type !== "choice") continue;
        // A reload may find a choice already saved but not acknowledged.
        // Keep it in the journal for server verification, without applying it twice.
        if (choice.serial < state.choiceSerial || (choice.serial === state.choiceSerial && !state.choices.length)) continue;
        if (choice.tick !== state.tick || choice.serial !== state.choiceSerial) throw new Error("Le choix sauvegardé a changé. Reprends la sauvegarde du serveur.");
        chooseCemeteryUpgrade(state, choice.choice);
      }
    };
    applyChoices();
    for (const input of this.inputs) {
      if (state.ended || state.choices.length) throw new Error("La partie a changé. Reprends la sauvegarde du serveur.");
      stepCemetery(state, input);
      applyChoices();
    }
    this.state = state;
    if (!this.wantsPlay || state.ended || state.choices.length) this.running = false;
  }
  private notify() {
    if (this.alive) this.options.change();
  }
  destroy() {
    this.wantsPlay = false;
    this.running = false;
    this.persist();
    this.alive = false;
  }
}
