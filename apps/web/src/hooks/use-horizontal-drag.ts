import { useEffect, useRef, useState } from "react";
import type { HTMLAttributes, PointerEvent } from "react";

const DRAG_THRESHOLD = 6;

export function useHorizontalDrag(
  enabled: boolean,
  {
    ignoreInteractiveElements = false,
  }: { ignoreInteractiveElements?: boolean } = {},
) {
  const [isDragging, setIsDragging] = useState(false);
  const drag = useRef<{
    pointerId: number;
    startX: number;
    scrollLeft: number;
    captureTarget: Element;
    row: HTMLDivElement;
    nextScrollLeft: number;
    moved: boolean;
  } | null>(null);
  const suppressClick = useRef(false);
  const frame = useRef<number | undefined>(undefined);

  useEffect(() => () => {
    if (frame.current !== undefined) window.cancelAnimationFrame(frame.current);
  }, []);

  function finishDrag(event: PointerEvent<HTMLDivElement>) {
    const source = drag.current;
    if (!source || source.pointerId !== event.pointerId) return;
    if (frame.current !== undefined) {
      window.cancelAnimationFrame(frame.current);
      frame.current = undefined;
      source.row.scrollLeft = source.nextScrollLeft;
    }
    drag.current = null;
    setIsDragging(false);
    if (source.captureTarget.hasPointerCapture(source.pointerId)) {
      source.captureTarget.releasePointerCapture(source.pointerId);
    }
  }

  const dragHandlers: HTMLAttributes<HTMLDivElement> = {
    onPointerDown(event) {
      suppressClick.current = false;
      if (!enabled || event.pointerType !== "mouse" || event.button !== 0) return;
      if (
        ignoreInteractiveElements &&
        (event.target as Element).closest("button, a, input, select, textarea")
      )
        return;

      // Capture on the original target so a simple click still reaches its
      // control, while a drag can continue outside the scroll area or viewport.
      const captureTarget = event.target as Element;
      drag.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        scrollLeft: event.currentTarget.scrollLeft,
        captureTarget,
        row: event.currentTarget,
        nextScrollLeft: event.currentTarget.scrollLeft,
        moved: false,
      };
      captureTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove(event) {
      const source = drag.current;
      if (!source || source.pointerId !== event.pointerId) return;
      if (!(event.buttons & 1)) {
        finishDrag(event);
        return;
      }

      const distance = event.clientX - source.startX;
      if (!source.moved && Math.abs(distance) < DRAG_THRESHOLD) return;
      if (!source.moved) {
        source.moved = true;
        setIsDragging(true);
      }
      suppressClick.current = true;
      event.preventDefault();
      source.nextScrollLeft = source.scrollLeft - distance;
      frame.current ??= window.requestAnimationFrame(() => {
        source.row.scrollLeft = source.nextScrollLeft;
        frame.current = undefined;
      });
    },
    onPointerUp: finishDrag,
    onPointerCancel: finishDrag,
    onLostPointerCapture: finishDrag,
    onClickCapture(event) {
      // Keyboard activation has detail 0 and must remain available after a drag.
      if (!suppressClick.current || event.detail === 0) return;
      suppressClick.current = false;
      event.preventDefault();
      event.stopPropagation();
    },
    onDragStart(event) {
      if (enabled) event.preventDefault();
    },
  };

  return { isDragging, dragHandlers };
}
