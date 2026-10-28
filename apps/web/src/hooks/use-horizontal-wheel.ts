import { useEffect, type RefObject } from "react";

export function useHorizontalWheel(ref: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const row = ref.current;
    if (!row) return;
    let frame: number | undefined;
    let delta = 0;

    const scrollHorizontally = (event: WheelEvent) => {
      if (
        event.ctrlKey ||
        event.shiftKey ||
        Math.abs(event.deltaX) >= Math.abs(event.deltaY) ||
        row.scrollWidth <= row.clientWidth
      )
        return;

      const unit =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? row.clientWidth
            : 1;
      event.preventDefault();
      delta += event.deltaY * unit;
      // Trackpads may emit several events per frame. Write scroll position once.
      frame ??= window.requestAnimationFrame(() => {
        row.scrollLeft += delta;
        delta = 0;
        frame = undefined;
      });
    };

    row.addEventListener("wheel", scrollHorizontally, { passive: false });
    return () => {
      row.removeEventListener("wheel", scrollHorizontally);
      if (frame !== undefined) window.cancelAnimationFrame(frame);
    };
  }, [ref]);
}
