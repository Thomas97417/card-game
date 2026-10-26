# Illustrations de Sylve

Les illustrations intégrées sont dans `apps/web/public/art/`. Le [manifeste](art-prompts.json) regroupe leurs chemins et les prompts ImageGen disponibles pour les fichiers conservés. Les retouches peuvent prendre le sprite final comme référence ; le prompt initial du fond `forest-arena.png` n’a pas été archivé.

## Organisation actuelle

| Dossier ou fichier | Usage |
| --- | --- |
| `characters/` et `characters/evolutions/` | 84 variantes du catalogue, renforts invoqués et portraits de compatibilité |
| `heroes/` | Gardien de la Sylve et Gardien mécanique |
| `factions/*-icon.webp` | Emblèmes Ordre, Nature et Chaos |
| `abilities/` | Capacités, états et événements de combat |
| `field/` | Bâtiments neutres, runes et pentagrammes |
| `chests/` | Cinq types de coffres, fermés et ouverts |
| `leagues/` | Écussons des dix ligues |
| `keys/` | Trois clés de déblocage, dont la clé souveraine `chest-key-3-v2.webp` |
| `treasures/` | Deux packs d’or et cinq packs d’émeraudes |
| `ui/` | Navigation, monnaies, statistiques, raretés, missions et chaînes |
| `guardian-village-mines.webp` | Refuge panoramique et mines |
| `duel-arena-overhead.webp` | Terrain de combat |
| `forest-arena.png` | Fond de la page d’accueil |
| `deck-workshop.webp`, `guardian-house.webp`, `play-lobby.webp`, `sanctuary.webp` | Décors des pages du jeu |

Les cartes utilisent les aplats CSS de `FactionBackdrop`, avec une teinte par faction et un accent par lignée. Les personnages conservent une identité commune entre les raretés, avec des poses, silhouettes et équipements progressifs. Les sprites restent transparents ; les statistiques et commandes sont rendues par l’interface.

## Maintenance

Les chemins de personnages sont construits depuis `artId` ou `baseId`. Les capacités, factions, ligues, coffres et raretés utilisent également des chemins dynamiques : une recherche de nom de fichier seule ne suffit pas à prouver qu’une image est inutilisée.

Les parties enregistrées conservent leurs instantanés de cartes. Les portraits de secours et les anciennes variantes encore nécessaires sont conservés avec les [données de compatibilité](legacy-data.md). Les références du catalogue dans `docs/references/cunt-wars/` servent aux imports et aux tests indépendants.

Les anciennes captures de validation, planches d’essai et générations remplacées sont retirées du projet. Leur historique reste accessible dans Git. Lors d’une modification, mettre à jour le manifeste, contrôler les images affichées sur ordinateur et mobile, puis lancer les tests, la vérification TypeScript et la compilation.
