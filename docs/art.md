# Illustrations de Sylve

Les illustrations sont originales et ont été produites avec l’outil intégré **ImageGen**. La capture fournie sert de référence à la disposition du duel (terrain central, créatures sur les cases, main en dessous, valeurs dans des icônes).

- `apps/web/public/art/forest-arena.png` : décor de la page d’accueil.
- `apps/web/public/art/duel-arena-overhead.webp` : terrain actuel du duel, une cour de pierre vue de dessus avec une légère perspective. La surface est volontairement calme pour lire clairement les 24 cases.
- `apps/web/public/art/duel-arena.webp` : première version du terrain, conservée comme référence.
- `apps/web/public/art/heroes/hero-sylve.webp` : héros elfe de la Sylve, placé à gauche du terrain et tourné vers son centre.
- `apps/web/public/art/heroes/hero-amber.webp` : héros mécanique d’ambre, placé à droite et tourné vers le terrain. La vie des deux héros est affichée au-dessus de leur silhouette par le même composant de cœur que les compagnons.
- `apps/web/public/art/characters/{id}.webp` : 12 personnages détourés, un pour chaque carte du catalogue : `guardian`, `fox`, `owl`, `stag`, `mushroom`, `dragon`, `turtle`, `wisp`, `wolf`, `knight`, `serpent`, `bear`. Le même visuel apparaît sur la carte et sur le terrain.
- `apps/web/src/components/game/stat-badge.tsx` : épée pour la puissance et cœur pour la vie, avec la valeur superposée et un libellé accessible. Les valeurs restent dynamiques ; elles ne sont pas incrustées dans les images.

Les personnages possèdent un véritable canal alpha transparent, vérifié avant intégration. Les images finales sont converties en WebP ; les compagnons sont limités à 512 px et les héros à 768 px pour limiter le téléchargement. Les PNG originaux restent dans le dossier de génération ImageGen local.

Le jeu de prompts exact utilisé pour le premier terrain et les 12 personnages est conservé dans [art-prompts.json](art-prompts.json). Celui du terrain vu de dessus et des deux héros, avec leurs chemins finaux et les coordonnées du plateau, est dans [art-prompts-v2.json](art-prompts-v2.json). Chaque personnage a fait l’objet d’un appel séparé à l’outil intégré, avec transparence demandée. Le détourage final du héros elfe a également été réalisé avec ImageGen. Aucun fallback CLI n’a été utilisé.

Le décor mesure 1659 × 948 px. Les quatre coins intérieurs de sa bordure dorée sont relevés dans `apps/web/src/components/game/arena-layout.ts`. Une homographie projette le plateau de 6 colonnes et 4 lignes vers ce quadrilatère. Les joints des dalles sont dessinés en SVG avec ces coordonnées ; les zones cliquables utilisent les mêmes polygones et les pieds des compagnons sont ancrés sur ce même plan. Le décor et la grille partagent un rapport d’image fixe, sans recadrage. L’interface de duel conserve cette disposition pour ordinateur.

Prompt final du décor de la page d’accueil, outil intégré ImageGen :

> Use case: stylized-concept. Asset type: wide landscape background illustration for an original fantasy tactical card game website, called Sylve. Create a gorgeous hand-painted 2D storybook fantasy landscape: an ancient circular stone duel arena surrounded by lush emerald forest, giant trees, small delicate golden flowers, ferns and moss-covered ruins, distant mountains and a waterfall, warm soft morning sunlight. Rich painterly brushwork, charming sophisticated game art, teal/forest greens and warm parchment gold, tiny magical fireflies. Composition: wide landscape 3:2, arena occupies lower right half with generous hazy lighter negative space upper left for page title overlay. No characters, no cards, no lettering, no text, no logos, no watermark, no UI. This is a single scenic illustration.
