import { useCallback, useEffect, useRef, useState } from "react";
import {
  mergeSummonProgress,
  summonRevealComplete,
  summonRevealIndices,
  type SummonResult,
  type SummonRevealProgress,
} from "@sylve/game/summoning";

const cacheKey = (requestId: string) => `sylve:summon-progress:${requestId}`;

function readDraft(draw: SummonResult): SummonRevealProgress | undefined {
  try {
    const raw = window.localStorage.getItem(cacheKey(draw.requestId));
    if (!raw) return;
    const value = JSON.parse(raw) as SummonRevealProgress;
    const valid = new Set(summonRevealIndices(draw));
    if (
      Number.isInteger(value.round) &&
      value.round >= 0 &&
      value.round < draw.count &&
      Array.isArray(value.revealed) &&
      value.revealed.length <= draw.count * 6 &&
      value.revealed.every(
        (index) => Number.isInteger(index) && valid.has(index),
      )
    )
      return value;
  } catch {
    /* Server persistence remains available when browser storage is disabled. */
  }
}

function writeDraft(draw: SummonResult, progress: SummonRevealProgress) {
  try {
    window.localStorage.setItem(
      cacheKey(draw.requestId),
      JSON.stringify(progress),
    );
  } catch {
    /* The server also stores each reveal. */
  }
}

export type SaveSummonProgress = (
  request: SummonRevealProgress & { requestId: string },
) => Promise<unknown>;

export function useSummonRevealProgress(
  onSave: SaveSummonProgress,
  latest?: SummonResult | null,
  unfinished?: SummonResult | null,
) {
  const [localDraws, setLocalDraws] = useState<Record<string, SummonResult>>(
    {},
  );
  const save = useRef(onSave);
  save.current = onSave;
  const dirty = useRef(new Map<string, SummonResult>());

  const persist = useCallback((draw: SummonResult) => {
    const progress = draw.revealProgress!;
    dirty.current.set(draw.requestId, draw);
    void save
      .current({ requestId: draw.requestId, ...progress })
      .then(() => {
        if (dirty.current.get(draw.requestId) === draw)
          dirty.current.delete(draw.requestId);
        const draft = readDraft(draw);
        if (
          draft &&
          draft.round <= progress.round &&
          draft.revealed.every((index) => progress.revealed.includes(index))
        ) {
          try {
            window.localStorage.removeItem(cacheKey(draw.requestId));
          } catch {
            /* Optional cache. */
          }
        }
      })
      .catch(() => {
        /* Keep the local draft for reconnection or the next visit. */
      });
  }, []);

  const remember = useCallback((draw: SummonResult) => {
    const saved = { ...draw };
    delete saved.repeatToken;
    setLocalDraws((current) => ({ ...current, [draw.requestId]: saved }));
  }, []);

  const update = useCallback(
    (draw: SummonResult, progress: SummonRevealProgress) => {
      const merged = mergeSummonProgress(draw.revealProgress, progress);
      const saved = {
        ...draw,
        revealProgress: merged,
        revealCompleted: summonRevealComplete(draw, merged),
      };
      delete saved.repeatToken;
      writeDraft(saved, merged);
      remember(saved);
      persist(saved);
    },
    [remember, persist],
  );

  useEffect(() => {
    for (const draw of [latest, unfinished]) {
      if (!draw || draw.revealCompleted !== false) continue;
      const draft = readDraft(draw);
      if (
        draft &&
        (draft.round > (draw.revealProgress?.round ?? 0) ||
          draft.revealed.some(
            (index) => !draw.revealProgress?.revealed.includes(index),
          ))
      )
        update(draw, draft);
    }
  }, [latest, unfinished, update]);

  useEffect(() => {
    const retry = () => {
      for (const draw of dirty.current.values()) persist(draw);
    };
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [persist]);

  function current(draw: SummonResult): SummonResult {
    let progress = draw.revealProgress;
    for (const saved of [localDraws[draw.requestId], latest, unfinished]) {
      if (saved?.requestId === draw.requestId && saved.revealProgress)
        progress = mergeSummonProgress(progress, saved.revealProgress);
    }
    if (!progress) return draw;
    return {
      ...draw,
      revealProgress: progress,
      revealCompleted: summonRevealComplete(draw, progress),
    };
  }

  function resume(draw: SummonResult): SummonResult {
    const saved = current(draw);
    const draft = readDraft(saved);
    if (!draft) return saved;
    const progress = mergeSummonProgress(saved.revealProgress, draft);
    update(saved, progress);
    return {
      ...saved,
      revealProgress: progress,
      revealCompleted: summonRevealComplete(saved, progress),
    };
  }

  const pending = [unfinished, ...Object.values(localDraws), latest]
    .filter((draw): draw is SummonResult => !!draw)
    .map(current)
    .find((draw) => draw.revealCompleted === false);

  return { current, remember, update, resume, pending };
}
