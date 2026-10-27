# Animations des batailles

L’arène conserve ses personnages, ses zones de placement et ses informations accessibles en React. GSAP anime les personnages et PixiJS dessine les effets sur un canvas transparent, sous les nombres de dégâts et les étiquettes des pouvoirs du Gardien. Les unités affichent uniquement leurs PV, leur puissance et les icônes de leurs compétences, agrandies et disposées à partir de leur coin inférieur gauche ; leur nom et leurs états détaillés restent dans leur fiche au clic. Le moteur de règles et les mutations Convex restent responsables du résultat du combat.

## Mise en scène

- Corps à corps : anticipation, charge vers la cible, impact et retour.
- Distance : préparation du tireur, projectile teinté selon sa faction et impact.
- Compétences : halo du lanceur et effets simultanés sur les cibles d’une même activation. Les projectiles de compétences sont réservés au Gardien ; les créatures conservent leur halo et leurs impacts locaux.
- Soins et vitalité : halo vert et particules en forme de croix ; protections et gel : effets bleus ; poison : vert ; pertes et drain : corail.
- Invocation : apparition progressive et onde ; mort ou retrait : disparition avec particules ascendantes.

`combatFrameTiming` fournit les durées et l’instant d’impact communs au lecteur d’événements, aux nombres de dégâts et aux timelines. Les PV changent toujours à l’impact prévu par `COMBAT_TIMING`. Une capacité de zone conserve tous ses impacts dans la même étape ; les animations n’ajoutent aucun délai aux règles.

Les unités sont identifiées par joueur, carte, ligne et profondeur. Deux exemplaires de la même carte restent indépendants. Les renforts conservent la distinction entre leur position et celle de leur invocateur.

## Chargement et ressources

Le module GSAP/PixiJS est chargé dynamiquement au montage d’une arène visible. Une initialisation tardive rejoint la séquence en cours à son temps écoulé ; une étape déjà terminée est ignorée. Les effets ne sont pas rejoués sur une simple actualisation d’état.

Le canvas utilise WebGL, avec une résolution limitée à deux fois les pixels CSS et moins de particules sur les petits écrans. Les particules gardent leurs proportions en portrait. Ses coordonnées suivent celles des personnages et son redimensionnement est observé : les effets en cours sont effacés lors d’un changement de taille et l’étape suivante mesure les nouvelles positions. Le rendu suit le ticker GSAP uniquement pendant les effets actifs.

Les timelines, les objets graphiques, le canvas, l’observateur de taille et les écouteurs sont nettoyés en quittant l’arène. Une initialisation terminée après ce départ est également détruite. Masquer la page efface les effets transitoires.

Le réglage système `prefers-reduced-motion` empêche le chargement du module et désactive les mouvements ; un changement de ce réglage pendant le combat détruit la scène. Les informations fixes de combat restent affichées. Si WebGL est indisponible, GSAP conserve la chorégraphie avec les indications CSS existantes. Si le module ne charge pas, l’arène conserve ses animations CSS. La perte d’un contexte WebGL libère le renderer et conserve GSAP.

## Vérification

Les tests couvrent l’instant d’impact, les exemplaires répétés, les impacts de zone, les tirs du Gardien, les renforts, les protections et les créations de runes vides. Ils vérifient aussi le nettoyage, l’absence de répétition, les chargements tardifs, la réduction des animations et le repli sans WebGL. Les tests existants du lecteur de combat et de l’arène vérifient les PV, les morts et les nombres flottants.
