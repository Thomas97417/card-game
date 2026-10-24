import { useEffect, type RefObject } from "react";

export function useHorizontalWheel(ref: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const row = ref.current;
    if (!row) return;

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
      row.scrollLeft += event.deltaY * unit;
      event.preventDefault();
    };

    row.addEventListener("wheel", scrollHorizontally, { passive: false });
    return () => row.removeEventListener("wheel", scrollHorizontally);
  }, [ref]);
}
