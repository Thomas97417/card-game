# Offres légendaires : petit guide Polar

Le coffre « NEW / OFFER » apparaît sous le cadeau du hub aux **rangs 1 à 25 inclus**. Chaque pack coûte **20 €** et contient **1 500 émeraudes, 40 000 or, 185 exemplaires d’une carte rare, 45 d’une épique et 7 d’une légendaire**. Les cartes sont garanties, sans tirage aléatoire.

## 1. Créer deux produits dans Polar

Commencer sur [Polar Sandbox](https://sandbox.polar.sh). Dans **Products**, créer :

| Champ                         | Serment solaire                  | Pacte des abysses                  |
| ----------------------------- | -------------------------------- | ---------------------------------- |
| Nom                           | Sylve — Serment solaire          | Sylve — Pacte des abysses          |
| Facturation                   | One-time purchase                | One-time purchase                  |
| Prix                          | Fixed, **20,00 EUR**             | Fixed, **20,00 EUR**               |
| Carte rare ×185               | Archère de la garde              | Vipère des ombres                  |
| Carte épique ×45              | Paladin du royaume               | Matriarche des maléfices           |
| Carte légendaire ×7           | Dragon du soleil éternel         | Monarque des abysses               |
| Variable Convex du Product ID | `POLAR_PRODUCT_OFFER_SOLAR_OATH` | `POLAR_PRODUCT_OFFER_ABYSSAL_PACT` |

Description à copier en adaptant les noms : « Pack Sylve : 1 500 émeraudes, 40 000 pièces d’or, 185 [carte rare], 45 [carte épique] et 7 [carte légendaire]. Contenu garanti. Réservé aux joueurs de rang 1 à 25 inclus. »

Conserver **un seul prix actif par produit**, sans abonnement, avec deux **Product ID** distincts de ceux des packs d’émeraudes. Copier l’ID du produit, pas celui de son prix. Le modèle ponctuel et le prix fixe sont décrits dans la [documentation des produits Polar](https://docs.polar.sh/documentation/features/products).

Configurer explicitement le prix de chaque produit en **Inclusive / taxes incluses** pour que le total payé reste à **20 €**. Vérifier ce total en sandbox après avoir renseigné un pays taxable. Le jeu relit le prix et refuse d’ouvrir le paiement si son réglage `tax_behavior` n’est pas `inclusive`. Polar distingue les modes `inclusive` et `exclusive` ; ce dernier ajoute les taxes au prix. Voir les [champs du checkout](https://polar.sh/docs/api-reference/checkouts/create-session). Les codes promotionnels sont désactivés par le jeu pour ces deux offres.

Le jeu contrôle le rang et délivre les cartes : aucun Benefit Polar ni lien de paiement public n’est nécessaire. Le joueur doit démarrer son paiement depuis le coffre du hub pour lier l’achat à son compte.

## 2. Compléter les variables du déploiement Convex

Dans **Convex → Settings → Environment Variables** du backend utilisé par le jeu :

| Variable                           | Valeur                                              |
| ---------------------------------- | --------------------------------------------------- |
| `POLAR_PRODUCT_OFFER_SOLAR_OATH`   | Product ID du Serment solaire                       |
| `POLAR_PRODUCT_OFFER_ABYSSAL_PACT` | Product ID du Pacte des abysses                     |
| `POLAR_ORGANIZATION_TOKEN`         | Jeton de cette organisation Polar                   |
| `POLAR_WEBHOOK_SECRET`             | Secret complet du webhook, préfixe `whsec_` compris |
| `POLAR_SERVER`                     | `sandbox` pour les essais, puis `production`        |
| `SITE_URL`                         | Origine du jeu, par exemple `https://ton-jeu.fr`    |

Si Polar fonctionne déjà pour les émeraudes, conserver les réglages communs et ajouter seulement les deux Product ID. Le jeton doit permettre au composant de lire les produits et de gérer clients et checkouts, notamment `checkouts:write` pour fixer les paramètres de paiement ; voir les [droits requis par le composant](https://github.com/convex/polar#prerequisites).

Ces variables vont sur **Convex**, jamais dans les variables frontend `VITE_` ni dans Git.

## 3. Brancher le webhook et synchroniser

Déployer le backend modifié vers le déploiement choisi, puis créer ou compléter le webhook Polar existant :

- URL : `https://<ton-deploiement>.convex.site/polar/events`.
- Format : **Raw** ; conserver la version API utilisée par l’intégration existante.
- Événements : **`product.created`**, **`product.updated`**, **`order.paid`**, **`order.refunded`**.
- Copier son secret dans `POLAR_WEBHOOK_SECRET` sur le même déploiement Convex.

Le jeu crédite les achats à réception de [`order.paid`](https://polar.sh/docs/api-reference/webhooks/order.paid), qui confirme l’encaissement. Les [événements disponibles](https://polar.sh/docs/api-reference/webhooks/endpoints/create) comprennent aussi les mises à jour produit et les remboursements.

Depuis `packages/backend`, synchroniser les produits après leur création :

```bash
bunx --bun convex run payments:syncProducts '{}'
```

Tant que les produits ou les variables manquent, les packs restent visibles aux joueurs éligibles avec les achats désactivés.

## 4. Tester, puis passer en production

1. Avec un compte de rang ≤25, ouvrir le coffre puis acheter chaque offre avec les [moyens de paiement de test Polar](https://polar.sh/docs/integrate/sandbox).
2. Vérifier le total de **20 €**, le retour sur `/hub?offerCheckout=…`, la confirmation et les deux monnaies ainsi que les trois lots de cartes. Pour une carte jamais obtenue, le premier exemplaire débloque la carte ; la réserve d’amélioration affiche donc 184, 44 ou 6 exemplaires supplémentaires.
3. Renvoyer la notification `order.paid` depuis Polar : rien ne doit être crédité une deuxième fois. Tester un remboursement : les monnaies et exemplaires correspondants sont repris. Si ces ressources ont été dépensées, une dette peut subsister ; les niveaux acquis sont conservés.
4. Vérifier qu’au **rang 26**, le coffre disparaît et qu’un nouveau checkout est refusé. Un paiement ouvert avant ce rang reste honoré même si le joueur progresse entre-temps.
5. Recréer les deux produits et le webhook dans **Polar production**, remplacer les Product ID, le jeton et le secret, passer `POLAR_SERVER=production`, puis resynchroniser.

Les achats sont répétables tant que le joueur est éligible ; la limite demandée porte sur le rang. Le catalogue et les quantités sont centralisés dans `packages/game/src/legendary-offers.ts`. Les achats déjà créés conservent une copie de leur contenu pour leur livraison et leur remboursement.

Pour le déploiement et les erreurs de signature webhook, voir aussi le [guide Polar existant](emerald-purchases.md).
