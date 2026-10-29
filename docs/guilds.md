# Guildes du refuge

Le raccourci **Guilde**, à côté d’Amis et du Classement dans le refuge, ouvre deux menus : **Toutes les guildes** et **Ma guilde**. Le module se charge à l’ouverture ou au survol/focus du raccourci.

## Classement

Toutes les guildes sont classées par puissance décroissante. La puissance d’une guilde est la somme des puissances des **cartes actuellement équipées** de ses membres, dans la limite des emplacements débloqués de chacun. Les niveaux et liens d’âme sont pris en compte avec les mêmes règles que l’atelier. Le niveau du Gardien et les records historiques de puissance ne sont pas ajoutés à cette somme.

Le calcul utilise `heroDeckCards` et `deckMight`, côté Convex. Les changements de composition, améliorations, liens d’âme, emplacements et adhésions actualisent les requêtes réactives. En cas d’égalité, la guilde la plus ancienne passe devant, puis son identifiant sert de dernier départage stable. La recherche conserve le rang mondial et ignore les accents et la casse.

## Création et membres

- Création gratuite, avec un nom de 3 à 32 caractères, une description facultative de 160 caractères maximum et un emblème choisi parmi 16 illustrations.
- Un seul groupe par joueur ; jusqu’à 30 membres par guilde. L’adhésion est libre tant qu’il reste une place.
- Le créateur devient chef et peut modifier le nom, la description et l’emblème. Les noms sont réservés après normalisation Unicode, des espaces et de la casse.
- Ma guilde affiche la puissance totale, le rang, les membres, leur Gardien actif et leur contribution de puissance.
- Un départ demande confirmation dans l’interface. Si le chef part, le membre restant le plus ancien lui succède. Le dernier départ dissout la guilde et libère son nom.
- Les comptes supprimés ne contribuent plus au score et leurs places sont libérées à la prochaine adhésion.

Les tables `guilds` et `guildMemberships` conservent l’identité et les adhésions. Les mutations valident côté serveur l’authentification, les droits, les noms, l’emblème, la capacité et l’appartenance unique. L’interface bloque les doubles soumissions et conserve le formulaire après une erreur.

## Illustrations

Génération : **ImageGen intégré**, fond transparent. Les prompts complets figurent dans [art-prompts.json](art-prompts.json).

| Illustration | Fichier |
| --- | --- |
| Bannière du raccourci Guilde | `apps/web/public/art/ui/guild-banner.webp` |
| Dragon de braise | `apps/web/public/art/guilds/ember-dragon.webp` |
| Loup lunaire | `apps/web/public/art/guilds/moon-wolf.webp` |
| Phénix solaire | `apps/web/public/art/guilds/sun-phoenix.webp` |
| Kraken des abysses | `apps/web/public/art/guilds/abyss-kraken.webp` |

La collection existante propose aussi l’écu de la Sylve, les trois factions, les lames de l’arène, le cristal du sanctuaire, les liens d’âme, la couronne de victoire, le Dragon d’ambre, le Loup des failles, la Prêtresse de l’aurore et la Pèlerine du serment. La liste partagée et les chemins sont dans `packages/game/src/guilds.ts`.
