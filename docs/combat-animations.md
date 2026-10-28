# Animations des batailles

L’arène conserve ses personnages, ses zones de placement et ses informations accessibles en React. Spine anime les poses des portraits, GSAP orchestre leurs déplacements et PixiJS dessine les effets sur un canvas transparent, sous les nombres de dégâts et les étiquettes des pouvoirs du Gardien. Howler.js assure l’ambiance et les effets sonores. Les unités affichent uniquement leurs PV, leur puissance et les icônes de leurs compétences, agrandies et disposées à partir de leur coin inférieur gauche ; leur nom et leurs états détaillés restent dans leur fiche au clic. Le moteur de règles et les mutations Convex restent responsables du résultat du combat.

## Poses Spine

`spine-battle-rig.ts` utilise le runtime officiel `@esotericsoftware/spine-core` 4.2. Chaque personnage possède son propre `Skeleton` et son `AnimationState`, avec des données d’animation partagées et des transitions de 65 ms. `spine-rig-data.ts` définit sept morphologies : humanoïde, quadrupède, dragon ailé, oiseau, serpent, végétal et esprit. Le rig humanoïde comporte treize os : racine, corps, bassin, torse, tête, bras, avant-bras, cuisses et jambes. Les autres profils adaptent la hiérarchie aux pattes, ailes, queues, branches ou ondulations.

Les illustrations existantes texturent un véritable `MeshAttachment` Spine pondéré, avec 195 sommets et 336 triangles par personnage. Chaque sommet est lié à trois os au maximum ; les coordonnées de liaison préservent exactement l’image dans la pose initiale. La tête, les coudes et les genoux bougent indépendamment du torse ; les appendices suivent leur propre animation. Cette déformation continue évite de découper les images ou de créer des trous entre les articulations. Les limites des silhouettes peintes subsistent : le maillage ne révèle pas les surfaces cachées et ne crée pas de nouvelles vues du personnage.

`spine-portrait-renderer.ts` calcule les sommets avec Spine et les affiche dans des `MeshSimple` PixiJS, sur le même contexte WebGL que les effets. Les textures sont partagées dans une arène et chaque personnage conserve sa géométrie indépendante. La position, le pivot, le miroir, l’opacité et les déplacements GSAP sont reproduits dans le rendu. Les images DOM restent accessibles en secours jusqu’au chargement de leur texture, puis les maillages prennent leur place. Les statistiques et icônes restent en React, au-dessus des personnages. Les bâtiments restent immobiles.

Un observateur rattache les os aux portraits nouvellement invoqués ou remplacés et libère ceux des créatures retirées, y compris les buffers de leur maillage. Les animations de repos sont déphasées par personnage. Le ticker est arrêté lorsque l’onglet est masqué et le rig est détruit si la réduction des animations est activée. Sans WebGL, les poses globales restent disponibles sur les portraits DOM ; les articulations pondérées nécessitent le renderer. Une perte de contexte réaffiche les images DOM et les textures sont libérées à la sortie de l’arène.

## Glisser-déposer

`BattleDragPreview` utilise `projectedUnitSize`, fondé sur les mêmes dimensions de case et le même rapport 1 / 1,1 que les créatures du plateau. La taille suit la case survolée, sa ligne en perspective et les redimensionnements de l’arène. Avant de survoler une case, la ligne la plus proche du pointeur sert de référence. L’image garde `object-fit: contain` et un ancrage en bas identiques à ceux du plateau. L’animation d’invocation conserve cette échelle au lieu de faire apparaître le personnage à 65 % de sa taille.

