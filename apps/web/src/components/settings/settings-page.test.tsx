import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsPage } from "./settings-page";

const { auth, notifications } = vi.hoisted(() => ({
  auth: {
    listAccounts: vi.fn(),
    listSessions: vi.fn(),
    getSession: vi.fn(),
    updateUser: vi.fn(),
    changeEmail: vi.fn(),
    changePassword: vi.fn(),
    deleteUser: vi.fn(),
    revokeSession: vi.fn(),
    revokeOtherSessions: vi.fn(),
  },
  notifications: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/auth-client", () => ({ authClient: auth }));
vi.mock("sonner", () => ({ toast: notifications }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: { children: ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
  useRouter: () => ({ navigate: vi.fn() }),
}));

const user = { name: "Gardienne des sources", email: "gardienne@example.com" };
const sessions = [
  {
    id: "current",
    token: "current-test-token",
    userAgent: "Firefox",
    updatedAt: new Date("2026-10-24T10:00:00Z"),
  },
  {
    id: "other",
    token: "other-test-token",
    userAgent: "Chrome Android",
    updatedAt: new Date("2026-10-23T10:00:00Z"),
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  auth.listAccounts.mockResolvedValue({
    data: [{ providerId: "credential" }],
    error: null,
  });
  auth.listSessions.mockResolvedValue({ data: sessions, error: null });
  auth.getSession.mockResolvedValue({
    data: { session: { id: "current" } },
    error: null,
  });
  auth.changePassword.mockResolvedValue({ error: null });
  auth.revokeSession.mockResolvedValue({ error: null });
  auth.revokeOtherSessions.mockResolvedValue({ error: null });
});

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SettingsPage user={user} />
    </QueryClientProvider>,
  );
}

describe("les paramètres de la maison des gardiens", () => {
  it("preserves unsaved profile edits when switching between the French sections", async () => {
    setup();
    expect(screen.getByRole("heading", { name: "Paramètres" })).toBeTruthy();
    const name = screen.getByRole("textbox", { name: "Ton nom" });
    fireEvent.change(name, { target: { value: "Gardienne des brumes" } });
    fireEvent.click(screen.getByRole("tab", { name: /Sécurité/ }));
    expect(screen.getByRole("heading", { name: "Mot de passe" })).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /Profil/ }));
    expect(
      (
        screen.getByRole("textbox", {
          name: "Ton nom",
        }) as HTMLInputElement
      ).value,
    ).toBe("Gardienne des brumes");
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("validates the guardian name in French before sending a profile update", async () => {
    setup();
    const name = screen.getByRole("textbox", { name: "Ton nom" });
    fireEvent.change(name, { target: { value: "A" } });
    fireEvent.submit(name.closest("form")!);
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Le nom doit contenir au moins 2 caractères.",
    );
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("keeps social provider email addresses read-only with a French explanation", async () => {
    auth.listAccounts.mockResolvedValue({
      data: [{ providerId: "google" }],
      error: null,
    });
    setup();
    const email = screen.getByRole("textbox", {
      name: "Ton adresse e-mail",
    }) as HTMLInputElement;
    await waitFor(() => expect(email.disabled).toBe(true));
    expect(
      screen.getByText(
        "Cette adresse est gérée par ton fournisseur de connexion.",
      ),
    ).toBeTruthy();
    expect(auth.changeEmail).not.toHaveBeenCalled();
  });

  it("rejects mismatched passwords and translates a server authentication error", async () => {
    setup();
    fireEvent.click(screen.getByRole("tab", { name: /Sécurité/ }));
    const current = screen.getByLabelText("Mot de passe actuel", {});
    const password = screen.getByLabelText("Nouveau mot de passe", {});
    const confirmation = screen.getByLabelText(
      "Confirmer le nouveau mot de passe",
      { exact: true },
    );
    fireEvent.change(current, { target: { value: "ancien-exemple-test" } });
    fireEvent.change(password, { target: { value: "nouveau-exemple-test" } });
    fireEvent.change(confirmation, {
      target: { value: "different-exemple-test" },
    });
    fireEvent.submit(current.closest("form")!);
    expect(
      await screen.findByText("Les mots de passe ne correspondent pas."),
    ).toBeTruthy();
    expect(auth.changePassword).not.toHaveBeenCalled();
    auth.changePassword.mockResolvedValue({
      error: { code: "INVALID_PASSWORD", message: "Invalid password" },
    });
    fireEvent.change(confirmation, {
      target: { value: "nouveau-exemple-test" },
    });
    fireEvent.submit(current.closest("form")!);
    await waitFor(() =>
      expect(notifications.error).toHaveBeenCalledWith(
        "Le mot de passe actuel est incorrect.",
      ),
    );
  });

  it("opens the French deletion confirmation without deleting when cancelled", async () => {
    setup();
    fireEvent.click(screen.getByRole("tab", { name: /Sécurité/ }));
    fireEvent.click(
      screen.getByRole("button", { name: "Supprimer mon compte" }),
    );
    const dialog = within(await screen.findByRole("alertdialog"));
    expect(dialog.getByText("Supprimer ton compte ?")).toBeTruthy();
    fireEvent.click(dialog.getByRole("button", { name: "Annuler" }));
    expect(auth.deleteUser).not.toHaveBeenCalled();
  });

  it("distinguishes the current device and revokes only the selected other session", async () => {
    setup();
    fireEvent.click(screen.getByRole("tab", { name: /Appareils/ }));
    expect(await screen.findByText("Cet appareil")).toBeTruthy();
    expect(screen.getAllByText(/Dernière activité :.*octobre/)).toHaveLength(2);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Déconnecter cet appareil",
      }),
    );
    const dialog = within(await screen.findByRole("alertdialog"));
    expect(dialog.getByText("Déconnecter cet appareil ?")).toBeTruthy();
    fireEvent.click(dialog.getByRole("button", { name: "Annuler" }));
    expect(auth.revokeSession).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Déconnecter l’appareil Chrome",
      }),
    );
    await waitFor(() =>
      expect(auth.revokeSession).toHaveBeenCalledWith({
        token: "other-test-token",
      }),
    );
    expect(notifications.success).toHaveBeenCalledWith(
      "L’appareil a été déconnecté.",
    );
  });
});
