import type { CSSProperties } from "react";
import {
  Body, Button, Container, Head, Heading, Hr, Html, Img, Link, Preview, Section, Text,
} from "@react-email/components";
import { render, toPlainText } from "@react-email/render";

const content = {
  verification: {
    subject: "Vérifie ton adresse email — Sylve",
    preview: "Ton aventure commence ici. Active ton compte pour rejoindre les gardiens.",
    title: "Le cercle s’ouvre à toi.",
    description: "Bienvenue dans Sylve. Vérifie ton adresse email pour activer ton compte, rassembler tes compagnons et composer ta première alliance.",
    action: "Vérifier mon adresse email",
    image: "/art/emails/sanctuary.jpg",
    ignore: "Si tu n’as pas créé de compte Sylve, tu peux simplement ignorer cet email.",
    recoveryPath: "/verify-email",
  },
  "password-reset": {
    subject: "Réinitialise ton mot de passe — Sylve",
    preview: "Retrouve l’accès à ton refuge en choisissant un nouveau mot de passe.",
    title: "La clé d’un nouveau départ.",
    description: "Tu as demandé à réinitialiser ton mot de passe. Choisis-en un nouveau pour retrouver ton refuge et reprendre l’aventure avec tes compagnons.",
    action: "Choisir un nouveau mot de passe",
    image: "/art/emails/guardian-house.jpg",
    ignore: "Tu n’as pas demandé ce changement ? Ignore cet email : ton mot de passe restera inchangé.",
    recoveryPath: "/forgot-password",
  },
} as const;

export type AuthEmailKind = keyof typeof content;
type AuthEmailProps = { kind: AuthEmailKind; url: string; siteUrl: string };

const colors = {
  paper: "#f2eee3",
  forest: "#18372a",
  ink: "#263d30",
  muted: "#606e5c",
  gold: "#dfc48a",
};
const paragraph: CSSProperties = {
  color: colors.muted,
  fontSize: "15px",
  lineHeight: "26px",
  margin: "0 0 24px",
};

export function AuthEmail({ kind, url, siteUrl }: AuthEmailProps) {
  const email = content[kind];
  // Artwork belongs to the frontend, whereas the action URL can point to Convex.
  const homeUrl = new URL("/", siteUrl).href;
  const imageUrl = new URL(email.image, siteUrl).href;
  const recoveryUrl = new URL(email.recoveryPath, siteUrl).href;

  return (
    <Html lang="fr">
      <Head>
        <title>{email.subject}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
        <style>{`
          @media only screen and (max-width: 620px) {
            .email-container { margin: 12px auto !important; }
            .email-brand { padding: 22px 24px !important; }
            .email-content { padding: 28px 24px 24px !important; }
            .email-title { font-size: 30px !important; line-height: 36px !important; }
            .email-button { font-size: 13px !important; }
          }
        `}</style>
      </Head>
      <Preview>{email.preview}</Preview>
      <Body style={{ backgroundColor: "#e5e9dd", margin: "0", padding: "0 12px", fontFamily: '"Avenir Next", Avenir, "Segoe UI", Arial, sans-serif' }}>
        <Container className="email-container" style={{ width: "100%", maxWidth: "600px", margin: "32px auto", backgroundColor: colors.paper, border: "1px solid #cbd2be", borderRadius: "8px", overflow: "hidden" }}>
          <Section className="email-brand" style={{ backgroundColor: colors.forest, padding: "24px 40px", borderBottom: `2px solid ${colors.gold}` }}>
            <Link href={homeUrl} style={{ color: "#f5efde", fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "36px", lineHeight: "40px", letterSpacing: "-1.5px", textDecoration: "none" }}>
              Sylve<span style={{ color: colors.gold }}>.</span>
            </Link>
          </Section>
          <Img src={imageUrl} alt="" width={600} height={180} style={{ display: "block", width: "100%", maxWidth: "600px", height: "auto", border: "0" }} />
          <Section className="email-content" style={{ padding: "34px 40px 30px" }}>
            <Heading className="email-title" as="h1" style={{ color: colors.ink, fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "35px", lineHeight: "41px", letterSpacing: "-1px", fontWeight: "400", margin: "0 0 18px" }}>
              {email.title}
            </Heading>
            <Text style={paragraph}>{email.description}</Text>
            <Section style={{ marginBottom: "24px" }}>
              <Button className="email-button" href={url} style={{ display: "block", backgroundColor: "#2c543e", borderRadius: "5px", color: "#fff7e5", fontSize: "14px", lineHeight: "20px", fontWeight: "600", padding: "17px 0", textAlign: "center", textDecoration: "none" }}>
                {email.action}
              </Button>
            </Section>
            <Text style={{ ...paragraph, fontSize: "13px", lineHeight: "22px", marginBottom: "24px" }}>
              Ce lien est temporaire. S’il a expiré, tu peux{" "}
              <Link href={recoveryUrl} style={{ color: "#2c5b3d", textDecoration: "underline" }}>demander un nouveau lien</Link>.
            </Text>
            <Hr style={{ border: "0", borderTop: "1px solid #cbd2be", margin: "0 0 22px" }} />
            <Text style={{ ...paragraph, fontSize: "12px", lineHeight: "21px", marginBottom: "8px" }}>
              Si le bouton ne fonctionne pas, copie ce lien dans ton navigateur :
            </Text>
            <Link href={url} style={{ display: "block", color: "#2c5b3d", fontSize: "12px", lineHeight: "20px", textDecoration: "underline", wordBreak: "break-all", overflowWrap: "anywhere" }}>{url}</Link>
            <Text style={{ ...paragraph, fontSize: "13px", lineHeight: "22px", margin: "24px 0 0" }}>{email.ignore}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export async function renderAuthEmail(props: AuthEmailProps) {
  const html = await render(<AuthEmail {...props} />);
  return { subject: content[props.kind].subject, html, text: toPlainText(html) };
}
