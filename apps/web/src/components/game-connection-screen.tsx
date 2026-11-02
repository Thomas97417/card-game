import { GameIcon } from "./game/game-icon";

export function GameConnectionScreen() {
  return (
    <main className="game-connection-screen">
      <div className="game-connection-scenery" aria-hidden="true">
        <img
          src="/art/play-lobby.webp"
          alt=""
          width={1672}
          height={941}
          fetchPriority="high"
        />
      </div>

      <div className="game-connection-content">
        <p className="game-connection-brand">
          Sylve<span>.</span>
        </p>
        <p className="game-connection-subtitle">Le cercle des gardiens</p>

        <div className="game-connection-emblem" aria-hidden="true">
          <GameIcon kind="guardian" size={112} />
        </div>

        <h1 className="game-connection-title">
          <span role="status">Connexion en cours…</span>
        </h1>
        <p className="game-connection-caption">Ton refuge t’attend.</p>
        <div className="game-connection-ornament" aria-hidden="true" />
      </div>
    </main>
  );
}
