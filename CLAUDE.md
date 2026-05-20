# CLAUDE.md

Contexte court pour Claude. Détails complets dans [README.md](README.md).

## Stack

- **Front** : Vite + React 18 + TypeScript strict, build statique dans `web/dist/`
- **API** : Pages Functions (`functions/`), TypeScript strict, `@cloudflare/workers-types`
- **Persistance plans** : Durable Object `PlanDO` hébergé dans le Worker `cooldown-planner-do` (`do-worker/`), binding cross-script via `script_name` dans `wrangler.toml`
- **Référentiel jobs/abilities** : KV `JOBS_KV`, clé unique `jobs:all` (~30KB JSON)
- **Auth** : aucune pour le MVP, plans accessibles par slug

## Conventions

- npm workspaces (`web/`, `do-worker/`), pas de pnpm
- Indentation 2 espaces, `const`/`let`, arrow functions
- TypeScript strict partout, `noUnusedLocals`, `noUnusedParameters`
- Pas de border-radius dans le CSS (esthétique cyberpunk angulaire)
- Variables CSS (`--cyan`, `--pink`, etc.) extraites verbatim du mockup V0.4
- Commits en français OK ; conventional commits non requis (cohérence avec PARTY//BUILDER)
- Tests : `node --test` natif sur les helpers purs de `web/src/lib/`

## Gotchas

### Cross-script DO binding
- Le Worker `cooldown-planner-do` DOIT être déployé avant Pages, sinon le binding ne résout pas
- En local, lancer les deux ensemble via `npm run dev` (concurrently) — état partagé via `.wrangler/state`

### Pages Functions
- Pas de classe Durable Object directement dans `functions/**` (Cloudflare ne le supporte toujours pas) — seule la binding existe ici
- CORS géré dans `functions/_middleware.ts` (whitelist `cooldown-planner.pages.dev` + `localhost:8788`)

### Types partagés
- Duplication volontaire entre `functions/_types.ts` et `web/src/types.ts` — pas d'import inter-workspaces au runtime worker
- Si l'un change, mettre à jour l'autre. À factoriser plus tard si la duplication devient gênante.

### Données ability/job
- Source unique : `seed/data.json` → poussé dans KV via `scripts/seed-kv.mjs`
- Chaque ability a son `mit_potency` réel (pas une valeur par défaut selon le type) et son `effect` propre
- Valeurs vérifiées sur Garland Tools, FFXIV Wiki (gamerescape.com). Chaque ability porte un champ `verified` (true/false) et `_source_url` quand pertinent

### Mockup V0.4
- Source de vérité visuelle dans `~/Downloads/mitigation-planner.html` (hors repo)
- Quand mockup et bootstrap doc divergent sur le data model, suivre le mockup
- Variables CSS, fonts (Chakra Petch + JetBrains Mono), spacings et anatomie des composants : à reproduire fidèlement

## Workflow

1. Helpers purs (calcul coverage, fmt time) → `web/src/lib/` + test dans `tests/`
2. Nouveau type de donnée persisté → modifier `functions/_types.ts` ET `web/src/types.ts`, puis adapter le DO + le store Zustand
3. Nouvelle ability dans le référentiel → édit `seed/data.json` + relancer `npm run seed:kv`
4. UI → composants React colocalisés, CSS en classique dans `web/src/styles/` (pas `@apply`)
