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

À faire une fois :

1. Va sur https://www.fflogs.com/api/clients/ (connecté à ton compte FFLogs)
2. "Create a Client" :
   - **Application name** : `COOLDOWN//PLANNER`
   - **Redirect URLs** : laisser vide (uniquement pour le auth-code flow)
   - **Public Client** : laisser décoché (le secret est stocké côté Cloudflare)
3. Récupère le `Client ID` + `Client Secret` affichés après Create.
4. Pose-les comme secrets Cloudflare Pages :

   ```sh
   wrangler pages secret put FFLOGS_CLIENT_ID --project-name=cooldown-planner
   # colle le Client ID au prompt
   wrangler pages secret put FFLOGS_CLIENT_SECRET --project-name=cooldown-planner
   # colle le Client Secret au prompt
   ```

Après ça, le bouton "+ IMPORT LOG" du Header marche : colle une URL
FFLogs (e.g. `https://www.fflogs.com/reports/abcDEF123`), pick une
fight, importe les mechanics. Le Worker fait le OAuth2
client-credentials dance, cache l'access_token 1h, et bearer-auth
les requêtes GraphQL.

Tant que les secrets ne sont pas posés, `/api/fflogs/*` renvoie un 503
avec un message d'erreur explicite côté UI.
