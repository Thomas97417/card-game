# Illustrations de Sylve

## Progression des raretés et personnalité — 26 octobre 2026

Le catalogue possède **84 illustrations distinctes pour 22 lignées**, avec une progression visible de Commune à Légendaire, ou depuis Rare pour les lignées sans forme commune. Les versions communes restent plus modestes ; les suivantes changent de posture, d’expression, de gabarit, d’équipement et de pouvoirs. Les poses comprennent des gardes resserrées, des pas en avant, des attaques en diagonale, des vues de trois quarts de dos avec le visage visible et des attitudes finales plus fières. La rareté ne se limite plus à une hausse du nombre d’ornements.

Chaque personnage garde ses repères : capuche rouge et grand arc pour l’archère, visage de pierre et cuivre pour le gardien, silhouette ivoire/prune et mitre pour la prêtresse, crâne rasé et cape ocre pour la pèlerine, lunettes rondes et carré blanc pour l’enchanteresse, barbe orange et marteau noir pour le forgeron, masque pâle et capuche indigo pour l’assassin, harpe et robe pourpre pour la chantre, cheveux courts argentés et bannière orange pour la capitaine, cornes ivoire et flamme orange pour la sorcière. La dryade garde ses fleurs corail ; la démone serpentine conserve ses cornes noires et sa queue turquoise.

Le vampire commence **sans ailes**, avec une tenue de noble simple. Il développe de petites ailes en Rare, des ailes moyennes en Épique et de grandes ailes de monarque en Légendaire. Son regard, sa posture, son armure et sa magie gagnent en assurance. La description du catalogue reflète cette transformation progressive.

Les créatures suivent aussi cette direction : développement des ailes et des bois du dragon d’ambre, croissance de la carapace végétale de la tortue, forme aquatique plus ample pour l’esprit, épaules et armure de bois plus puissantes pour l’ours, métamorphose du loup infernal en alpha démoniaque. Le félin reste un guérisseur animal vêtu, le saule conserve ses frondaisons sarcelle et ses lanternes ambrées, et le totem garde sa pierre claire, ses feuilles de jade et son cœur d’ambre.

Les héroïnes humanoïdes sont clairement adultes. Leurs costumes deviennent plus raffinés et leurs attitudes plus glamour et assurées. Une demande d’exagération anatomique a été refusée par le filtre de sécurité d’ImageGen ; la déclinaison finale reste dans le registre adulte vêtu de l’échantillon validé. Les animaux et esprits non humanoïdes conservent leur anatomie et une représentation non sexuelle.

Les sprites sont générés avec **ImageGen intégré**, chacun par un appel distinct, puis encodés en **WebP de 512 × 512 px avec leur véritable canal alpha**. Les formes communes approuvées de l’enchanteresse et du vampire sont réutilisées. Des marges transparentes préservent les accessoires et les ailes dans les cartes. Les fichiers finaux restent dans `apps/web/public/art/characters/` et `apps/web/public/art/characters/evolutions/`. Les chemins de secours du loup et de la chantre reprennent leur nouvelle forme rare ; ceux du totem et du saule servent directement à leurs formes légendaires. Les identifiants, statistiques, coûts et capacités restent compatibles.

Le [manifeste complet](art-prompts-rarity-progressions.json) conserve chaque prompt, référence et PNG source. Les [références figées](art-references/rarity-progressions/) gardent l’identité initiale des 22 lignées ; l’[échantillon validé](art-samples/rarity-progression-v2/README.md) reste disponible. Les fonds des cartes demeurent sobres.

Validation : les **84 variantes sont uniques, transparentes et de 512 × 512 px**, pour **5,96 Mio** au total : 39 Ordre, 30 Nature et 15 Chaos. Le contrôle vérifie les PNG sources, les fichiers finaux et les chemins réellement utilisés par le catalogue, dont les deux formes légendaires enregistrées directement sous `idol.webp` et `tree.webp`. Les **45 tests ciblés** de l’atelier, du bestiaire et des liens d’âme, TypeScript et la compilation passent. Le composant réel est contrôlé dans un aperçu isolé avec des données de démonstration à **1 440 × 900** et **390 × 844 px** : huit cartes du deck visibles sur ordinateur, images chargées, noms lisibles et aucun débordement horizontal de la page. Les captures [ordinateur](rarity-progressions-desktop.jpg) et [mobile](rarity-progressions-mobile.jpg), les [deux exemples de progression](rarity-progressions-examples.webp) et les planches complètes [Ordre](rarity-progressions-order.webp), [Nature](rarity-progressions-nature.webp) et [Chaos](rarity-progressions-chaos.webp) montrent le résultat.

## Version précédente : lisibilité des personnages — 26 octobre 2026

Les humanoïdes sont redessinés autour de **14 identités visuelles** : des silhouettes plus franches, des visages plus expressifs et trois grandes masses de couleur par personnage. L’archère porte une capuche rouge et un grand arc ; la prêtresse associe tiare ivoire et robe prune ; l’enchanteresse a un carré blanc, une robe sarcelle et un orbe ambré ; le forgeron forme une masse orange autour de son marteau noir. La pèlerine conserve sa cape ocre et sa lance, l’assassin sa silhouette indigo accroupie, la capitaine sa bannière orange. Le Chaos distingue la queue turquoise de la démone serpentine, les ailes violettes du vampire et les cornes ivoire de la sorcière. La dryade se reconnaît à sa grande fleur corail.

**55 variantes de personnages**, une pour chaque rareté existante de ces lignées, sont créées par appels distincts à **ImageGen intégré**, puis encodées en WebP de 512 × 512 px avec leur canal alpha. Les versions communes, rares, épiques et légendaires partagent l’identité du personnage, avec des poses et accessoires distincts ; la progression ne repose plus sur l’accumulation de petites dorures. Les illustrations sont enregistrées dans `apps/web/public/art/characters/` et `apps/web/public/art/characters/evolutions/`. Le [manifeste complet](art-prompts-readable-characters.json) conserve chaque prompt, famille, rareté, chemin final et PNG source. Le chemin de secours `characters/bard.webp` reprend la nouvelle forme rare. Aucun fallback CLI n’est utilisé.

Les fonds des cartes sont désormais des dégradés CSS sobres, avec une teinte par famille et un accent par lignée. Ils remplacent à l’affichage les scènes architecturales et forestières, conservées dans les assets historiques. Le composant partagé `FactionBackdrop` utilise l’identifiant de base pour garder le même accent entre les évolutions. Les aplats restent derrière les sprites transparents dans le deck, la collection, les invocations, le bestiaire, la main en combat, les fiches et les miniatures du classement.

Dans l’atelier, les motifs superposés et halos décoratifs sont retirés. Le contour de rareté est plus fin, les statistiques, capacités et emblèmes plus discrets. Le bandeau du nom reste limité à 15 % de la hauteur et les huit emplacements restent visibles dès 1 440 px de largeur. Les identifiants des cartes, noms, descriptions, valeurs et règles sont conservés.

Validation : les **55 WebP sont uniques, transparents et de 512 × 512 px**, pour 2,91 Mio au total ; répartition : 39 Ordre, 4 Nature et 12 Chaos. Les 45 tests ciblés de l’atelier, du bestiaire et des liens d’âme, TypeScript et la compilation passent. Le composant réel a été contrôlé dans un aperçu isolé à 2 195 × 1 314, 1 440 × 900, 390 × 844 et 320 × 568 px. Les huit cartes sont visibles à 1 440 px ; les noms et les commandes ne débordent pas. Les captures [ordinateur](cards-readable-desktop.jpg) et [mobile](cards-readable-mobile.jpg), ainsi que les planches [Ordre](cards-readable-order.webp), [Nature](cards-readable-nature.webp) et [Chaos](cards-readable-chaos.webp), montrent les illustrations intégrées.

## Première version des familles Ordre, Nature et Chaos — 26 octobre 2026

Les trois familles possèdent désormais leur propre décor de carte et leur emblème, créés avec **ImageGen intégré**, par un appel distinct pour chaque asset. Les fonds sont enregistrés dans `apps/web/public/art/factions/{order,nature,chaos}-background.webp` (512 × 768 px) et les emblèmes dans `apps/web/public/art/factions/{order,nature,chaos}-icon.webp` (384 × 384 px, avec alpha). L’Ordre associe cathédrales, châteaux, ivoire, bleu royal et or ; la Nature, clairières, bois vivant et feuillages émeraude ; le Chaos, sanctuaires d’obsidienne, braises rouges et brumes violettes. Le [manifeste des six visuels](art-prompts-factions.json) conserve les prompts complets, sources PNG et chemins finaux.

**58 portraits** ont été recréés pour les dix lignées de l’Ordre, les quatre du Chaos et la dryade de la Nature, avec une illustration distincte pour chaque rareté existante. Les sept autres lignées de la Nature conservent leurs illustrations sylvestres. L’Ordre rassemble désormais gardien des remparts, archère royale, prêtresse, pèlerine, écuyer, forgeron, enchanteresse du chapitre, lame du cloître, chantre et capitaine. Sa prêtresse légendaire porte une tiare pontificale. Le Chaos comprend loup démoniaque, démone serpentine, vampire ailé et sorcière infernale. La dryade remplace la sentinelle champignon. Les noms des évolutions et les descriptions des 22 lignées sont harmonisés avec ces univers.

