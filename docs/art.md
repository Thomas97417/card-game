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
| `hub/refuge-landscape-v2.webp` | Base du paysage du refuge, sans bâtiments, en panorama 3:1 |
| `hub/*-ground-v4.webp` | Anciens terrains individuels, conservés comme références des compositions précédentes |
| `hub/*-building-v4.webp` | Huit bâtiments transparents harmonisés avec leurs terrains, dont la fonderie, le téléporteur et les mines |
| `hub/workshop-building-v3.webp` | Ancien atelier en forme de maison, conservé comme référence du redesign V7 |
| `hub/workshop-building-v7.webp` | Atelier de cartes ouvert, de plain-pied, avec presse, établis et auvent ; environ 15 % moins large que la V6 |
| `hub/workshop-crossing-ground-v7.webp` | Abords de l’atelier et pont de bois vers le téléporteur et la route de la mine d’or |
| `hub/courtyard-ground-v5.webp` | Terrain commun atelier–rivière–maison : cour équipée, chemins continus et pont entre deux berges sèches |
| `hub/western-ground-v6.webp` | Quartier ouest : mine d’or, téléporteur, aire de chargement et préparation des départs |
| `hub/archives-ground-v6.webp` | Terrasse des archives : accès pavés, banc et pupitre, raccordés aux chemins voisins |
| `hub/eastern-ground-v6.webp` | Quartier est : sanctuaire, arène, fonderie et mine d’émeraudes, reliés par une voie commune et une rampe |
| `hub/workshop-ground-v3.webp` | Ancien terrain de l’atelier, conservé comme référence de la composition V5 |
| `hub/*-v2.webp` | Premières versions des bâtiments séparés, conservées comme références |
| `guardian-village-mines.webp` | Ancien refuge avec bâtiments intégrés, conservé pour l’aperçu de l’accueil public |
| `foundry-building.webp` | Bâtiment transparent de la Fonderie des Échos, superposé au panorama |
| `foundry-interior-v1.webp` | Intérieur peint de la fonderie, grand établi accueillant les objets 3D |
| `duel-arena-overhead.webp` | Terrain de combat |
| `campaign/` | Téléporteur du refuge, carte du monde et quatre terrains régionaux de l’aventure |
| `forest-arena.png` | Fond de la page d’accueil |
| `screenshots/duel-in-progress.jpg` | Capture d’une vraie partie au tour 13, présentée sur l’accueil public |
| `deck-workshop.webp`, `guardian-house.webp`, `play-lobby.webp`, `sanctuary.webp` | Décors des pages du jeu |

Les cartes utilisent les aplats CSS de `FactionBackdrop`, avec une teinte par faction et un accent par lignée. Les personnages conservent une identité commune entre les raretés, avec des poses, silhouettes et équipements progressifs. Les sprites restent transparents ; les statistiques et commandes sont rendues par l’interface.

Le refuge utilise une base de paysage de 2172 × 724 générée avec ImageGen intégré, sans bâtiments, enrichie par quatre terrains de quartier et un raccord local pour la traversée ouest de l’atelier. Les neuf bâtiments restent des sprites transparents indépendants. L’atelier V3 a servi de référence commune pour la lumière, la perspective, les matières et la végétation ; son architecture est désormais remplacée par la V7. Les WebP conservent leur définition native et les sprites leur alpha, avec les marges transparentes retirées.

Le terrain V5 de la cour centrale relie la maison, l’atelier et la rivière. La maison conserve son agrandissement d’environ 35 %. Un escalier avec paliers dessert la terrasse et le pont de pierre du premier plan rejoint une berge sèche. Des caisses, un point d’eau, des pots et des lanternes donnent une fonction aux abords des chemins. Les objets peints dans le terrain restent décoratifs. La scène ne contient aucun habitant.

