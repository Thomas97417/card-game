import type { ReactNode } from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { heroProgress } from "@sylve/game";
import { GuardianHouse } from "./guardian-house";
import { HeroProgressSummary } from "./hero-progress-summary";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: { children: ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

describe("la Maison des gardiens", () => {
  it("promotes the current level once, then uses the refreshed progression for the next promotion", async () => {
    let finish!: () => void;
    const onUpgrade = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const progress = heroProgress([{ id: "deck", might: 870 }]);
    const { rerender } = render(
      <GuardianHouse progress={progress} onUpgrade={onUpgrade} />,
    );
    const upgrade = screen.getByRole("button", {
      name: "Améliorer au niveau 2",
    });
    fireEvent.click(upgrade);
    fireEvent.click(upgrade);
    expect(onUpgrade).toHaveBeenCalledExactlyOnceWith(1);
    expect((upgrade as HTMLButtonElement).disabled).toBe(true);
    finish();
    await waitFor(() =>
      expect((upgrade as HTMLButtonElement).disabled).toBe(false),
    );
    rerender(
      <GuardianHouse
        progress={heroProgress([{ id: "deck", might: 870 }], {
          level: 2,
          peakMight: 870,
        })}
        onUpgrade={onUpgrade}
      />,
    );
    const next = screen.getByRole("button", {
      name: "Améliorer au niveau 3",
    }) as HTMLButtonElement;
    expect(next.disabled).toBe(true);
    fireEvent.click(next);
    expect(onUpgrade).toHaveBeenCalledTimes(1);
  });

  it("keeps permanent eligibility from the record, previews the next power and lists every hero level", () => {
    const progress = heroProgress([], { level: 10, peakMight: 100_000 });
    render(<GuardianHouse progress={progress} onUpgrade={vi.fn()} />);
    expect(
      (
        screen.getByRole("button", {
          name: "Améliorer au niveau 11",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    expect(
      screen.getByText("Nouveau pouvoir : Appel des éclaireurs"),
    ).toBeTruthy();
    expect(screen.getAllByText("Niveau 21").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText("Les 91 niveaux du Gardien"));
    expect(screen.getAllByRole("row")).toHaveLength(92);
    expect(screen.getByText("1475")).toBeTruthy();
  });

  it("does not offer a promotion before loading or beyond the final level", () => {
    const { rerender } = render(
      <GuardianHouse progress={undefined} onUpgrade={vi.fn()} />,
    );
    expect(screen.getByRole("status").textContent).toContain(
      "Chargement de ton Gardien",
    );
    expect(screen.queryByRole("button", { name: /Améliorer/ })).toBeNull();
    rerender(
      <GuardianHouse
        progress={heroProgress([], { level: 91, peakMight: 1e9 })}
        onUpgrade={vi.fn()}
      />,
    );
    expect(screen.getByText("Niveau maximum atteint")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Améliorer/ })).toBeNull();
  });

  it("links the workshop summary to the house and leaves promotion in the house", () => {
    render(
      <HeroProgressSummary
        progress={heroProgress([{ id: "deck", might: 870 }])}
      />,
    );
    const summary = within(
      screen.getByRole("region", { name: "Progression du Gardien" }),
    );
    expect(
      summary
        .getByRole("link", { name: /Amélioration disponible/ })
        .getAttribute("href"),
    ).toBe("/guardian");
    expect(summary.queryByRole("button")).toBeNull();
  });
});
