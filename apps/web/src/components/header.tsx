import { Link } from "@tanstack/react-router";
import { Authenticated, Unauthenticated } from "convex/react";

import { Leaf, Map, Swords } from "lucide-react";
import { PlayerHeader } from "./player-header";

const linkStyles = "sylve-nav-link";

export default function Header() {
  return (
    <header className="sylve-header">
      <div className="header-inner">
        <div className="header-brand-nav">
          <Link to="/" className="sylve-logo">
            <span className="logo-mark">
              <Leaf size={22} />
            </span>
            Sylve<span className="logo-dot">.</span>
          </Link>
          <nav className="sylve-nav" aria-label="Navigation principale">
            <Authenticated>
              <Link to="/hub" className={linkStyles}>
                <Map size={15} />
                Le refuge
              </Link>
            </Authenticated>
            <Link to="/arena" className={linkStyles}>
              <Swords size={15} />
              Arène
            </Link>
            <Link to="/decks" className={linkStyles}>
              Mon deck
            </Link>
          </nav>
        </div>
        <div className="header-account-actions">
          <PlayerHeader />
          <Unauthenticated>
            <Link to="/sign-in" className="sylve-button secondary small-button">
              Connexion
            </Link>
          </Unauthenticated>
        </div>
      </div>
    </header>
  );
}