L’atelier V7 est un bâtiment de plain-pied plus bas et environ 15 % moins large que la V6. Sa grande baie ouverte montre une presse à cartes, des établis et des outils ; un auvent couvre une seconde table de travail. La palette terre cuite, noyer, pierre claire et toile turquoise conserve son identité. Son libellé est placé sous le bâtiment sur les écrans hauts pour laisser les postes de travail visibles ; il retrouve son décalage compact sous 700 px de hauteur. Un raccord de terrain spécifique élargit son parvis sec et ajoute un pont de bois sur culées de pierre, avec un chemin à chaque extrémité. La traversée rejoint la place du téléporteur, la route existante de la mine d’or et la cour centrale.

Les sept autres bâtiments suivent désormais cette échelle : +30 % pour les mines, les archives, le sanctuaire et la fonderie, +35 % pour le téléporteur, +27 % pour l’arène. L’entrée ouest partage une route entre la mine et le téléporteur, avec des caisses de minerai, une brouette, un banc et du matériel de voyage. La terrasse des archives ajoute un passage pavé, un banc et un pupitre. À l’est, une voie commune dessert l’arène et la fonderie ; des équipements d’entraînement et une aire d’outillage occupent les marges. Une rampe soutenue par un mur, avec palier et garde-corps, relie la voie basse à l’aire de chargement de la mine d’émeraudes. Les objets restent décoratifs et les chemins dégagés, sans habitants.

`components/hub/hub-art.ts` regroupe les images, les emplacements et les paramètres des fondus. L’entrée ouest est posée avant la cour, puis viennent les archives, le quartier est et le raccord du pont de l’atelier. Les fondus latéraux sont réglables pour conserver les objets et les accès aux bords de la carte ; les terrains qui touchent le premier plan restent opaques en bas. Chaque sprite, son libellé et son lien partagent les mêmes coordonnées, y compris pour le téléporteur et les deux mines. Les libellés des mines laissent la place aux commandes de collecte sur les écrans peu hauts.

Cette composition est intégrée par défaut sur `/hub`. `docs/art-references/hub-workshop-v7.webp` montre le nouvel atelier et sa traversée ; les références de quartier V6 et `hub-integration-v6.json` documentent le reste du village. `hub-workshop-v7.json` archive la nouvelle emprise, le cadrage du sprite, le raccord et les repères de passage. Les prompts de génération, de détourage et de terrain figurent dans le manifeste. Les références des phases précédentes restent disponibles pour retravailler chaque zone. Le paysage, ses terrains et chacun des neuf bâtiments peuvent être remplacés indépendamment.

Le bouton Guilde utilise `ui/guild-banner.webp`. Le créateur de guilde réunit quatre nouveaux emblèmes et douze illustrations déjà présentes dans le jeu. Les cinq nouveaux fichiers sont exportés en WebP 384 × 384 en conservant leur transparence ; les prompts complets sont conservés dans le manifeste.

Les trois premières places du classement des joueurs et des guildes partagent les médailles `ui/podium-gold.webp`, `ui/podium-silver.webp` et `ui/podium-bronze.webp`, générées avec ImageGen intégré. Le chiffre est intégré à chaque médaille ; un libellé de rang reste accessible aux lecteurs d’écran. À partir de la quatrième place, le rang est affiché en texte.

Le bâtiment de la Fonderie des Échos a été généré avec ImageGen intégré, en prenant le panorama comme référence de style et de perspective. Le WebP de 640 × 640 conserve sa transparence ; son prompt exact figure dans le manifeste. Le décor intérieur `foundry-interior-v1.webp` (1672 × 941) a aussi été généré avec ImageGen intégré, avec les intérieurs de l’atelier et de la maison des gardiens comme références de style et le bâtiment comme référence architecturale. Son prompt exact figure dans le manifeste. Son établi volontairement vide accueille les sept marteaux du nouvel arsenal, les quatre reliques actuelles et la source vivante conservée pour les anciennes manches, leurs ombres et les fragments en 3D procédurale Three.js, dans un canvas transparent. Ces modèles utilisent des volumes lissés et biseautés, des ornements sculptés, des matériaux à grain peint générés par le code et des ombres de contact dégradées.

