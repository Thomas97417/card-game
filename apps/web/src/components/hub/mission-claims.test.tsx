import type { ComponentType, ReactNode } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import {
  currentMissionState,
  missionBoard,
  type MissionBoard,
} from "@sylve/game/missions";
import { MissionsPanel, type HubMissionsProps } from "./missions-dialog";
import { CurrencyGain } from "@/components/currency-gain";
import { EmeraldIcon } from "@/components/emerald-balance";
import { Route } from "@/routes/hub";

const mocks = vi.hoisted(() => ({
  board: undefined as MissionBoard | undefined,
  claim: vi.fn(),
  ensure: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: { component: ComponentType }) => ({
    options,
    useSearch: () => ({}),
    useNavigate: () => vi.fn(),
  }),
  Link: ({ children, to, ...props }: { children: ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  redirect: vi.fn(),
}));
vi.mock("convex/react", () => ({
  useAction: () => vi.fn(),
  useQuery: (query: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(query) === "missions:board" ? mocks.board : undefined,
  useMutation: (mutation: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(mutation) === "missions:claim" ? mocks.claim : mocks.ensure,
}));
vi.mock("@/components/hub/village-hub", () => ({
  VillageHub: ({ missions }: { missions: HubMissionsProps }) => (
    <>
      <CurrencyGain currency="emeralds">
        <EmeraldIcon />
      </CurrencyGain>
      <MissionsPanel {...missions} id="test-missions" onClose={() => {}} />
    </>
  ),
}));
vi.mock("@/hooks/use-mine-collection", () => ({
  useMineBoard: () => undefined,
  useMineCollection: () => ({ pending: null, collectResource: vi.fn() }),
}));
vi.mock("@/components/play/chest-reveal-dialog", () => ({
  ChestRevealDialog: () => null,
}));
vi.mock("@/components/game/shared", () => ({ showGameError: mocks.error }));
vi.mock("sonner", () => ({ toast: { success: mocks.success } }));

const Page = Route.options.component as ComponentType;
const now = Date.parse("2026-10-21T12:00:00Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  vi.clearAllMocks();
  mocks.claim.mockReset();
  mocks.ensure.mockResolvedValue(undefined);
  const state = currentMissionState(null, now);
  state.daily.counters.battles = 1;
  state.weekly.counters.battles = 15;
  state.lifetime.upgrades = 5;
  mocks.board = missionBoard(state, now);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("retour de récupération des missions", () => {
  it.each([
    ["daily", "Jour", "Entre dans l’arène", 20],
    ["weekly", "Semaine", "L’appel du cercle", 100],
  ] as const)(
    "animates confirmed %s seals in their own track without a toast",
    async (_kind, tab, title, amount) => {
      let resolve!: (result: {
        currency: "seals";
        amount: number;
        alreadyClaimed: boolean;
      }) => void;
      mocks.claim.mockImplementation(
        () =>
          new Promise((done) => {
            resolve = done;
          }),
      );
      render(<Page />);
      fireEvent.click(screen.getByRole("tab", { name: new RegExp(`^${tab}`) }));
      const claim = screen.getByRole("button", {
        name: `Récupérer : ${title}`,
      });
      fireEvent.click(claim);
      fireEvent.click(claim);
      expect(mocks.claim).toHaveBeenCalledOnce();
      expect(claim.getAttribute("aria-busy")).toBe("true");
      expect(screen.queryByRole("status")).toBeNull();

      await act(async () =>
        resolve({ currency: "seals", amount, alreadyClaimed: false }),
      );
      const gain = screen.getByRole("status", {
        name: `${amount} sceaux de mission récupérés`,
      });
      expect(gain.textContent).toBe(`+${amount}`);
      expect(gain.querySelector("img")?.getAttribute("src")).toBe(
        "/art/ui/mission-seal.webp",
      );
      expect(mocks.success).not.toHaveBeenCalled();
      fireEvent.click(
        screen.getByRole("tab", {
          name: tab === "Jour" ? /^Semaine/ : /^Jour/,
        }),
      );
      expect(screen.queryByRole("status")).toBeNull();
      fireEvent.click(screen.getByRole("tab", { name: new RegExp(`^${tab}`) }));
      expect(screen.getByRole("status")).toBeTruthy();
      act(() => vi.advanceTimersByTime(1600));
      expect(screen.queryByRole("status")).toBeNull();
    },
  );

  it.each(["replayed", "rejected"] as const)(
    "does not celebrate a %s claim",
    async (outcome) => {
      const failure = new Error("Récupération refusée");
      if (outcome === "replayed")
        mocks.claim.mockResolvedValue({
          currency: "seals",
          amount: 20,
          alreadyClaimed: true,
        });
      else mocks.claim.mockRejectedValue(failure);
      render(<Page />);
      await act(async () =>
        fireEvent.click(
          screen.getByRole("button", {
            name: "Récupérer : Entre dans l’arène",
          }),
        ),
      );
      expect(screen.queryByRole("status")).toBeNull();
      expect(mocks.success).not.toHaveBeenCalled();
      if (outcome === "rejected")
        expect(mocks.error).toHaveBeenCalledWith(failure);
      expect(
        (
          screen.getByRole("button", {
            name: "Récupérer : Entre dans l’arène",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false);
    },
  );

  it("animates confirmed epic emeralds through the mine currency effect without a toast", async () => {
    let resolve!: (result: {
      currency: "emeralds";
      amount: number;
      alreadyClaimed: boolean;
    }) => void;
    mocks.claim.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    render(<Page />);
    fireEvent.click(screen.getByRole("tab", { name: /^Épique/ }));
    const claim = screen.getByRole("button", {
      name: "Récupérer : Maître de l’atelier",
    });
    fireEvent.click(claim);
    fireEvent.click(claim);
    expect(mocks.claim).toHaveBeenCalledExactlyOnceWith({
      missionId: "epic-upgrades",
      periodKey: "lifetime",
      tier: 0,
    });
    expect(claim.getAttribute("aria-busy")).toBe("true");
    expect(screen.queryByRole("status")).toBeNull();

    await act(async () =>
      resolve({ currency: "emeralds", amount: 15, alreadyClaimed: false }),
    );
    const gain = screen.getByRole("status", { name: "Émeraudes récupérées" });
    expect(gain.classList.contains("currency-gain")).toBe(true);
    expect(gain.getAttribute("data-currency")).toBe("emeralds");
    expect(gain.textContent).toContain("+ 15");
    expect(gain.querySelector("img")?.getAttribute("src")).toBe(
      "/art/ui/emerald.webp",
    );
    expect(mocks.success).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it.each(["replayed", "rejected"] as const)(
    "does not animate a %s epic claim and releases the button",
    async (outcome) => {
      const failure = new Error("Récupération refusée");
      if (outcome === "replayed")
        mocks.claim.mockResolvedValue({
          currency: "emeralds",
          amount: 15,
          alreadyClaimed: true,
        });
      else mocks.claim.mockRejectedValue(failure);
      render(<Page />);
      fireEvent.click(screen.getByRole("tab", { name: /^Épique/ }));
      const claim = screen.getByRole("button", {
        name: "Récupérer : Maître de l’atelier",
      }) as HTMLButtonElement;
      await act(async () => fireEvent.click(claim));
      expect(screen.queryByRole("status")).toBeNull();
      expect(mocks.success).not.toHaveBeenCalled();
      expect(claim.disabled).toBe(false);
      if (outcome === "rejected")
        expect(mocks.error).toHaveBeenCalledExactlyOnceWith(failure);
    },
  );
});
