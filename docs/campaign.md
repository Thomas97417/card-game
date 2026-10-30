# L’aventure au-delà de la Sylve

Le téléporteur est un bâtiment indépendant posé dans la clairière à droite de la mine d’or. Son portail de pierre moussue, d’or ancien et de magie turquoise/violette ouvre `/world`. La carte conserve les coordonnées de ses destinations lors du défilement et propose un retour vers la Sylve. Le refuge se trouve dans la forêt ancienne au nord-ouest ; la bourgade fortifiée représentée au sud-ouest accueille le premier niveau, Clairval.

La carte remplit l’écran dès l’arrivée, sans titre ni texte d’introduction superposé en haut à gauche. Les informations d’un niveau s’ouvrent au clic sur sa destination dans un panneau superposé. Sur ordinateur, son côté dépend de la position visible du marqueur : il s’ouvre à gauche si le panneau droit couvrirait la destination, notamment pour les Terres de braise. L’ouverture ne change ni la largeur de la page ou de la carte, ni son défilement. Sur mobile, le panneau reste en bas. Le bouton de fermeture, la touche Échap ou un clic sur le décor rendent toute la carte visible. Les étapes et le compteur numérique restent consultables dans ce panneau ; la barre de progression régionale a été retirée.

La campagne comporte quatre niveaux de dix sous-niveaux. Le premier chiffre désigne la région, le second son combat : `1-1` à `1-10`, puis `2-1`, jusqu’à `4-10`. Chaque région possède un nouveau terrain généré avec ImageGen intégré, décliné depuis le terrain de duel pour conserver la géométrie du plateau et les placements.

| Niveau | Région | Gardien final | Terrain |
| --- | --- | --- | --- |
| 1 | La Bourgade de Clairval | Le Capitaine de Clairval | Grande place pavée, remparts de pierre claire et toits verts |
| 2 | Les Rivages d’azur | La Sentinelle des marées | Falaises, ruines côtières et mer turquoise |
| 3 | Les Cimes de givre | Le Souverain du givre | Sanctuaire enneigé et montagnes bleutées |
| 4 | Les Terres de braise | Le Gardien des braises | Ruines de basalte et paysage volcanique |

Les définitions et règles sont dans `packages/game/src/campaign.ts`. Seule la première étape est disponible au départ ; chaque première victoire débloque exactement l’étape suivante. Les étapes ultérieures peuvent être consultées, mais le serveur refuse de les lancer tant qu’elles sont verrouillées. Les combats utilisent le deck actif complet et ses niveaux, le Gardien choisi, le moteur et l’IA du solo. Leur difficulté suit une courbe fixe par étape : améliorer son alliance rend les premières régions plus faciles. Le nombre de cartes adverse suit la capacité du deck du joueur.

La région et le sous-niveau sont enregistrés dans `games.campaign`, avec l’état normal du duel ; les rechargements et reconnexions retrouvent donc le même terrain et le même combat. Le mode technique reste `solo`, ce qui conserve le chronomètre illimité, la lecture animée et le rattrapage serveur de l’IA. La campagne ne modifie pas les trophées ou les coffres de l’arène. Ses combats alimentent les missions de combat et de victoire.

## Récompenses

Pour l’index global `i` de 0 à 39, une première victoire donne `60 + 15 × i` pièces d’or. Le dixième combat ajoute `150 × région` pièces d’or et `25 × région` émeraudes. Le cinquième combat donne aussi `5 × région` émeraudes. Les autres étapes donnent de l’or. Les récompenses sont annoncées avant le départ et créditées dans la transaction qui termine le duel.

Chaque victoire `N-10` garantit également un coffre **épique**, sans délai ni occupation des emplacements de l’arène. Son contenu et son or sont tirés une seule fois d’après le meilleur palier du joueur à l’obtention, avec les tables de coffres existantes. Le coffre reste dans `campaignChests` jusqu’à son ouverture depuis la carte ; revenir sur la carte centre en priorité une région dont le coffre attend d’être ouvert, sans ouvrir son panneau. Cliquer sur cette destination révèle le bouton d’ouverture du coffre. Son contenu est caché par les requêtes publiques. L’ouverture crédite les cartes et l’or, compte pour les missions de coffres et conserve le résultat pour les réessais. Les clics concurrents ne recréditent rien.

`campaignProgress.completedStages` enregistre le nombre de premières victoires consécutives. La fin d’un combat, les récompenses et le déblocage suivant sont atomiques. Un abandon ou une défaite ne donne rien et ne retire aucune progression. Une étape terminée peut être rejouée ; elle ne redonne ni monnaie ni coffre.

## Visuels et vérification

Les illustrations utilisées sont dans `apps/web/public/art/campaign/` : `teleporter.webp` (alpha conservé), `world-map.webp`, `arena-1-clairval.webp` et `arena-2.webp` à `arena-4.webp`. Le premier terrain a été régénéré pour représenter la grande place de la bourgade, en prenant le terrain initial comme référence de projection et le village peint sur la carte comme référence d’architecture. L’ancien décor forestier `arena-1.webp` reste conservé comme source remplacée. Les prompts complets et les références sont conservés dans `docs/art-prompts.json`. L’interface affiche elle-même les noms, points, liens, numéros, serrures et récompenses.

Les tests du moteur couvrent les coordonnées valides, les récompenses de boss et les adversaires des quarante étapes. Les tests Convex vérifient l’authentification, la possession et la complétude du deck, les verrous, les abandons, les premières victoires, les réessais, les replays et l’ouverture concurrente/propriétaire des coffres. Les tests d’interface couvrent l’accès au téléporteur, la sélection, les aperçus verrouillés, la reprise d’un combat et le coffre à récupérer.