Deux renforts de l’Ordre ont aussi été refaits : `apps/web/public/art/characters/life-palace.webp`, une chapelle consacrée, et `apps/web/public/art/characters/root-coil.webp`, une tourelle du chapitre. Les **60 sprites transparents de 512 × 512 px** pèsent ensemble environ 4,96 Mio ; l’alpha a été contrôlé pour chaque fichier. Les [prompts des personnages](art-prompts-faction-characters.json) listent chaque nom de fichier, sa famille, sa rareté et son PNG source. Les chemins de secours `characters/wolf.webp` et `characters/bard.webp` réutilisent les nouvelles formes rares correspondantes. Aucun fallback CLI n’a été utilisé.

Les fonds et emblèmes sont intégrés aux cartes du deck, de la collection, du bestiaire, des invocations et de la main en combat, ainsi qu’aux fiches. Les miniatures du classement utilisent aussi les fonds. Les sprites gardent leur transparence sur le terrain. La rareté conserve son contour indépendant de la famille ; les identifiants, statistiques, capacités et coûts restent compatibles avec les collections et decks existants.

Dans `/decks`, les trois boutons **Ordre**, **Nature** et **Chaos** se trouvent en bas. Plusieurs familles peuvent être sélectionnées ; leur union se combine avec le type de combat et les raretés choisies. « Toutes » et le retour depuis un résultat vide réinitialisent les trois groupes. Filtrer ne modifie pas le deck. Le compteur de collection utilise désormais les 84 variantes réelles.

Validation : 716 tests du monorepo, puis contrôle ciblé des écrans modifiés, TypeScript et compilation. Le composant réel a été vérifié dans un aperçu isolé, avec des données locales, à 1440 × 900, 390 × 844 et 320 × 568 px : filtres combinés, maintien des huit cartes équipées, absence de débordement de la page et des commandes, noms lisibles et ouverture des fiches. Captures : [ordinateur](factions-desktop-validation.jpg), [mobile](factions-mobile-validation.jpg), [petit mobile](factions-small-mobile-validation.jpg) et [fiche de l’Ordre](factions-card-detail-validation.jpg).

## Coffres de missions réellement ouverts — 25 octobre 2026

Trois versions ouvertes ont été générées avec **ImageGen intégré**, en éditant séparément les coffres fermés correspondants : `apps/web/public/art/chests/common-open.webp`, `rare-open.webp` et `bigRare-open.webp`. Leurs matériaux, couleurs et perspective sont conservés ; le couvercle est relevé et l’intérieur vide est visible. Les fichiers sont en **WebP de 512 × 512 px avec alpha**, vérifié par `webpinfo`. Le [manifeste](art-prompts-open-chests.json) conserve les trois prompts, les références et les PNG sources.

Le chemin des missions affiche ces images dès que le coffre passe à l’état récupéré. Les coffres ouverts gardent leurs couleurs pour que l’intérieur et le couvercle restent lisibles. Le passage de l’image fermée à l’image ouverte et la désactivation après récupération sont vérifiés par le test existant des récompenses.

Le rendu réel a été contrôlé dans le navigateur à **1280 × 720** et **390 × 844 px**, avec trois coffres communs récupérés, un disponible et un verrouillé : [ordinateur](missions-open-chests-desktop.png), [mobile](missions-open-chests-mobile.png). Les 23 tests du hub, TypeScript et la compilation passent.

## Coffres de missions par palier — 25 octobre 2026

Les cinq coffres sont reliés par un chemin fin de 4 px qui traverse la rangée derrière les illustrations. Le remplissage doré s’arrête au centre du palier atteint ; les seuils intermédiaires sont interpolés entre les coffres. Les images restent opaques pour masquer le trait sous leur silhouette. Les coffres récupérés portent une coche dans leur pastille de seuil et le libellé « Ouvert » ; le coffre disponible possède une pastille et un halo dorés ; les suivants portent un cadenas. Les coffres restent directement sur le fond commun, sans écrin individuel ni jauge séparée.

Les illustrations existantes sont conservées. Le rendu réel des missions quotidiennes et hebdomadaires a été contrôlé dans le navigateur sur ordinateur, à 390 px et à 320 px de large. Détails : [ordinateur](missions-chest-track-desktop.png), [mobile](missions-chest-track-mobile.png). Les 23 tests du hub, TypeScript et la compilation passent.

## Panneaux communautaires harmonisés — 25 octobre 2026

Le classement, les missions et le chat mondial utilisent le même composant `HubPanel` : largeur maximale de **620 px**, marge latérale de 12 px sur petit écran, bord inférieur à **14 px au-dessus des raccourcis**. Le cadre vert forêt, les bordures dorées, l’en-tête et la fermeture sont partagés. Leur hauteur commune reprend celle des missions : **660 px**, limités par l’espace disponible. Les onglets des missions restent visibles pendant le défilement. Ouvrir un panneau replie le précédent ; le brouillon du chat est conservé.

L’icône du chat est un globe émeraude dans une bulle dorée, généré avec **ImageGen intégré** et enregistré dans `apps/web/public/art/ui/world-chat-globe.webp` en **WebP transparent de 384 × 384 px**. Elle apparaît dans le bandeau, l’en-tête et l’état vide du chat. Le [manifeste](art-prompts-hub-dock.json) conserve son prompt complet et le PNG source.

Les composants réels ont été vérifiés dans un aperçu local avec des données de démonstration à **1440 × 900**, **390 × 844**, **320 × 700**, **844 × 390** et **390 × 480 px** : largeur, position et habillage identiques, raccourcis fixes, défilement des missions, deck du classement, retour du focus et conservation du brouillon, sans débordement horizontal ni erreur JavaScript. Captures de l’harmonisation initiale, avant l’égalisation des hauteurs : missions [ordinateur](hub-panels-missions-desktop.webp) et [mobile](hub-panels-missions-mobile.webp), classement [ordinateur](hub-panels-ranking-desktop.webp) et [mobile](hub-panels-ranking-mobile.webp), chat [ordinateur](hub-panels-chat-desktop.webp) et [mobile](hub-panels-chat-mobile.webp).

## Barre communautaire du refuge

Le hub possède une barre ancrée en bas au centre, indépendante du défilement de la carte. Trois raccourcis illustrés, **Classement**, **Amis** et **Missions**, surmontent un bandeau **Chat mondial** repliable. Le cadre vert forêt et laiton entoure uniquement le chat ; les icônes restent directement sur le décor, sans cadre au survol. Les commandes d’exploration du village encadrent la barre à gauche et à droite, à hauteur du chat. Le texte d’aide au déplacement est retiré. L’ensemble s’adapte aux petits écrans et à leur zone de sécurité.

Les raccourcis sont regroupés au centre sur 280 px au maximum, avec des icônes de 52 px et des libellés de 14 px, à 2 px du chat. Sur mobile, le groupe mesure au maximum 252 px, les icônes 44 px et les textes 12 px ; aucun espace supplémentaire ne sépare les raccourcis du cadre du chat.

Les trois icônes originales ont été créées par trois appels distincts à **ImageGen intégré**, avec un fond transparent :

- `apps/web/public/art/ui/ranking-trophy.webp` : trophée doré avec une émeraude en forme de feuille.
- `apps/web/public/art/ui/friends-handshake.webp` : poignée de main entre deux gardiens, cuir, laiton et émeraudes.
- `apps/web/public/art/ui/missions-scroll.webp` : parchemin aux coches vertes et au sceau doré.

Les assets sont encodés en WebP transparent de 384 × 384 px, avec conservation de l’alpha généré. Les [prompts complets, sources et chemins finaux](art-prompts-hub-dock.json) sont conservés dans le manifeste. Aucun fallback CLI n’a été utilisé.

Cette modification prépare les points d’entrée de l’interface : le chat, le classement mondial, la liste d’amis et les missions sont explicitement indiqués comme **bientôt disponibles**, sans messages ni joueurs fictifs. Les panneaux proposent les actions déjà disponibles dans l’arène. Leur ouverture utilise les dialogues partagés avec navigation au clavier et retour du focus ; Échap replie le chat.

Le composant réel a été vérifié dans un aperçu isolé, sans connexion à un compte, à 1440 × 900, 390 × 844, 320 × 568 et 844 × 390 px : centrage, maintien pendant le défilement de la carte, ouverture des panneaux, retour du focus, archives et réduction des animations. Les rendus sont conservés sur [ordinateur](hub-dock-desktop-validation.webp), sur [mobile](hub-dock-mobile-validation.webp), avec le [chat déplié](hub-chat-mobile-validation.webp) et avec le [panneau Amis](hub-friends-validation.webp). Un [détail de la barre](hub-dock-detail.webp) montre les trois icônes intégrées.

## En-tête et menu des paramètres

L’icône `apps/web/public/art/ui/settings-gear.webp` a été créée avec **ImageGen intégré** : un engrenage de noyer sculpté, bordé de laiton doré, avec des incrustations de feuilles et un centre émeraude. Le WebP de 384 × 384 px conserve l’alpha généré et mesure environ 52 Ko. Le [prompt complet](art-prompts-settings.json) conserve aussi le chemin du PNG original.

