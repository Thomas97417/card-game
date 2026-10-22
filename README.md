# Sylve — Le cercle des gardiens

Jeu de cartes tactique en ligne pour deux joueurs, réalisé avec React, TanStack Start, Convex et TypeScript. Interface en français, univers fantasy 2D et synchronisation des parties en temps réel.

## Jouer

Se connecter, puis ouvrir `/play`. Un deck de départ de 8 cartes uniques est fourni automatiquement ; `/decks` permet de le modifier ou d’en créer d’autres parmi les 12 monstres disponibles.

- **Partie privée** : créer une invitation et partager le lien ou le code de 8 caractères. L’adversaire sélectionne son deck et rejoint la partie. L’invitation expire après 10 minutes.
- **Recherche automatique** : les deux joueurs choisissent « Trouver un adversaire ». La présence en file est renouvelée toutes les 15 secondes et expire après 45 secondes sans renouvellement.
- **Duel** : glisser une carte vers une case libre de son camp, ou sélectionner la carte puis la case à la souris ou au clavier. Une invocation par tour, sans mana. Les attaques se déclenchent en terminant son tour, automatiquement au bout de 60 secondes.
- **Retrait** : pendant son tour, sélectionner une créature de son camp puis choisir « Retirer du terrain ». La carte rejoint la défausse et pourra être repiochée. Le retrait ne rend pas une invocation déjà utilisée.
- Chaque camp possède 4 lignes et 3 colonnes. Chaque monstre attaque le premier ennemi dans sa ligne, sinon le héros adverse. Le premier héros à 0 PV perd.
- La main est complétée à 4 au début du tour. Les monstres morts rejoignent la défausse, remélangée lorsque la pioche est vide. Actualiser la page restaure la partie ; les tours continuent pendant les déconnexions.

Les règles et les valeurs d’équilibrage sont centralisées dans `packages/game/src/index.ts`. Les fonctions Convex sont autoritaires : les clients ne choisissent ni les dégâts ni le contenu des pioches et ne reçoivent pas la main adverse.

Les anciens decks de 10 cartes sont ramenés aux 8 premières cartes, dans leur ordre enregistré, à l’ouverture du salon ou du grimoire, ou à leur prochaine utilisation. Les invitations et recherches déjà en attente utilisent aussi 8 cartes au démarrage du duel. Les parties déjà commencées conservent leurs cartes ; les nouvelles parties démarrent avec une main de 4.

## Vérifier le jeu

```bash
bun run test
bun run check-types
bun run build
```

Les tests couvrent le moteur, la conservation des cartes sur 20 duels simulés, les autorisations avec de vraies identités du composant Better Auth, les invitations concurrentes, la confidentialité, les échéances et le matchmaking.

Un scénario sur le backend réel est disponible, **uniquement pour un déploiement `dev:`** :

```bash
cd packages/backend
bun run test:live
```

Il crée deux comptes temporaires, vérifie une invitation, la synchronisation WebSocket, la reconnexion, l’abandon, le matchmaking et une partie jusqu’à la victoire. Il termine les activités des comptes et supprime leurs identifiants et sessions en sortie ; les parties de test terminées restent en base. L’option `bun scripts/verify-live.mjs --keep` conserve les comptes pour un contrôle navigateur, dans `.cache` ignoré par Git ; utiliser ensuite `bun scripts/verify-live.mjs --cleanup`.

Pour utiliser ce worktree quand un autre serveur écoute déjà sur l’IPv6 de `localhost:3001`, lancer `bun run dev --host 127.0.0.1` depuis `apps/web`, puis ouvrir [http://127.0.0.1:3001](http://127.0.0.1:3001). Cette origine IPv4 est acceptée uniquement lorsque `SITE_URL` désigne le serveur HTTP local correspondant.

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

- [Convex et Better Auth avec TanStack Start](https://labs.convex.dev/better-auth/framework-guides/tanstack-start)
- [Variables d’environnement Convex](https://docs.convex.dev/production/environment-variables)
