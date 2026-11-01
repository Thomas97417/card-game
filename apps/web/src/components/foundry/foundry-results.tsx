import { useEffect, useRef } from "react";
import { Amphora, Gem, Footprints, Sparkles, Hammer, RotateCcw } from "lucide-react";
import { ACTIVE_RELIC_KINDS, FOUNDRY, RELICS, type FoundryRound } from "@sylve/game/foundry";
import { FoundryShardIcon } from "./foundry-icons";

const number = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const icons = { urn: Amphora, geode: Gem, runner: Footprints, chaos: Sparkles };

export function FoundryResults({ round, saved, notice, command, onContinue, onRetry, onRestore }: {
  round: FoundryRound; saved: boolean; notice: string;
  command?: { name: string; shards: number; cost: number };
  onContinue: () => void; onRetry: () => void; onRestore?: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => { title.current?.focus(); }, []);
  const swings = round.rogue?.strikes ?? round.hits;
  const hits = round.rogue?.complete?.hits;
  const accuracy = hits !== undefined && swings > 0 ? Math.min(100, Math.round(hits / swings * 100)) : undefined;
  return <div className="foundry-results" ref={panel} role="dialog" aria-modal="true" aria-labelledby="foundry-results-title"
    onKeyDown={(event) => {
      if (event.key === "Escape") { event.stopPropagation(); return; }
      if (event.key !== "Tab") return;
      const buttons = Array.from(panel.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
      if (!buttons.length) { event.preventDefault(); return; }
      const first = buttons[0]!, last = buttons[buttons.length - 1]!;
      if (document.activeElement === title.current || (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
        event.preventDefault(); (event.shiftKey ? last : first).focus();
      }
    }}>
    <div className="foundry-results-content">
      <h2 id="foundry-results-title" ref={title} tabIndex={-1}>Main fatiguée</h2>
      <div className="foundry-results-grid">
        <section className="foundry-results-harvest" aria-label="Récolte de la manche">
          <h3>Éclats récoltés</h3>
          <div className="foundry-results-total"><FoundryShardIcon size={42} /><strong>{number.format(round.shards)}</strong></div>
          <dl>
            {accuracy !== undefined && <div><dt>Précision</dt><dd>{accuracy} %</dd></div>}
            <div><dt>Frappes</dt><dd>{swings}</dd></div>
            <div><dt>Critiques</dt><dd>{round.criticals}</dd></div>
            <div><dt>Durée</dt><dd>{number.format(round.tick * FOUNDRY.stepMs / 1000)} s</dd></div>
          </dl>
        </section>
        <div className="foundry-results-right">
          <section className="foundry-results-relics" aria-label="Reliques brisées">
            <h3>Reliques brisées <strong>{round.broken}</strong></h3>
            {round.brokenByKind && <div className="foundry-results-kinds">{ACTIVE_RELIC_KINDS.map((kind) => {
              const Icon = icons[kind]; const count = round.brokenByKind?.[kind] ?? 0;
              return <div key={kind} className={count ? "" : "is-empty"} title={RELICS[kind].name} aria-label={`${RELICS[kind].name} : ${count}`}>
                <Icon size={30} aria-hidden="true" /><strong>{count}</strong><span>{RELICS[kind].name}</span>
              </div>;
            })}</div>}
          </section>
          {command && <section className="foundry-results-command" aria-label="Progression de la commande">
            <h3>{command.name}</h3>
            <div><FoundryShardIcon size={19} /><strong>{number.format(command.shards)} <small>/ {number.format(command.cost)}</small></strong></div>
            <div className="foundry-order-track" role="progressbar" aria-label="Éclats pour la commande" aria-valuemin={0} aria-valuemax={command.cost} aria-valuenow={Math.min(command.cost, command.shards)}>
              <i style={{ width: `${Math.min(100, command.shards / command.cost * 100)}%` }} />
            </div>
          </section>}
        </div>
      </div>
      <div className="foundry-results-actions">
        {notice && !saved && <p role="alert">{notice}</p>}
        {notice && !saved && <button type="button" className="foundry-quiet" onClick={() => { title.current?.focus(); onRetry(); }}><RotateCcw size={16} /> Réessayer la sauvegarde</button>}
        {notice && !saved && onRestore && <button type="button" className="foundry-quiet" onClick={onRestore}>Reprendre la sauvegarde du serveur</button>}
        <button type="button" className="foundry-primary" disabled={!saved} onClick={onContinue}><Hammer size={19} />{saved ? "Améliorations" : "Sauvegarde…"}</button>
      </div>
    </div>
  </div>;
}
