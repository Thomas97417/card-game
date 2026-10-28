import { lazy, useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DeferredContent } from "./deferred-content";

function deferredPanel() {
  function Panel({ open }: { open: boolean }) {
    const [draft, setDraft] = useState("");
    return open ? (
      <input aria-label="Brouillon" value={draft} onChange={(event) => setDraft(event.target.value)} />
    ) : null;
  }
  let resolve!: (module: { default: typeof Panel }) => void;
  const load = vi.fn(() => new Promise<{ default: typeof Panel }>((done) => { resolve = done; }));
  const LazyPanel = lazy(load);
  function View({ open }: { open: boolean }) {
    return (
      <DeferredContent active={open} fallback={<p role="status">Chargement…</p>}>
        <LazyPanel open={open} />
      </DeferredContent>
    );
  }
  return { View, load, resolve: () => resolve({ default: Panel }) };
}

describe("deferred content", () => {
  it("loads only on first opening and preserves drafts after closing and reopening", async () => {
    const { View, load, resolve } = deferredPanel();
    const { rerender } = render(<View open={false} />);
    expect(load).not.toHaveBeenCalled();
    rerender(<View open />);
    expect(screen.getByRole("status").textContent).toContain("Chargement");
    expect(load).toHaveBeenCalledOnce();
    await act(async () => resolve());
    fireEvent.change(screen.getByLabelText("Brouillon"), { target: { value: "À conserver" } });
    rerender(<View open={false} />);
    expect(screen.queryByLabelText("Brouillon")).toBeNull();
    rerender(<View open />);
    expect((screen.getByLabelText("Brouillon") as HTMLInputElement).value).toBe("À conserver");
    expect(load).toHaveBeenCalledOnce();
  });

  it("allows closing during loading without reopening when the module arrives", async () => {
    const { View, load, resolve } = deferredPanel();
    const { rerender } = render(<View open />);
    expect(screen.getByRole("status")).toBeTruthy();
    rerender(<View open={false} />);
    expect(screen.queryByRole("status")).toBeNull();
    await act(async () => resolve());
    expect(screen.queryByLabelText("Brouillon")).toBeNull();
    rerender(<View open />);
    expect(screen.getByLabelText("Brouillon")).toBeTruthy();
    expect(load).toHaveBeenCalledOnce();
  });
});
