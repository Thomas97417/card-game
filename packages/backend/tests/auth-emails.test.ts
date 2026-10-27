// @vitest-environment node
import { existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { internal } from "../convex/_generated/api";
import { renderAuthEmail, type AuthEmailKind } from "../convex/lib/auth-email";
import schema from "../convex/schema";

const { sendEmail } = vi.hoisted(() => ({ sendEmail: vi.fn() }));
vi.mock("@convex-dev/resend", () => ({
  Resend: class { sendEmail = sendEmail; },
}));

const modules = import.meta.glob("../convex/**/*.{ts,tsx}");
const siteUrl = "https://sylve.example";
const cases = [
  { kind: "verification", path: "verify-email", image: "sanctuary.jpg", subject: "Vérifie ton adresse email — Sylve", action: "Vérifier mon adresse email" },
  { kind: "password-reset", path: "forgot-password", image: "guardian-house.jpg", subject: "Réinitialise ton mot de passe — Sylve", action: "Choisir un nouveau mot de passe" },
] satisfies { kind: AuthEmailKind; path: string; image: string; subject: string; action: string }[];

beforeEach(() => {
  vi.stubEnv("SITE_URL", siteUrl);
  sendEmail.mockReset().mockResolvedValue("test-email");
});
afterEach(() => vi.unstubAllEnvs());

describe("les emails d’authentification Sylve", () => {
  for (const email of cases) {
    it(`${email.kind} : conserve le lien d’authentification dans le bouton, le secours et la version texte`, async () => {
      const url = "https://auth.example/api/auth/verify-email?token=exemple%2B%2F%3D&callbackURL=https%3A%2F%2Fsylve.example%2Fsign-in%3FreturnTo%3D%252Fdecks";
      const rendered = await renderAuthEmail({ kind: email.kind, url, siteUrl });
      expect(rendered.subject).toBe(email.subject);
      expect(rendered.html).toContain('lang="fr"');
      expect(rendered.html).toContain(email.action);
      const links = [...rendered.html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
      expect(links.filter((href) => href === url.replaceAll("&", "&amp;"))).toHaveLength(2);
      expect(rendered.text).toContain(url);
      expect(rendered.text).toContain("Ce lien est temporaire.");
      expect(rendered.text).toContain(`${siteUrl}/${email.path}`);
      expect(rendered.text).not.toMatch(/<html|<img|<table/);
    });

    it(`${email.kind} : utilise une illustration JPEG existante sur l’origine du jeu`, async () => {
      const rendered = await renderAuthEmail({ kind: email.kind, url: "https://auth.example/link", siteUrl: `${siteUrl}/` });
      expect(rendered.html).toContain(`src="${siteUrl}/art/emails/${email.image}"`);
      expect(rendered.html).not.toContain('src="https://auth.example');
      const image = fileURLToPath(new URL(`../../../apps/web/public/art/emails/${email.image}`, import.meta.url));
      expect(existsSync(image)).toBe(true);
      expect(statSync(image).size).toBeLessThan(200_000);
      expect(Buffer.byteLength(rendered.html)).toBeLessThan(40_000);
    });
  }

  it("échappe le lien sans permettre l’injection de contenu HTML", async () => {
    const url = 'https://auth.example/link?token=exemple"><script>alert(1)</script>';
    const email = await renderAuthEmail({ kind: "verification", url, siteUrl });
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
  });

  it("envoie le nouveau modèle de vérification et sa version texte", async () => {
    const t = convexTest(schema, modules);
    const url = "https://auth.example/verify-email?token=exemple";
    await t.action(internal.sendEmails.sendVerificationEmail, { from: "Sylve <jeu@example.invalid>", to: "gardien@example.invalid", url, token: "exemple" });
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(sendEmail.mock.calls[0]?.[1]).toMatchObject({
      from: "Sylve <jeu@example.invalid>", to: "gardien@example.invalid",
      subject: "Vérifie ton adresse email — Sylve",
      html: expect.stringContaining("Le cercle s’ouvre à toi."),
      text: expect.stringContaining(url),
    });
  });

  it("envoie la réinitialisation avec une explication claire si la demande est inconnue", async () => {
    const t = convexTest(schema, modules);
    const url = "https://auth.example/reset-password?token=exemple";
    await t.action(internal.sendEmails.sendResetPasswordEmail, { from: "Sylve <jeu@example.invalid>", to: "gardien@example.invalid", url });
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(sendEmail.mock.calls[0]?.[1]).toMatchObject({
      from: "Sylve <jeu@example.invalid>", to: "gardien@example.invalid",
      subject: "Réinitialise ton mot de passe — Sylve",
      html: expect.stringContaining("ton mot de passe restera inchangé."),
      text: expect.stringContaining(url),
    });
  });
});
