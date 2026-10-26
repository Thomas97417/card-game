import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CARD_VARIANTS, resolveCard, type OwnedCard } from "@sylve/game";
import { CardSoulbind, CardEvolutionResources } from "./card-soulbind";
import { CardUpgradeDialog } from "./card-upgrade-dialog";
import { GoldContext } from "@/components/gold-balance";

const collection = (): OwnedCard[] =>
  CARD_VARIANTS.map((c) => ({ card: resolveCard(c.id, 26), copies: 100 }));
const progress = {
  rank: 1000,
  soulDust: 10000,
  unlocked: true,
  evolutionUnlocked: true,
  earned: 10,
  required: 50,
};
function expand(container: HTMLElement) {
  fireEvent.click(container.querySelector("summary")!);
}

describe("Soulbind card controls", () => {
  it("shows the four links, their actual bonuses and the available activation action", async () => {
    const onSoulbind = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <CardSoulbind
        card={resolveCard("guardian:common")}
        collection={collection()}
        soulProgress={progress}
        onSoulbind={onSoulbind}
      />,
    );
    expand(container);
    expect(screen.getAllByRole("region", { name: /Lien d’âme / })).toHaveLength(
      4,
    );
    const first = within(screen.getByRole("region", { name: "Lien d’âme I" }));
    expect(first.getByText("+1 PV")).toBeTruthy();
    expect(first.getByText("Lame du cloître")).toBeTruthy();
    const button = first.getByRole("button", {
      name: /Activer le lien I Gratuit/,
    });
    expect((button as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(button);
    await waitFor(() =>
      expect(onSoulbind).toHaveBeenCalledWith("guardian:common", 1),
    );
  });
  it("disables activation when the rank, required companions or dust are missing", () => {
    const { container } = render(
      <CardSoulbind
        card={resolveCard("guardian:common")}
        collection={[]}
        soulProgress={{ ...progress, rank: 1, soulDust: 0 }}
        onSoulbind={vi.fn()}
      />,
    );
    expand(container);
    expect(
      screen
        .getAllByRole("button")
        .every((b) => (b as HTMLButtonElement).disabled),
    ).toBe(true);
    expect(screen.getByText("Niv. 0 / 6")).toBeTruthy();
  });
  it("explains prerequisites in the bestiary without offering an owned-card mutation", () => {
    const { container } = render(
      <CardSoulbind card={resolveCard("guardian:common")} />,
    );
    expand(container);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("Activation gratuite")).toBeTruthy();
  });
  it("converts an explicit reserve quantity into dust", async () => {
    const onSacrifice = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <CardEvolutionResources
        entry={{ card: resolveCard("guardian:common"), copies: 100 }}
        onSacrifice={onSacrifice}
      />,
    );
    expand(container);
    fireEvent.change(
      screen.getByRole("spinbutton", { name: "Nombre de lots" }),
      { target: { value: "2" } },
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Convertir 100 exemplaires en 20 poussières",
      }),
    );
    await waitFor(() =>
      expect(onSacrifice).toHaveBeenCalledWith("guardian:common", 2),
    );
  });
  it("enables only documented evolutions to forms already owned", async () => {
    const onEvolve = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <CardEvolutionResources
        entry={{ card: resolveCard("guardian:rare"), copies: 50 }}
        collection={collection()}
        soulProgress={progress}
        onEvolve={onEvolve}
      />,
    );
    expand(container);
    const button = screen.getByRole("button", {
      name: "Évoluer vers Colosse du serment",
    });
    expect((button as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(button);
    await waitFor(() =>
      expect(onEvolve).toHaveBeenCalledWith("guardian:rare", "guardian:epic"),
    );
  });
  it("includes already active links in the next-level health preview", async () => {
    render(
      <GoldContext.Provider value={1000}>
        <CardUpgradeDialog
          entry={{ card: resolveCard("guardian:common", 1, [1]), copies: 25 }}
          onClose={vi.fn()}
          onUpgrade={vi.fn()}
        />
      </GoldContext.Provider>,
    );
    const stats = within(
      await screen.findByRole("region", { name: "Caractéristiques" }),
    );
    expect(stats.getByLabelText("12 au niveau 2")).toBeTruthy();
  });
});
