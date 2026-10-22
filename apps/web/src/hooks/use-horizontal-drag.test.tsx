import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useHorizontalDrag } from "./use-horizontal-drag";

afterEach(cleanup);

function setup(enabled = true) {
  const enter = vi.fn();
  function Map() {
    const { isDragging, dragHandlers } = useHorizontalDrag(enabled);
    return (
      <div data-testid="map" data-dragging={isDragging} {...dragHandlers}>
        <button type="button" onClick={enter}>
          <span>Maison</span>
        </button>
        <a
          href="/decks"
          onClick={(event) => {
            event.preventDefault();
            enter();
          }}
        >
          Atelier
        </a>
      </div>
    );
  }
  const view = render(<Map />);
  const map = view.getByTestId("map");
  const label = view.getByText("Maison");
  const link = view.getByText("Atelier");
  const capture = vi.fn();
  const release = vi.fn();
  for (const element of [map, label, link]) {
    Object.assign(element, {
      setPointerCapture: capture,
      hasPointerCapture: () => true,
      releasePointerCapture: release,
    });
  }
  map.scrollLeft = 400;
  return { map, label, link, enter, capture, release };
}

function pointer(
  target: HTMLElement,
  type: string,
  options: MouseEventInit & { pointerType?: string; pointerId?: number } = {},
) {
  const { pointerType = "mouse", pointerId = 1, ...mouseOptions } = options;
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: 200,
    button: 0,
    buttons: type === "pointerup" ? 0 : 1,
    ...mouseOptions,
  });
  Object.assign(event, { pointerType, pointerId });
  fireEvent(target, event);
}

describe("horizontal map dragging", () => {
  it("follows the mouse in both directions and ends when released", () => {
    const { map, capture, release } = setup();
    pointer(map, "pointerdown");
    pointer(map, "pointermove", { clientX: 120 });
    expect(map.scrollLeft).toBe(480);
    expect(map.dataset.dragging).toBe("true");
    expect(capture).toHaveBeenCalledWith(1);

    pointer(map, "pointermove", { clientX: 260 });
    expect(map.scrollLeft).toBe(340);
    pointer(map, "pointerup", { clientX: 260 });
    expect(map.dataset.dragging).toBe("false");
    expect(release).toHaveBeenCalledWith(1);
    pointer(map, "pointermove", { clientX: 100 });
    expect(map.scrollLeft).toBe(340);
  });

  it("preserves building clicks when the mouse only moves slightly", () => {
    const { map, label, enter } = setup();
    pointer(label, "pointerdown");
    pointer(label, "pointermove", { clientX: 203 });
    pointer(label, "pointerup", { clientX: 203 });
    fireEvent.click(label, { detail: 1 });
    expect(map.scrollLeft).toBe(400);
    expect(enter).toHaveBeenCalledOnce();
  });

  it.each(["button", "link"])(
    "can drag from a building %s without entering it on release",
    (kind) => {
      const { map, label, link, enter } = setup();
      const target = kind === "button" ? label : link;
      pointer(target, "pointerdown");
      pointer(target, "pointermove", { clientX: 100 });
      pointer(target, "pointerup", { clientX: 100 });
      expect(fireEvent.click(target, { detail: 1 })).toBe(false);
      expect(map.scrollLeft).toBe(500);
      expect(enter).not.toHaveBeenCalled();

      pointer(target, "pointerdown");
      pointer(target, "pointerup");
      fireEvent.click(target, { detail: 1 });
      expect(enter).toHaveBeenCalledOnce();
    },
  );

  it("keeps keyboard activation available after dragging", () => {
    const { label, enter } = setup();
    pointer(label, "pointerdown");
    pointer(label, "pointermove", { clientX: 100 });
    pointer(label, "pointerup", { clientX: 100 });
    fireEvent.click(label, { detail: 0 });
    expect(enter).toHaveBeenCalledOnce();
  });

  it.each(["touch", "pen", "right button", "no overflow"])(
    "leaves %s interactions to the browser",
    (kind) => {
      const { map, capture } = setup(kind !== "no overflow");
      const options = {
        pointerType: kind === "touch" || kind === "pen" ? kind : "mouse",
        button: kind === "right button" ? 2 : 0,
      };
      pointer(map, "pointerdown", options);
      pointer(map, "pointermove", { ...options, clientX: 100 });
      expect(map.scrollLeft).toBe(400);
      expect(map.dataset.dragging).toBe("false");
      expect(capture).not.toHaveBeenCalled();
    },
  );

  it.each(["pointercancel", "lostpointercapture", "released button"])(
    "cleans up a drag after %s",
    (reason) => {
      const { map } = setup();
      pointer(map, "pointerdown");
      pointer(map, "pointermove", { clientX: 100 });
      if (reason === "released button") {
        pointer(map, "pointermove", { clientX: 90, buttons: 0 });
      } else {
        pointer(map, reason);
      }
      expect(map.dataset.dragging).toBe("false");
      pointer(map, "pointermove", { clientX: 50 });
      expect(map.scrollLeft).toBe(500);
    },
  );

  it("prevents native link dragging from interrupting map movement", () => {
    const { link } = setup();
    expect(fireEvent.dragStart(link)).toBe(false);
  });
});
