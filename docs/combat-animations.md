# Animations des batailles

L’arène conserve ses personnages, ses zones de placement et ses informations accessibles en React. Spine anime les poses des portraits, GSAP orchestre leurs déplacements et PixiJS dessine les effets sur un canvas transparent, sous les nombres de dégâts et les étiquettes des pouvoirs du Gardien. Howler.js assure l’ambiance et les effets sonores. Les unités affichent uniquement leurs PV, leur puissance et les icônes de leurs compétences, agrandies et disposées à partir de leur coin inférieur gauche ; leur nom et leurs états détaillés restent dans leur fiche au clic. Le moteur de règles et les mutations Convex restent responsables du résultat du combat.

## Poses Spine

`spine-battle-rig.ts` utilise le runtime officiel `@esotericsoftware/spine-core` 4.2. Chaque personnage possède son propre `Skeleton` et son `AnimationState`, avec des données d’animation partagées et des transitions de 80 ms. Le squelette original à deux os (racine et corps) anime la respiration, la préparation de mêlée, le tir, le sort, la réaction à l’impact, l’invocation et la mort. La réaction à un coup commence à l’impact commun, sans transition qui l’atténuerait.

Les ressources actuelles sont des illustrations entières : le corps reçoit la matrice héritée du squelette dans un élément DOM dédié, à l’intérieur du déplacement GSAP. Il s’agit d’un rig de portrait, sans articulation indépendante des bras et des jambes ni atlas exporté de l’éditeur Spine. L’image adverse reste retournée dans son propre élément ; les poses sont orientées selon le point de vue. Les statistiques et icônes ne respirent pas avec le portrait. Les bâtiments restent immobiles.

Un observateur rattache les os aux portraits nouvellement invoqués ou remplacés et libère ceux des créatures retirées. Les animations de repos sont déphasées par personnage. Le ticker est arrêté lorsque l’onglet est masqué et le rig est détruit si la réduction des animations est activée. Le rig continue de fonctionner sans WebGL.

Références : [architecture du runtime Spine](https://esotericsoftware.com/spine-runtime-architecture), [application et mélange des animations](https://esotericsoftware.com/spine-applying-animations). La [licence des runtimes Spine](https://esotericsoftware.com/spine-runtimes-license) est conservée dans `public/licenses/spine-runtimes.txt` ; l’utilisation et la distribution du runtime sont régies par ses conditions.

## Son du combat

`use-battle-audio.ts` charge Howler.js séparément des animations : les sons restent disponibles avec `prefers-reduced-motion` et sans WebGL. Le son est déverrouillé à la première interaction clavier ou pointeur. Les commandes du duel proposent une coupure immédiate et un volume, mémorisés localement sous `sylve:combat-audio` ; le volume initial est de 55 %.

Les deux bus Howler sont propres au duel et ne modifient aucun volume global. Un fond forestier et magique boucle discrètement. Un sprite audio regroupe treize sons : préparation de mêlée, tir, coup reçu, protection, magie, soin, poison, gel, invocation, disparition, pouvoir du Gardien, victoire et défaite. Les coups reçus et les compétences retentissent à l’impact défini par `combatFrameTiming`. La conclusion joue après la fin de la lecture du combat. Le panoramique stéréo suit le camp affiché, avec de légères variations de hauteur des effets.

Une compétence de zone joue une seule fois chaque type de son par camp. Le mix est limité à huit effets simultanés. Les étapes déjà entendues, les instants déjà dépassés et les sons dont le fichier n’est pas prêt ne sont pas remis en attente au déverrouillage ou au chargement. La coupure, le masquage de l’onglet et le départ annulent les impacts programmés ; seuls les sons d’ambiance reprennent au retour de l’onglet. Le départ décharge les deux bus et retire les écouteurs.

Les fichiers WAV de `public/audio/combat/` sont synthétisés hors ligne, sans enregistrement externe ni service tiers. `bun scripts/generate-combat-audio.mjs` les régénère de façon déterministe, ainsi que `combat-audio-sprite.json`. L’ensemble pèse environ 844 Kio. Référence : [documentation officielle Howler.js](https://github.com/goldfire/howler.js#documentation).

## Mise en scène

- Corps à corps : anticipation, charge vers la cible, impact et retour.
- Distance : préparation du tireur, projectile teinté selon sa faction et impact.
- Compétences : halo du lanceur et effets simultanés sur les cibles d’une même activation. Les projectiles de compétences sont réservés au Gardien ; les créatures conservent leur halo et leurs impacts locaux.
- Soins et vitalité : halo vert et particules en forme de croix ; protections et gel : effets bleus ; poison : vert ; pertes et drain : corail.
- Invocation : apparition progressive et onde ; mort ou retrait : disparition avec particules ascendantes.

`combatFrameTiming` fournit les durées et l’instant d’impact communs au lecteur d’événements, aux nombres de dégâts et aux timelines. Les PV changent toujours à l’impact prévu par `COMBAT_TIMING`. Une capacité de zone conserve tous ses impacts dans la même étape ; les animations n’ajoutent aucun délai aux règles.

Les unités sont identifiées par joueur, carte, ligne et profondeur. Deux exemplaires de la même carte restent indépendants. Les renforts conservent la distinction entre leur position et celle de leur invocateur.

## Chargement et ressources

Le module Spine/GSAP/PixiJS est chargé dynamiquement au montage d’une arène visible. Une initialisation tardive rejoint la séquence en cours à son temps écoulé ; une étape déjà terminée est ignorée. Les effets ne sont pas rejoués sur une simple actualisation d’état.

Le canvas utilise WebGL, avec une résolution limitée à deux fois les pixels CSS et moins de particules sur les petits écrans. Les particules gardent leurs proportions en portrait. Ses coordonnées suivent celles des personnages et son redimensionnement est observé : les effets en cours sont effacés lors d’un changement de taille et l’étape suivante mesure les nouvelles positions. Le rendu suit le ticker GSAP uniquement pendant les effets actifs.

Les timelines, les objets graphiques, le canvas, l’observateur de taille et les écouteurs sont nettoyés en quittant l’arène. Une initialisation terminée après ce départ est également détruite. Masquer la page efface les effets transitoires.

Le réglage système `prefers-reduced-motion` empêche le chargement du module et désactive les mouvements ; un changement de ce réglage pendant le combat détruit la scène. Les informations fixes de combat restent affichées. Si WebGL est indisponible, GSAP conserve la chorégraphie avec les indications CSS existantes. Si le module ne charge pas, l’arène conserve ses animations CSS. La perte d’un contexte WebGL libère le renderer et conserve GSAP.

## Vérification

Les tests couvrent l’instant d’impact commun au son et aux poses Spine, les matrices osseuses, le retour au repos, les exemplaires répétés, les impacts de zone, les tirs du Gardien, les renforts, les protections et les créations de runes vides. Ils vérifient aussi le nettoyage, l’absence de répétition, les chargements tardifs, la réduction des animations, le repli sans WebGL, le déverrouillage audio, la coupure, le masquage, le panoramique et la limite des voix. Les tests existants du lecteur de combat et de l’arène vérifient les PV, les morts et les nombres flottants.
