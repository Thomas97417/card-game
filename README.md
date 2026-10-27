# Sylve — Le cercle des gardiens

Jeu de cartes tactique en français, avec combats solo et multijoueurs, collection, progression et refuge partagé. Le monorepo utilise Bun, Turborepo, React 19, TanStack Start et Convex.

## Version actuelle

| Route | Fonction |
| --- | --- |
| `/hub` | Refuge, cadeaux quotidiens, mines d’or et d’émeraudes, classement, amis, chat et missions |
| `/arena` | Combats solo, matchmaking public, invitations amicales et coffres |
| `/decks` | Deck, collection, améliorations, évolutions et liens d’âme |
| `/guardian` | Onze héros, déblocage en émeraudes, sélection, progression et pouvoirs |
| `/sanctuary` | Invocations, bestiaire, packs de monnaies et clés de coffres |
| `/settings` | Profil, email, mot de passe, sessions et suppression du compte |
| `/practice` | Entraînement local accessible sans compte |
| `/game/$gameId` | Partie connectée, synchronisée en temps réel |

`/dashboard` redirige vers `/hub` ; `/play` redirige vers `/arena` en conservant les invitations. Le catalogue compte 84 variantes pour 22 lignées, réparties entre Ordre, Nature et Chaos. Les règles détaillées et leurs sources sont dans `docs/`.

## Installation

Prérequis : Bun (version déclarée : `1.3.0`), un compte Convex, et Resend pour la vérification d’email et la réinitialisation du mot de passe.

Depuis la racine :

```bash
bun install --frozen-lockfile
bun run dev:setup
```

La configuration Convex crée `packages/backend/.env.local`, notamment avec `CONVEX_DEPLOYMENT`. Créer ensuite `apps/web/.env` avec les deux URL publiques du même déploiement :

```dotenv
VITE_CONVEX_URL=https://ton-deploiement.convex.cloud
VITE_CONVEX_SITE_URL=https://ton-deploiement.convex.site
```

Configurer les variables du backend **sur le déploiement Convex** :

```bash
cd packages/backend
bunx --bun convex env set SITE_URL http://localhost:3001
bunx --bun convex env set BETTER_AUTH_URL http://localhost:3001
bunx --bun convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
cd ../..
```

Générer le secret une seule fois et le conserver aux démarrages suivants. Utiliser l’URL publique de l’application pour `SITE_URL` et `BETTER_AUTH_URL` en production.

Ajouter également `RESEND_API_KEY` et `EMAIL_FROM` dans les variables du déploiement Convex. `EMAIL_FROM` doit être un expéditeur autorisé par Resend. La vérification d’email est activée ; cette configuration est nécessaire pour terminer une inscription par email.

Les emails d’authentification utilisent les illustrations JPEG de `apps/web/public/art/emails/`, exportées depuis les décors du jeu. Leurs URL absolues sont construites à partir de `SITE_URL`, qui doit donc être l’origine publique du frontend en production. Pour générer des aperçus HTML et texte sans envoyer d’email : `bun run --cwd packages/backend preview:emails /tmp/sylve-auth-emails http://localhost:3001`.

```bash
bun run dev
```

Ouvrir [http://localhost:3001](http://localhost:3001). Après modification du fichier frontend `.env`, redémarrer son serveur.

| Emplacement | Contenu |
| --- | --- |
| `apps/web/.env` | Les deux URL publiques Convex |
| `packages/backend/.env.local` | Configuration locale de la CLI Convex |
| Variables du déploiement Convex | Secrets d’authentification, Resend, OAuth et Polar |

Les variables `VITE_` sont accessibles au navigateur. Ne jamais y placer de secret ni copier tout le fichier du backend dans celui du frontend. Les fichiers `.env` locaux sont ignorés par Git.

## Services facultatifs

Les achats d’émeraudes utilisent Polar : voir [la configuration des paiements](docs/emerald-purchases.md). Les offres restent indisponibles tant que le service n’est pas configuré.

Le hub propose aussi deux packs légendaires à 20 €, réservés aux rangs 1 à 25 inclus : voir le [petit guide Polar des offres légendaires](docs/legendary-offers-polar.md).

Pour les connexions Google et GitHub, configurer les applications OAuth et leurs URL de retour, puis les variables Convex `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID` et `GITHUB_CLIENT_SECRET`.

## Commandes et vérifications

| Commande | Usage |
| --- | --- |
| `bun run dev` | Frontend et backend en développement |
| `bun run dev:web` | Frontend uniquement, port 3001 |
| `bun run dev:server` | Backend Convex uniquement |
| `bun run dev:setup` | Configuration initiale du déploiement |
| `bun run test` | Tests du moteur, du backend et de l’interface |
| `bun run check-types` | Vérification TypeScript des workspaces |
| `bun run build` | Compilation de production |

Le scénario connecté `bun run test:live`, lancé depuis `packages/backend`, est réservé à un déploiement `dev:`. Il crée deux comptes temporaires et vérifie les invitations, WebSocket, reconnexions, matchmaking et combats. Les comptes et sessions sont supprimés en sortie ; les états finaux des parties restent en base, mais leurs événements sont purgés deux minutes après la fin du combat. Un rattrapage horaire nettoie les événements des anciennes parties terminées. `bun scripts/verify-live.mjs --keep` conserve les comptes dans `.cache` pour un contrôle navigateur ; `--cleanup` les supprime ensuite.

## Dépannage

- Origine d’authentification refusée : vérifier `SITE_URL` sur le déploiement Convex utilisé, puis ouvrir l’application à cette origine.
- Inscription ou réinitialisation bloquée : vérifier `RESEND_API_KEY` et `EMAIL_FROM` sur Convex. `/verify-email` permet de renvoyer une vérification.
- Session expirée : se reconnecter ; les routes protégées attendent la validation de la session avant de charger le jeu.
- Port 3001 occupé sur `localhost` : depuis `apps/web`, `bun run dev --host 127.0.0.1` permet d’utiliser [http://127.0.0.1:3001](http://127.0.0.1:3001). Cette origine est acceptée lorsque `SITE_URL` désigne le serveur HTTP local correspondant.
- Plusieurs worktrees sur le même déploiement Convex : une publication remplace les fonctions et le schéma partagés. Utiliser des déploiements de développement distincts pour des versions incompatibles.

## Structure

```text
apps/web/             Interface React et routes TanStack Start
packages/backend/     Fonctions, schéma, authentification et tests Convex
packages/game/        Catalogue, moteur et règles partagés
packages/env/         Validation des URL publiques du frontend
packages/config/      Configuration TypeScript partagée
scripts/              Imports reproductibles du catalogue et du héros
docs/                 Règles, sources et illustrations actuelles
```

Les fichiers `routeTree.gen.ts` et `packages/backend/convex/_generated/` sont générés automatiquement.

## Documentation

- [Catalogue, liens d’âme, évolutions et héros](docs/cw-alignment.md)
- [Ligues, coffres et progression](docs/progression.md)
- [Invocations et tarifs du sanctuaire](docs/summoning.md)
- [Mines du refuge](docs/mines.md)
- [Cadeaux quotidiens du refuge](docs/daily-rewards.md)
- [Amis, messages et entraide](docs/social.md)
- [Terrain et effets de combat](docs/field.md)
- [Configuration des paiements Polar](docs/emerald-purchases.md)
- [Illustrations et prompts conservés](docs/art.md)
- [Données historiques nécessaires à la compatibilité](docs/legacy-data.md)
