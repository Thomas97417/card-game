# Le Puits oublié

Le puits, au milieu de la place entre la maison des gardiens et l’atelier, ouvre `/cemetery`. Cette route demande la même session que le refuge. Le mode est solo, en 2D avec PixiJS, sans limite de durée, sans entrée payante et sans quota quotidien de récompenses.

## Jouer et progresser

Le gardien sélectionné conserve son illustration. Son niveau, ses pouvoirs de duel et son deck ne modifient pas cette activité. Chaque partie commence au niveau 1 avec 100 PV avant améliorations, la Baguette sylvestre et les achats permanents figés au lancement. Les onze gardiens utilisent les mêmes règles.

ZQSD, WASD et les flèches déplacent le héros ; un joystick est affiché sur mobile. Les armes attaquent automatiquement. Les choix de niveau, la pause, le changement d’onglet et la perte de focus suspendent la simulation. Les touches maintenues sont relâchées lors d’une interruption. Échap permet de mettre en pause et de reprendre, sauf pendant un choix ou après la mort.

L’interface conserve les actions, statistiques et règles utiles. Les accès aux améliorations et à l’arsenal se trouvent sous le bouton de partie ; le record accompagne le titre. Les prix des améliorations utilisent les illustrations de pièces d’or et d’émeraudes communes au jeu. Dans l’arsenal, l’arme et son évolution sont présentées côte à côte avec leur recette ; sur mobile, les douze armes se sélectionnent dans une grille d’illustrations compacte, sans déplacement automatique de la page. Le bilan réutilise le portrait du gardien, les illustrations de statistiques, le coffre et les images des actions. La barre d’expérience en bas du combat contient dix segments de 10 %, partiellement remplis si nécessaire, et le niveau actuel en son centre. Sa valeur et la progression vers le prochain niveau sont aussi accessibles aux lecteurs d’écran.

La collecte d’expérience propose trois objets distincts, ou quatre selon la chance. Le joueur peut porter six armes et six passifs. Le catalogue contient douze armes, leurs douze évolutions et seize objets passifs. Les objets sont disponibles dès le départ dans le tirage des niveaux, sans importer les succès de déblocage du jeu de référence. Les armes montent jusqu’au niveau 8 ; une arme complète et son passif associé permettent une évolution grâce à un reliquaire de boss apparu à partir de dix minutes. Les reliquaires antérieurs améliorent les objets déjà possédés. Quand le build est complet, les niveaux proposent de l’or ou des soins. Le Talisman de retour ne peut être obtenu à nouveau après épuisement.

Les revenants sont rejoints progressivement par les chauves-souris, squelettes, spectres et gardes funéraires. Un boss entre toutes les cinq minutes, même lorsque la horde atteint sa limite. La population est limitée à 180 ennemis, les projectiles à 280 et les ramassables à 160. Les ramassables de même type sont fusionnés en conservant leur valeur. La difficulté continue après trente minutes ; aucune Faucheuse ni écran de victoire ne termine la partie.

## Améliorations permanentes

Les seize caractéristiques classiques sont proposées, avec une Égide propre à Sylve. Vie : ×1,1 par rang, jusqu’à trois rangs ; attraction : ×1,25 par rang, jusqu’à deux. Les autres cumuls sont additifs, avec les plafonds de rangs de référence. L’armure s’applique avant le bouclier et ne peut réduire un coup à moins d’un point. L’Égide ajoute dix points d’absorption par rang, jusqu’à cinquante, et recharge dix points par seconde après cinq secondes actives sans dégât.

Chaque rang peut être payé en or ou en émeraudes, avec le même effet. Le prix en or est le coût initial de référence multiplié par le prochain rang ; le prix en émeraudes est ce montant divisé par 200, arrondi au supérieur. Les frais globaux de Vampire Survivors ne sont pas transposés. L’Égide utilise une base de 600 pièces d’or. Les achats sont possibles uniquement entre les parties et ne sont pas remboursables dans cette version.