Elle ouvre le menu utilisateur, assorti aux panneaux vert forêt et aux bordures dorées du jeu. Le refuge, l’atelier, le salon, le sanctuaire et l’en-tête général partagent désormais la ligue, les deux monnaies et ce bouton. La progression dans la division remplit le fond du panneau de ligue ; le survol et le libellé accessible précisent les trophées restants. Les écrans de combat conservent leur interface. Le sélecteur de thème a été retiré.

Le rendu de l’en-tête partagé est conservé sur [ordinateur](header-desktop-validation.webp) à 1280 × 720 px et sur [mobile](header-mobile-validation.webp) à 390 × 844 px. Le sanctuaire et les paramètres ont également été vérifiés à 320 px, ainsi que la navigation du menu au clavier.

## Maison des gardiens et paramètres

Le décor `apps/web/public/art/guardian-house.webp` a été créé avec **ImageGen intégré** : un intérieur de bois sculpté et de pierre claire, une cheminée, des lanternes en laiton et de grandes fenêtres ouvertes sur le village forestier. Le WebP de 1672 × 941 px, encodé en qualité 88, couvre tout l’écran de `/settings`. Le [prompt complet et le PNG source](art-prompts-guardian-house.json) sont conservés dans le manifeste.

La Maison des gardiens du refuge ouvre directement les paramètres. Les rubriques Profil, Sécurité et Appareils, leurs formulaires, validations, notifications et confirmations sont en français. Les panneaux reprennent le vert forêt et les dorures du jeu. Le défilement se limite au contenu de la page ; les saisies restent conservées entre les rubriques.

`GameHeader` est partagé par le refuge, les decks, le salon, le sanctuaire et les paramètres. Sa hauteur vaut 100 px sur ordinateur et 88 px sur mobile. Les mesures dans le navigateur donnent les mêmes positions pour les cinq pages : ligue et or à 28 px du haut sur ordinateur, puis à 12 px sur mobile ; bouton des paramètres à 24 px puis 22 px. L’historique des invocations est regroupé avec les raccourcis du sanctuaire pour conserver cette géométrie.

Les aperçus finaux des paramètres sont conservés sur [ordinateur](settings-desktop-validation.webp) et sur [mobile](settings-mobile-validation.webp). Les onglets et confirmations ont aussi été vérifiés au clavier et à 320 px de large.

## Éléments du terrain

Trois bâtiments neutres originaux ont été créés le 24 octobre 2026 avec **ImageGen intégré**, par trois appels distincts avec transparence :

- `apps/web/public/art/field/spikes.webp` : pieux de ronces en bois et bronze, liés par des lianes épineuses.
- `apps/web/public/art/field/dark-tree.webp` : arbre sombre creux, racines noueuses, fissures violettes et lueur d’ambre.
- `apps/web/public/art/field/mossy-rock.webp` : rocher calcaire moussu, petites fougères et gravure ancienne.

Les images finales sont encodées en WebP sur un canevas transparent de 512 × 512 px, avec conservation de l’alpha généré et de leurs proportions. Les PNG originaux restent dans le répertoire local de génération. Les [prompts complets](art-prompts-field.json) conservent les sources et les chemins finaux ; aucun fallback CLI n’a été utilisé.

Quatre sceaux originaux ont également été créés avec **ImageGen intégré**, par quatre appels distincts avec transparence. Les images finales mesurent 512 × 341 px, encodées en WebP avec leurs proportions et leur alpha conservés :

- `apps/web/public/art/field/rune-health.webp` : disque de calcaire moussu, glyphe végétal vert.
- `apps/web/public/art/field/rune-attack.webp` : disque de calcaire moussu, glyphe de puissance ambre.
- `apps/web/public/art/field/pentagram-health.webp` : cercle de pierre et bronze, étoile entrelacée verte.
- `apps/web/public/art/field/pentagram-attack.webp` : cercle de pierre et bronze, étoile entrelacée violette.

Les [prompts complets des sceaux](art-prompts-seals.json) conservent les sources et les chemins intégrés. Le style reprend les textures peintes, les contours fins, le vert mousse et l’ambre des compagnons de Sylve. Les bâtiments et les sceaux apparaissent directement dans l’arène et dans leur fiche. `FieldMark` affiche ces images peintes, accompagnées du type de bonus, de sa valeur et de la mention « /tour » pour les pentagrammes. Une rune activée reste visible, avec une lueur atténuée, jusqu’au départ de son porteur.

Les captures du jeu réel montrent la [fiche du pentagramme de vie](seals-painted-detail.png) et le [terrain avec un pentagramme occupé](seals-painted-board.png). La tortue reste à 15 PV lors de sa pose et passe à 18 PV au début de son tour suivant. Le badge du sceau reste lisible sous son porteur.

L’[activation en entraînement](seal-activation-game.png) montre la lueur ambrée d’une rune de puissance et son gain au-dessus de la Sentinelle. Les halos, étincelles et gains sont animés en CSS à partir des événements de combat. Les [couleurs des statistiques](combat-stat-colors.png) sont vérifiées avec le composant réel du plateau et un état de démonstration : vert pour les valeurs supérieures à la carte normale, corail en dessous, ivoire à égalité. Les tests contrôlent l’impact des quatre sceaux, leur répétition aux tours suivants, l’absence de rejeu lors d’une actualisation, la référence au niveau et à la rareté, les renforts et les fiches. Le scénario temporaire de contrôle n’est pas intégré aux écrans du jeu.

