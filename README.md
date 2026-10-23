# Sylve — Le cercle des gardiens

Jeu de cartes tactique en ligne pour deux joueurs, réalisé avec React, TanStack Start, Convex et TypeScript. Interface en français, univers fantasy 2D et synchronisation des parties en temps réel.

## Jouer

Après connexion, `/hub` ouvre le refuge des gardiens, un village illustré en plein écran (`/dashboard` redirige vers `/hub`). Les bâtiments donnent accès à l’arène, à l’atelier, au compte, aux règles et au sanctuaire d’invocation. La carte se parcourt à la souris, au clavier et au tactile.

### Salon et trésors

`/play` est un salon illustré en plein écran : le héros à gauche ouvre le deck, les boutons de combat sont à droite et sept emplacements de trésors occupent le bas. Le premier contient un coffre commun récurrent, les deux suivants accueillent les coffres de combat et les quatre derniers sont verrouillés par des chaînes. Les illustrations originales reprennent l’univers peint de Sylve.

- **Combat solo** : affronte le Gardien mécanique avec ton deck et gagne des coffres. La partie est enregistrée sur Convex, reprend après actualisation, commence par le joueur humain et n’a pas de chronomètre. L’IA ne connaît que les informations visibles. Elle joue après les animations ; une relance serveur après trente secondes permet de poursuivre si le client disparaît.
- **Duel public** : cherche un autre joueur. La présence en file est renouvelée toutes les quinze secondes et expire après quarante-cinq secondes d’absence. Le vainqueur gagne un coffre.
- **Défi amical** : crée ou rejoins une invitation de huit caractères, valable dix minutes. Le lien retrouve sa destination après connexion. Ces parties ne rapportent pas de coffre.
- **Entraînement local** : `/practice` reste accessible sans compte et sans récompenses. La session recommence à l’actualisation.

Les combats solo connectés et duels publics rapportent **25 trophées par victoire** et en retirent **15 par défaite ou abandon**, avec un minimum de zéro. Les promotions arrivent tous les 200 trophées ; les emplacements de deck gagnés restent acquis après une rétrogradation. Le Gardien mécanique adapte ses créatures, raretés et niveaux à la ligue actuelle, avec des cartes communes de niveau 1 au départ. Il varie ses cartes grâce à la mémoire de ses trois derniers choix, tout en conservant les priorités tactiques de victoire et de survie. Les règles détaillées sont dans [docs/progression.md](docs/progression.md).

Le **coffre commun tout à gauche se déverrouille après trois victoires**, y compris contre le Gardien mécanique en combat solo. Son bouton « Ouvrir » permet de récupérer les cartes et l’or, puis le compteur repart à zéro pour un nouveau cycle de trois victoires. Il n’a aucun délai et progresse même si les places de combat sont pleines. Le compteur reste à 3/3 tant que le coffre n’a pas été ouvert.

Chaque victoire éligible attribue aussi un coffre de combat si une des deux places est libre. Les délais démarrent automatiquement et en parallèle : **15 minutes, 1 heure, 3 heures ou 8 heures**, selon la rareté. Un coffre prêt continue d’occuper son emplacement jusqu’à son ouverture. Si les deux places sont occupées au moment de la victoire, **ce coffre de combat est perdu**. Le salon et le résultat du combat l’indiquent ; la victoire compte toujours pour le coffre commun.

L’ouverture révèle **deux récompenses : de l’or et un lot d’une seule carte de la rareté du coffre**. Le nombre d’exemplaires est doublé : 8–16 dans un commun, 24–40 dans un rare, 60–100 dans un épique et 150–220 dans un légendaire. Les montants d’or sont respectivement 40–80, 120–200, 300–500 et 750–1 100 pièces. Le contenu est tiré côté serveur à l’attribution, puis conservé et caché jusqu’à l’ouverture. Une ouverture répétée ne crédite jamais deux fois ses récompenses. Les anciens coffres encore fermés adoptent ces règles à leur première ouverture.

Le solde d’or, initialement nul, apparaît en haut des pages connectées, hors combat (`/game/$gameId` et `/practice`). Une icône originale de pièces dorées accompagne le solde, le coût des améliorations et les récompenses.

### Sanctuaire et diamants

Le bâtiment du sanctuaire ouvre `/sanctuary`, un temple forestier illustré où les diamants permettent d’invoquer des cartes. Leur icône originale apparaît à côté de l’or en haut des pages connectées, hors combat. Chaque compte, nouveau ou existant, reçoit **3 000 diamants de bienvenue une seule fois** ; recharger la page ne renouvelle pas ce crédit. Aucune autre source de diamants n’est prévue pour le moment.

| Pack | Taux par invocation, hors garantie | Une invocation | Dix invocations | Garantie du lot de dix |
|---|---|---:|---:|---|
| Appel de la Sylve | Commune 65 %, rare 25 %, épique 8 %, légendaire 2 % | 149 diamants | 1 299 diamants (−12,8 %) | Au moins 1 légendaire |
| Appel des anciens | Épique 80 %, légendaire 20 % | 449 diamants | 3 899 diamants (−13,2 %) | Au moins 2 légendaires |

Une invocation donne un exemplaire d’une variante. Le premier la débloque ; les doublons alimentent sa réserve sans changer son niveau. Les lots effectuent dix tirages puis, au besoin, remplacent des résultats non légendaires choisis au hasard pour atteindre leur garantie. Les légendaires obtenus naturellement sont conservés. Les garanties sont propres à chaque achat groupé, sans cumul des achats unitaires.

