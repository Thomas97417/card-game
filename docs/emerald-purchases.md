# Acheter des émeraudes avec Polar

Le sanctuaire propose cinq achats ponctuels en argent réel. Les contenants progressent d’une petite bourse à un coffre unique ; la rangée d’offres se parcourt à la souris, au pavé tactile et au toucher.

| Identifiant       | Pack               | Émeraudes | Variable Convex du produit Polar         |
| ----------------- | ------------------ | --------: | ---------------------------------------- |
| `small-pouch`     | Bourse d’émeraudes |       500 | `POLAR_PRODUCT_EMERALDS_SMALL_POUCH`     |
| `leather-satchel` | Sacoche de voyage  |     1 200 | `POLAR_PRODUCT_EMERALDS_LEATHER_SATCHEL` |
| `wooden-case`     | Écrin de la Sylve  |     2 600 | `POLAR_PRODUCT_EMERALDS_WOODEN_CASE`     |
| `carved-coffer`   | Coffret sculpté    |     7 000 | `POLAR_PRODUCT_EMERALDS_CARVED_COFFER`   |
| `ancient-chest`   | Coffre des anciens |    15 000 | `POLAR_PRODUCT_EMERALDS_ANCIENT_CHEST`   |

Les quantités et illustrations sont centralisées dans `packages/game/src/emerald-packs.ts`. Les **prix sont choisis dans Polar**, puis lus depuis les produits synchronisés du composant Convex. Aucun prix de démonstration n’est utilisé par l’application.

La gamme du 25 octobre 2026 conserve les quantités des cinq paliers. Les anciennes variables restent reconnues comme repli : `POUCH` → `SMALL_POUCH`, `COFFER` → `LEATHER_SATCHEL`, `CHEST` → `WOODEN_CASE`, `HOARD` → `CARVED_COFFER`, `ROYAL` → `ANCIENT_CHEST` (préfixe commun `POLAR_PRODUCT_EMERALDS_`). Une nouvelle variable configurée prend toujours la priorité. Il faut renommer les produits dans Polar selon leur palier de quantité, et non associer l’ancien produit `CHEST` au nouveau dernier niveau. Les achats déjà enregistrés gardent leur identifiant historique et leur quantité sauvegardée ; leurs paiements et remboursements continuent à fonctionner.

## Configuration

### 1. Préparer Polar en sandbox

