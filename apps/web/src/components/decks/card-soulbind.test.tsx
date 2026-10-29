import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  CARD_VARIANTS,
  resolveCard,
  soulbindDefinitions,
  type OwnedCard,
} from "@sylve/game";
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
  it("shows the current rank and XP progress, including the maximum rank", () => {
    const props = {
      card: resolveCard("bear:epic"),
      onSoulbind: vi.fn(),
      presentation: "page" as const,
    };
    const { rerender } = render(
      <CardSoulbind
        {...props}
        soulProgress={{ ...progress, rank: 9, earned: 10, required: 50 }}
      />,
    );
    const wallet = within(screen.getByLabelText("Progression des liens d’âme"));
    expect(wallet.getByText("Rang 9")).toBeTruthy();
    expect(wallet.queryByText(/Vers le rang/)).toBeNull();
    expect(wallet.getByText("10 / 50 XP")).toBeTruthy();
    const meter = wallet.getByRole("progressbar", { name: "Expérience de rang" });
    expect(meter.getAttribute("value")).toBe("10");
    expect(meter.getAttribute("max")).toBe("50");

    rerender(
      <CardSoulbind
        {...props}
        soulProgress={{ ...progress, earned: 0, required: 0 }}
      />,
    );
    expect(wallet.getByText("Rang maximum")).toBeTruthy();
    expect(wallet.getByText("MAX")).toBeTruthy();
    expect(wallet.queryByText(/Vers le rang/)).toBeNull();
    expect(meter.getAttribute("value")).toBe("1");
    expect(meter.getAttribute("max")).toBe("1");
  });

  it("labels required-level previews explicitly for undiscovered companions", () => {
    const card = resolveCard("guardian:legendary");
    render(
      <CardSoulbind
        card={card}
        collection={[]}
        soulProgress={progress}
        presentation="page"
      />,
    );
    expect(screen.queryByText(/\/ 4 actifs/)).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Afficher le lien d’âme IV" }),
    );
    const fourth = within(
      screen.getByRole("region", { name: "Lien d’âme IV" }),
    );
    expect(fourth.queryByText("Lien d’âme IV")).toBeNull();
    for (const requirement of soulbindDefinitions(card.id)[3]!.requirements) {
      const companion = resolveCard(requirement.variantId);
      const preview = fourth.getByRole("img", {
        name: new RegExp(
          `^${companion.name}, .*niveau ${requirement.level} requis$`,
        ),
      });
      expect(
        within(preview).getByText(`Requis : niv. ${requirement.level}`),
      ).toBeTruthy();
    }
    expect(fourth.getByText("Aucune carte consommée")).toBeTruthy();
  });

  it("shows owned companions at their actual levels and separates current and required levels", () => {
    const card = resolveCard("bear:epic");
    const requirements = soulbindDefinitions(card.id)[2]!.requirements;
    const first = resolveCard(requirements[0]!.variantId, 3);
    const second = resolveCard(requirements[1]!.variantId, 1);
    const owned = [card, first, second].map((card) => ({ card, copies: 0 }));
    const view = (collection: OwnedCard[]) => (
      <CardSoulbind
        card={card}
        collection={collection}
        soulProgress={progress}
        presentation="page"
      />
    );
    const { rerender } = render(view(owned));
    fireEvent.click(
      screen.getByRole("button", { name: "Afficher le lien d’âme III" }),
    );
    for (const [companion, requirement] of [
      [first, requirements[0]!],
      [second, requirements[1]!],
    ] as const) {
      const preview = screen.getByRole("img", {
        name: `${companion.name}, Épique, niveau actuel ${companion.level}, niveau ${requirement.level} requis`,
      });
      expect(within(preview).getByText(`Niv. ${companion.level}`)).toBeTruthy();
      expect(within(preview).queryByText(`Niv. ${requirement.level}`)).toBeNull();
      expect(
        within(preview).getByLabelText(`${companion.health} points de vie`),
      ).toBeTruthy();
      const levels = within(screen.getByLabelText(`Niveaux de ${companion.name}`));
      expect(levels.getByText("Niveau actuel")).toBeTruthy();
      expect(levels.getByText(`Niv. ${companion.level}`)).toBeTruthy();
      expect(levels.getByText("Niveau requis")).toBeTruthy();
      expect(levels.getByText(`Niv. ${requirement.level}`)).toBeTruthy();
    }
    const upgraded = resolveCard(first.id, requirements[0]!.level);
    rerender(
      view(
        owned.map((entry) =>
          entry.card.id === first.id ? { ...entry, card: upgraded } : entry,
        ),
      ),
    );
    expect(
      screen
        .getByRole("button", { name: "Afficher le lien d’âme III" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    const levels = screen.getByLabelText(`Niveaux de ${first.name}`);
    expect(within(levels).queryByText("Niv. 3")).toBeNull();
    expect(
      within(levels).getAllByText(`Niv. ${requirements[0]!.level}`),
    ).toHaveLength(2);
    expect(levels.getAttribute("data-ready")).toBe("true");
  });

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
    expect(screen.getAllByText("À découvrir").length).toBeGreaterThan(0);
    expect(screen.queryByText("Niv. 0 / 6")).toBeNull();
  });
  it("explains prerequisites in the bestiary without offering an owned-card mutation", () => {
    const { container } = render(
      <CardSoulbind card={resolveCard("guardian:common")} />,
    );
    expand(container);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("Activation gratuite")).toBeTruthy();
    expect(screen.queryByText("Niveau actuel")).toBeNull();
    expect(screen.getAllByText("Niveau requis").length).toBeGreaterThan(0);
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
