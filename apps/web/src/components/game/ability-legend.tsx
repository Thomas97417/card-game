import { AbilityIcon, type AbilityIconKind } from "./ability-icons";

const entries: [AbilityIconKind, string, string][] = [
  ["power", "Puissance", "Augmente l’attaque."],
  ["vitality", "Vitalité", "Augmente les PV actuels et maximum."],
  ["heal", "Soin", "Restaure des PV, jusqu’au maximum."],
  ["block", "Blocage", "Réduit les dégâts des attaques physiques."],
  ["spikes", "Épines", "Renvoie des dégâts à l’attaquant."],
  [
    "vampirism",
    "Vampirisme",
    "Draine des PV après l’attaque et soigne son porteur.",
  ],
  ["regeneration", "Régénération", "Soigne au début du tour du propriétaire."],
  [
    "mental-shield",
    "Bouclier mental",
    "Annule les prochains dégâts, puis disparaît.",
  ],
  ["double-strike", "Double attaque", "Effectue une seconde attaque."],
  [
    "piercing",
    "Perforation",
    "Inflige des dégâts dans la colonne de la cible.",
  ],
  [
    "life-rune",
    "Rune de vie",
    "Renforce la prochaine unité qui apparaît sur cette case.",
  ],
  [
    "reinforcement",
    "Renfort",
    "Invoque une unité sur une case libre adjacente.",
  ],
  [
    "order-alliance",
    "Alliance de l’Ordre",
    "Renforce l’attaque grâce aux alliés Ordre.",
  ],
  ["weaken", "Affaiblissement", "Réduit l’attaque."],
  [
    "blocked",
    "Attaque bloquée",
    "Un allié placé devant empêche cette unité de mêlée d’attaquer.",
  ],
  ["temporary", "Bonus temporaire", "Expire après l’assaut du propriétaire."],
];

export function AbilityLegend() {
  return (
    <details className="ability-legend">
      <summary>Comprendre les icônes</summary>
      <p>
        Les icônes au pied des compagnons indiquent leurs capacités ; celles sur
        le côté montrent leurs états actuels. Ouvre une fiche pour consulter
        leurs effets et leurs valeurs. Un cadenas indique un niveau encore à
        atteindre.
      </p>
      <dl>
        {entries.map(([kind, label, description]) => (
          <div key={kind}>
            <AbilityIcon kind={kind} size={32} />
            <div>
              <dt>{label}</dt>
              <dd>{description}</dd>
            </div>
          </div>
        ))}
      </dl>
    </details>
  );
}
