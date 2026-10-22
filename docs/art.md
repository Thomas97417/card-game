# Illustrations de Sylve

Les illustrations sont originales et ont été produites avec l’outil intégré **ImageGen**. La capture fournie sert de référence à la disposition du duel (terrain central, créatures sur les cases, main en dessous, valeurs dans des icônes).

- `apps/web/public/art/forest-arena.png` : décor de la page d’accueil.
- `apps/web/public/art/duel-arena.webp` : nouveau terrain du duel, une cour de pierre au cœur de la forêt. La grille interactive et l’interface sont ajoutées dans React.
- `apps/web/public/art/characters/{id}.webp` : 12 personnages détourés, un pour chaque carte du catalogue : `guardian`, `fox`, `owl`, `stag`, `mushroom`, `dragon`, `turtle`, `wisp`, `wolf`, `knight`, `serpent`, `bear`. Le même visuel apparaît sur la carte et sur le terrain.
- `apps/web/src/components/game/stat-badge.tsx` : épée pour la puissance et cœur pour la vie, avec la valeur superposée et un libellé accessible. Les valeurs restent dynamiques ; elles ne sont pas incrustées dans les images.

Les personnages possèdent un véritable canal alpha transparent, vérifié avant intégration. Les images finales sont converties en WebP et les personnages limités à 512 px pour limiter le téléchargement. Les PNG originaux restent dans le dossier de génération ImageGen local.

Le jeu de prompts exact utilisé pour le nouveau terrain et les 12 personnages, ainsi que chaque chemin final, est conservé dans [art-prompts.json](art-prompts.json). Chaque personnage a fait l’objet d’un appel séparé à l’outil intégré, avec transparence demandée. Aucun fallback CLI n’a été utilisé.

Prompt final du décor de la page d’accueil, outil intégré ImageGen :

> Use case: stylized-concept. Asset type: wide landscape background illustration for an original fantasy tactical card game website, called Sylve. Create a gorgeous hand-painted 2D storybook fantasy landscape: an ancient circular stone duel arena surrounded by lush emerald forest, giant trees, small delicate golden flowers, ferns and moss-covered ruins, distant mountains and a waterfall, warm soft morning sunlight. Rich painterly brushwork, charming sophisticated game art, teal/forest greens and warm parchment gold, tiny magical fireflies. Composition: wide landscape 3:2, arena occupies lower right half with generous hazy lighter negative space upper left for page title overlay. No characters, no cards, no lettering, no text, no logos, no watermark, no UI. This is a single scenic illustration.