## Coffres et compte principal

| Survie active | Coffre à la mort |
| --- | --- |
| Moins de 5 minutes | Commun |
| De 5 à moins de 10 minutes | Rare |
| De 10 à moins de 15 minutes | Grand coffre rare |
| De 15 à moins de 20 minutes | Épique |
| À partir de 20 minutes | Légendaire |

Une mort donne un seul coffre : le meilleur palier atteint. Ses cartes et son or viennent des tables existantes ; la meilleure progression de ligue est figée au départ. L’or ramassé s’ajoute à l’or du coffre et est crédité lors de son ouverture. Les coffres non ouverts restent accessibles dans le menu, y compris après une nouvelle partie ou une reconnexion. Leur ouverture utilise la révélation habituelle, les règles de doublons et la mission d’ouverture de coffres. Les reliquaires de boss restent internes à la partie et ne comptent pas comme coffres de collection. Un abandon volontaire n’accorde ni or, ni coffre, ni record.

## Données de référence et adaptations

Les valeurs ont été consultées le **12 novembre 2026** sur le [wiki Vampire Survivors](https://vampire.survivors.wiki/). Les chiffres sont locaux : aucun accès à ce wiki n’est effectué pendant le jeu.

- [Armes](https://vampire.survivors.wiki/w/Weapons), [évolutions](https://vampire.survivors.wiki/w/Evolved), [objets passifs](https://vampire.survivors.wiki/w/Passive_items), [améliorations permanentes](https://vampire.survivors.wiki/w/PowerUps) et [niveaux d’expérience](https://vampire.survivors.wiki/w/Level_up).
- Les douze fiches d’armes et d’évolutions sont conservées dans `packages/game/src/cemetery-catalogue.ts`, avec les modifications numériques de chacun des huit niveaux. Les secondes et multiplicateurs sont préservés, notamment les augmentations réelles de 0,25 seconde de Santa Water et Runetracer et les cumuls multiplicatifs de vie et d’attraction.
- Le relevé numérique consultable est dans [la référence classique V1](references/vampire-survivors-classic-v1.json). Il identifie chaque fiche d’origine et sépare les valeurs relevées des choix d’intégration.
- Les noms français, illustrations, géométrie et distances du champ, vitesse absolue des déplacements et projectiles, apparitions et statistiques ennemies, tarifs, bouclier et coffres du compte sont des adaptations de Sylve. Les Arcanas, DLC, unions, Limit Break et personnages de Vampire Survivors sont hors de cette version.

Les illustrations ont été générées avec l’outil intégré imagegen, puis converties en WebP en préservant leur transparence. Les huit prompts et la référence de style du village sont conservés dans [le manifeste d’illustrations](art-references/cemetery-v1.json). Les portraits des gardiens réutilisent les assets de Sylve.

Le [manifeste des objets](art-references/cemetery-items-v1.json) conserve les prompts ImageGen des 47 illustrations transparentes du cimetière : douze armes, douze évolutions, seize passifs, deux cristaux d’expérience, quatre autres ramassables et l’Égide du refuge. Ces WebP de 256 × 256 sont utilisés dans l’arsenal, les choix de niveau, les achats, l’inventaire, les ramassables au sol et les projectiles adaptés. Le bleu et le violet distinguent les valeurs d’XP ; leur taille conserve un minimum visible sur les petits écrans. Les sprites de combat sont réutilisés puis libérés à leur disparition. Les anciennes formes et icônes restent disponibles comme repli si une illustration ne peut pas être chargée.

## Sauvegardes et interfaces

`@sylve/game/cemetery` exporte le moteur, le catalogue, les statistiques, les entrées, les choix et les bilans. La simulation avance par pas de 50 ms et utilise un générateur pseudo-aléatoire dont l’état est sauvegardé. L’état versionné fige le héros et les améliorations de départ.

Les tables `cemeteryProgress`, `cemeteryRuns` et `cemeteryInputReceipts` isolent ce mode des duels. Le backend expose `board`, `run`, `ensure`, `startRun`, `resumeRun`, `pauseRun`, `submitInputs`, `chooseUpgrade`, `purchaseUpgrade`, `finishRun`, `abandonRun` et `openReward`.

Le navigateur prédit la partie et envoie une seconde d’entrées par lot. Un choix de niveau est appliqué et inscrit dans le brouillon local dès le clic : le jeu reprend sans attendre la sauvegarde et les niveaux enchaînés restent immédiatement accessibles. Les choix et les déplacements suivants sont confirmés dans leur ordre d’origine, puis rejoués sur le dernier état du serveur pour préserver la prédiction. Le serveur valide le choix et reprend la partie dans une seule mutation ; les envois suivants respectent son nouveau budget de temps sans bloquer le rendu.

La pause et la reprise dans une session ouverte prennent effet immédiatement à l’écran. Le bouton de reprise reste disponible pendant une sauvegarde. Leurs commandes sont inscrites dans la même file que les déplacements et les choix, puis confirmées dans l’ordre des pas de simulation. Des bascules rapides au même pas sont fusionnées sans modifier une requête déjà envoyée. Une confirmation tardive ne remplace jamais la dernière intention locale de jouer ou de rester en pause.

Le retour au menu affiche immédiatement le menu et suspend la simulation, pendant que la session conservée en mémoire termine sa sauvegarde. Le temps et le niveau affichés viennent de cet état local ; une reprise immédiate réutilise la même session sans relire un ancien état serveur. Les erreurs de sauvegarde restent visibles dans le menu. Un abandon confirmé libère la session conservée. Après une mort, le menu reste accessible pendant la validation du bilan ; une nouvelle partie et les achats attendent cette validation.

Le serveur rejoue les entrées, contrôle leur cadence et calcule les morts et récompenses. Les lots et choix ont des reçus persistants comparés exactement lors d’une répétition. L’entrée dans une partie acquiert une nouvelle session de contrôle pour empêcher deux onglets de piloter simultanément. Une reprise depuis la pause conserve cette session et vérifie qu’un autre onglet ne l’a pas remplacée. Les sélections et pauses suspendent cette session ; une reprise recale le budget de temps sur le dernier état confirmé, y compris lorsqu’une pause rapide a été fusionnée avant son envoi. Le temps passé en pause ne devient donc pas un crédit de déplacements.

Le brouillon local V3 contient les entrées, choix, pauses et reprises encore non confirmés, séparés par compte, partie et session de contrôle ; les anciens brouillons V1 et V2 restent lisibles. La file reste bornée à cent déplacements et choix cumulés, soit au plus cinq secondes actives non confirmées ; les commandes de pause et de reprise sont également bornées et fusionnées au même pas. Le brouillon est envoyé avant la récupération d’une session après rechargement ; une sauvegarde corrompue ne remplace jamais celle du serveur. Une réponse perdue n’applique pas deux fois l’amélioration. Une action permet de reprendre explicitement l’état du serveur en cas de conflit. Les achats vérifient le rang attendu et ne peuvent pas débiter deux fois le même rang. La finalisation et l’ouverture des récompenses sont également idempotentes.

Le backend et le schéma doivent être intégrés au déploiement Convex avant de publier le frontend correspondant. Les comptes existants sont initialisés à leur première visite ; aucune migration destructive n’est nécessaire.

## Vérifications

Les tests du moteur couvrent les références numériques, les six emplacements, les douze évolutions, les collisions, déplacements, bouclier, résurrections, reliquaires, fusion des butins, pauses, relectures et une survie de 31 minutes. Les tests Convex couvrent l’authentification, les achats et requêtes concurrents, les soldes à zéro, les reprises, les choix, les cinq paliers et les récompenses idempotentes. Les tests d’interface et de session couvrent le menu, l’arsenal, les paiements, le lien du hub, les brouillons et les interruptions réseau. Les vues du menu et du combat sont aussi vérifiées sur ordinateur et sur mobile.
