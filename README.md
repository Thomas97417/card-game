# Sylve — Le cercle des gardiens

Jeu de cartes tactique en ligne pour deux joueurs, réalisé avec React, TanStack Start, Convex et TypeScript. Interface en français, univers fantasy 2D et synchronisation des parties en temps réel.

## Jouer

Après connexion, `/hub` ouvre le refuge des gardiens, un village illustré en plein écran (`/dashboard` redirige vers `/hub`). Les bâtiments donnent accès à l’arène, à l’atelier, à la Maison des gardiens, aux paramètres du compte dans les Archives et au sanctuaire d’invocation. La carte se parcourt à la molette, par glisser à la souris, au clavier et au tactile, avec une barre de défilement horizontale masquée.

Le nouveau décor panoramique **3:1** étend le village et réserve des clairières aux futurs bâtiments. Deux mines produisent même hors connexion : **6 pièces d’or et 2 émeraudes par heure et par niveau du héros**, avec un plafond de **huit heures de production** pour chacune. Une icône apparaît au-dessus de la mine dès qu’une ressource entière peut être récupérée ; cliquer dessus affiche immédiatement le gain et vide la réserve. Le serveur confirme la collecte dans une transaction ; en cas de refus, les soldes et réserves affichés reviennent automatiquement aux valeurs serveur. La production démarre à la première visite du hub ; le niveau utilisé est celui du Gardien géré dans la Maison des gardiens. Les [règles des mines](docs/mines.md) détaillent l’accumulation, les plafonds, le changement de niveau et les protections contre les collectes répétées.

Une barre communautaire reste centrée en bas du hub pendant l’exploration : trois icônes originales donnent accès à **Classement**, **Amis** et **Missions**, avec un bandeau **Chat mondial** repliable en dessous. **Classement** ouvre juste au-dessus des icônes un panneau défilant avec les 50 meilleurs gardiens ayant terminé un combat à trophées, du rang 1 au rang 50, avec leur pseudo, leur ligue et leurs trophées actualisés en direct. Cliquer sur un joueur déplie sa ligne vers le bas : record de trophées, meilleure ligue et deck actuel avec les niveaux, raretés et statistiques des cartes. Le clavier permet de parcourir les joueurs et Échap ferme le panneau. **Amis** affiche jusqu’à 25 amis, les demandes reçues et envoyées, les conversations privées et l’aide quotidienne. La barre s’adapte aux écrans mobiles.

Le **Chat mondial** partage les 100 derniers messages en temps réel entre les joueurs connectés et conserve leur historique dans Convex. Les composants Message et MessageGroup de shadcn sont adaptés au refuge : les messages consécutifs d’un même gardien sont regroupés, avec son pseudo une seule fois et son avatar sur le dernier message. Un changement de jour démarre un nouveau groupe. Entrée envoie le message et Maj + Entrée ajoute une ligne ; chaque message est limité à 500 caractères, avec deux secondes entre deux envois. Le brouillon est conservé à la fermeture du panneau ou en cas d’échec. Le chat, les missions et le classement partagent le même cadre de 620 px maximum, centré au-dessus des raccourcis : ouvrir l’un replie le précédent. Leur hauteur commune reprend celle des missions, soit 660 px maximum, et s’adapte à l’écran. Le chat possède une icône originale de globe dans une bulle dorée.

Les **Missions** ouvrent un carnet à trois onglets : **Jour**, **Semaine** et **Épique**. Les cinq objectifs quotidiens et hebdomadaires suivent les duels terminés, les victoires, les cartes jouées, les coffres ouverts et les améliorations. Un clic sur **Récupérer** rapporte respectivement 20 ou 100 **sceaux de mission**. Ces sceaux débloquent cinq coffres sur chaque parcours (20 à 100 par jour, 100 à 500 par semaine), à ouvrir manuellement sans délai ni emplacement de coffre requis : quatre Communs puis un Rare pour le Jour ; deux Communs, deux Rares puis un Big Rare pour la Semaine. Les coffres contiennent les cartes et l’or de la ligue maximale atteinte au moment de l’ouverture ; ils comptent aussi pour les objectifs d’ouverture. Les sceaux ne sont pas dépensés et expirent avec le parcours. Le jour se renouvelle à minuit UTC, la semaine le lundi à minuit UTC ; les récompenses non récupérées expirent également.

