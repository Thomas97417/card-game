# Mines du refuge

Les deux mines démarrent à la première visite du hub et produisent même hors connexion. Le niveau utilisé est le **niveau du Gardien**, conservé dans `heroes` et augmenté manuellement dans la Maison des gardiens lorsque la puissance du deck le permet. Le rang d’expérience des liens d’âme reste indépendant. Aucun niveau de mine séparé ni achat n’est nécessaire.

| Mine | Production horaire | Capacité | Exemple au niveau 3 |
| --- | --- | --- | --- |
| Or | 6 × niveau du héros | 48 × niveau du héros | 18 pièces/h, réserve de 144 |
| Émeraudes | 2 × niveau du héros | 16 × niveau du héros | 6 émeraudes/h, réserve de 48 |

La réserve correspond à huit heures de production. Une fois pleine, la production s’arrête : les heures supplémentaires ne sont pas reportées. Les paramètres sont centralisés dans `packages/game/src/mines.ts`.

Dès qu’une unité entière est disponible, une icône de monnaie et la quantité apparaissent au-dessus de la mine. Cliquer sur l’icône transfère toute la quantité entière disponible au portefeuille et conserve la fraction restante. La production reprend immédiatement après la collecte. Les deux réserves sont indépendantes. Les mines sont accessibles en parcourant la carte.

Dès le clic, le solde affiché augmente, la réserve se vide et une petite animation « + X » avec l’icône de la monnaie apparaît pendant deux secondes sous son compteur dans l’en-tête. Cette mise à jour est une anticipation locale gérée par le cache optimiste de Convex. La requête serveur contient le type de mine, la révision et l’identifiant du compte attendu ; aucun montant estimé ni heure du client n’est envoyé. Le curseur reste normal et les clics supplémentaires sur la même mine sont bloqués jusqu’à la réponse. L’autre mine peut être collectée immédiatement et ses gains sont indépendants.

À la confirmation, les données serveur remplacent l’estimation sans ajouter une seconde fois le gain. Si le montant diffère, l’animation est corrigée. En cas de refus, Convex restaure automatiquement les soldes et réserves du serveur, l’animation correspondante est annulée et l’erreur est signalée. Si la réserve a déjà été récupérée depuis un autre onglet, l’anticipation est retirée sans crédit supplémentaire. Les souscriptions de lecture restent actives pendant le rafraîchissement afin que les retours arrière restent visibles. Sur mobile, les gains sont regroupés sous les compteurs ; la préférence pour les animations réduites conserve un fondu sans déplacement.

L’horloge monotone continue lors d’un retour arrière : une pièce devenue disponible après la dernière lecture serveur redevient immédiatement récupérable. Une ancienne lecture en erreur ne masque pas une nouvelle réponse valide. Si la session expire ou si le joueur quitte le hub, les animations en attente sont annulées et les réponses tardives ne déclenchent plus de gain ni de message sur la page suivante. Une collecte en attente est liée au compte qui l’a déclenchée : le serveur refuse son exécution sous un autre compte, et le cache optimiste ignore les données de cet autre joueur. Une coupure réseau laisse la mutation en attente de reconnexion ; elle ne constitue pas à elle seule un refus du serveur et ne déclenche pas de seconde collecte.

L’état de chaque mine (réserve fractionnaire, date de calcul, niveau du héros et révision de collecte) est stocké dans le champ optionnel `wallets.mines`, compatible avec les anciens portefeuilles. L’initialisation est idempotente et conserve les soldes existants, dont un solde d’émeraudes nul. Le bonus de bienvenue reste attribué une seule fois selon les règles existantes.

`collection.mineBoard` renvoie l’état privé du joueur avec son identifiant de propriétaire et l’heure serveur. Le client actualise l’affichage chaque seconde avec une horloge monotone et resynchronise la lecture toutes les trente secondes ; le paramètre de rafraîchissement sert uniquement à invalider le cache. Le serveur calcule les récompenses avec sa propre heure et déduit le propriétaire de la session validée. L’identifiant attendu sert uniquement à refuser une requête devenue obsolète après un changement de compte. Le client ne choisit ni le montant, ni le propriétaire, ni la date de production.

`collection.collectMine` vérifie la révision et crédite le portefeuille dans la même transaction que la remise à zéro de la réserve. Les doubles clics, requêtes rejouées et collectes simultanées depuis plusieurs onglets ne peuvent pas créditer deux fois une réserve. Une collecte vide ne réinitialise pas le temps de production.

Lors d’une promotion du Gardien, la transaction calcule d’abord la production et le plafond de l’ancien niveau, puis applique le nouveau rendement à partir de cet instant. Les heures passées ne sont jamais recalculées au nouveau niveau. Une simple amélioration de carte ou un gain d’expérience n’augmente pas le rendement sans promotion du Gardien.

Le décor panoramique 3:1 conserve les cinq bâtiments existants et ajoute une mine d’or à l’ouest et une mine d’émeraudes à l’est. Les zones cliquables utilisent les coordonnées de cette nouvelle illustration. Le [manifeste ImageGen](art-prompts-hub-mines.json) conserve le prompt intégral et les chemins des images.
