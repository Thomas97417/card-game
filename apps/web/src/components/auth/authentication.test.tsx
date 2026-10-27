import type { ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SignInForm from "../sign-in-form";
import SignUpForm from "../sign-up-form";
import ForgotPasswordForm from "../forgot-password-form";
import VerifyEmailForm from "../verify-email-form";
import ResetPasswordForm from "../reset-password-form";

const { auth, search, redirect } = vi.hoisted(() => ({
  auth: {
    signIn: vi.fn(), signUp: vi.fn(), social: vi.fn(),
    requestReset: vi.fn(), verify: vi.fn(), reset: vi.fn(),
  },
  search: { current: { returnTo: "/decks" } as Record<string, unknown> },
  redirect: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({ authClient: {
  signIn: { email: auth.signIn, social: auth.social },
  signUp: { email: auth.signUp },
  requestPasswordReset: auth.requestReset,
  sendVerificationEmail: auth.verify,
  resetPassword: auth.reset,
} }));
vi.mock("@/lib/auth-feedback", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/auth-feedback")>(),
  redirectAfterAuth: redirect,
}));
vi.mock("@tanstack/react-router", () => ({
  useSearch: () => search.current,
  Link: ({ to, search: params, children, ...props }: { to: string; search?: Record<string, unknown>; children: ReactNode }) => {
    const query = new URLSearchParams(Object.entries(params ?? {}).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)]));
    return <a href={`${to}${query.size ? `?${query}` : ""}`} {...props}>{children}</a>;
  },
}));

beforeEach(() => {
  search.current = { returnTo: "/decks" };
  redirect.mockReset();
  for (const method of Object.values(auth)) method.mockReset().mockResolvedValue({ error: null });
});
afterEach(() => vi.useRealTimers());

function change(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label, { exact: true }), { target: { value } });
}
function submit() {
  fireEvent.submit(document.querySelector("form")!);
}
function signInValues() {
  change("Adresse email", "gardien@example.com");
  change("Mot de passe", "Fictif-test-42!");
}