Sept missions épiques suivent aussi les invocations et les évolutions, sans limite de temps. Chaque palier doit être récupéré pour créditer les émeraudes et ouvrir le suivant : les objectifs sont cumulatifs et croissent selon `objectif initial × (palier + 1) × (palier + 2) / 2` (palier interne à partir de zéro), les récompenses selon `récompense initiale × (palier + 1)`. La progression est conservée. Seuls les duels solo et publics comptent ; les défis amicaux et l’entraînement local sont exclus. Le suivi commence avec l’ajout de cette fonctionnalité. Une coche verte apparaît sur l’icône du hub dès qu’une mission ou un coffre peut être récupéré. Les événements et récompenses sont validés dans les transactions Convex ; les reprises de requêtes ne distribuent pas une récompense deux fois.

### Arène et trésors

`/arena` ouvre l’arène illustrée en plein écran (`/play` redirige vers `/arena` et conserve les invitations) : le héros à gauche ouvre le deck, les boutons de combat sont à droite et neuf emplacements de trésors occupent le bas. Le premier contient le coffre commun de trois victoires. Cinq places de combat suivent : deux sont ouvertes au départ et trois se gagnent en Bronze IV (800 trophées), Argent IV (1 600) et Or IV (2 400). Les trois dernières s’achètent au sanctuaire avec des clés à 500, 1 000 et 1 500 émeraudes. Les places acquises restent ouvertes après rétrogradation. La rangée se parcourt à la molette, au tactile, au clavier et par glisser à la souris, avec une barre de défilement masquée. Les illustrations originales reprennent l’univers peint de Sylve.

- **Combat solo** : affronte le Gardien mécanique avec ton deck et gagne des coffres. La partie est enregistrée sur Convex, reprend après actualisation, commence par le joueur humain et n’a pas de chronomètre. L’IA ne connaît que les informations visibles. Elle joue après les animations ; une relance serveur après trente secondes permet de poursuivre si le client disparaît.
- **Duel public** : cherche un autre joueur. La présence en file est renouvelée toutes les quinze secondes et expire après quarante-cinq secondes d’absence. Le vainqueur gagne un coffre.
- **Défi amical** : crée ou rejoins une invitation de huit caractères, valable dix minutes. Le lien retrouve sa destination après connexion. Ces parties ne rapportent pas de coffre.
- **Entraînement local** : `/practice` reste accessible sans compte et sans récompenses. La session recommence à l’actualisation.

Les combats solo connectés et duels publics rapportent **25 trophées par victoire** et en retirent **15 par défaite ou abandon**, avec un minimum de zéro. Les promotions arrivent tous les 200 trophées ; les emplacements de deck gagnés restent acquis après une rétrogradation. Le Gardien mécanique adapte ses créatures, raretés et niveaux à la ligue actuelle, avec des cartes communes de niveau 1 au départ. Il varie ses cartes grâce à la mémoire de ses trois derniers choix, tout en conservant les priorités tactiques de victoire et de survie. Les règles détaillées sont dans [docs/progression.md](docs/progression.md).

Le **coffre commun tout à gauche se déverrouille après trois victoires**, y compris contre le Gardien mécanique en combat solo. Son bouton « Ouvrir » permet de récupérer les cartes et l’or, puis le compteur repart à zéro pour un nouveau cycle de trois victoires. Il n’a aucun délai et progresse même si les places de combat sont pleines. Le compteur reste à 3/3 tant que le coffre n’a pas été ouvert.

Chaque victoire éligible attribue aussi un coffre de combat si une des places débloquées est libre. Les délais démarrent automatiquement et en parallèle : **15 minutes, 1 heure, 3 heures ou 8 heures**, selon la rareté. Un coffre prêt continue d’occuper son emplacement jusqu’à son ouverture. Si toutes les places débloquées sont occupées au moment de la victoire, **ce coffre de combat est perdu**. Le salon et le résultat du combat l’indiquent ; la victoire compte toujours pour le coffre commun.

