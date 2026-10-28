import type { ComponentType, ReactNode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import {
  dailyRewardsBoard,
  type DailyRewardReceipt,
} from "@sylve/game/daily-rewards";
import {
  DailyRewardsPanel,
  type HubDailyRewardsProps,
} from "./daily-rewards-panel";
import type { ChestReveal } from "@/components/play/chest-reveal-dialog";
import { Route } from "@/routes/hub";

const mocks = vi.hoisted(() => ({
  claim: vi.fn(),
  ensure: vi.fn(),
  gain: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
const now = Date.parse("2026-10-27T12:00:00Z");
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: { component: ComponentType }) => ({
    options,
    useSearch: () => ({}),
    useNavigate: () => vi.fn(),
  }),
  redirect: vi.fn(),
}));
vi.mock("convex/react", () => ({
  useAction: () => vi.fn(),
  useQuery: (query: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(query) === "dailyRewards:board"
      ? dailyRewardsBoard([], now)
      : undefined,
  useMutation: (mutation: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(mutation) === "dailyRewards:claim"
      ? mocks.claim
      : mocks.ensure,
}));
vi.mock("@/components/hub/village-hub", () => ({
  VillageHub: ({ dailyRewards }: { dailyRewards: HubDailyRewardsProps }) => (
    <DailyRewardsPanel
      {...dailyRewards}
      now={now}
      id="rewards"
      onClose={() => {}}
    />
  ),
}));
vi.mock("@/hooks/use-mine-collection", () => ({
  useMineBoard: () => undefined,
  useMineCollection: () => ({ pending: [], collectResource: vi.fn() }),
}));
vi.mock("@/components/play/chest-reveal-dialog", () => ({
  ChestRevealDialog: ({ reward }: { reward: ChestReveal | null }) =>
    reward ? (
      <div role="dialog" aria-label="Coffre du cadeau">
        {reward.rarity} · {reward.gold} pièces · {reward.reveals.length} cartes
      </div>
    ) : null,
}));
vi.mock("@/components/currency-gain", () => ({
  CurrencyGainProvider: ({ children }: { children: ReactNode }) => children,
  useCurrencyGain: () => mocks.gain,
}));
vi.mock("@/components/game/shared", () => ({ showGameError: mocks.error }));
vi.mock("sonner", () => ({ toast: { success: mocks.success } }));

const Page = Route.options.component as ComponentType;
const receipt: DailyRewardReceipt = {
  day: 1,
  claimedAt: now,
  gold: 5000,
  emeralds: 0,
  reveals: [],
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.claim.mockReset();
  mocks.ensure.mockResolvedValue(undefined);
});

describe("récupération des cadeaux depuis le hub", () => {
  it("guards rapid clicks and animates confirmed currency without a toast", async () => {
    let resolve!: (
      result: DailyRewardReceipt & { alreadyClaimed: boolean },
    ) => void;
    mocks.claim.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    render(<Page />);
    const button = screen.getByRole("button", { name: /Jour 1.*récupérer/ });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(mocks.claim).toHaveBeenCalledExactlyOnceWith({ day: 1 });
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(mocks.gain).not.toHaveBeenCalled();
    await act(async () => resolve({ ...receipt, alreadyClaimed: false }));
    expect(mocks.gain).toHaveBeenCalledExactlyOnceWith("gold", 5000);
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it("shows the server's chest contents in the existing reveal dialog", async () => {
    mocks.claim.mockResolvedValue({
      ...receipt,
      rarity: "epic",
      gold: 123,
      reveals: [
        {
          variantId: "guardian:epic",
          count: 2,
          isNew: true,
          level: 1,
          copies: 1,
        },
      ],
      alreadyClaimed: false,
    });
    render(<Page />);
    await act(async () =>
      fireEvent.click(
        screen.getByRole("button", { name: /Jour 1.*récupérer/ }),
      ),
    );
    expect(
      screen.getByRole("dialog", { name: "Coffre du cadeau" }).textContent,
    ).toBe("epic · 123 pièces · 1 cartes");
    expect(mocks.gain).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it.each(["replayed", "failed"] as const)(
    "does not celebrate a %s claim and releases the button",
    async (outcome) => {
      const error = new Error("Le cadeau n’est pas encore disponible.");
      if (outcome === "replayed")
        mocks.claim.mockResolvedValue({ ...receipt, alreadyClaimed: true });
      else mocks.claim.mockRejectedValue(error);
      render(<Page />);
      const button = screen.getByRole("button", {
        name: /Jour 1.*récupérer/,
      }) as HTMLButtonElement;
      await act(async () => fireEvent.click(button));
      expect(button.disabled).toBe(false);
      expect(mocks.gain).not.toHaveBeenCalled();
      expect(mocks.success).not.toHaveBeenCalled();
      expect(screen.queryByRole("dialog")).toBeNull();
      if (outcome === "failed") expect(mocks.error).toHaveBeenCalledWith(error);
    },
  );
});