Le serveur vérifie les diamants, effectue les tirages, débite le portefeuille et crédite la collection dans une seule transaction. Une nouvelle tentative du même achat restitue le résultat sans nouveau débit. La dernière invocation peut être revue après rechargement ; le bestiaire reste accessible depuis la page.

### Collection et deck

Le départ comprend quatre cartes **communes niveau 1** : Gardien de pierre, Tortue millénaire, Sentinelle mousse et Esprit des sources. Les **22 cartes** existent chacune en quatre raretés, soit **88 variantes indépendantes** : 11 créatures de mêlée, 9 à distance et 2 bâtiments. Les communes n’ont pas de contour de rareté ; les rares ont un contour bleu, les épiques violet et les légendaires doré.

Le premier exemplaire d’une variante la débloque. Les suivants alimentent sa réserve d’amélioration. Le plafond est **26 niveaux** ; les statistiques communes, les 34 capacités et leurs paliers reprennent les tables Mighty Party collectées, sans croissance linéaire. Les coûts dépendent du niveau et de la rareté : une commune passe de 1 à 2 pour **25 exemplaires et 50 pièces d’or**, puis de 2 à 3 pour **50 exemplaires et 80 pièces**. La fiche montre les deux coûts, les gains et les capacités qui se débloquent ; le bestiaire permet d’explorer les 26 niveaux.

Les variantes supérieures gardent les bonus Sylve ajoutés aux courbes communes : rare `+1/+2`, épique `+2/+4`, légendaire `+4/+8` ; les bâtiments restent à zéro attaque. Ce sont des adaptations, les courbes propres aux cartes supérieures de Mighty Party n’ayant pas été collectées. Une amélioration conserve la rareté. Chaque variante garde son niveau et sa réserve et peut figurer avec une autre rareté de la même créature dans le deck. La [documentation d’équilibrage](docs/card-balance.md) donne les correspondances, les règles des capacités et le périmètre exact.

`/decks` conserve l’atelier illustré et son deck unique. Il contient **4 à 8 variantes distinctes**. Glisser une carte sur une place libre l’ajoute, sur une carte occupée la remplace ; glisser deux cartes du deck échange leur position. Cliquer sur une carte ouvre sa fiche, les statistiques du prochain niveau et les actions d’amélioration ou de composition. Le remplacement au clavier passe aussi par cette fiche. La collection affiche les variantes débloquées hors du deck et se filtre par type de combat et rareté.

Les changements du deck sont enregistrés automatiquement dans leur ordre, avec reprise après une erreur réseau. Les niveaux sont lus depuis la collection par le serveur. Les caractéristiques sont figées à la création de l’invitation ou à l’entrée en file, puis conservées pendant le combat. Au premier passage dans la nouvelle progression, les anciens decks de développement sont remplacés par les quatre cartes de départ ; cette initialisation ne se répète pas.

### Règles du combat

La main contient quatre variantes distinctes. Chaque carte jouée est immédiatement remplacée par un tirage aléatoire parmi toutes les variantes du deck absentes de la main. La carte qui vient d’être posée est éligible, même si elle reste sur le terrain ; plusieurs créatures de cette variante peuvent donc coexister. Les cartes déjà en main sont exclues du tirage. Avec le deck de départ à quatre cartes, la carte jouée revient toujours. Jouer une carte déclenche les attaques puis le tour adverse. En multijoueur, le délai de soixante secondes déclenche aussi les attaques. Si aucun placement n’est possible, « Attaquer sans invoquer » permet de poursuivre.

Chaque camp possède quatre lignes et trois colonnes. La colonne centrale est partagée. Le corps à corps peut aussi se placer vers l’ennemi et la distance vers son héros. Les bâtiments se placent dans les trois colonnes et n’attaquent pas. Une unité au corps à corps derrière un allié sur la même ligne est bloquée ; une unité à distance attaque derrière ses alliés. Chaque unité qui peut agir vise le premier ennemi dans sa ligne, sinon le héros adverse. Les capacités ajoutent blocage, épines, soins, régénération, bouclier, vampirisme, perforation, double attaque, bonus de faction, runes et renforts invoqués. Le premier héros à zéro PV perd.

Avant de jouer sa carte, on peut retirer une créature pour libérer sa case sans modifier la main. La case permet de sélectionner un exemplaire précis lorsque plusieurs créatures partagent une variante ; les dégâts et animations ciblent aussi cet exemplaire. Les morts et retraits ne consomment aucune carte du deck ni exemplaire de la collection. Les règles et les paramètres de progression sont centralisés dans `packages/game`. Convex valide les actions, les possessions, les récompenses, les délais et les améliorations.

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

### Connexion Google et GitHub

Créer les applications OAuth auprès des fournisseurs concernés, puis ajouter leurs identifiants dans les **variables du déploiement Convex** :

| Fournisseur | Variables                                  |
| ----------- | ------------------------------------------ |
| Google      | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| GitHub      | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` |

Configurer également les URL de retour OAuth chez chaque fournisseur en fonction de l’URL de l’application.

## Dépannage

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

- [Référence Mighty Party : cartes communes, niveaux, capacités et coûts](docs/mighty-party-reference.md) — collecte documentaire du 23 octobre 2026, avec sources historiques et comparaison avec Sylve.
- [Convex et Better Auth avec TanStack Start](https://labs.convex.dev/better-auth/framework-guides/tanstack-start)
- [Variables d’environnement Convex](https://docs.convex.dev/production/environment-variables)
