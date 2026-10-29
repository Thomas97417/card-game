import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getFunctionName, type FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import { api } from "@my-better-t-app/backend/convex/_generated/api";
import type { Id } from "@my-better-t-app/backend/convex/_generated/dataModel";
import { HubDock } from "./hub-dock";
import { GuildsPanel } from "./guilds-panel";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  create: vi.fn(),
  join: vi.fn(),
  update: vi.fn(),
  leave: vi.fn(),
  retry: vi.fn(),
}));
vi.mock("@tanstack/react-query", () => ({ useQuery: mocks.query }));
vi.mock("convex/react", () => ({
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) =>
    mocks[
      getFunctionName(reference).split(":")[1] as
        | "create"
        | "join"
        | "update"
        | "leave"
    ],
}));

const guildId = "guild-one" as Id<"guilds">;
const secondId = "guild-two" as Id<"guilds">;
type Ranking = FunctionReturnType<typeof api.guilds.leaderboard>;
type Mine = FunctionReturnType<typeof api.guilds.mine>;
let ranking: Ranking;
let mine: Mine;
let queryError: boolean;
let queryPending: boolean;

function ownedGuild(): NonNullable<Mine> {
  return {
    id: guildId,
    name: "Les Veilleurs",
    description: "Sous une même lune",
    emblemId: "moon-wolf",
    isLeader: true,
    power: 1200,
    members: [
      {
        playerId: "alice",
        name: "Aëlys",
        power: 800,
        isLeader: true,
        isSelf: true,
        profile: { heroId: "moon" },
      },
      {
        playerId: "bob",
        name: "Sylvar",
        power: 400,
        isLeader: false,
        isSelf: false,
        profile: { heroId: "north" },
      },
    ],
  };
}

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  queryError = false;
  queryPending = false;
  mine = null;
  ranking = {
    guildId: null,
    guilds: [
      {
        id: guildId,
        name: "Les Veilleurs",
        description: "Sous une même lune",
        emblemId: "moon-wolf",
        power: 1200,
        rank: 1,
        memberCount: 2,
        isOwn: false,
      },
      {
        id: secondId,
        name: "L’Éclat du Phénix",
        description: "Ensemble vers l’aube",
        emblemId: "sun-phoenix",
        power: 500,
        rank: 2,
        memberCount: 1,
        isOwn: false,
      },
    ],
  };
  mocks.query.mockImplementation(
    ({
      queryKey,
    }: {
      queryKey: [string, Parameters<typeof getFunctionName>[0]];
    }) => ({
      data: queryPending
        ? undefined
        : getFunctionName(queryKey[1]) === "guilds:mine"
          ? mine
          : ranking,
      isPending: queryPending,
      isError: queryError,
      refetch: mocks.retry,
    }),
  );
});

