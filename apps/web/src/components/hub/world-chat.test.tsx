import type { ReactNode } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConvexError } from "convex/values";
import { useQuery } from "convex/react";
import { HubDock } from "./hub-dock";

type Message = {
  id: string;
  sentAt: number;
  senderName: string;
  body: string;
  isOwn: boolean;
  continuesPrevious?: boolean;
};
const state = vi.hoisted(() => ({
  messages: [] as Message[] | undefined,
  connected: true,
  send: vi.fn(),
  resize: () => {},
}));

vi.mock("convex/react", () => ({
  useQuery: vi.fn((_query, args) =>
    args === "skip" ? undefined : state.messages,
  ),
  useMutation: () => state.send,
  useConvexConnectionState: () => ({ isWebSocketConnected: state.connected }),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: [], isPending: false, isError: false }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: { children: ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

async function openChat() {
  const trigger = screen.getByRole("button", { name: /^Chat mondial/ });
  await act(async () => fireEvent.click(trigger));
  await screen.findByLabelText("Ton message");
  return trigger;
}

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        state.resize = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  state.messages = [];
  state.connected = true;
  state.send.mockReset().mockResolvedValue("sent-message");
  vi.mocked(useQuery).mockClear();
});
afterEach(() => vi.unstubAllGlobals());

describe("le chat mondial du refuge", () => {
  it("preserves the draft when switching between the chat, ranking and missions", async () => {
    render(<HubDock />);
    const chatTrigger = await openChat();
    fireEvent.change(screen.getByLabelText("Ton message"), {
      target: { value: "Mon message en cours" },
    });
    const rankingTrigger = screen.getByRole("button", {
      name: "Classement",
    });
    await act(async () => fireEvent.click(rankingTrigger));
    expect(
      screen.getByRole("region", { name: "Classement mondial" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("region", { name: "Chat mondial" }),
    ).toBeNull();
    expect(vi.mocked(useQuery).mock.calls.at(-1)?.[1]).toBe("skip");
    fireEvent.click(chatTrigger);
    expect(
      screen.queryByRole("region", { name: "Classement mondial" }),
    ).toBeNull();
    expect(rankingTrigger.getAttribute("aria-expanded")).toBe("false");
    expect(
      (screen.getByLabelText("Ton message") as HTMLTextAreaElement).value,
    ).toBe("Mon message en cours");
    const missionsTrigger = screen.getByRole("button", { name: "Missions" });
    fireEvent.click(missionsTrigger);
    expect(screen.queryByRole("region", { name: "Chat mondial" })).toBeNull();
    expect(screen.getByRole("region", { name: "Missions" })).toBeTruthy();
    expect(vi.mocked(useQuery).mock.calls.at(-1)?.[1]).toBe("skip");
    fireEvent.click(chatTrigger);
    expect(screen.queryByRole("region", { name: "Missions" })).toBeNull();
    expect(missionsTrigger.getAttribute("aria-expanded")).toBe("false");
    expect(
      (screen.getByLabelText("Ton message") as HTMLTextAreaElement).value,
    ).toBe("Mon message en cours");
  });

  it("subscribes on opening, shows live messages and closes with Escape, restoring focus and the draft", async () => {
    state.messages = [
      {
        id: "one",
        sentAt: Date.now(),
        senderName: "Léa",
        body: "Bonjour les gardiens !",
        isOwn: false,
      },
    ];
    render(<HubDock />);
    expect(useQuery).not.toHaveBeenCalled();
    expect(screen.queryByRole("log")).toBeNull();
    const trigger = await openChat();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Léa")).toBeTruthy();
    expect(screen.getByText("Bonjour les gardiens !")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Ton message"), {
      target: { value: "Mon brouillon" },
    });
    fireEvent.keyDown(screen.getByLabelText("Ton message"), { key: "Escape" });
    expect(screen.queryByRole("log")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(vi.mocked(useQuery).mock.calls.at(-1)?.[1]).toBe("skip");
    fireEvent.click(trigger);
    expect(
      (screen.getByLabelText("Ton message") as HTMLTextAreaElement).value,
    ).toBe("Mon brouillon");
    fireEvent.click(
      screen.getByRole("button", { name: "Fermer le chat mondial" }),
    );
    expect(document.activeElement).toBe(trigger);
  });

  it("sends trimmed text with Enter, prevents concurrent submissions and clears only after success", async () => {
    let resolve!: () => void;
    state.send.mockImplementation(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    );
    render(<HubDock />);
    await openChat();
    const input = screen.getByLabelText("Ton message") as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: "  Salut la Sylve !  " } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(state.send).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.submit(input.closest("form")!);
    expect(state.send).toHaveBeenCalledExactlyOnceWith({
      body: "Salut la Sylve !",
    });
    expect(input.value).toBe("  Salut la Sylve !  ");
    expect(input.disabled).toBe(true);
    resolve();
    await waitFor(() => expect(input.value).toBe(""));
    expect(input.disabled).toBe(false);
  });

  it("keeps a failed message available to retry and reports the server error", async () => {
    state.send.mockRejectedValueOnce(
      new ConvexError("Patiente deux secondes entre deux messages."),
    );
    render(<HubDock />);
    await openChat();
    const input = screen.getByLabelText("Ton message") as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: "Une nouvelle aventure" } });
    fireEvent.click(screen.getByRole("button", { name: "Envoyer le message" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Patiente deux secondes",
    );
    expect(input.value).toBe("Une nouvelle aventure");
    fireEvent.click(screen.getByRole("button", { name: "Envoyer le message" }));
    await waitFor(() => expect(input.value).toBe(""));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("handles loading, an empty chat and a lost connection without losing text", async () => {
    state.messages = undefined;
    const view = render(<HubDock />);
    await openChat();
    expect(screen.getByText("Les messages arrivent…")).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "Envoyer le message",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    state.messages = [];
    view.rerender(<HubDock />);
    expect(screen.getByText("La conversation commence ici")).toBeTruthy();
    const input = screen.getByLabelText("Ton message") as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(state.send).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "À bientôt !" } });
    state.connected = false;
    view.rerender(<HubDock />);
    expect(
      screen.getByText("Connexion interrompue. Ton brouillon est conservé."),
    ).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "Envoyer le message",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(input.value).toBe("À bientôt !");
    state.connected = true;
    view.rerender(<HubDock />);
    expect(
      (
        screen.getByRole("button", {
          name: "Envoyer le message",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });

  it("preserves the reading position when new messages arrive and can jump back to the latest", async () => {
    state.messages = [
      {
        id: "one",
        sentAt: Date.now(),
        senderName: "Léa",
        body: "Premier message",
        isOwn: false,
      },
    ];
    const view = render(<HubDock />);
    await openChat();
    const log = screen.getByRole("log");
    Object.defineProperties(log, {
      scrollHeight: { value: 1200 },
      clientHeight: { value: 300 },
    });
    state.resize();
    log.scrollTop = 100;
    fireEvent.scroll(log);
    state.messages = [
      ...state.messages!,
      {
        id: "two",
        sentAt: Date.now(),
        senderName: "Alice",
        body: "<script>salut</script>",
        isOwn: true,
      },
    ];
    view.rerender(<HubDock />);
    expect(log.scrollTop).toBe(100);
    expect(screen.getByText("<script>salut</script>")).toBeTruthy();
    expect(screen.getByText("Toi")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Nouveaux messages" }));
    expect(log.scrollTop).toBe(1200);
    expect(
      screen.queryByRole("button", { name: "Nouveaux messages" }),
    ).toBeNull();
  });

  it("keeps the latest messages visible when the viewport resizes while preserving an older reading position", async () => {
    state.messages = [
      {
        id: "one",
        sentAt: Date.now(),
        senderName: "Léa",
        body: "Bonjour",
        isOwn: false,
      },
    ];
    render(<HubDock />);
    await openChat();
    const log = screen.getByRole("log");
    Object.defineProperties(log, {
      scrollHeight: { value: 1200 },
      clientHeight: { value: 300, configurable: true },
    });
    state.resize();
    expect(log.scrollTop).toBe(1200);
    Object.defineProperty(log, "clientHeight", { value: 200 });
    log.scrollTop = 900;
    fireEvent.scroll(log);
    state.resize();
    expect(log.scrollTop).toBe(1200);
    log.scrollTop = 100;
    fireEvent.scroll(log);
    state.resize();
    expect(log.scrollTop).toBe(100);
  });

  it("groups consecutive messages with one header and an avatar on the last row, on both sides", async () => {
    const sentAt = new Date(2026, 9, 25, 14).getTime();
    state.messages = [
      {
        id: "one",
        sentAt,
        senderName: "Léa",
        body: "Bonjour !",
        isOwn: false,
        continuesPrevious: false,
      },
      {
        id: "two",
        sentAt: sentAt + 60_000,
        senderName: "Léa",
        body: "Un défi amical ?",
        isOwn: false,
        continuesPrevious: true,
      },
      {
        id: "three",
        sentAt: sentAt + 120_000,
        senderName: "Alice",
        body: "Avec plaisir !",
        isOwn: true,
        continuesPrevious: false,
      },
      {
        id: "four",
        sentAt: sentAt + 180_000,
        senderName: "Alice",
        body: "Je prépare mon deck.",
        isOwn: true,
        continuesPrevious: true,
      },
      {
        id: "five",
        sentAt: sentAt + 240_000,
        senderName: "Léa",
        body: "À tout de suite !",
        isOwn: false,
        continuesPrevious: false,
      },
    ];
    render(<HubDock />);
    await openChat();

    const received = screen.getAllByRole("group", { name: "Messages de Léa" });
    const own = screen.getByRole("group", { name: "Tes messages" });
    expect(received).toHaveLength(2);
    expect(within(received[0]!).getByText("Bonjour !")).toBeTruthy();
    expect(within(received[0]!).getByText("Un défi amical ?")).toBeTruthy();
    expect(within(received[1]!).getByText("À tout de suite !")).toBeTruthy();
    expect(within(own).getByText("Avec plaisir !")).toBeTruthy();
    expect(within(own).getByText("Je prépare mon deck.")).toBeTruthy();
    expect(screen.getAllByText("Léa")).toHaveLength(2);
    expect(screen.getAllByText("Toi")).toHaveLength(1);
    for (const group of [received[0]!, own]) {
      const avatars = group.querySelectorAll('[data-slot="message-avatar"]');
      expect(avatars).toHaveLength(2);
      expect(avatars[0]!.textContent).toBe("");
      expect(avatars[1]!.textContent).not.toBe("");
      expect(group.querySelectorAll("time")).toHaveLength(2);
    }
  });

  it("starts another group at a day boundary even when the sender continues", async () => {
    state.messages = [
      {
        id: "one",
        sentAt: new Date(2026, 9, 24, 23, 59).getTime(),
        senderName: "Léa",
        body: "Bonne nuit !",
        isOwn: false,
        continuesPrevious: false,
      },
      {
        id: "two",
        sentAt: new Date(2026, 9, 25, 0, 1).getTime(),
        senderName: "Léa",
        body: "Un dernier duel ?",
        isOwn: false,
        continuesPrevious: true,
      },
    ];
    render(<HubDock />);
    await openChat();
    expect(
      screen.getAllByRole("group", { name: "Messages de Léa" }),
    ).toHaveLength(2);
    expect(screen.getByText("24 octobre")).toBeTruthy();
    expect(screen.getByText("25 octobre")).toBeTruthy();
  });

  it("extends a live group and moves the avatar to the new last message", async () => {
    state.messages = [
      {
        id: "one",
        sentAt: Date.now(),
        senderName: "Léa",
        body: "Bonjour !",
        isOwn: false,
        continuesPrevious: false,
      },
    ];
    const view = render(<HubDock />);
    await openChat();
    const firstAvatar = screen
      .getByRole("group", { name: "Messages de Léa" })
      .querySelector('[data-slot="message-avatar"]');
    expect(firstAvatar!.textContent).toBe("LÉ");

    state.messages = [
      ...state.messages!,
      {
        id: "two",
        sentAt: Date.now(),
        senderName: "Léa",
        body: "Encore moi !",
        isOwn: false,
        continuesPrevious: true,
      },
    ];
    view.rerender(<HubDock />);
    const group = screen.getByRole("group", { name: "Messages de Léa" });
    expect(within(group).getByText("Bonjour !")).toBeTruthy();
    expect(within(group).getByText("Encore moi !")).toBeTruthy();
    expect(screen.getAllByText("Léa")).toHaveLength(1);
    expect(firstAvatar!.textContent).toBe("");
    expect(
      group.querySelectorAll('[data-slot="message-avatar"]')[1]!.textContent,
    ).toBe("LÉ");
  });
});