L’ouverture révèle **deux récompenses : de l’or et un lot d’une seule carte de la rareté du coffre**. Le nombre d’exemplaires est doublé : 8–16 dans un commun, 24–40 dans un rare, 60–100 dans un épique et 150–220 dans un légendaire. Les montants d’or sont respectivement 40–80, 120–200, 300–500 et 750–1 100 pièces. Le contenu est tiré côté serveur à l’attribution, puis conservé et caché jusqu’à l’ouverture. Une ouverture répétée ne crédite jamais deux fois ses récompenses. Les anciens coffres encore fermés adoptent ces règles à leur première ouverture.

Le solde d’or, initialement nul, apparaît en haut des pages connectées, hors combat (`/game/$gameId` et `/practice`). Une icône originale de pièces dorées accompagne le solde, le coût des améliorations et les récompenses.

Cliquer sur l’avatar d’un gardien dans le chat ouvre son menu : profil public, demande d’amitié et, entre amis, message privé ou retrait. L’onglet **Amis** du chat donne accès aux conversations privées ; chaque destinataire conserve son propre brouillon. Une aide par ami et par jour crédite **10 jetons d’entraide au destinataire**, gratuitement, avec renouvellement à minuit à Paris. Ces jetons se dépensent au sanctuaire. Les règles sont détaillées dans [docs/social.md](docs/social.md).

### Sanctuaire et monnaies

Le bâtiment du sanctuaire ouvre `/sanctuary`, un temple forestier illustré où les émeraudes permettent d’invoquer des cartes. Leur icône originale représente une seule grosse émeraude verte sur fond transparent et apparaît à côté de l’or en haut des pages connectées, hors combat. Chaque compte, nouveau ou existant, reçoit **3 000 émeraudes de bienvenue une seule fois** ; recharger la page ne renouvelle pas ce crédit. La mine d’émeraudes et les missions épiques permettent aussi d’en gagner. Les soldes existants sont conservés ; le champ de stockage historique `diamonds` reste compatible.

| Pack | Taux par invocation | Une invocation | Dix invocations | Garantie du lot de dix |
|---|---|---:|---:|---|
| Appel de l’entraide (en premier) | Commune 80 %, rare 20 % | 150 jetons d’entraide | 1 300 jetons d’entraide | 50 lots communs ou rares |
| Appel de la Sylve | Rare 82 %, épique 16 %, légendaire 2 % (avant garantie) | 149 émeraudes | 1 299 émeraudes | Au moins 1 lot légendaire |
| Appel des anciens | Épique 54 %, légendaire 46 % (garanties incluses) | 4 999 émeraudes | 44 999 émeraudes | Au moins 20 lots légendaires |

Une invocation donne cinq lots de cartes et une carte d’or ; les quantités suivent le record de ligue. Le premier exemplaire débloque la variante, les doublons alimentent sa réserve sans changer son niveau. Les lots ×10 se révèlent en dix étapes. La réinvocation depuis le cercle ouvert applique les paliers propres à chaque pack et format ; fermer le cercle annule cette remise temporaire. Pour l’entraide, les tarifs sont de 150, puis 140 et 130 jetons en ×1, ou 1 300, puis 1 150 et 1 000 jetons en ×10. Les règles détaillées figurent dans [docs/summoning.md](docs/summoning.md).

Le serveur vérifie la monnaie du pack, effectue les tirages, débite le portefeuille et crédite la collection dans une seule transaction. Une nouvelle tentative du même achat restitue le résultat sans nouveau débit. La dernière invocation peut être revue après rechargement ; le bestiaire reste accessible depuis la page.

Le bestiaire s’ouvre dans une galerie avec recherche par nom (y compris les noms des évolutions), filtres de combat et choix de rareté. Cliquer sur une carte ouvre sa fiche dans la même fenêtre : caractéristiques, capacités, liens d’âme, exploration des niveaux et trois ou quatre formes réelles de la lignée. Les flèches parcourent les créatures filtrées ; le retour à la galerie retrouve la recherche et la position de départ. Les formes de rareté restent des variantes à collectionner séparément.