describe("guildes dans le refuge", () => {
  it("opens from the illustrated dock shortcut and restores focus on Escape", async () => {
    render(<HubDock />);
    const trigger = screen.getByRole("button", { name: "Guilde" });
    expect(trigger.querySelector("img")?.getAttribute("src")).toBe(
      "/art/ui/guild-banner.webp",
    );
    fireEvent.click(trigger);
    await screen.findByRole("button", { name: "Toutes les guildes" });
    const panel = screen.getByRole("region", { name: "Guildes" });
    expect(
      within(panel)
        .getByRole("button", { name: "Toutes les guildes" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      within(panel).getByRole("button", { name: "Ma guilde" }),
    ).toBeTruthy();
    fireEvent.keyDown(panel, { key: "Escape" });
    expect(screen.queryByRole("region", { name: "Guildes" })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("keeps global ranks when searching and finds names without accents", () => {
    render(<GuildsPanel id="guilds" onClose={vi.fn()} />);
    const search = screen.getByRole("searchbox", {
      name: "Rechercher une guilde",
    });
    fireEvent.change(search, { target: { value: "eclat" } });
    expect(screen.queryByText("Les Veilleurs")).toBeNull();
    expect(screen.getByText("L’Éclat du Phénix")).toBeTruthy();
    expect(screen.getByLabelText("Rang 2")).toBeTruthy();
    fireEvent.change(search, { target: { value: "introuvable" } });
    expect(screen.getByText("Aucune guilde trouvée")).toBeTruthy();
    fireEvent.change(search, { target: { value: "" } });
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("creates a guild with a chosen existing or new emblem and opens its member list", async () => {
    mocks.create.mockImplementation(async () => {
      mine = ownedGuild();
      ranking = {
        guildId,
        guilds: ranking.guilds.map((guild) => ({
          ...guild,
          isOwn: guild.id === guildId,
        })),
      };
      return guildId;
    });
    render(<GuildsPanel id="guilds" onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Ma guilde" }));
    fireEvent.click(screen.getByRole("button", { name: "Créer ma guilde" }));
    expect(screen.getByText("Nouveaux emblèmes")).toBeTruthy();
    expect(screen.getByText("La collection du refuge")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Écu de la Sylve" }));
    expect(
      screen
        .getByRole("button", { name: "Écu de la Sylve" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Loup lunaire" }));
    fireEvent.change(screen.getByLabelText(/Nom de la guilde/), {
      target: { value: "Les Veilleurs" },
    });
    fireEvent.change(screen.getByLabelText(/Devise ou description/), {
      target: { value: "Sous une même lune" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Créer ma guilde" }));
    await screen.findByRole("list", { name: "Membres de ma guilde" });
    expect(mocks.create).toHaveBeenCalledWith({
      name: "Les Veilleurs",
      description: "Sous une même lune",
      emblemId: "moon-wolf",
    });
    expect(screen.getByText("Aëlys")).toBeTruthy();
    expect(screen.getByText("Chef de guilde")).toBeTruthy();
    expect(screen.getByText("#1")).toBeTruthy();
  });

  it("keeps the draft and selection after a server rejection and prevents duplicate submissions", async () => {
    let rejectCreate!: (reason: Error) => void;
    mocks.create.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectCreate = reject;
        }),
    );
    render(<GuildsPanel id="guilds" onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Créer une guilde" }));
    fireEvent.change(screen.getByLabelText(/Nom de la guilde/), {
      target: { value: "Les Veilleurs" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Kraken des abysses" }));
    const form = screen.getByLabelText(/Nom de la guilde/).closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(
      screen
        .getByRole("button", { name: "Enregistrement…" })
        .matches(":disabled"),
    ).toBe(true);
    await act(async () =>
      rejectCreate(new ConvexError("Ce nom de guilde est déjà utilisé.")),
    );
    expect(screen.getByRole("alert").textContent).toContain("déjà utilisé");
    expect(
      (screen.getByLabelText(/Nom de la guilde/) as HTMLInputElement).value,
    ).toBe("Les Veilleurs");
    expect(
      screen
        .getByRole("button", { name: "Kraken des abysses" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("joins the selected guild and hides other join actions for members", async () => {
    mocks.join.mockImplementation(async () => {
      mine = { ...ownedGuild(), isLeader: false };
      ranking = {
        guildId,
        guilds: ranking.guilds.map((guild) => ({
          ...guild,
          isOwn: guild.id === guildId,
        })),
      };
      return guildId;
    });
    render(<GuildsPanel id="guilds" onClose={vi.fn()} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Rejoindre Les Veilleurs" }),
    );
    await screen.findByRole("list", { name: "Membres de ma guilde" });
    expect(mocks.join).toHaveBeenCalledWith({ guildId });
    expect(
      screen.queryByRole("button", { name: "Personnaliser la guilde" }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Toutes les guildes" }));
    expect(screen.queryByRole("button", { name: /Rejoindre/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Voir" }));
    expect(
      screen.getByRole("list", { name: "Membres de ma guilde" }),
    ).toBeTruthy();
  });

  it("lets the leader update the emblem and requires an explicit departure confirmation", async () => {
    mine = ownedGuild();
    ranking.guildId = guildId;
    ranking.guilds[0]!.isOwn = true;
    mocks.update.mockResolvedValue(null);
    mocks.leave.mockImplementation(async () => {
      mine = null;
      ranking.guildId = null;
    });
    render(<GuildsPanel id="guilds" onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Ma guilde" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Personnaliser la guilde" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Phénix solaire" }));
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith({
        guildId,
        name: "Les Veilleurs",
        description: "Sous une même lune",
        emblemId: "sun-phoenix",
      }),
    );
    await screen.findByRole("button", { name: "Quitter la guilde" });
    fireEvent.click(screen.getByRole("button", { name: "Quitter la guilde" }));
    expect(mocks.leave).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("plus ancien");
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmer le départ" }),
    );
    await screen.findByText("Ta place est parmi les gardiens");
    expect(mocks.leave).toHaveBeenCalledWith({ guildId });
  });

  it("shows loading and retry states and disables full guilds", () => {
    queryPending = true;
    const { rerender } = render(<GuildsPanel id="guilds" onClose={vi.fn()} />);
    expect(screen.getByRole("status").textContent).toContain("bannières");
    queryPending = false;
    queryError = true;
    rerender(<GuildsPanel id="guilds" onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(mocks.retry).toHaveBeenCalledOnce();
    queryError = false;
    ranking.guilds[0]!.memberCount = 30;
    rerender(<GuildsPanel id="guilds" onClose={vi.fn()} />);
    expect(
      screen
        .getByRole("button", { name: "Rejoindre Les Veilleurs" })
        .hasAttribute("disabled"),
    ).toBe(true);
  });
});
