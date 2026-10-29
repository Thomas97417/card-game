# Fonderie des Échos

La fonderie est accessible dès la première visite du refuge par son nouveau bâtiment, à droite de l’arène. La route `/foundry` demande une session connectée. Le bâtiment est une illustration transparente superposée au panorama existant ; les autres bâtiments et mines gardent leurs coordonnées.

## Une manche

Après trois secondes de préparation, le marteau frappe automatiquement les reliques à portée de la visée. La souris se déplace librement, le doigt reste maintenu sur mobile et les flèches déplacent la visée au clavier. Échap et le bouton Pause suspendent la manche, comme le passage en arrière-plan. Aucune production ni échéance n’avance hors du jeu actif.

La concentration commence à 100 et diminue de deux points par seconde. Une manche dure ainsi environ cinquante secondes, avec un plafond de soixante-quinze secondes même après récupération de concentration. Les sources vivantes rendent huit points. Le plateau contient au maximum seize objets : urnes fragiles, géodes résistantes, reliques fuyantes, sources vivantes et cœurs du Chaos dont la destruction touche les voisins.

Le maillet de cuivre est disponible dès le départ. Une commande livrée débloque définitivement le martelet vif ; trois commandes débloquent le marteau de résonance et sa grande zone. Le Forgeron est prêté par le refuge et donne 15 % de dégâts supplémentaires. La Dryade donne 15 % de concentration et la Féline 15 % d’éclats ; la découverte de leur famille dans la collection ouvre leur sélection. Les cartes restent utilisables dans le deck et leurs niveaux de combat ne modifient pas ces talents.

## Commandes et progression

Les cinq commandes coûtent successivement 100, 200, 350, 550 et 850 éclats. Chaque nouvelle commande doit être livrée en deux manches ; les gains de la dernière manche restent utilisables pour la livraison. À l’échéance, une réserve insuffisante clôt le chantier. Si la réserve suffit, la commande doit être livrée avant une nouvelle manche ou une amélioration.

Chaque livraison donne un point de maîtrise permanent et propose trois bénédictions différentes, parmi six effets cumulables pour ce chantier : dégâts, cadence, concentration, portée, butin et critiques. L’arbre d’améliorations possède trois branches de trois niveaux, coûtant chacune 50, 100 puis 200 éclats : dégâts +25 %, concentration +15 % ou critiques +5 points de pourcentage par niveau.

La cinquième livraison termine le chantier. Après un succès ou un échec, le joueur peut ouvrir le suivant : éclats, améliorations et bénédictions repartent à zéro ; la maîtrise et les outils débloqués sont conservés.

## Coffre quotidien

La troisième livraison de la journée offre un coffre commun immédiatement ouvert, tous chantiers confondus. Le jour est calculé par le serveur à minuit à Paris, avec les changements d’heure. Les livraisons suivantes continuent à donner de la maîtrise et des bénédictions.

Le contenu et l’or utilisent `chestLoot` et `chestGold`, selon le record de trophées au moment du gain. L’attribution utilise les fonctions existantes de collection et de portefeuille et compte comme une ouverture pour les missions. Le coffre ne prend aucune place de coffre de combat. Le reçu et le crédit sont enregistrés ensemble ; une réponse perdue retrouve la même récompense. La révélation reste disponible jusqu’à sa fermeture, même après un changement de jour.

## Simulation et sauvegarde

`@sylve/game/foundry` centralise les paramètres, les transitions et la simulation déterministe à pas de cinquante millisecondes. Le décor peint `foundry-interior-v1.webp` occupe la page entière, comme les autres intérieurs du jeu. Three.js superpose les reliques, le marteau et leurs ombres à son grand établi au premier plan, dans un canvas transparent indépendant des calculs : visée projetée sur le plateau, marteau animé, réactions aux coups, fissures, fragments et éclats. La caméra cadre uniquement la surface jouable, avec le grand côté dans la hauteur en mode portrait. La visée reste alignée sur le même plateau logique, sans modifier la portée ni les gains. Les outils et compagnons se choisissent dans une fenêtre de préparation ; sur mobile, les commandes et améliorations restent accessibles sous l’établi. Les sons proviennent du sprite de combat existant, avec ses attributions conservées. Le moteur graphique est importé uniquement dans la fonderie. La résolution et les particules sont plafonnées ; les secousses sont désactivées avec les animations réduites. Une indisponibilité de WebGL 2 empêche de commencer une nouvelle manche.

Les tables Convex `foundryProgress`, `foundryRounds` et `foundryDaily` sont initialisées à l’entrée. Le navigateur prédit les frappes et envoie des lots de quarante entrées toutes les deux secondes, ainsi qu’à la pause et en fin de manche. Le serveur contrôle la session, les coordonnées, le curseur de simulation, la cadence réelle et le contenu des lots rejoués. Il recalcule les résultats ; le client ne choisit jamais les gains. Les mutations de décisions utilisent la révision du chantier pour refuser les actions concurrentes.

Un brouillon local conserve les entrées non confirmées, séparées par compte et manche. La reprise retire les entrées déjà confirmées, rejoue les autres et attend une action du joueur avant de continuer. Un conflit entre onglets met en pause et propose de reprendre explicitement la sauvegarde du serveur. Les manches finalisées sont conservées comme reçus, ce qui rend les nouvelles tentatives idempotentes.

## Vérification et publication

Les tests du moteur contrôlent les relectures déterministes, les cibles, les limites de concentration, les échéances et les coûts. Les tests Convex couvrent les autorisations, les lots concurrents, les crédits et le passage de minuit. Les tests d’interface couvrent les outils verrouillés, les assistants, WebGL indisponible, le clavier, la pause et les bénédictions ; ceux de session contrôlent les brouillons et la reprise. Les tests de projection vérifient le cadrage, la correspondance entre pointeur et plateau et les flèches au clavier sur ordinateur, mobile et écran bas.

`bun scripts/verify-foundry.mjs`, depuis `packages/backend`, crée son propre compte jetable et joue de vraies manches cadencées jusqu’au coffre quotidien. Il compare les résultats serveur à la prédiction et rejoue les requêtes pour vérifier leur idempotence. Il accepte uniquement un déploiement `dev:` ou un backend HTTP de bouclage local. `--keep` conserve le compte dans `.cache/foundry-test-user.json` pour le contrôle navigateur ; `--cleanup` supprime ensuite ses sessions et son compte. Ce scénario peut prendre quelques minutes.

Utiliser une version de Node compatible avec Vite 7 pour `bun run test`, puis lancer `bun run check-types` et `bun run build`. Générer les routes et les types par TanStack et Convex. Publier le backend avant le frontend. Sur un déploiement de développement partagé, intégrer aussi les fonctions et le schéma des autres branches actives avant publication : Convex remplace les fonctions et les index absents du projet publié.
