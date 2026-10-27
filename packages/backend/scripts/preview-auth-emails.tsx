import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { renderAuthEmail } from "../convex/lib/authEmail";

// Render locally without importing an action or contacting the email service.
const directory = resolve(process.argv[2] ?? "/tmp/sylve-auth-emails");
const siteUrl = process.argv[3] ?? "http://localhost:3001";
await mkdir(directory, { recursive: true });

for (const kind of ["verification", "password-reset"] as const) {
  const url = new URL(`https://auth.sylve.example/api/auth/${kind === "verification" ? "verify-email" : "reset-password"}`);
  url.searchParams.set("token", "exemple-pour-apercu-sans-effet");
  url.searchParams.set("callbackURL", new URL("/sign-in?returnTo=%2Fdecks", siteUrl).href);
  const email = await renderAuthEmail({ kind, siteUrl, url: url.href });
  await writeFile(resolve(directory, `${kind}.html`), email.html);
  await writeFile(resolve(directory, `${kind}.txt`), `${email.subject}\n\n${email.text}`);
}

console.log(`Aperçus HTML et texte enregistrés dans ${directory}`);