describe("les parcours publics d’authentification", () => {
  it("annonce les erreurs et associe chaque erreur au champ sans appeler le serveur", async () => {
    render(<SignInForm />);
    submit();
    await screen.findByText("Saisis une adresse email valide.");
    expect(screen.getByLabelText("Adresse email").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByLabelText("Adresse email").getAttribute("aria-describedby")).toBe("email-error");
    expect(screen.getByText("Saisis ton mot de passe.").getAttribute("role")).toBe("alert");
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("Adresse email")));
    expect(auth.signIn).not.toHaveBeenCalled();
  });

  it("traduit un échec de connexion et conserve les valeurs saisies", async () => {
    auth.signIn.mockResolvedValue({ error: { code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid email or password" } });
    render(<SignInForm />);
    signInValues();
    submit();
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "L’adresse email ou le mot de passe est incorrect.");
    expect((screen.getByLabelText("Adresse email") as HTMLInputElement).value).toBe("gardien@example.com");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("propose la vérification avec l’email et la destination du joueur", async () => {
    auth.signIn.mockResolvedValue({ error: { code: "EMAIL_NOT_VERIFIED", status: 403 } });
    render(<SignInForm />);
    signInValues();
    submit();
    const link = await screen.findByRole("link", { name: "Recevoir un lien de vérification" });
    expect(link.getAttribute("href")).toBe("/verify-email?returnTo=%2Fdecks&email=gardien%40example.com");
  });

  it("reprend la destination du joueur après une connexion réussie", async () => {
    render(<SignInForm />);
    signInValues();
    submit();
    await waitFor(() => expect(redirect).toHaveBeenCalledWith("/decks"));
    expect(auth.signIn).toHaveBeenCalledWith({ email: "gardien@example.com", password: "Fictif-test-42!" });
  });

  it("présente les critères existants et refuse un mot de passe d’inscription incomplet", async () => {
    render(<SignUpForm />);
    change("Pseudo", "Gardienne");
    change("Adresse email", "gardienne@example.com");
    change("Mot de passe", "abcdefgh");
    expect(screen.getByText("8 caractères minimum").closest("li")?.getAttribute("data-met")).toBe("true");
    expect(screen.getByText("Un chiffre").closest("li")?.getAttribute("data-met")).toBe("false");
    submit();
    await screen.findByText("Ajoute une majuscule, une minuscule, un chiffre et un caractère spécial.");
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it("prépare directement la vérification après la création du compte", async () => {
    render(<SignUpForm />);
    change("Pseudo", "Gardienne");
    change("Adresse email", "gardienne@example.com");
    change("Mot de passe", "Fictif-test-42!");
    submit();
    await waitFor(() => expect(redirect).toHaveBeenCalledWith("/verify-email?returnTo=%2Fdecks&email=gardienne%40example.com&sent=1"));
    expect(auth.signUp).toHaveBeenCalledWith({ name: "Gardienne", email: "gardienne@example.com", password: "Fictif-test-42!", callbackURL: `${window.location.origin}/sign-in?returnTo=%2Fdecks` });
  });

  it("n’annonce pas l’envoi d’un lien de récupération lorsque l’API retourne une erreur", async () => {
    auth.requestReset.mockResolvedValue({ error: { status: 429, code: "TOO_MANY_REQUESTS" } });
    render(<ForgotPasswordForm />);
    change("Adresse email", "gardien@example.com");
    submit();
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Trop de tentatives. Patiente un instant avant de réessayer.");
    expect(screen.queryByRole("heading", { name: "Consulte ta boîte mail." })).toBeNull();
    expect(screen.getByLabelText("Adresse email")).toBeTruthy();
  });

  it("confirme un envoi réussi sans divulguer l’existence du compte et permet de corriger l’adresse", async () => {
    render(<ForgotPasswordForm />);
    change("Adresse email", "gardien@example.com");
    submit();
    await screen.findByRole("heading", { name: "Consulte ta boîte mail." });
    expect(auth.requestReset).toHaveBeenCalledWith({ email: "gardien@example.com", redirectTo: `${window.location.origin}/reset-password?returnTo=%2Fdecks` });
    expect(screen.getByText(/Si un compte correspond/)).toBeTruthy();
    expect((screen.getByRole("button", { name: /Renvoyer le lien dans/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Utiliser une autre adresse" }));
    expect((screen.getByLabelText("Adresse email") as HTMLInputElement).value).toBe("gardien@example.com");
  });

  it("n’annonce pas l’envoi de vérification lorsque le service refuse la demande", async () => {
    auth.verify.mockResolvedValue({ error: { code: "INTERNAL_SERVER_ERROR" } });
    render(<VerifyEmailForm />);
    change("Adresse email", "gardien@example.com");
    submit();
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Le lien n’a pas pu être envoyé. Réessaie dans un instant.");
    expect(screen.queryByRole("heading", { name: "Consulte ta boîte mail." })).toBeNull();
  });

  it("évite un second envoi automatique après inscription et temporise le renvoi", async () => {
    vi.useFakeTimers();
    search.current = { returnTo: "/decks", email: "gardien@example.com", sent: true };
    render(<VerifyEmailForm />);
    expect(screen.getByRole("heading", { name: "Consulte ta boîte mail." })).toBeTruthy();
    expect(auth.verify).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: /Renvoyer le lien dans/ }) as HTMLButtonElement).disabled).toBe(true);
    act(() => { vi.advanceTimersByTime(60_000); });
    const resend = screen.getByRole("button", { name: "Renvoyer le lien" });
    expect((resend as HTMLButtonElement).disabled).toBe(false);
    await act(async () => { fireEvent.click(resend); });
    expect(auth.verify).toHaveBeenCalledWith({ email: "gardien@example.com", callbackURL: `${window.location.origin}/sign-in?returnTo=%2Fdecks` });
  });

  it("propose une issue claire lorsqu’un lien de réinitialisation est incomplet", () => {
    render(<ResetPasswordForm />);
    expect(screen.getByRole("heading", { name: "Ce lien n’est plus valide." })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Demander un nouveau lien" }).getAttribute("href")).toBe("/forgot-password?returnTo=%2Fdecks");
    expect(auth.reset).not.toHaveBeenCalled();
  });

  it("vérifie la confirmation et permet d’afficher chaque mot de passe au clavier", async () => {
    search.current.token = "test-reset-token";
    render(<ResetPasswordForm />);
    change("Nouveau mot de passe", "Fictif-test-42!");
    change("Confirmer le mot de passe", "Autre-test-42!");
    fireEvent.click(screen.getByRole("button", { name: "Afficher la confirmation du mot de passe" }));
    expect(screen.getByLabelText("Confirmer le mot de passe").getAttribute("type")).toBe("text");
    submit();
    await screen.findByText("Les mots de passe ne correspondent pas.");
    expect(auth.reset).not.toHaveBeenCalled();
    change("Confirmer le mot de passe", "Fictif-test-42!");
    await waitFor(() => expect((screen.getByRole("button", { name: "Enregistrer le mot de passe" }) as HTMLButtonElement).disabled).toBe(false));
    submit();
    await screen.findByRole("heading", { name: "Ton refuge t’attend." });
    expect(auth.reset).toHaveBeenCalledWith({ token: "test-reset-token", newPassword: "Fictif-test-42!" });
    expect(screen.queryByLabelText("Nouveau mot de passe")).toBeNull();
  });

  it("remplace le formulaire par une demande de nouveau lien si le serveur détecte son expiration", async () => {
    search.current.token = "test-expired-token";
    auth.reset.mockResolvedValue({ error: { code: "INVALID_TOKEN" } });
    render(<ResetPasswordForm />);
    change("Nouveau mot de passe", "Fictif-test-42!");
    change("Confirmer le mot de passe", "Fictif-test-42!");
    submit();
    await screen.findByRole("heading", { name: "Ce lien n’est plus valide." });
    expect(screen.queryByLabelText("Nouveau mot de passe")).toBeNull();
  });

  it("protège la destination OAuth et rend les contrôles disponibles après un échec", async () => {
    search.current.returnTo = "https://example.com/untrusted";
    auth.social.mockRejectedValue(new Error("Network unavailable"));
    render(<SignInForm />);
    fireEvent.click(screen.getByRole("button", { name: "Continuer avec Google" }));
    await screen.findByRole("alert");
    expect(auth.social).toHaveBeenCalledWith({ provider: "google", callbackURL: `${window.location.origin}/hub` });
    expect((screen.getByRole("button", { name: "Continuer avec GitHub" }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole("button", { name: "Se connecter" }) as HTMLButtonElement).disabled).toBe(false);
  });
});
