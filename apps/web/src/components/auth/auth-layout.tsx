import { stylesheet } from "@/lib/stylesheet";
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Leaf } from "lucide-react";
import authCss from "@/auth.css?url";

const scenes = {
  "sign-in": {
    background: "/art/play-lobby.webp",
    subject: "/art/heroes/hero-sylve.webp",
    title: <>Ton refuge<br />t’attend.</>,
  },
  "sign-up": {
    background: "/art/sanctuary.webp",
    subject: "/art/characters/evolutions/dragon-legendary.webp",
    title: <>Ta légende<br />commence ici.</>,
  },
  "forgot-password": {
    background: "/art/guardian-house.webp",
    subject: "/art/keys/chest-key-3-v2.webp",
    title: <>Le chemin<br />vers ton refuge.</>,
  },
  "reset-password": {
    background: "/art/guardian-house.webp",
    subject: "/art/keys/chest-key-3-v2.webp",
    title: <>La clé d’un<br />nouveau départ.</>,
  },
  "verify-email": {
    background: "/art/sanctuary.webp",
    subject: "/art/ui/missions-scroll.webp",
    title: <>Le cercle<br />s’ouvre à toi.</>,
  },
} as const;

export type AuthScene = keyof typeof scenes;

export function authPageLinks(scene: AuthScene) {
  return [
    stylesheet(authCss),
    { rel: "preload", as: "image", href: scenes[scene].background },
  ];
}

export function AuthLayout({
  scene,
  children,
}: {
  scene: AuthScene;
  children: ReactNode;
}) {
  const artwork = scenes[scene];
  return (
    <main className="auth-layout" data-scene={scene}>
      <aside className="auth-art">
        <img className="auth-background" src={artwork.background} alt="" width={1672} height={941} fetchPriority="high" />
        <div className="auth-art-shade" />
        <Link to="/" className="auth-brand" aria-label="Sylve — Retour à l’accueil">
          <span aria-hidden="true"><Leaf size={25} strokeWidth={1.3} /></span>
          Sylve<span className="auth-brand-dot">.</span>
        </Link>
        <div className="auth-art-story" aria-hidden="true">
          <img className="auth-character" src={artwork.subject} alt="" width={512} height={scene === "sign-in" ? 768 : 512} />
          <p className="auth-art-title">{artwork.title}</p>
        </div>
      </aside>
      <section className="auth-panel" aria-label="Accès à ton compte Sylve">
        <Link to="/" className="auth-home-link"><ArrowLeft size={16} aria-hidden="true" /> Retour à l’accueil</Link>
        <div className="auth-form-container">{children}</div>
      </section>
    </main>
  );
}