Références : [architecture du runtime Spine](https://esotericsoftware.com/spine-runtime-architecture), [application et mélange des animations](https://esotericsoftware.com/spine-applying-animations). La [licence des runtimes Spine](https://esotericsoftware.com/spine-runtimes-license) est conservée dans `public/licenses/spine-runtimes.txt` ; l’utilisation et la distribution du runtime sont régies par ses conditions.

## Son du combat

`use-battle-audio.ts` charge Howler.js séparément des animations : les sons restent disponibles avec `prefers-reduced-motion` et sans WebGL. Le son est déverrouillé à la première interaction clavier ou pointeur. Les commandes du duel proposent une coupure immédiate et un volume, mémorisés localement sous `sylve:combat-audio` ; le volume initial est de 55 %.

Les deux bus Howler sont propres au duel et ne modifient aucun volume global. Un fond forestier et magique boucle discrètement. Un sprite audio regroupe treize sons : préparation de mêlée, tir, coup reçu, protection, magie, soin, poison, gel, invocation, disparition, pouvoir du Gardien, victoire et défaite. Les coups reçus et les compétences retentissent à l’impact défini par `combatFrameTiming`. La conclusion joue après la fin de la lecture du combat. Le panoramique stéréo suit le camp affiché, avec de légères variations de hauteur des effets.

Une compétence de zone joue une seule fois chaque type de son par camp. Le mix est limité à huit effets simultanés. Les étapes déjà entendues, les instants déjà dépassés et les sons dont le fichier n’est pas prêt ne sont pas remis en attente au déverrouillage ou au chargement. La coupure, le masquage de l’onglet et le départ annulent les impacts programmés ; seuls les sons d’ambiance reprennent au retour de l’onglet. Le départ décharge les deux bus et retire les écouteurs.

Les fichiers WAV de `public/audio/combat/` sont synthétisés hors ligne, sans enregistrement externe ni service tiers. `bun scripts/generate-combat-audio.mjs` les régénère de façon déterministe, ainsi que `combat-audio-sprite.json`. L’ensemble pèse environ 844 Kio. Référence : [documentation officielle Howler.js](https://github.com/goldfire/howler.js#documentation).

## Mise en scène

- Corps à corps : flexion, préparation des bras, saut en arc jusqu’au contact de la cible, bref maintien de l’impact, poussée de retour et récupération sur la case d’origine. La distance de charge dépend des positions et de la taille des deux combattants.
- Distance : préparation du tireur, projectile teinté selon sa faction et impact.
- Compétences : halo du lanceur et effets simultanés sur les cibles d’une même activation. Les projectiles de compétences sont réservés au Gardien ; les créatures conservent leur halo et leurs impacts locaux.
- Soins et vitalité : halo vert et particules en forme de croix ; protections et gel : effets bleus ; poison : vert ; pertes et drain : corail.
- Invocation : apparition progressive et onde ; mort ou retrait : disparition avec particules ascendantes.

`combatFrameTiming` fournit les durées et l’instant d’impact communs au lecteur d’événements, aux nombres de dégâts et aux timelines. Les PV changent toujours à l’impact prévu par `COMBAT_TIMING`. Une capacité de zone conserve tous ses impacts dans la même étape ; les animations n’ajoutent aucun délai aux règles.

Les unités sont identifiées par joueur, carte, ligne et profondeur. Deux exemplaires de la même carte restent indépendants. Les renforts conservent la distinction entre leur position et celle de leur invocateur.

## Chargement et ressources

Le module Spine/GSAP/PixiJS est chargé dynamiquement au montage d’une arène visible. Une initialisation tardive rejoint la séquence en cours à son temps écoulé ; une étape déjà terminée est ignorée. Les effets ne sont pas rejoués sur une simple actualisation d’état.

Le canvas utilise WebGL, avec une résolution limitée à deux fois les pixels CSS et moins de particules sur les petits écrans. Les particules et personnages gardent leurs proportions en portrait. Ses coordonnées suivent celles des personnages et son redimensionnement est observé : les effets en cours sont effacés lors d’un changement de taille et les points d’ancrage sont remesurés. Le rendu suit le ticker GSAP lorsque l’arène est visible, pour animer aussi les articulations et la respiration au repos.

Les timelines, les objets graphiques, le canvas, l’observateur de taille et les écouteurs sont nettoyés en quittant l’arène. Une initialisation terminée après ce départ est également détruite. Masquer la page efface les effets transitoires.

Le réglage système `prefers-reduced-motion` empêche le chargement du module et désactive les mouvements ; un changement de ce réglage pendant le combat détruit la scène. Les informations fixes de combat restent affichées. Si WebGL est indisponible, GSAP conserve la chorégraphie avec les indications CSS existantes. Si le module ne charge pas, l’arène conserve ses animations CSS. La perte d’un contexte WebGL libère le renderer et conserve GSAP.

## Vérification

Les tests couvrent l’instant d’impact commun au son et aux poses Spine, la reconstruction exacte des sept maillages dans leur pose initiale, les articulations indépendantes, le contact et le retour de la charge, le partage des textures et la libération des géométries. Ils vérifient aussi la taille du glisser-déposer sur chaque ligne à 390, 1 024 et 1 920 pixels, son redimensionnement et le placement par événements pointeur. Les contrôles existants vérifient les exemplaires répétés, les compétences de zone, les chargements tardifs, la réduction des animations, le repli sans WebGL, le son, les PV, les morts et les nombres flottants.