Trois cartes de clés dorées permettent aussi de débloquer définitivement les emplacements de coffre 07, 08 et 09 : **Clé de la Sylve (500 émeraudes), Clé des anciens (1 000) et Clé souveraine (1 500)**. Elles se trouvent à droite des packs d’invocation et de monnaies, dans une même rangée qui se parcourt à la molette, au tactile, au clavier et par glisser à la souris, avec une barre de défilement masquée. Chaque clé s’achète une seule fois, indépendamment des autres et des ligues. Les chaînes de ces trois places portent un cadenas doré serti d’émeraude et ouvrent directement la section des clés du sanctuaire. Le débit et le déblocage sont atomiques ; réessayer un achat ne le débite jamais deux fois.

### Collection et deck

Le départ comprend quatre cartes **communes niveau 1** : Gardien de pierre, Tortue millénaire, Sentinelle mousse et Esprit des sources. Les **22 familles** suivent les lignées Cunt Wars : **84 variantes indépendantes**, dont 18 communes, 22 rares, 22 épiques et 22 légendaires. Leurs identifiants restent stables ; les noms, descriptions et illustrations suivent les familles **Ordre**, **Nature** et **Chaos**. Chaque famille possède un fond de carte et un emblème peints : clergé et chevalerie pour l’Ordre, peuples et créatures des bois pour la Nature, démons et bêtes infernales pour le Chaos. Les communes n’ont pas de contour de rareté ; les rares ont un contour bleu, les épiques violet et les légendaires doré.

Le premier exemplaire débloque une variante ; les suivants alimentent sa réserve. Le plafond est **26 pour toutes les raretés**. Les 2 184 paires ATQ/PV, 176 capacités et coûts d’amélioration suivent les fiches CW collectées. Une commune passe de 1 à 2 pour **25 exemplaires et 50 pièces d’or**. La fiche montre les coûts, les gains et les capacités à débloquer ; le bestiaire explore les niveaux et formes disponibles.

Les **liens d’âme (Soulbind)** ajoutent quatre bonus permanents indépendants par carte, avec les coûts, rangs et bonus CW et des compagnons adaptés aux 22 lignées. Ils s’ouvrent en **Bronze IV (800 trophées)**. Les améliorations donnent de l’expérience de rang ; les réserves peuvent être converties en poussière d’âme. À partir d’**Or IV (2 400 trophées)**, l’évolution convertit des exemplaires vers une forme supérieure déjà découverte. Le serveur valide les conditions et débits.

Les quatre anciennes communes sans équivalent CW deviennent rares ; les niveaux supérieurs à 26 et les variantes fusionnées donnent lieu à remboursement. Les parties enregistrées conservent leurs instantanés. Les [correspondances et règles détaillées](docs/cw-alignment.md) documentent les sources, les 336 Soulbinds, les conversions et la migration.

`/decks` conserve l’atelier illustré et son deck unique. Il contient **4 à 8 variantes distinctes**. Glisser une carte sur une place libre l’ajoute, sur une carte occupée la remplace ; glisser deux cartes du deck échange leur position. Cliquer sur une carte ouvre sa fiche, les statistiques du prochain niveau et les actions d’amélioration ou de composition. Le remplacement au clavier passe aussi par cette fiche. La collection affiche les variantes débloquées hors du deck et se filtre par type de combat, rareté et famille. Les filtres se combinent ; plusieurs familles peuvent être sélectionnées et « Toutes » réinitialise l’ensemble. Les deux rangées de cartes défilent horizontalement à la molette, au clavier, au tactile ou en glissant leur fond à la souris, avec une barre masquée. Sur une carte, un geste tactile horizontal fait défiler la rangée ; un geste vertical permet de déplacer la carte entre les deux rangées.

Les changements du deck sont enregistrés automatiquement dans leur ordre, avec reprise après une erreur réseau. Les niveaux sont lus depuis la collection par le serveur. Les caractéristiques sont figées à la création de l’invitation ou à l’entrée en file, puis conservées pendant le combat. Au premier passage dans la nouvelle progression, les anciens decks de développement sont remplacés par les quatre cartes de départ ; cette initialisation ne se répète pas.

### Héros et pouvoirs

