# COOLDOWN//PLANNER

Webapp de planification de cooldowns défensifs pour les raids Final Fantasy XIV. Compagnon de [PARTY//BUILDER](https://party-builder.pages.dev/).

- **Stack** — Cloudflare Pages (React + Vite + TypeScript), Pages Functions, Durable Object, KV
- **Domaine cible** — `cooldown-planner.pages.dev` (à enregistrer après v1)
- **Auth** — différée ; plans accessibles par slug, mode invité par défaut

## Dev local

```sh
npm install
npm run dev
```

Trois processus se lancent en parallèle :

| Process       | Port | Rôle                                                |
|---------------|------|-----------------------------------------------------|
| Vite          | 5173 | React HMR (proxifié par wrangler)                   |
| Pages dev     | 8788 | Pages Functions + assets statiques + proxy vers vite |
| DO worker dev | 8787 | Worker `cooldown-planner-do` (classe `PlanDO`)      |

Ouvre http://localhost:8788. Les requêtes `/api/*` vont aux Functions, le reste à Vite.

## Build & deploy

```sh
npm run build              # web/dist
npm run deploy:worker      # do-worker en premier (cross-script binding)
npm run deploy:pages
# ou tout en un :
npm run deploy
```

## Structure

```
xiv-cd-planner/
├── functions/        # Pages Functions (API REST)
├── do-worker/        # Worker séparé hébergeant PlanDO (Durable Object)
├── web/              # Front Vite + React + TS
├── seed/             # Référentiel jobs/abilities (poussé en KV via scripts/seed-kv.mjs)
└── scripts/          # fetch-icons.mjs, seed-kv.mjs
```

Voir [CLAUDE.md](CLAUDE.md) pour les conventions et points d'attention.

## Activer l'import FFLogs

Une seule étape, à faire une fois :

1. Va sur https://www.fflogs.com/api/clients/ (connecté à ton compte FFLogs)
2. Section "Personal Access Token" → génère un token (24h validity n'a pas
   d'incidence ici, le token PAT est permanent)
3. Pose-le comme secret Cloudflare Pages :

   ```sh
   wrangler pages secret put FFLOGS_API_TOKEN --project-name=cooldown-planner
   # colle le token au prompt
   ```

Après ça, le bouton "+ IMPORT LOG" du Header marche : colle une URL
FFLogs (e.g. `https://www.fflogs.com/reports/abcDEF123`), pick une
fight, importe les mechanics.

Tant que le secret n'est pas posé, l'endpoint `/api/fflogs/*` renvoie
un 503 avec un message d'erreur explicite côté UI.
