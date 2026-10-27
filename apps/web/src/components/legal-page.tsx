import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="legal-page">
      <div className="legal-container">
        <Link to="/" className="legal-back-link">
          <ArrowLeft size={16} aria-hidden="true" /> Retour à l’accueil
        </Link>
        <h1>{title}</h1>
        <div className="legal-copy">{children}</div>
        <nav className="legal-links" aria-label="Informations légales">
          <Link to="/cgu">CGU</Link>
          <Link to="/mentions-legales">Mentions légales</Link>
        </nav>
      </div>
    </main>
  );
}