Le héros progresse du **niveau 1 au niveau 91**, de **45 à 1 475 PV**, selon le barème d’Adam dans Cunt Wars. La puissance additionne les cartes équipées à leur niveau réel, leurs liens d’âme et **10 points par niveau de héros acquis après le premier**. Les cartes en réserve ne comptent pas. Dans la **Maison des gardiens** (`/guardian`), atteindre le seuil permet de monter d’un niveau gratuitement ; les niveaux et le record de puissance restent acquis après un changement de deck. La fiche compare les gains du prochain niveau et présente les pouvoirs. « Explorer les niveaux » permet de parcourir les 91 paliers, avec des raccourcis vers les niveaux importants. Dans l’atelier, le résumé à droite de « Ta collection » affiche la puissance actuelle et le seuil suivant ; une flèche ouvre la Maison lorsqu’une amélioration est disponible.

En combat, les **cartes de pouvoir empilées en bas à droite** s’utilisent avant de poser une créature, sans terminer le tour ni modifier la main. Il faut utiliser la première avant les suivantes : **Tempête de feuilles** dès le niveau 1 et son deuxième tour ; **Appel des éclaireurs**, deux renforts à distance, dès le niveau 11 et son troisième tour ; **Élan de la Sylve**, un bonus d’attaque pour le tour, dès le niveau 21 et son septième tour. Chaque pouvoir s’utilise une seule fois. Au niveau 21, **Dernier souffle** ajoute une carte de dégâts directs croissants à chacun de ses tours à partir du onzième, après les trois pouvoirs initiaux. Les cartes non dépensées restent empilées.