La page [Field de Mighty Party](https://mightyparty.fandom.com/wiki/Field) sert de référence pour la présence de bâtiments, de runes et de pentagrammes au début du combat. Les illustrations et les effets chiffrés sont des adaptations originales pour Sylve ; ils ne reproduisent pas les statistiques de Mighty Party. Les règles retenues sont décrites dans [field.md](field.md).

Les pertes de statistiques réutilisent le halo et les étincelles avec une teinte rouge et une étiquette sombre « −N puissance » ou « −N PV ». Les captures de contrôle montrent une [perte de puissance](debuff-attack-animation.png) causée par le Saule des murmures et une [perte de vie](debuff-health-animation.png) appliquée par une capacité de démonstration. Les deux scénarios utilisent les composants réels et les événements du moteur partagé ; leurs écrans temporaires ne sont pas intégrés au jeu. La perte affichée tient compte du plancher de puissance à zéro.
## Filtres « Toutes » et « Bâtiments »

Deux illustrations ont été créées avec **ImageGen intégré**, par deux appels distincts avec fond transparent, puis encodées en WebP de 256 × 256 px avec alpha conservé : `apps/web/public/art/ui/all-cards.webp`, un éventail de cartes aux couleurs des quatre raretés, et `apps/web/public/art/ui/building-tower.webp`, une tour de pierre au toit vert et aux ornements dorés. Les prompts exacts et les chemins des sources sont conservés dans [art-prompts-collection-filters.json](art-prompts-collection-filters.json).

Le composant partagé `GameIcon` affiche les deux illustrations dans les filtres de l’atelier. Le bâtiment apparaît aussi dans les cartes, les statistiques de combat, les détails et le bestiaire. `CollectionIcon` réutilise l’éventail dans les emplacements libres, la fiche d’amélioration, le refuge, les archives et les récompenses de ligue. La collection de l’atelier s’affiche par rareté décroissante : légendaire, épique, rare, commune ; les cartes de même rareté gardent leur ordre d’origine.

Le [rendu de l’atelier](decks-rarity-filters-validation.jpg) montre le tri et les deux nouvelles illustrations dans les filtres.

## Trophées et ligues

Onze nouveaux visuels originaux ont été créés avec **ImageGen intégré**, chacun par un appel distinct avec transparence : `apps/web/public/art/ui/trophy.webp` et les dix écussons `apps/web/public/art/leagues/{iron,bronze,silver,gold,platinum,emerald,diamond,master,grandmaster,challenger}.webp`. Les images ont été encodées en WebP de 384 × 384 px avec alpha conservé. Le trophée est utilisé dans l’arène et les résultats ; les écussons figurent dans l’arène, l’atelier, les promotions et le parcours des ligues. Les chiffres romains IV, III, II et I sont superposés en HTML par `LeagueBadge`, sur la plaque sombre de l’illustration. Les trois dernières ligues de prestige portent I.

Le jeu complet des prompts finaux et les chemins des images sont conservés dans [art-prompts-leagues.json](art-prompts-leagues.json). Les PNG originaux sont conservés dans le répertoire local de génération. Aucun fallback CLI de génération n’a été utilisé.

Les illustrations sont originales et ont été produites avec l’outil intégré **ImageGen**. La capture fournie sert de référence à la disposition du duel (terrain central, créatures sur les cases, main en dessous, valeurs dans des icônes).

- `apps/web/public/art/forest-arena.png` : décor de la page d’accueil.
- `apps/web/public/art/guardian-village.jpg` : village original créé avec l’outil intégré **ImageGen**, puis converti en JPEG qualité 88 pour limiter le poids du décor. Utilisé par le refuge connecté `/dashboard`. Les zones interactives sont des liens et des boutons HTML positionnés en pourcentage sur l’illustration, dont le ratio est conservé.
- `apps/web/public/art/duel-arena-overhead.webp` : terrain actuel du duel, une cour de pierre vue de dessus avec une légère perspective. La surface est volontairement calme pour lire clairement les 24 cases.
- `apps/web/public/art/duel-arena.webp` : première version du terrain, conservée comme référence.
- `apps/web/public/art/heroes/hero-sylve.webp` : héros elfe de la Sylve, placé à gauche du terrain et tourné vers son centre.
- `apps/web/public/art/heroes/hero-amber.webp` : héros mécanique d’ambre, placé à droite et tourné vers le terrain. La vie des deux héros est affichée au-dessus de leur silhouette par le même composant de cœur que les compagnons.
- `apps/web/public/art/characters/{id}.webp` : 12 personnages détourés, un pour chaque carte du catalogue : `guardian`, `fox`, `owl`, `stag`, `mushroom`, `dragon`, `turtle`, `wisp`, `wolf`, `knight`, `serpent`, `bear`. Le même visuel apparaît sur la carte et sur le terrain.
- `apps/web/src/components/game/stat-badge.tsx` : épée pour la puissance et cœur pour la vie, avec la valeur superposée et un libellé accessible. Les valeurs restent dynamiques ; elles ne sont pas incrustées dans les images.

Les personnages possèdent un véritable canal alpha transparent, vérifié avant intégration. Les images finales sont converties en WebP ; les compagnons sont limités à 512 px et les héros à 768 px pour limiter le téléchargement. Les PNG originaux restent dans le dossier de génération ImageGen local.

Le jeu de prompts exact utilisé pour le premier terrain et les 12 personnages est conservé dans [art-prompts.json](art-prompts.json). Celui du terrain vu de dessus et des deux héros, avec leurs chemins finaux et les coordonnées du plateau, est dans [art-prompts-v2.json](art-prompts-v2.json). Chaque personnage a fait l’objet d’un appel séparé à l’outil intégré, avec transparence demandée. Le détourage final du héros elfe a également été réalisé avec ImageGen. Aucun fallback CLI n’a été utilisé.

Le décor mesure 1659 × 948 px. Les quatre coins intérieurs de sa bordure dorée sont relevés dans `apps/web/src/components/game/arena-layout.ts`. Une homographie projette le plateau de 6 colonnes et 4 lignes vers ce quadrilatère. Les joints des dalles sont dessinés en SVG avec ces coordonnées ; les zones cliquables utilisent les mêmes polygones et les pieds des compagnons sont ancrés sur ce même plan. Le décor et la grille partagent un rapport d’image fixe, sans recadrage. L’interface de duel conserve cette disposition pour ordinateur.

Prompt final du décor de la page d’accueil, outil intégré ImageGen :

> Use case: stylized-concept. Asset type: wide landscape background illustration for an original fantasy tactical card game website, called Sylve. Create a gorgeous hand-painted 2D storybook fantasy landscape: an ancient circular stone duel arena surrounded by lush emerald forest, giant trees, small delicate golden flowers, ferns and moss-covered ruins, distant mountains and a waterfall, warm soft morning sunlight. Rich painterly brushwork, charming sophisticated game art, teal/forest greens and warm parchment gold, tiny magical fireflies. Composition: wide landscape 3:2, arena occupies lower right half with generous hazy lighter negative space upper left for page title overlay. No characters, no cards, no lettering, no text, no logos, no watermark, no UI. This is a single scenic illustration.

Prompt final du village, outil intégré ImageGen :

> Use case: stylized-concept.
> Asset type: production background illustration for the interactive village hub of Sylve, an original French fantasy card game.
> Primary request: a beautiful explorable woodland village with five distinct buildings, like an illustrated strategy game's home map, at a fixed elevated three-quarter isometric camera angle. A coherent single scene, no user interface.
> Scene/backdrop: a secluded emerald forest valley, ancient monumental trees framing the sides, mossy rounded rock ledges, a winding turquoise stream and small waterfall toward the lower right, pale misty mountains in the distance, winding warm sandy footpaths connecting all five buildings, tiny wildflowers and ferns. Fill the whole rectangular scene edge to edge. This is a cozy premium hand-painted 2D fantasy game, detailed brushwork, natural colors, charming architectural silhouettes, readable at browser size.
> Composition/framing: wide landscape 16:9. All five buildings completely visible and well separated, no overlaps. Center-back at x=51% y=37% a large welcoming guardian's keep with cream stone walls, mossy teal conical roofs, warm glowing windows, a small green banner and broad front steps (the central landmark). Upper-left at x=24% y=37% a bookish wizard's archive tower with a tall navy roof and a large open-book sign. Lower-left at x=22% y=68% a cozy card-maker's workshop with a terracotta roof, wood veranda, card banners and a golden lantern. Upper-right at x=77% y=33% a mystical round stone sanctuary with a giant luminous jade crystal growing above a circular stone base, fireflies. Lower-right at x=76% y=68% a circular open-air dueling arena, low mossy stone walls, two crossed green banners and softly glowing golden stone floor. Leave small clear grass/path pockets immediately below each building for HTML labels. Building centers should closely follow specified coordinates; buildings take about 15-21% scene width each. Middle foreground has open curved path.
> Lighting/mood: late-afternoon sunlight from top left, warm rays through tree canopy, peaceful magical atmosphere, subtle teal ambient shadows and warm honey highlights, enough contrast for legibility. Polished storybook illustration, not plastic 3D, not pixel art, not photorealism.
> Constraints: no people, no characters, no text, no letters, no logos, no watermark, no cards overlay, no frames, no interface, no labels. Original architecture and world. Deliver just the landscape illustration.

## Atelier des decks

Le décor plein écran de `/decks` est enregistré dans `apps/web/public/art/deck-workshop.webp` (1672 × 941 px, environ 317 Ko). Il a été créé avec l’outil intégré **ImageGen**, puis encodé en WebP avec `cwebp` (qualité 88). Le PNG original reste dans le dossier de génération local. Le décor couvre toute la fenêtre ; les deux rangées de cartes, leurs statistiques et les commandes sont des éléments interactifs superposés. Les personnages réutilisent les illustrations du catalogue.

Le deck enregistré s’ouvre en haut et les créatures qui n’y figurent pas composent la collection en dessous. Glisser une carte de la collection sur une carte du deck remplace cette dernière ; glisser deux cartes du deck échange leur position. La composition conserve huit cartes uniques. Une sélection suivie d’un clic ou d’une activation au clavier offre la même interaction. Les filtres à icônes en bas (« Toutes », « Corps à corps », « À distance ») s’appliquent à la collection. Les changements de cartes sont enregistrés automatiquement, avec reprise après erreur réseau. Chaque joueur dispose d’un seul deck ; les contrôles de création, de suppression et de sélection ont été retirés.

Le rendu actuel est conservé dans les aperçus [ordinateur](ui-deck-filters-validation.jpg) à 1440 × 900 px et [mobile](ui-deck-filters-mobile-validation.jpg) à 390 × 844 px, avec défilement horizontal des cartes. Le contenu commence juste sous le bord de la table, en tenant compte du recadrage du décor en `cover`. L’en-tête conserve le retour au refuge et le solde d’or ; l’inscription « L’atelier des gardiens » a été retirée.

Prompt final :

```text
Use case: stylized-concept.
Asset type: production full-screen background illustration for the deck-building workshop of Sylve, an original woodland fantasy card game.
Primary request: a beautiful hand-painted card-maker's workshop, an atmospheric open wooden lodge in an enchanted forest. The camera looks slightly downward across a very broad empty warm dark walnut worktable, almost front-on, to support an interactive two-row card collection interface.
Scene/backdrop: ancient carved timber rafters at the top and outer corners, open arched windows overlooking misty emerald woods, warm golden lanterns to either side, small mossy leaves at the extreme edges, a few rolled parchments and a closed green grimoire confined to the far left and right edges. Rich natural wood grain, old brass fittings, subtle vine carvings, premium storybook fantasy game illustration.
Composition/framing: wide landscape 16:9, edge-to-edge illustration. The entire middle 85 percent of the image must be a calm spacious uncluttered wooden work surface, with no objects in the middle. The upper 15 percent shows the workshop architecture and forest windows; table occupies from 20 percent to the bottom. Make two very subtle broad horizontal surfaces at about 35 percent and 70 percent, but no visible card slots or individual rectangles. Darker shadowed bottom edge. Props confined to extreme edges only, so HTML card rows are fully legible.
Lighting/mood: cozy late-afternoon honey light from upper left, deep forest-teal shadows at the corners, warm amber highlights along wood edges, a few discreet floating dust motes.
Style: sophisticated detailed painterly 2D storybook fantasy, same world as an emerald forest village with teal-roofed stone towers and warm lanterns. Polished natural materials, soft brushwork, original scenery.
Constraints: scenery only; no cards, no characters, no creatures, no text, no letters, no numbers, no logos, no watermark, no interface, no buttons, no icons, no frame around the whole image. Do not draw a screenshot or a game UI.
```

## Flèche de retour

`apps/web/public/art/ui/back-arrow.webp` : flèche de retour originale en bois sculpté, laiton doré et incrustations de feuilles vertes, créée avec l’outil intégré **ImageGen**. Son canal alpha a été vérifié, puis l’image a été recadrée sur son contenu transparent, réduite et encodée en WebP avec `sharp` (288 × 157 px, environ 17 Ko). Le PNG original reste dans le dossier de génération local.

La flèche remplace l’ancien lien illustré d’une icône et du texte « Le refuge » dans l’en-tête de `/decks`. Le lien conserve sa destination `/hub` et le libellé accessible « Retour au refuge », avec une zone cliquable adaptée au tactile et un focus visible au clavier.

Prompt final, outil intégré ImageGen :

```text
Use case: stylized-concept.
Asset type: a single transparent game interface navigation asset, the back arrow for Sylve, a hand-painted woodland fantasy card game.
Primary request: create one beautiful, compact, LEFT-pointing return arrow, made from warm carved walnut wood with an aged golden brass edge. It must feel crafted inside an enchanted forest workshop with ancient timber, amber lantern light and forest-green accents.
Subject: one unmistakable broad left-pointing arrow silhouette, large triangular arrowhead on the left, short thick straight horizontal shaft ending in a softly rounded tail on the right. Fine dark wood grain, a modest beveled brass rim with honey highlights, a tiny restrained carved vine detail near the tail with muted jade green inlay. Strong clean readable outline. The arrow is the complete clickable icon: no additional button, no plaque behind it, no circle or square surrounding it.
Style/medium: premium hand-painted 2D storybook fantasy game asset, tactile painted wood and slightly worn brass, soft painterly shading, natural materials matching a cozy forest card-maker's lodge. Almost front-on orthographic view, no dramatic perspective. Subtle depth from the bevel only.
Composition/framing: square canvas, isolated single arrow centered, arrow occupies about 90 percent of the canvas width and 60 percent of its height, balanced compact 3:2 silhouette with a thick shape that stays legible when displayed at 72 by 48 pixels.
Lighting/mood: soft warm lantern highlights from upper left, dark emerald ambient shade, gentle dark contour around the silhouette for legibility over a busy forest background.
Constraints: true alpha-transparent background; transparency visible around every outer edge. No background scenery, no checkerboard pattern painted into the image, no backing plate, no text, no letters, no symbols other than the left arrow, no logo, no watermark, no border around the canvas, no duplicate arrows. Deliver just the single finished arrow asset.
```

## Pourtour du deck

`apps/web/public/art/ui/deck-frame.webp` : pourtour original en noyer, laiton vieilli et petites feuilles de jade, assorti à la flèche de retour. Il a été créé avec l’outil intégré **ImageGen**. Le centre est réellement transparent (canal alpha vérifié), tout comme l’extérieur. L’asset est recadré et encodé avec `sharp` en WebP de 1536 × 458 px, environ 104 Ko. Le PNG original reste dans le dossier local de génération.

Le cadre est posé via `border-image` avec une découpe de 120 px et des bordures de 28 px ; les coins sont préservés et les rails s’étirent avec le contenu. Le panneau vert est retiré et le bois de la table reste visible au centre. Le cadre contient uniquement les cartes agrandies, sans titre, nom de deck ni texte sous les cartes. Sur petit écran, les commandes de défilement restent à l’extérieur du cadre. La collection conserve son titre « Ta collection », sans surtitre ni slogan. Le pourtour ne capte pas les événements du pointeur, ce qui conserve le glisser-déposer.

Le deck unique est enregistré dès qu’une carte est remplacée ou déplacée. Les écritures sont sérialisées et les changements intermédiaires regroupés pendant une requête en cours. Une erreur déclenche une nouvelle tentative automatique ; la navigation attend que les dernières modifications soient enregistrées. La sauvegarde laisse les cartes modifiables. Les anciens decks supplémentaires sont conservés en base, mais seul le plus récemment modifié est exposé et peut être utilisé ; aucune nouvelle création ni suppression n’est autorisée par les mutations publiques.

Prompt final, outil intégré ImageGen :

```text
Use case: stylized-concept.
Asset type: production transparent decorative rectangular frame border for the current deck in Sylve, a hand-painted woodland fantasy card game.
Primary request: create one wide empty rectangular picture-frame surround, in the same material style as a fantasy return arrow made of carved walnut, aged golden brass and small green leaf inlays.
Subject: only the perimeter border of a wide horizontal rectangular frame. Warm dark walnut wood rails, realistic fine painted wood grain, modest worn gold brass edging on both inner and outer rim, softly beveled corners. Restrained small carved curling vines and muted jade-green leaves at the four corners, integrated into the wood and brass. Charming premium storybook fantasy illustration with soft honey lantern highlights and deep forest-tinted shadows. Strong continuous rectangular outline, elegant restrained craft rather than an ornate baroque frame.
Composition/framing: wide landscape exactly 3:1 aspect ratio. Frame centered and almost fills the canvas, with only a tiny transparent margin outside. Straight perfectly horizontal top and bottom rails and perfectly vertical side rails. Front-facing flat orthographic view, no perspective, no tilt. Rails about 50 pixels thick on a 1536 by 512 canvas; corner ornament contained inside the outer rectangular silhouette. Each corner fits within a 96 by 96 pixel square, and the middle portions of all four rails must remain straight and uniform so this artwork can be rendered as a resizable CSS nine-slice border.
Transparency: the entire large rectangular center opening MUST be empty and truly alpha-transparent, with no paper, no wood panel, no colored fill, no glass, no green rectangle. The small area outside the frame must also be truly alpha-transparent. This is an isolated cutout frame perimeter, not a picture of a frame in a scene.
Constraints: no background, no table, no environment, no images or objects inside the frame, no cards, no creatures, no text, no letters, no numbers, no logo, no watermark, no UI buttons. Do not paint a checkerboard pattern. Deliver just one continuous rectangular decorative frame with a transparent center and transparent exterior.
```


## Icônes de vie et de combat

Les images `apps/web/public/art/ui/health-heart.webp`, `apps/web/public/art/ui/melee-sword.webp` et `apps/web/public/art/ui/ranged-bow.webp` remplacent les symboles SVG des points de vie et des types de combat. Elles sont partagées entre les cartes, les unités et héros en duel, le sanctuaire et les filtres de l’atelier. Les nombres restent du texte HTML et les libellés accessibles sont conservés.

Les trois illustrations ont été générées séparément avec l’outil intégré **ImageGen**, puis recadrées sur leur canal alpha, réduites et encodées avec `sharp` en WebP transparent de 256 × 256 px. Les PNG originaux sont conservés dans `/Users/thomas/.codex/generated_images/01a163fa-150d-7022-93bb-99fd860612fb/`. Le cœur est rouge avec un pourtour de laiton et de jade ; les armes reprennent le noyer, le laiton et l’argent de la flèche de retour.

Prompts finaux, outil intégré ImageGen :

### Cœur de vie

```text
Use case: stylized-concept.
Asset type: transparent health icon for Sylve, an original woodland fantasy card game, used as a tiny 34-pixel stat badge.
Primary request: one bold ruby-red HEART symbol, hand-painted and beautifully crafted, matching a carved walnut and aged golden brass interface with subtle jade leaf details.
Subject: a broad symmetrical plump heart with two clear rounded lobes and a pointed bottom, rich warm vermilion-red enamel, a restrained thin beveled antique brass rim, a small walnut shadow along the lower edge. Keep the broad center simple, calm and red so a white number can be overlaid by the website. Tiny leafy engraving confined to the outer rim only.
Style/medium: premium detailed hand-painted 2D storybook fantasy game UI asset, tactile materials, strong silhouette, soft painterly shading, front-on view, warm light from upper left, dark contour for contrast against both wooden scenery and pale cards. Elegant, readable and compact, matching a return arrow carved in walnut with a honey-brass edge and jade vine inlay.
Composition/framing: square canvas; isolated single heart centered and filling about 88 percent of the width and height; modest transparent margin. Strong legibility at 24 to 40 pixels.
Constraints: actual alpha-transparent background around the silhouette. No backplate, no frame around the canvas, no scenery, no hands, no extra objects, no text, no letters, no digits, no logo, no watermark, no painted checkerboard. Deliver only this one finished heart.
```

### Épée de corps à corps

```text
Use case: stylized-concept.
Asset type: transparent melee sword icon for Sylve, an original woodland fantasy card game, used at 18 to 40 pixels in cards and filter buttons.
Primary request: one bold, simple SWORD, hand-painted and beautifully crafted, matching a carved walnut and aged golden brass interface with subtle jade details.
Subject: one short broad straight double-edged blade of bright softly shaded silver, pointing diagonally toward the upper right, with the short walnut grip at lower left; a sturdy aged gold crossguard, rounded golden pommel, one small jade inset at the hilt. The silhouette should be thick and iconic, with a broad readable blade and compact grip; very restrained engraving only.
Style/medium: premium detailed hand-painted 2D storybook fantasy game UI asset, tactile materials, strong silhouette, soft painterly shading, front-on view, warm light from upper left, dark contour for contrast against wooden scenery and pale cards. Elegant, readable and compact, matching a return arrow carved in walnut with a honey-brass edge and jade vine inlay.
Composition/framing: square canvas; isolated single sword centered, arranged lower left to upper right, filling about 88 percent of the width and height; modest transparent margin. It must remain instantly readable at 18 pixels.
Constraints: actual alpha-transparent background around every edge. No circle, no shield, no backplate, no surrounding frame, no scenery, no hands, no extra objects, no crossed second weapon, no blood, no text, no letters, no digits, no logo, no watermark, no painted checkerboard. Deliver only this one finished sword.
```

### Arc à distance

```text
Use case: stylized-concept.
Asset type: transparent ranged bow icon for Sylve, an original woodland fantasy card game, used at 18 to 40 pixels in cards and filter buttons.
Primary request: one bold BOW WITH A SINGLE NOCKED ARROW, hand-painted and beautifully crafted, matching a carved walnut and aged golden brass interface with subtle jade details.
Subject: a compact curved recurve bow of warm walnut wood with thick honey-brass reinforced tips and a small jade green grip. A clearly visible taut pale-gold bowstring and ONE simple broad silver-tipped arrow pointing diagonally toward the upper right. Strong recognizable bow silhouette, not a crossbow; keep the internal geometry very simple and the wood thick enough to read when tiny.
Style/medium: premium detailed hand-painted 2D storybook fantasy game UI asset, tactile materials, strong silhouette, soft painterly shading, front-on view, warm light from upper left, dark contour for contrast against wooden scenery and pale cards. Elegant, readable and compact, matching a return arrow carved in walnut with a honey-brass edge and jade vine inlay.
Composition/framing: square canvas; isolated single bow and nocked arrow centered, filling about 88 percent of the width and height; modest transparent margin. It must remain instantly readable at 18 pixels.
Constraints: actual alpha-transparent background, including inside the bow. No circle, no shield, no backplate, no surrounding frame, no scenery, no hands, no extra arrows or objects, no text, no letters, no digits, no logo, no watermark, no painted checkerboard. Deliver only this one finished bow with arrow.
```

## Salon et coffres de progression

L’arène `/arena` utilise `apps/web/public/art/play-lobby.webp`, un hall d’arène forestier original généré avec l’outil intégré **ImageGen**. Le décor couvre toute la fenêtre ; le héros réutilise `hero-sylve.webp`. Les boutons et les sept emplacements de trésors sont des éléments HTML superposés.

Les quatre sprites `apps/web/public/art/chests/{common,rare,epic,legendary}.webp` ont chacun été générés séparément avec ImageGen et une transparence demandée. Ils partagent une vue de trois quarts : bois et fer, métal bleu, cristaux violets puis or lumineux. Le canal alpha des quatre WebP a été vérifié avec `webpinfo`. Les coffres sont encodés à 512 × 512 px, qualité 90 ; le décor à 1672 × 941 px, qualité 88, avec `cwebp`. Aucun fallback CLI de génération n’a été utilisé.

Les cinq prompts exacts sont conservés dans [art-prompts-progression.json](art-prompts-progression.json). Les PNG originaux restent dans `/Users/thomas/.codex/generated_images/01a164cc-a67f-78d2-9443-a99ddbff74c8/`. Les images consommées par le jeu sont toutes copiées dans le dépôt. Les raretés et niveaux des cartes utilisent les portraits existants avec une bordure et un badge HTML ; aucune statistique n’est incrustée dans les images.

Le salon a été contrôlé dans le navigateur à 1440 × 900 px et 390 × 844 px, ainsi que la fiche d’amélioration sur mobile. Aperçus : [ordinateur](play-validation.jpg), [mobile](play-mobile-validation.jpg), [amélioration](card-upgrade-mobile-validation.jpg). Les commandes, le retour de focus des fenêtres et les cartes ont été vérifiés ; aucune erreur n’a été relevée dans la console du navigateur.

### Emplacements enchaînés

`apps/web/public/art/ui/slot-chains.webp` est une chaîne croisée en X avec un cadenas fermé, générée séparément avec l’outil intégré **ImageGen**. Le fond est réellement transparent et le canal alpha a été vérifié avec `webpinfo`. L’image est encodée en WebP de 512 × 512 px, qualité 90. Le prompt exact est enregistré dans [art-prompts-slot-chains.json](art-prompts-slot-chains.json). Les quatre emplacements verrouillés du salon utilisent cette même illustration ; le premier emplacement affiche toujours le coffre commun de trois victoires.

Cette disposition à sept emplacements a été contrôlée à 1440 × 900 px et 390 × 844 px, y compris le défilement horizontal jusqu’aux quatre emplacements enchaînés sur mobile. Aperçus : [ordinateur](play-chained-slots-validation.jpg), [mobile](play-chained-slots-mobile-validation.jpg).

## Pièces d’or

`apps/web/public/art/ui/gold-coins.webp` est une pile compacte de trois pièces dorées frappées d’une feuille de chêne, générée avec l’outil intégré **ImageGen** sur fond transparent. L’illustration reprend les matières peintes, les reflets de miel et les ombres ambrées de Sylve. Elle est utilisée dans le solde en haut des pages hors combat, la fiche d’amélioration et les récompenses de coffre.

Le canal alpha du WebP a été vérifié avec `webpinfo`. Le fichier final mesure 384 × 384 px, environ 46 Ko, encodé avec `cwebp` en qualité 90. Le prompt exact est conservé dans [art-prompts-currency.json](art-prompts-currency.json). Le PNG original reste dans le dossier de génération local ; le fichier consommé par le jeu est dans le dépôt. Aucun fallback CLI de génération n’a été utilisé.

La présentation a été contrôlée dans un aperçu local avec des données de démonstration, à 1440 × 900 px et 390 × 844 px. Le solde, les deux récompenses, le coût du prochain niveau et le blocage en cas d’or insuffisant ont été vérifiés. Aperçus : [salon](gold-lobby-validation.webp), [récompenses](gold-rewards-validation.webp), [amélioration sur mobile](gold-upgrade-mobile-validation.webp).

## Filtres de rareté et dialogues

Les quatre petites cartes `apps/web/public/art/ui/rarity-{common,rare,epic,legendary}.webp` ont été générées séparément avec l’outil intégré **ImageGen**. Elles représentent des dos de cartes à feuille centrale : argent et sauge pour commune, bleu saphir pour rare, violet améthyste pour épique et or pour légendaire. Les images ont été recadrées sur leur transparence puis encodées avec `sharp` en WebP de 160 × 216 px, qualité 90, environ 74 Ko pour les quatre. Le canal alpha des fichiers finaux a été vérifié (valeurs de 0 à 255). Les prompts exacts, les PNG sources conservés localement et chaque chemin final sont enregistrés dans [art-prompts-rarity-filters.json](art-prompts-rarity-filters.json).

Les icônes remplacent le sélecteur de rareté et sont placées à côté des filtres de combat, sur une seconde ligne sur mobile. Chaque rareté se sélectionne indépendamment ; les raretés sélectionnées sont réunies, puis combinées avec le type de combat. Sans rareté sélectionnée, toutes sont visibles. « Toutes » réinitialise les deux groupes. Les boutons conservent un libellé accessible, un état `aria-pressed`, une coche et une infobulle au survol ou au focus. La combinaison épique + légendaire + corps à corps a été vérifiée dans le navigateur, ainsi que les activations avec Entrée et Espace.

Les fiches d’amélioration reprennent une composition de fiche de jeu : une grande carte illustrée à gauche, le nom dans un bandeau, une barre de progression avec le prochain niveau, les statistiques actuelles et futures, puis un grand bouton d’amélioration affichant le prix et les gains. Les commandes du deck sont regroupées dans un volet latéral. Les portraits et le décor existants sont réutilisés, avec un cadre de la couleur de rareté, dans la palette vert profond et crème de Sylve. Sur mobile, le portrait et le nom restent côte à côte ; les statistiques et les commandes passent dessous. Le niveau maximal présente une progression terminée et les exemplaires en réserve, sans coût de prochain niveau.

La fiche a été vérifiée dans un aperçu local avec des données de démonstration à 1440 × 900, 1280 × 720, 390 × 844 et 320 × 800 px : amélioration, mise à jour des exemplaires et de l’or, manque de ressources, niveau maximal, ouverture depuis le deck, fermeture par Échap et retour du focus. Aucune erreur de console ni débordement horizontal n’a été relevé. Les récompenses de coffre conservent leur thème `game` et les cartes révélées leur pleine opacité.

Aperçus : [fiche ordinateur](ui-card-dialog-validation.jpg), [fiche mobile](ui-card-mobile-validation.jpg), [coffre ordinateur](ui-chest-dialog-validation.jpg), [coffre mobile](ui-chest-mobile-validation.jpg).

## Sanctuaire et émeraudes

Les offres d’émeraudes progressent désormais d’une **bourse de cuir** à une **sacoche**, puis un **écrin**, un **coffret sculpté** et un **coffre des anciens**. Quatre illustrations sobres ont été créées avec **ImageGen intégré** en prenant l’ancien « Coffre des anciens » comme référence de matière et de style ; ce coffre unique devient le dernier palier. Les anciennes scènes à deux ou trois coffres ne sont plus utilisées. Les WebP transparents de 512 × 512 px sont dans `apps/web/public/art/treasures/`, avec une échelle d’affichage croissante de 66 à 100 %. Le [nouveau manifeste](art-prompts-emerald-packs-v2.json) conserve les prompts complets et les chemins finaux ; le [manifeste initial](art-prompts-emerald-packs.json) reste archivé. Les [notes sur les achats Polar](emerald-purchases.md) détaillent les nouveaux noms, identifiants et associations de produits.

`apps/web/public/art/sanctuary.webp` représente un temple forestier ouvert, enchâssé dans un arbre ancien, avec un autel de pierre et une fontaine d’invocation turquoise. L’image a été générée avec l’outil intégré **ImageGen**, puis encodée avec `cwebp` en WebP de 1672 × 941 px, qualité 88, environ 487 Ko. Le décor couvre toute la page `/sanctuary` ; le titre, les taux, les prix et les commandes sont des éléments HTML. Les éventails des packs réutilisent les dos de cartes illustrés existants.

`apps/web/public/art/ui/emerald.webp` représente **une seule grosse émeraude verte**, taillée à pans coupés, créée avec **ImageGen intégré**, sur un fond réellement transparent. Elle remplace l’ancien groupe de trois diamants bleus. L’image finale mesure 384 × 384 px, qualité 90, avec son canal alpha conservé. Elle accompagne le solde en haut des pages connectées hors combat et les prix des invocations, à côté des pièces d’or. Les libellés accessibles, les messages de solde insuffisant et les accents du portefeuille utilisent aussi les émeraudes.

Le prompt exact du décor et son chemin source restent dans [art-prompts-sanctuary.json](art-prompts-sanctuary.json). Le prompt exact de l’émeraude, son chemin source et le chemin final sont conservés dans [art-prompts-currency.json](art-prompts-currency.json), avec les pièces d’or. Les PNG originaux restent dans le dossier local de génération ; les images consommées par le jeu sont dans le dépôt.

Le remplacement par les émeraudes a été vérifié dans le sanctuaire à 1280 × 720 px : une seule pierre dans le solde et chaque prix, transparence conservée (contrôlée avec `webpinfo`), solde existant préservé et aucune erreur de console. Aucune invocation n’a été achetée pour ce contrôle. TypeScript, la compilation de production et les 25 tests ciblés du portefeuille et du sanctuaire passent. [Aperçu avec les émeraudes](emerald-currency-validation.webp).

Le parcours hub → sanctuaire a été vérifié sur le backend de développement et à 320 × 800 px. La page a aussi été contrôlée à 1280 × 720 et 390 × 844 px. Les révélations ont été testées dans un aperçu isolé avec des données de démonstration : dix cartes, minimum de deux légendaires pour le pack des anciens, débit du solde, désactivation des achats trop chers et ouverture du dialogue en haut de la liste sur mobile. Aucun diamant du compte connecté n’a été dépensé pour ces contrôles. Aucun débordement horizontal ni nouvelle erreur de console n’a été relevé après les derniers ajustements.

Aperçus : [sanctuaire ordinateur](sanctuary-validation.jpg), [mobile](sanctuary-mobile-validation.jpg), [petit mobile](sanctuary-small-mobile-validation.jpg), [révélation ordinateur](sanctuary-reveal-validation.jpg), [révélation mobile](sanctuary-reveal-mobile-validation.jpg).

L’en-tête a ensuite été simplifié : le libellé du lieu, le bloc d’introduction et l’annonce des diamants de bienvenue sont retirés. Bestiaire et Collection restent accessibles dans l’en-tête, sans pied de page ; la dernière invocation conserve un bouton d’historique compact. Les packs sont centrés dans l’espace disponible. L’absence de défilement vertical a été vérifiée à 1456 × 853 et 1280 × 720 px, ainsi que le placement des raccourcis à 390 × 844 px. [Aperçu de la disposition simplifiée](sanctuary-clean-layout-validation.jpg).

Les offres ont été allégées : les surtitres et les étoiles décoratives sont retirés, ainsi que le bloc de garantie séparé. Les boutons ×10 affichent directement « 1 légendaire garanti » pour la Sylve et « 2 légendaires garantis » pour les anciens, avec une description accessible. Le rendu a été contrôlé à 1218 × 853, 1280 × 720 et 390 × 844 px : pas de défilement vertical sur ordinateur ni de débordement horizontal sur mobile. Aperçus : [offres sur ordinateur](sanctuary-compact-offers-validation.jpg), [offres sur mobile](sanctuary-compact-offers-mobile-validation.jpg).

Les pourcentages de réduction sont remplacés par un ruban doré « 1 tirage gratuit » sur les deux boutons ×10. La note sous les offres et le message initial « Le sanctuaire s’éveille… » sont supprimés ; les boutons restent désactivés pendant l’initialisation, sans bloc qui déplace les packs. Le rendu est vérifié à 2265 × 1314, 1280 × 720 et 390 × 844 px, sans débordement horizontal ni défilement vertical sur ordinateur. Aperçus : [rubans sur ordinateur](sanctuary-offer-ribbons-validation.jpg), [rubans sur mobile](sanctuary-offer-ribbons-mobile-validation.jpg).

Les raccourcis Bestiaire et Ma collection sont désormais centrés juste sous les deux offres, avec un espacement de 12 px. Les offres et leur navigation forment un seul groupe centré ; sur mobile, les raccourcis suivent la seconde carte. Le placement est vérifié à 2265 × 1314, 1280 × 720 et 390 × 844 px, avec accès au clavier et sans défilement vertical sur ordinateur. [Aperçu de la navigation sous les offres](sanctuary-bottom-navigation-validation.jpg).


## Cartes communes et renforts — 23 octobre 2026

Onze illustrations originales ont été générées avec l’outil intégré **ImageGen** pour compléter le catalogue : `healer`, `gnome`, `idol`, `enchantress`, `lynx`, `bard`, `tree`, `vampire`, `captain`, `witch` et le jeton `sporeling`. Les personnages, le totem et l’arbre conservent la direction peinte de Sylve, leurs silhouettes entières et un fond transparent. Les images ne reprennent pas les illustrations de Mighty Party.

Les fichiers sont intégrés dans `apps/web/public/art/characters/`, en WebP avec canal alpha, dans une boîte maximale de 512 px. Les portraits et unités partagent ces mêmes fichiers ; l’Éclaireur invoqué réutilise l’illustration du Renard des braises. Le [manifeste des prompts](art-prompts-cards.json) conserve chaque prompt intégral, le PNG source généré et le chemin final. L’[alignement Cunt Wars](cw-alignment.md) décrit leurs rôles et capacités actuels.


## Capacités et états — 24 octobre 2026

Seize icônes originales ont été générées avec l’outil intégré **ImageGen** : puissance, vitalité, soin, blocage, épines, vampirisme, régénération, bouclier mental, double attaque, perforation, rune de vie, renfort, alliance de l’Ordre, affaiblissement, attaque bloquée et bonus temporaire. Leur peinture, leurs contours et leurs accents dorés reprennent les symboles de vie et d’attaque de Sylve. Le [manifeste](art-prompts-abilities.json) conserve les prompts complets, les PNG générés et les chemins intégrés.

Les fichiers sont dans `apps/web/public/art/abilities/`, en **WebP de 192 × 192 px avec transparence**, pour environ **191 Kio au total**. Les originaux sont conservés. Les contours transparents sont normalisés avec une marge commune pour garder des tailles visuelles cohérentes. Les nombres et explications restent du texte HTML.

`ability-icons.tsx` partage les images entre les cartes en main, les decks, les cartes de l’atelier, les récompenses de coffres et d’invocations, les fiches, le bestiaire, les effets animés et le journal. Sur le plateau, les capacités apparaissent au pied des unités ; les états reçus sont placés sur le côté avec leurs valeurs actuelles. Les sceaux utilisent leurs quatre illustrations de terrain et restent visibles sous leur porteur. Un bouclier consommé disparaît : les états sont lus sur l’instance de combat et les passifs initiaux ne sont pas réaffichés à sa place.

Les bonus d’attaque et de vie sont comparés aux valeurs de base de la variante ; les malus, bonus temporaires et unités de mêlée bloquées ont leur propre symbole. Quatre états restent visibles en combat ; un compteur et son infobulle donnent accès aux suivants, tous détaillés dans la fiche. Les capacités verrouillées sont grisées et portent un cadenas et leur niveau de déblocage. Le bestiaire met aussi à jour les icônes de ses vignettes lorsque le niveau change. Sa fiche reste visible pendant le défilement.

Une légende repliable est disponible dans les règles du duel, les archives et le bestiaire. Les fiches conservent un contraste adapté aux panneaux clairs ou sombres ; la fiche d’un compagnon s’ouvre sur son titre. Les animations de capacité ont une durée de 360 ms et un impact à 180 ms, ce qui laisse leur image et leur valeur apparaître avant l’événement suivant. Les dégâts physiques conservent leur impact à 260 ms.

Les tests couvrent les déblocages, les états accordés par une autre unité, les protections consommées, les bonus et malus, le compteur des effets cumulés et les impacts illustrés pendant la lecture des événements. Les contrôles visuels utilisent les composants réels, avec un état de combat de démonstration : [plateau à 1 440 × 900](abilities-board-desktop.jpg), [fiche sur ordinateur](abilities-details-desktop.jpg), [fiche à 390 × 844](abilities-details-mobile.jpg), [états et capacités sur mobile](abilities-statuses-mobile.jpg), [amélioration mobile](abilities-upgrade-mobile.jpg), [bestiaire](abilities-bestiary-desktop.jpg), [légende des seize icônes](abilities-legend-desktop.jpg). Toutes les images chargent ; les fiches contrôlées ne débordent pas horizontalement.

## Évolutions Rare et Epic — 24 octobre 2026

**44 sprites originaux** ont été générés avec **ImageGen intégré**, un appel par variante, puis enregistrés en WebP RGBA dans `apps/web/public/art/characters/evolutions/{famille}-{rare,epic}.webp` (512 px maximum). Les sprites conservent l’espèce et l’univers peint des communes ; l’équipement et la silhouette progressent avec la rareté, avec des accents bleus puis améthyste. Les portraits utilisent l’identifiant d’illustration conservé dans chaque instantané de carte. Une nouvelle icône de poison est dans `apps/web/public/art/abilities/poison.webp` (192 px maximum).

Le [manifeste](art-prompts-evolutions.json) contient les 45 prompts finaux, le nom de chaque évolution, les chemins de sortie et les PNG originaux. L’alpha a été vérifié sur tous les fichiers ; les 44 sprites ont été contrôlés sur deux planches de comparaison : [familles 1–11](evolutions-art-1.jpg) et [familles 12–22](evolutions-art-2.jpg). Les illustrations Mighty Party ne sont pas utilisées.

Contrôles des composants : [bestiaire ordinateur](evolutions-bestiary-desktop.jpg), [bestiaire mobile](evolutions-bestiary-mobile.jpg), [fiche ordinateur](evolutions-upgrade-desktop.jpg), [fiche mobile](evolutions-upgrade-mobile.jpg).

## Évolutions Legendary — 24 octobre 2026

**20 sprites originaux** ont été générés avec **ImageGen intégré**, un appel par évolution, et enregistrés dans `apps/web/public/art/characters/evolutions/{famille}-legendary.webp`. Les espèces et silhouettes des familles Epic sont conservées ; l’équipement, les couronnes et les motifs végétaux progressent avec des accents d’or, d’ivoire et de lumière. Les WebP ont une boîte maximale de 512 px et une transparence réelle vérifiée. Les deux familles dont les fiches Epic indiquent « Evolves To: N/A » conservent leur illustration existante.

Les invocations de l’Oracle du firmament et du Grand forgeron ont leurs propres sprites : **Autel des sources** (`characters/life-palace.webp`) et **Bobine des racines** (`characters/root-coil.webp`), également transparents et limités à 512 px. L’Écuyer des racines réutilise le Chevalier commun. Quatre nouvelles icônes transparentes de 192 px maximum — **silence, immunité, esquive, contre-attaque** — complètent les 17 symboles existants. Elles sont partagées par les capacités, les états du plateau, les fiches et le journal.

Le [manifeste Legendary](art-prompts-legendary.json) contient les **26 prompts complets**, les PNG générés et chaque chemin final. Les illustrations sont originales et ne reprennent pas les images de Mighty Party. Planches de comparaison Epic → Legendary : [familles 1–10](legendary-art-1.jpg), [familles 11–20](legendary-art-2.jpg), [invocations et icônes](legendary-summons-and-icons.jpg).

Les composants réels ont été contrôlés à **1 330 × 1 100** et **390 × 844 px** dans un aperçu local : les 20 nouveaux portraits chargent, les plafonds 31 et 26 suivent la famille, aucune erreur JavaScript ni aucun débordement horizontal n’est relevé. Le focus initial de la fiche d’amélioration est placé sur sa fenêtre pour qu’elle s’ouvre en haut sur mobile. Aperçus : [bestiaire ordinateur](legendary-bestiary-desktop.jpg), [bestiaire mobile](legendary-bestiary-mobile.jpg), [fiche ordinateur](legendary-upgrade-desktop.jpg), [fiche mobile](legendary-upgrade-mobile.jpg). Les [profils historiques conservés pour les tests](legacy-data.md) documentent les données de cette validation antérieure à CW.


## Emplacements de coffre et clés — 24 octobre 2026

Quatre images originales ont été générées avec **ImageGen intégré**, un appel par image : les chaînes croisées et leur cadenas doré serti d’émeraude (`apps/web/public/art/ui/premium-slot-chains.webp`), puis les clés de la Sylve, des anciens et souveraine (`apps/web/public/art/keys/chest-key-{1,2,3}.webp`). Les trois clés possèdent des silhouettes distinctes, avec des feuilles de chêne et des incrustations vertes. Les chaînes de fer déjà présentes restent utilisées pour les déblocages de ligue.

Les quatre fichiers sont en **WebP RGBA de 512 × 512 px**, pour environ **232 Kio au total**, avec alpha réel vérifié. Le [manifeste des quatre prompts](art-prompts-chest-keys.json) conserve les prompts complets et les PNG sources. Les fichiers référencés par le jeu sont tous dans le dépôt.

Les composants réels ont été vérifiés à **1 440 × 900**, **390 × 844** et **320 × 700 px** dans un aperçu local avec des achats simulés. Le contrôle navigateur vérifie les neuf emplacements, la molette horizontale, la barre masquée, le glisser à la souris, l’absence d’ouverture après un glisser et le clic normal sur un coffre prêt. Les trois clés chargent ; l’achat simulé met à jour le solde et l’état acquis, sans erreur JavaScript ni débordement horizontal de la page. Aperçus : [coffres ordinateur](chest-slots-desktop.webp), [cadenas dorés ordinateur](chest-slots-premium-desktop.webp), [coffres mobile](chest-slots-mobile.webp), [cadenas dorés mobile](chest-slots-premium-mobile.webp), [clés ordinateur](chest-keys-desktop.webp), [achat de clé](chest-key-purchased-desktop.webp), [clés mobile](chest-keys-mobile.webp), [petit mobile](chest-keys-small-mobile.webp).

## Grand coffre rare et butin par ligue

Le nouveau grand coffre rare possède une illustration distincte, assortie au bois bleu et aux renforts argentés du coffre rare : `apps/web/public/art/chests/bigRare.webp`, WebP 512 × 512 avec canal alpha vérifié par `webpinfo`. Elle a été créée avec l’outil imagegen intégré ; le [prompt final et la référence](art-prompts-big-rare-chest.json) sont conservés dans le dépôt.

L’arène affiche le prix d’ouverture immédiate sous le compte à rebours. La fenêtre permet d’ouvrir avec des émeraudes ou de continuer à attendre ; le prix diminue et devient gratuit à l’échéance. Les fiches de ligue détaillent les cinq catégories, leurs chances, les lots de cartes, l’or et le délai. Les invocations affichent la quantité par compagnon correspondant au record de ligue, puis le nombre réellement gagné sur chaque carte.

Rendus vérifiés avec des données de démonstration : [ouverture sur ordinateur](chests-rush-desktop.webp), [mobile](chests-rush-mobile.webp), [petit mobile](chests-rush-small-mobile.webp), [sanctuaire](chests-summons-desktop.webp), [sanctuaire mobile](chests-summons-mobile.webp), [révélation ×10](chests-summons-reveal-desktop.webp) et [révélation sur petit mobile](chests-summons-reveal-small-mobile.webp).

## Trois appels et carte d’or

La Sylve retrouve ses taux de 65 % / 25 % / 8 % / 2 %, avec un éventail de quatre raretés et une mention de la carte d’or garantie. Les anciens reprennent leur éventail épique / légendaire et leurs taux de 80 % / 20 %. L’offre entièrement légendaire devient l’Appel des divinités, avec une bordure dorée renforcée et des prix de 4 499 / 39 999 émeraudes. Les trois offres se parcourent sur la même rangée horizontale, avant les clés.

La carte d’or apparaît en plus des compagnons dans la révélation de la Sylve. Elle réutilise l’illustration des pièces et un cadre doré en CSS, avec le montant réellement crédité. La dernière invocation conserve cette récompense à la réouverture.

Le [rendu de la carte d’or](summons-gold-bonus.webp) a été vérifié avec les composants réels à 1 280 × 720 dans un aperçu isolé : cinq compagnons et une carte d’or supplémentaire. Les trois offres et leurs taux ont également été contrôlés dans le sanctuaire ouvert.

### Cercle d’invocation et dos commun

La révélation utilise désormais un [dos unique](../apps/web/public/art/ui/summon-card-back.webp), généré avec ImageGen intégré à partir du style forestier du jeu. Le [manifeste](art-prompts-summon-card-back.json) conserve son prompt complet. Le WebP transparent de 400 × 560 px est partagé par toutes les raretés et par la carte d’or, dont la position est mélangée pour garder la surprise.

Les six cartes se retournent individuellement autour d’un bouton central. Les lots ×10 se révèlent en dix étapes ; le dernier cercle propose le même achat à tarif réduit, uniquement sur son bouton central et tant que le cercle reste ouvert. Les offres du sanctuaire gardent leurs prix de base, dont le tarif groupé permanent du ×10. La carte d’or s’ajoute désormais aussi aux anciens et aux divinités pour conserver six récompenses par nouveau tirage. Le [fonctionnement et les captures de validation](summoning.md) détaillent les tarifs, la reprise réseau et les anciens résultats.