Créer une organisation de test sur [sandbox.polar.sh](https://sandbox.polar.sh), puis un produit par ligne du tableau, avec **un seul prix actif fixe en EUR**, **sans abonnement**. Affecter un identifiant de produit distinct à chaque pack. Un produit archivé, récurrent, gratuit, à montant libre ou avec plusieurs prix actifs n’est pas proposé à l’achat.

Créer un jeton d’organisation pour le composant, avec les droits sur les produits, les clients et les checkouts indiqués dans la [documentation du composant](https://github.com/convex/polar#prerequisites). Les secrets restent dans les variables du déploiement Convex, jamais dans des variables `VITE_`.

Dans les paramètres du déploiement Convex, renseigner :

| Variable                   | Valeur                                                               |
| -------------------------- | -------------------------------------------------------------------- |
| `POLAR_SERVER`             | `sandbox` pendant les essais ; `production` pour les paiements réels |
| `POLAR_ORGANIZATION_TOKEN` | Jeton de l’organisation Polar de l’environnement choisi              |
| `POLAR_WEBHOOK_SECRET`     | Secret de signature du webhook Polar                                 |
| `POLAR_PRODUCT_EMERALDS_*` | Les cinq identifiants du tableau ci-dessus                           |
| `SITE_URL`                 | Origine du frontend, déjà utilisée par l’authentification            |

Ces variables sont configurables dans le dashboard Convex ou avec `bunx --bun convex env set NOM_VARIABLE 'valeur'` depuis `packages/backend`. Ne pas coller de secret dans une conversation ni dans un fichier versionné.

### 2. Publier les fonctions et brancher le webhook

La dépendance `@convex-dev/polar` est déclarée dans le backend, puis installée par `app.use(polar)`. Le SDK `@polar-sh/sdk` est limité à la série compatible `0.47.x` : sa version majeure `1.x` supprime les chemins importés par le composant `0.9.2`.

Depuis `packages/backend`, lancer le cycle de développement habituel :

```bash
bunx --bun convex dev --once
```

Comme pour les autres fonctionnalités du jeu, vérifier le déploiement ciblé avant publication : plusieurs worktrees peuvent partager le même backend. La génération des types avec `convex codegen` ne remplace pas cette publication.

Dans Polar, créer un webhook vers **`https://<déploiement>.convex.site/polar/events`** avec les événements :

- `product.created` et `product.updated` pour synchroniser les offres ;
- `order.paid` pour créditer les émeraudes ;
- `order.refunded` pour retirer les émeraudes remboursées.

Le secret de ce webhook doit correspondre à `POLAR_WEBHOOK_SECRET`. Utiliser le domaine **`.site`**, comme pour les routes HTTP d’authentification.

Synchroniser une première fois les produits déjà créés :

```bash
bunx --bun convex run payments:syncProducts '{}'
```

`syncProducts` est une action interne accessible au dashboard et à la CLI authentifiée. Les mises à jour suivantes sont reçues par webhook.

Tant que la configuration ou les produits sont absents, les cinq trésors restent visibles avec des boutons **Indisponible**. Le 24 octobre 2026, aucune variable `POLAR_*` n’était configurée sur le déploiement de développement consulté ; aucune création de produit ni aucun paiement réel n’ont été exécutés pour cette implémentation.

### 3. Vérifier puis activer les paiements réels

Effectuer un achat avec les [moyens de test Polar](https://polar.sh/docs/integrate/sandbox). Vérifier le retour sur `/sanctuary?checkout=…`, le passage du message de vérification à la confirmation et l’augmentation du solde. Renvoyer le webhook dans Polar et vérifier que le solde ne change plus. Tester aussi un remboursement.

Pour encaisser réellement, créer les produits et le webhook dans l’organisation de production, remplacer les cinq identifiants, le jeton et le secret, puis définir `POLAR_SERVER=production`. Les identifiants et secrets sandbox sont distincts de ceux de production. Resynchroniser les produits de production.

## Traitement des paiements

`payments:createCheckout` accepte seulement l’identifiant du pack. Le backend retrouve le joueur via Better Auth, choisit le produit autorisé et fixe la quantité. Il vérifie que le montant renvoyé par Polar correspond à l’offre synchronisée avant de renvoyer le lien. Le checkout est lié à ce joueur dans `emeraldPurchases`, avec une copie de la quantité et du prix au moment de l’achat.

Le composant crée le checkout et vérifie la signature de chaque webhook. Seul **`order.paid`** déclenche le crédit, via une mutation interne. Le retour du navigateur, un identifiant inventé, `order.created` ou un paiement non abouti ne donnent aucune émeraude. Le destinataire, le produit et la devise doivent correspondre au checkout enregistré. Le rapprochement du portefeuille et du journal d’achat est atomique ; les notifications répétées et concurrentes créditent une seule fois.

`payments:checkoutStatus` ne retourne que les achats du joueur connecté. Le navigateur suit cette requête réactive et le solde existant `collection:diamonds`. Si le webhook tarde, l’interface explique que la confirmation peut arriver après avoir quitté la page. Les noms internes historiques `diamonds` sont conservés pour garder tous les portefeuilles existants.

Les remboursements retirent la fraction correspondante des émeraudes, arrondie à l’entier inférieur ; un remboursement total retire tout le pack. Le cumul maximal reçu est conservé, donc un événement ancien ne peut pas annuler un remboursement. Un remboursement reçu avant la notification de paiement fonctionne également. Si le joueur a déjà dépensé ses émeraudes, le retrait peut rendre son solde négatif ; les futurs achats reconstituent ce solde. L’or et les cartes restent inchangés.

## Validation

- Les 24 tests backend de paiement exercent les vrais composants Better Auth et Polar, dont des webhooks signés par HMAC et leur vérification réelle par le SDK. Deux scénarios couvrent les anciennes variables Polar et les achats en attente avant le changement d’identifiants.
- Les tests couvrent les accès anonymes, les produits inadaptés, les prix modifiés, la confidentialité, l’absence de crédit au retour du navigateur, les doublons, la concurrence, les anciens portefeuilles et les remboursements.
- Quatre tests d’interface couvrent les cinq images et quantités, les prix synchronisés, les états indisponibles, les clics répétés, les erreurs et la confirmation serveur.
- La suite complète compte **551 tests réussis**, avec Node 24 pour Vitest ; TypeScript et la compilation de production passent.
- Les composants réels sont vérifiés dans un aperçu local avec des prix et achats **simulés** à 1 440 × 900, 390 × 844 et 320 × 700 px : images chargées, accès aux cinq packs, aucun débordement horizontal de la page, aucune erreur JavaScript. Ces contrôles ne constituent pas une transaction Polar sandbox de bout en bout ; celle-ci demande la configuration de l’organisation.

Aperçus : [ordinateur](emerald-packs-desktop.jpg), [mobile](emerald-packs-mobile.jpg), [petit mobile](emerald-packs-small-mobile.jpg), [confirmation simulée](emerald-payment-confirmed.jpg).

La nouvelle gamme a été contrôlée dans le sanctuaire réel à 1 218 × 853 px : les cinq images chargent et leur taille augmente de palier en palier. Aperçus : [bourse, sacoche et écrin](emerald-packs-v2-first-tiers.png), [écrin, coffret et coffre final](emerald-packs-v2-last-tiers.png). Les fonctions Convex de développement ont été synchronisées avec les nouveaux identifiants.

La nouvelle gamme utilise quatre illustrations créées avec **ImageGen intégré** et reprend l’ancien visuel « Coffre des anciens » pour le cinquième palier. Les WebP RGBA de 512 × 512 px sont dans `apps/web/public/art/treasures/`. Le [nouveau manifeste](art-prompts-emerald-packs-v2.json) conserve les prompts, les références et les chemins finaux ; le [manifeste initial](art-prompts-emerald-packs.json) reste archivé. Les images ont une taille d’affichage graduelle, de 66 % pour la petite bourse à 100 % pour le coffre.