Les quatre marqueurs de terrain v2 ont été générés avec ImageGen intégré d’après la référence de combat fournie par l’utilisateur, puis exportés en WebP 256 × 256 avec leur transparence. Les runes utilisent `rune-health-orb-v2.webp` et `rune-attack-orb-v2.webp` ; les pentagrammes utilisent `pentagram-health-glyph-v2.webp` et `pentagram-attack-glyph-v2.webp`. Les valeurs sont ajoutées par l’interface. Les anciennes gravures en pierre sont conservées comme sources remplacées dans le manifeste.

La capture du duel provient de l’interface réelle du terrain d’entraînement, après plusieurs tours joués. Sa provenance figure dans la section `captures` du manifeste.

Les illustrations de l’[aventure](campaign.md) ont été générées avec ImageGen intégré. Le téléporteur est exporté en WebP 640 × 640 en conservant sa transparence. La carte est une illustration 1536 × 1024 ; ses points et libellés sont ajoutés par l’interface. La Sylve occupe la forêt et le premier niveau se déroule dans la bourgade de Clairval. Les quatre terrains reprennent la projection du plateau original avec des décors de bourgade, de rivages, de givre et de braise. `arena-1-clairval.webp` remplace le premier terrain forestier pour les combats du niveau 1. Le terrain choisi suit le combat enregistré sur ordinateur comme sur mobile.

## Maintenance

Les chemins de personnages sont construits depuis `artId` ou `baseId`. Les capacités, factions, ligues, coffres et raretés utilisent également des chemins dynamiques : une recherche de nom de fichier seule ne suffit pas à prouver qu’une image est inutilisée.

Les parties enregistrées conservent leurs instantanés de cartes. Les portraits de secours et les anciennes variantes encore nécessaires sont conservés avec les [données de compatibilité](legacy-data.md). Les références du catalogue dans `docs/references/cunt-wars/` servent aux imports et aux tests indépendants.

Les anciennes captures de validation, planches d’essai et générations remplacées sont retirées du projet. Leur historique reste accessible dans Git. Lors d’une modification, mettre à jour le manifeste, contrôler les images affichées sur ordinateur et mobile, puis lancer les tests, la vérification TypeScript et la compilation.

Les marteaux du chantier partagent les matériaux peints et les géométries procédurales de la fonderie : tête de pierre renforcée de fer pour le Brise-roche, tête fine et améthystes pour le Marteau du graveur, cuivre doré et sceaux floraux pour le Marteau d’ambre. La face métallique reste ancrée sur la visée à l’impact pour les sept outils actuels et les modèles des anciennes manches.

Le Marteau à panne reprend le profil Cross Peen avec une panne en fer biseautée ; le Marteau à pointes ajoute des cônes lissés et des attaches arrondies à la tête de fer. L’ancienne couronne de résonance reste visible dans les manches sauvegardées antérieures à V9. Ces variantes réutilisent les textures peintes et les ressources partagées de la scène.

Les reliques lumineuses de l’arbre V4 réutilisent les modèles peints avec un anneau doré procédural, mutualisé et libéré avec les autres effets de la scène. Aucun visuel de Bills Must Be Paid n’est importé.

Les techniques de l’arbre complet V11 ajoutent une main spectrale aux doigts arrondis, des piliers de lumière et des roches peintes. Ces volumes procéduraux réutilisent les textures de la fonderie ; aucun dessin du jeu de référence n’est importé. Les réserves graphiques sont bornées à 8 mains, 20 roches et 8 rayons sur ordinateur, et 4 / 12 / 4 sur mobile. La pause fige leur animation ; les animations réduites remplacent la chute et les flashes par des marques discrètes. Les ressources partagées sont libérées avec la scène.

Les reliques V11 ont un volume et un rayon de collision réduits ensemble à 80 % pour conserver un plateau lisible jusqu’à 32 cibles. Un halo turquoise distingue les éclats enfouis ; le halo doré reste celui des reliques lumineuses. Les dommages simultanés d’une même relique sont additionnés dans un seul nombre, avec un gain d’éclats séparé.
