# RECYCLEM

Une petite liste partagée qui remplace un fichier Excel : des fiches avec photo, une recherche, « Ça m'intéresse »,
ajouter et supprimer une ligne. Pas de compte : chacun choisit un pseudo, retenu en cookie sur son appareil.
Tout le monde peut supprimer n'importe quelle ligne (pour l'instant).

Hébergement : un **Worker Cloudflare** (`worker.js`, la page dans `public/`) et une base **D1** (lignes et photos).
Les tables se créent seules au premier appel.

## Les colonnes

Elles sont toutes dans `columns.js` (clé, libellé, type `text` / `long` / `image`, `required`). La première colonne
texte sert de titre de fiche ; les trois suivantes s'affichent sur la carte, toutes dans le détail.

## Mise en ligne (une fois, dans le navigateur)

1. [dash.cloudflare.com](https://dash.cloudflare.com), **Storage & Databases**, **D1**, **Create database**, nom `recyclem`.
   Copier son **Database ID** dans `wrangler.jsonc` (`database_id`).
2. **Workers & Pages**, **Create application**, **Import a repository**, GitHub, dépôt `RECYCLEM`
   (l'ajouter à l'application GitHub « Cloudflare Workers and Pages » si besoin). Nom du projet : `recyclem`,
   Build command vide, Deploy command `npx wrangler deploy`. **Create and deploy**.
3. Le site est sur `https://recyclem.<sous-domaine>.workers.dev`. Chaque push sur `main` republie.

## Développer

```
npm test          # tests de l'API (Node 22, SQLite en mémoire)
npm run dev       # site en local avec wrangler
```