L’IA utilise aussi ces pouvoirs en solo et en entraînement. Les parties déjà commencées conservent leurs caractéristiques. Les [sources, seuils et adaptations](docs/cw-alignment.md#héros-et-puissance-du-deck) précisent les valeurs historiques et le calcul Sylve de Dernier souffle.

### Règles du combat

La main contient quatre variantes distinctes. Chaque carte jouée est immédiatement remplacée par un tirage aléatoire parmi toutes les variantes du deck absentes de la main. La carte qui vient d’être posée est éligible, même si elle reste sur le terrain ; plusieurs créatures de cette variante peuvent donc coexister. Les cartes déjà en main sont exclues du tirage. Avec le deck de départ à quatre cartes, la carte jouée revient toujours. Jouer une carte déclenche les attaques puis le tour adverse. En multijoueur, le délai de soixante secondes déclenche aussi les attaques. Si aucun placement n’est possible, « Attaquer sans invoquer » permet de poursuivre.

Chaque camp possède quatre lignes et trois colonnes. La colonne centrale est partagée. Le corps à corps peut aussi se placer vers l’ennemi et la distance vers son héros. Les bâtiments se placent dans les trois colonnes et n’attaquent pas. Une unité au corps à corps derrière un allié sur la même ligne est bloquée ; une unité à distance attaque derrière ses alliés. Chaque unité qui peut agir vise le premier ennemi dans sa ligne, sinon le héros adverse. Les capacités ajoutent blocage, épines, soins, régénération, bouclier, vampirisme, perforation, double attaque, bonus de faction, runes et renforts invoqués. Les évolutions ajoutent poison, vol d’attaque, runes de puissance, bonus de formation et réactions aux soins, au Blocage, aux Épines, au Vampirisme et aux morts. Dix-sept icônes illustrées accompagnent les capacités et états dans les cartes, les fiches, les récompenses et le combat. Sur le plateau, les capacités apparaissent au pied des unités et les états actifs sur le côté ; leurs valeurs et les effets supplémentaires sont consultables dans la fiche. Une légende est disponible dans les règles et le bestiaire. Le premier héros à zéro PV perd.

Les créatures posées restent sur le plateau jusqu’à leur mort et ne peuvent pas être retirées volontairement. La case permet de consulter un exemplaire précis lorsque plusieurs créatures partagent une variante ; les dégâts et animations ciblent aussi cet exemplaire. Les morts ne consomment aucune carte du deck ni exemplaire de la collection. Les règles et les paramètres de progression sont centralisés dans `packages/game`. Convex valide les actions, les possessions, les récompenses, les délais et les améliorations.

Les nouvelles parties commencent avec des **terrains aléatoires asymétriques** : chaque camp reçoit **0 à 3 bâtiments neutres**, **0 à 2 runes** et **0 à 2 pentagrammes**, pour un total de 2 à 6 éléments. Chaque sceau renforce aléatoirement la vie (+3 PV actuels et maximum) ou la puissance (+2 attaque). Une rune donne son bonus **immédiatement, une seule fois** à l’arrivée de l’unité. Un pentagramme ne donne rien à la pose puis **ajoute son bonus à chaque début de tour du propriétaire**, en cumulant les gains. Les deux disparaissent à la mort du porteur. Les quantités des deux camps restent proches, avec de petits avantages possibles ; les positions et les types de bâtiments sont tirés séparément. Chaque camp garde au moins cinq placements libres pour la mêlée comme pour la distance. Les pieux de ronces ripostent avec Épines 1, l’arbre sombre régénère 1 PV et le rocher moussu sert d’obstacle. Les trois bâtiments et les quatre variantes de sceaux possèdent des illustrations peintes originales. Les bâtiments doivent être détruits pour libérer leur case. Cliquer sur un élément ouvre sa fiche. Les anciennes parties gardent leur terrain. Les [règles du terrain](docs/field.md) détaillent le placement et les effets.

Les [règles de progression](docs/progression.md) détaillent les probabilités et les garanties des coffres. Les [notes sur les illustrations](docs/art.md) documentent les images et leurs prompts.

## Vérifier le jeu

```bash
bun run test
bun run check-types
bun run build
```

Les tests couvrent le moteur, le maintien de quatre cartes distinctes en main sur 20 duels simulés et 8 entraînements complets, les créatures répétées et leurs animations, les choix offensifs et défensifs de l’ordinateur, les autorisations avec de vraies identités du composant Better Auth, les invitations concurrentes, la confidentialité, les échéances et le matchmaking.

Un scénario sur le backend réel est disponible, **uniquement pour un déploiement `dev:`** :

```bash
cd packages/backend
bun run test:live
```

Il crée deux comptes temporaires, vérifie une invitation, la synchronisation WebSocket, la reconnexion, l’abandon, le matchmaking et une partie jusqu’à la victoire. Il termine les activités des comptes et supprime leurs identifiants et sessions en sortie ; les parties de test terminées restent en base. L’option `bun scripts/verify-live.mjs --keep` conserve les comptes pour un contrôle navigateur, dans `.cache` ignoré par Git ; utiliser ensuite `bun scripts/verify-live.mjs --cleanup`.

Pour utiliser ce worktree quand un autre serveur écoute déjà sur l’IPv6 de `localhost:3001`, lancer `bun run dev --host 127.0.0.1` depuis `apps/web`, puis ouvrir [http://127.0.0.1:3001](http://127.0.0.1:3001). Cette origine IPv4 est acceptée uniquement lorsque `SITE_URL` désigne le serveur HTTP local correspondant.

Lorsque plusieurs worktrees partagent la même configuration Convex, une publication remplace les fonctions et le schéma du déploiement commun. Les évolutions du sanctuaire et des ligues doivent être intégrées ensemble avant publication ; des déploiements de développement séparés évitent ce conflit.

Les [notes sur les illustrations](docs/art.md) indiquent l’origine du décor et le prompt utilisé.

Le boilerplate inclut l’authentification Better Auth, la vérification d’email et la réinitialisation du mot de passe via Resend, ainsi que les connexions Google et GitHub. L’interface utilise Tailwind CSS et shadcn/ui ; le monorepo utilise Bun et Turborepo.

## Prérequis

- Bun : le projet déclare la version `1.3.0` dans `package.json`.
- Un compte Convex pour créer le backend de card-game.
- Un compte Resend et une adresse d’expédition configurée pour tester l’inscription par email.
- OpenSSL pour générer le secret d’authentification avec la commande ci-dessous.

## Installation et premier démarrage

Exécuter les commandes à la racine du dépôt, sauf indication contraire.

### 1. Installer les dépendances et initialiser Convex

```bash
bun install
bun run dev:setup
```

Suivre les instructions pour se connecter à Convex et créer un **nouveau projet pour card-game**. Le fichier `packages/backend/.env.local` contient ensuite la configuration du déploiement utilisé par la CLI Convex, notamment `CONVEX_DEPLOYMENT`.

### 2. Configurer les URL du frontend

Créer `apps/web/.env` :

```dotenv
VITE_CONVEX_URL=https://ton-deploiement.convex.cloud
VITE_CONVEX_SITE_URL=https://ton-deploiement.convex.site
```

Remplacer `ton-deploiement` par le nom du déploiement de développement créé à l’étape précédente. Les URL sont disponibles dans Convex :

- `VITE_CONVEX_URL` termine en `.cloud` et permet de communiquer avec le backend.
- `VITE_CONVEX_SITE_URL` termine en `.site` et permet d’appeler ses routes HTTP, notamment celles de l’authentification.

Si Convex génère une variable nommée `CONVEX_URL` dans le fichier du backend, utiliser sa valeur pour `VITE_CONVEX_URL` dans le frontend.

### 3. Configurer l’authentification sur Convex

**Les variables ajoutées dans un fichier `.env` local ne sont pas automatiquement transférées au déploiement Convex.** Les fonctions du backend lisent les variables configurées sur ce déploiement, via la CLI ou le dashboard Convex.

Depuis le dossier backend :

```bash
cd packages/backend
bunx --bun convex env set SITE_URL http://localhost:3001
bunx --bun convex env set BETTER_AUTH_URL http://localhost:3001
bunx --bun convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
cd ../..
```

`SITE_URL` définit l’origine autorisée de l’application. `BETTER_AUTH_URL` définit son URL de base pour l’authentification. Ces valeurs correspondent ici au serveur de développement local ; utiliser l’URL publique de l’application sur un déploiement de production.

Générer `BETTER_AUTH_SECRET` une seule fois lors de la configuration initiale et conserver cette valeur lors des démarrages suivants.

Les exemples utilisent `bunx --bun` pour exécuter la CLI avec Bun.

### 4. Configurer les emails sur Convex

La vérification d’email est activée dans ce boilerplate. **Resend doit être configuré pour terminer une inscription par email**, ainsi que pour réinitialiser un mot de passe.

Dans les paramètres du déploiement Convex de développement, ajouter :

| Variable         | Valeur à renseigner                                                                  |
| ---------------- | ------------------------------------------------------------------------------------ |
| `RESEND_API_KEY` | La clé API du compte Resend utilisé par card-game                                    |
| `EMAIL_FROM`     | L’expéditeur configuré dans Resend, par exemple `card-game <bonjour@ton-domaine.fr>` |

Ces variables peuvent aussi être définies avec `bunx --bun convex env set NOM_VARIABLE 'valeur'`, depuis `packages/backend`.

### 5. Lancer l’application

Depuis la racine du dépôt :

```bash
bun run dev
```

Cette commande lance le frontend et le backend Convex en mode développement. Ouvrir **[http://localhost:3001](http://localhost:3001)**.

Pour les démarrages suivants, `bun run dev` suffit si la configuration est déjà en place. Après une modification de `apps/web/.env`, redémarrer le serveur frontend.

## Où configurer les variables ?

| Emplacement                     | Usage                                                                                  |
| ------------------------------- | -------------------------------------------------------------------------------------- |
| `packages/backend/.env.local`   | Configuration locale de la CLI, notamment le déploiement ciblé par `CONVEX_DEPLOYMENT` |
| `apps/web/.env`                 | Variables du frontend : URL Convex                                                     |
| Variables du déploiement Convex | Configuration des fonctions backend : authentification, Resend et OAuth                |

Ne pas copier tout le fichier du backend dans celui du frontend. Ajouter uniquement les variables nécessaires à chaque emplacement. Les variables préfixées par `VITE_` sont accessibles au navigateur : elles ne doivent pas contenir de secrets. Les fichiers `.env` locaux sont ignorés par Git.

## Services complémentaires

Ces services sont nécessaires pour utiliser les fonctionnalités correspondantes.

### Achats d’émeraudes avec Polar

Le sanctuaire propose cinq packs d’émeraudes en argent réel, de la bourse au coffre des anciens, en passant par une sacoche et deux coffrets. Les paiements ponctuels utilisent le composant Convex Polar, avec crédit après webhook signé et traitement des remboursements. La [configuration des achats](docs/emerald-purchases.md) détaille les cinq produits, les variables Convex et le webhook à brancher. Les offres restent indisponibles tant que Polar n’est pas configuré.

### Connexion Google et GitHub

Créer les applications OAuth auprès des fournisseurs concernés, puis ajouter leurs identifiants dans les **variables du déploiement Convex** :

| Fournisseur | Variables                                  |
| ----------- | ------------------------------------------ |
| Google      | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| GitHub      | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` |

Configurer également les URL de retour OAuth chez chaque fournisseur en fonction de l’URL de l’application.

## Dépannage

### « Connecte-toi pour jouer » dans les logs de `bun run dev`

Si Convex affiche `Convex functions ready!`, le backend a démarré. Ce message vient d’une requête du jeu reçue sans session valide. Le frontend attend la confirmation de Convex et la validation de la session Better Auth avant de charger les pages protégées et les compteurs ; une session expirée renvoie vers la connexion, puis vers la page demandée.

Si un ancien onglet affiche encore cette erreur après un redémarrage, actualiser la page et se reconnecter si demandé. L’annonce d’une nouvelle version de Convex est indépendante de cette erreur.

### « A provided trusted origin is invalid »

Vérifier que `SITE_URL` est définie **sur le déploiement Convex utilisé par l’application**, et pas seulement dans un fichier local :

```bash
cd packages/backend
bunx --bun convex env get SITE_URL
bunx --bun convex env set SITE_URL http://localhost:3001
cd ../..
```

Rafraîchir ensuite l’application à l’adresse `http://localhost:3001`.

### « Object is missing the required field from » lors de l’inscription

L’expéditeur transmis à l’action d’envoi provient de `EMAIL_FROM`. Vérifier que cette variable est renseignée sur Convex, ainsi que `RESEND_API_KEY`. Le champ `from` doit rester obligatoire.

Une fois la configuration corrigée, utiliser la page `/verify-email` pour demander un nouvel email de vérification si le compte a déjà été créé.

### « Could not find a declaration file for module react/jsx-runtime »

Le backend utilise du JSX pour les emails. Il déclare donc `@types/react` dans ses dépendances de développement. Relancer `bun install` à la racine si ces types ne sont pas installés.

Pour vérifier uniquement le TypeScript du backend, depuis la racine :

```bash
bunx --bun tsc --project packages/backend/convex/tsconfig.json --noEmit
```

## Structure du projet

```text
card-game/
├── apps/web/             # Frontend React + TanStack Start
├── packages/backend/    # Fonctions, authentification et schéma Convex
├── packages/game/       # Catalogue, types et moteur pur du jeu
├── packages/config/     # Configuration TypeScript partagée
└── packages/env/        # Validation des variables du frontend
```

## Commandes utiles

À exécuter depuis la racine du dépôt :

| Commande             | Description                                                  |
| -------------------- | ------------------------------------------------------------ |
| `bun install`        | Installer les dépendances du monorepo                        |
| `bun run dev:setup`  | Configurer le projet Convex lors de la première installation |
| `bun run dev`        | Lancer le frontend et le backend en développement            |
| `bun run dev:web`    | Lancer uniquement le frontend                                |
| `bun run dev:server` | Lancer uniquement le backend Convex en développement         |
| `bun run build`      | Construire l’application pour la production                  |

## Documentation

- [Cartes Cunt Wars et Soulbind](docs/cw-alignment.md) — correspondances, progression et migrations du catalogue actuel.
- [Données historiques conservées](docs/legacy-data.md) — récompenses actives, remboursements et compatibilité des anciennes parties.
- [Convex et Better Auth avec TanStack Start](https://labs.convex.dev/better-auth/framework-guides/tanstack-start)
- [Variables d’environnement Convex](https://docs.convex.dev/production/environment-variables)
