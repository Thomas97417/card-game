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

  it("explains eligibility from the record and explores future levels without promoting the hero", async () => {
    const progress = heroProgress([], { level: 10, peakMight: 100_000 });
    const onUpgrade = vi.fn();
    render(<GuardianHouse progress={progress} onUpgrade={onUpgrade} />);
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
    expect(
      screen.getByText(/Ce niveau reste disponible grâce à ton record/),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Explorer les niveaux" }),
    );
    const dialog = within(await screen.findByRole("dialog"));
    expect(dialog.getByRole("heading", { name: "Niveau 11" })).toBeTruthy();
    expect(dialog.getByText("2 éclaireuses · 6 ATQ / 1 PV")).toBeTruthy();
    fireEvent.click(dialog.getByRole("button", { name: "Élan · 21" }));
    expect(dialog.getByText("+7 ATQ aux alliés pour un tour")).toBeTruthy();
    fireEvent.click(dialog.getByRole("button", { name: "Maximum · 91" }));
    expect(dialog.getByText(/^1\s475$/)).toBeTruthy();
    expect(dialog.getByText(/^46\s550$/)).toBeTruthy();
    expect(
      (
        dialog.getByRole("button", {
          name: "Niveau suivant",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(onUpgrade).not.toHaveBeenCalled();
  });

  it("shows the threshold for entering a level and supports browsing from the first to the final level", async () => {
    render(
      <GuardianHouse
        progress={heroProgress([], { level: 2, peakMight: 870 })}
        onUpgrade={vi.fn()}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Explorer les niveaux" }),
    );
    const dialog = within(await screen.findByRole("dialog"));
    expect(dialog.getByRole("heading", { name: "Niveau 3" })).toBeTruthy();
    expect(dialog.getByText(/^1\s000$/)).toBeTruthy();
    const slider = dialog.getByRole("slider", { name: "Niveau à consulter" });
    fireEvent.change(slider, { target: { value: "1" } });
    expect(dialog.getByText("Niveau de départ")).toBeTruthy();
    expect(
      (
        dialog.getByRole("button", {
          name: "Niveau précédent",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.click(dialog.getByRole("button", { name: "Niveau suivant" }));
    expect(dialog.getByText("870")).toBeTruthy();
    fireEvent.change(slider, { target: { value: "91" } });
    expect(dialog.getByRole("heading", { name: "Niveau 91" })).toBeTruthy();
    fireEvent.click(dialog.getByRole("button", { name: "Niveau précédent" }));
    expect(dialog.getByRole("heading", { name: "Niveau 90" })).toBeTruthy();
    fireEvent.click(dialog.getByRole("button", { name: "Fermer la fenêtre" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(
      screen.getByRole("button", { name: "Explorer les niveaux" }),
    );
    expect(
      within(await screen.findByRole("dialog")).getByRole("heading", {
        name: "Niveau 3",
      }),
    ).toBeTruthy();
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

  it("shows the workshop upgrade shortcut only while a promotion is available", () => {
    const { rerender } = render(
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
    expect(summary.queryByRole("progressbar")).toBeNull();
    rerender(
      <HeroProgressSummary
        progress={heroProgress([{ id: "deck", might: 400 }])}
      />,
    );
    expect(summary.queryByRole("link")).toBeNull();
    expect(summary.getByText("400")).toBeTruthy();
    expect(summary.getByText("870")).toBeTruthy();
    rerender(
      <HeroProgressSummary
        progress={heroProgress([], { level: 91, peakMight: 100_000 })}
      />,
    );
    expect(summary.queryByRole("link")).toBeNull();
    expect(summary.getByText("Max.")).toBeTruthy();
  });
});
