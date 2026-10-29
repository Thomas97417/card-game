# Illustrations de Sylve

Les illustrations intégrées sont dans `apps/web/public/art/`. Le [manifeste](art-prompts.json) regroupe leurs chemins et les prompts ImageGen disponibles pour les fichiers conservés. Les retouches peuvent prendre le sprite final comme référence ; le prompt initial du fond `forest-arena.png` n’a pas été archivé.

## Organisation actuelle

| Dossier ou fichier | Usage |
| --- | --- |
| `characters/` et `characters/evolutions/` | 84 variantes du catalogue, renforts invoqués et portraits de compatibilité |
| `heroes/` | Gardien de la Sylve et Gardien mécanique |
| `factions/*-icon.webp` | Emblèmes Ordre, Nature et Chaos |
| `abilities/` | Capacités, états et événements de combat |
| `field/` | Bâtiments neutres, petites orbes de rune v2 et glyphes plats de pentagramme v2 |
| `chests/` | Cinq types de coffres, fermés et ouverts |
| `leagues/` | Écussons des dix ligues |
| `guilds/` | Dragon de braise, Loup lunaire, Phénix solaire et Kraken des abysses, générés avec ImageGen intégré |
| `results/` | Emblèmes de victoire et de défaite, générés avec ImageGen intégré |
| `keys/` | Trois clés de déblocage, dont la clé souveraine `chest-key-3-v2.webp` |
| `treasures/` | Deux packs d’or et cinq packs d’émeraudes |
| `ui/` | Navigation, monnaies, statistiques, raretés, missions, récompenses (cadeau, cadenas, horloge), chaînes, liens d’âme et poussière d’âme |
| `guardian-village-mines.webp` | Refuge panoramique et mines |
| `duel-arena-overhead.webp` | Terrain de combat |
| `forest-arena.png` | Fond de la page d’accueil |
| `screenshots/duel-in-progress.jpg` | Capture d’une vraie partie au tour 13, présentée sur l’accueil public |
| `deck-workshop.webp`, `guardian-house.webp`, `play-lobby.webp`, `sanctuary.webp` | Décors des pages du jeu |

Les cartes utilisent les aplats CSS de `FactionBackdrop`, avec une teinte par faction et un accent par lignée. Les personnages conservent une identité commune entre les raretés, avec des poses, silhouettes et équipements progressifs. Les sprites restent transparents ; les statistiques et commandes sont rendues par l’interface.

Le bouton Guilde utilise `ui/guild-banner.webp`. Le créateur de guilde réunit quatre nouveaux emblèmes et douze illustrations déjà présentes dans le jeu. Les cinq nouveaux fichiers sont exportés en WebP 384 × 384 en conservant leur transparence ; les prompts complets sont conservés dans le manifeste.

Les quatre marqueurs de terrain v2 ont été générés avec ImageGen intégré d’après la référence de combat fournie par l’utilisateur, puis exportés en WebP 256 × 256 avec leur transparence. Les runes utilisent `rune-health-orb-v2.webp` et `rune-attack-orb-v2.webp` ; les pentagrammes utilisent `pentagram-health-glyph-v2.webp` et `pentagram-attack-glyph-v2.webp`. Les valeurs sont ajoutées par l’interface. Les anciennes gravures en pierre sont conservées comme sources remplacées dans le manifeste.

La capture du duel provient de l’interface réelle du terrain d’entraînement, après plusieurs tours joués. Sa provenance figure dans la section `captures` du manifeste.

## Maintenance

Les chemins de personnages sont construits depuis `artId` ou `baseId`. Les capacités, factions, ligues, coffres et raretés utilisent également des chemins dynamiques : une recherche de nom de fichier seule ne suffit pas à prouver qu’une image est inutilisée.

Les parties enregistrées conservent leurs instantanés de cartes. Les portraits de secours et les anciennes variantes encore nécessaires sont conservés avec les [données de compatibilité](legacy-data.md). Les références du catalogue dans `docs/references/cunt-wars/` servent aux imports et aux tests indépendants.

Les anciennes captures de validation, planches d’essai et générations remplacées sont retirées du projet. Leur historique reste accessible dans Git. Lors d’une modification, mettre à jour le manifeste, contrôler les images affichées sur ordinateur et mobile, puis lancer les tests, la vérification TypeScript et la compilation.
