# Design SPIKE — Multi-pull / patterns de rotation

> **Statut : document de design, PAS une implémentation.**
> Objectif : explorer le problème « patterns #1 / #2 » remonté par la statique,
> comparer 2-3 approches concrètes et recommander un MVP incrémental.
> Aucune ligne de ce doc n'engage le data-model : tout est à valider avant de coder.

---

## 1. Le problème (retours Discord)

La statique raisonne en **« patterns de rotation #1 / #2 »** : certaines mécaniques
ont plusieurs résolutions possibles — un « OU » sur la timeline. Sur un même boss,
le pull A peut envoyer *Mécanique X* à 2:10 alors que le pull B envoie *Mécanique Y*
au même instant (ordre RNG, ciblage aléatoire, branche de phase…). Ils veulent :

1. **Mapper leurs CDs sur plusieurs pulls** dans un même plan.
2. **Voir ce qui est commun** (sorts stables, posés au même endroit quel que soit le pattern)
   **vs ce qui diverge** (sorts spécifiques à un pattern).

Idées lancées dans la discussion, **toutes explicitement « à cooker »** :

- **(I1)** Importer plusieurs logs, matcher les mécas à ±10 s, moyenner les sorts
  stables, marquer les divergents en transparence avec des étiquettes A/B/C.
- **(I2)** Une **substitution manuelle** : remplacer une méca par une alternative.
- **(I3)** Surligner des zones/phases comme premier pas — **déjà livré** via `plan.phases`
  (cf. [`Phase`](../../web/src/types.ts) l.136-140, rendu dans
  [`PhaseMarkers.tsx`](../../web/src/components/timeline/PhaseMarkers.tsx)).

**Réserves soulevées par la statique elle-même :**

- **R1 — timer de départ.** L'import multi-log (I1) ne marche que si le `t=0` du pull
  est identique d'un log à l'autre. Pas garanti : FFLogs horodate au premier événement,
  le pre-pull / le countdown varient.
- **R2 — phasing par debuffs.** Les boss qui changent de phase après *N* debuffs
  (et non à un timestamp fixe) cassent tout matching à ±10 s : le décalage se cumule.
- **R3 — UI confuse.** Gros risque d'illisibilité si on superpose plusieurs timelines
  ou si on multiplie les états visuels.

D'où ce SPIKE : **cooker le design avant d'écrire du code.**

---

## 2. État des lieux du data-model

### 2.1 Anatomie d'un `Plan` aujourd'hui

Source de vérité : [`web/src/types.ts`](../../web/src/types.ts) l.167-181, dupliquée
**verbatim** dans [`functions/_types.ts`](../../functions/_types.ts) et
[`do-worker/src/types.ts`](../../do-worker/src/types.ts) l.76-87 (duplication volontaire,
cf. CLAUDE.md « Types partagés »).

```
Plan
├── meta            PlanMeta { slug, owner_id, created_at, updated_at }
├── encounter       Encounter { fight_name, fight_duration, party_ilvl, level }
├── party           Player[]    (8 slots fixes p1..p8, badges MT/OT/H1…)
├── boss_lanes      BossLane[]  (lignes du boss : "BOSS A", "Right Wing"…)
├── mechanics       Mechanic[]  (UN seul jeu de mécas)
├── uses            Use[]       (UN seul jeu de placements de CD)
├── hidden_ability_ids  string[]
└── phases?         Phase[]     (marqueurs verticaux P1/P2…, pure annotation)
```

Les deux collections qui nous intéressent :

- **`Mechanic`** ([`types.ts`](../../web/src/types.ts) l.92-129) : `{ id, lane_id, name,
  time, category, targets[], damage_kind?, cast_time?, hit_count?, tags?, game_id? }`.
  Une méca appartient à une `lane_id` et tombe à `time` (secondes).
- **`Use`** ([`types.ts`](../../web/src/types.ts) l.142-147) : `{ id, player_id,
  ability_id, time }`. Un placement de CD d'un joueur à un instant donné.

**Point central : il n'existe qu'UN `mechanics[]` et UN `uses[]` par plan.** Tout le
reste (coverage, undo, autosave, DO) suppose ce singleton.

### 2.2 Comment c'est consommé

- **Coverage** : [`computeCoverage`](../../web/src/lib/mitigation.ts) l.71-117 prend
  `(mech, uses, abilities, partySize, …)`. Pour chaque `mech`, il somme les `mit_potency`
  des `uses` dont la fenêtre `[u.time, u.time + ab.effect)` couvre `mech.time`. C'est
  un parcours plat de `uses[]` — aucune notion de variante. La fonction est **pure**
  et déjà paramétrée par `level` + `hiddenAbilityIds`, donc facile à appeler par sous-ensemble.
- **Store** : [`planStore.ts`](../../web/src/state/planStore.ts) tient `mechanics` /
  `uses` à plat (l.197-198) avec des actions CRUD simples (`addMechanic`, `moveUse`,
  `updateMechanic`… l.336-345). `importFightFromLog` (l.446-568) **écrase** `mechanics`
  + `uses` à chaque import — c'est un remplacement total, pas une fusion.
- **Undo/redo** : [`historyManager.ts`](../../web/src/state/historyManager.ts) snapshote
  les 7 slices persistables par **égalité de référence** (l.69-77). Toute nouvelle slice
  top-level doit être ajoutée ici, sinon undo l'ignore.
- **Autosave** : [`AutoSaver.tsx`](../../web/src/components/AutoSaver.tsx) PATCH tout le
  blob 1 s après la dernière édition (l.63-71). Le tableau de deps de l'effet (l.90) liste
  chaque slice — toute nouvelle slice doit y être ajoutée.
- **Persistance DO** : [`plan-do.ts`](../../do-worker/src/plan-do.ts) `handlePatch`
  (l.82-108) fait un **merge shallow champ-à-champ** : `mechanics: patch.mechanics ??
  current.mechanics`. Il backfill les champs manquants des plans legacy (`level`,
  `phases ?? []` l.103). **Toute nouvelle clé top-level doit être ajoutée explicitement
  ici**, sinon le PATCH la jette.

### 2.3 La primitive `phases` comme précédent

`phases` est le modèle à suivre pour toute extension : c'est un **tableau optionnel
top-level** (`phases?: Phase[]`) ajouté après coup, avec backfill `?? []` partout
(DO l.103, store `hydratePlan` l.806, init l.74). Annotation pure, zéro impact coverage.
Tout ajout multi-pull devrait copier ce patron de migration : **optionnel + backfill,
jamais de champ requis qui casserait les plans existants.**

### 2.4 Contraintes transverses à respecter

| Contrainte | Source | Impact multi-pull |
|---|---|---|
| Duplication 3× des types | CLAUDE.md, 3 fichiers `_types`/`types` | Tout nouveau champ = 3 éditions synchrones |
| Merge shallow du DO | [`plan-do.ts`](../../do-worker/src/plan-do.ts) l.95-104 | Nouvelle clé top-level → ajouter au merge + backfill |
| Snapshot par référence | [`historyManager.ts`](../../web/src/state/historyManager.ts) l.44-55, 69-77 | Nouvelle slice → ajouter à `capture()` + au compare |
| Deps autosave | [`AutoSaver.tsx`](../../web/src/components/AutoSaver.tsx) l.90 | Nouvelle slice → ajouter au tableau de deps |
| 8 slots fixes p1..p8 | [`planStore.ts`](../../web/src/state/planStore.ts) l.31, 91 | Les variantes partagent la même party |
| Pas de border-radius | CLAUDE.md | Toute UI variante reste angulaire |

---

## 3. Trois approches

Convention commune : on appelle **« variante »** un pattern de pull (A, B, C…).
Les trois approches diffèrent par *où* vit la divergence dans le data-model.

### Approche (a) — Variantes de pull nommées dans un même plan, avec overrides

**Idée.** Le plan garde un jeu **« base »** de `mechanics` + `uses` (le tronc commun),
et porte une liste de **variantes** ; chaque variante ne stocke que ses **deltas** par
rapport à la base (mécas ajoutées/retirées/déplacées, uses spécifiques).

```ts
interface PullVariant {
  id: string;
  name: string;                 // "Pattern #1", "Add NE", "P2 cleave gauche"…
  color?: string;               // teinte de l'overlay A/B/C
  // Deltas vs la base. Absent partout = variante == base.
  mech_overrides?: {
    added?: Mechanic[];         // mécas propres à cette variante
    removed_ids?: string[];     // mécas de base masquées dans cette variante
    patched?: Record<string, Partial<Mechanic>>;  // mech.id -> patch (time, targets…)
  };
  use_overrides?: {
    added?: Use[];
    removed_ids?: string[];
    patched?: Record<string, Partial<Use>>;
  };
}

interface Plan {
  // … existant …
  mechanics: Mechanic[];        // = la BASE (tronc commun)
  uses: Use[];                  // = la BASE
  variants?: PullVariant[];     // optionnel, backfill [] (patron `phases`)
  active_variant_id?: string;   // variante affichée (UI-state, peut rester hors persistance)
}
```

**Résolution.** Une fonction pure `resolvePlan(plan, variantId): { mechanics, uses }`
applique les deltas sur la base avant de la passer à `computeCoverage` (qui ne change
pas — elle reçoit juste le `uses[]` résolu). Le « commun vs divergent » se dérive :
une méca/use dans `mechanics`/`uses` base = commune ; dans un `*_overrides` = divergente.

**Migration.** Triviale : `variants ?? []`, `active_variant_id` ignoré si absent.
Patron `phases` exact. Plans existants = une seule variante implicite (la base).

**Impact transverse.**
- Types : +`PullVariant` dans les 3 fichiers.
- DO : ajouter `variants: patch.variants ?? current.variants ?? []` au merge (l.95-104).
- Snapshot + autosave : ajouter `variants` (et éventuellement `active_variant_id` si persisté).
- Coverage : **inchangé**, on lui passe le résultat de `resolvePlan`.
- Store : actions `addVariant`, `renameVariant`, `setActiveVariant`, et router les
  CRUD existants (`addMechanic`, `moveUse`…) vers la base **ou** la variante active.
  C'est le vrai coût : chaque mutation doit savoir « est-ce que j'édite la base ou un override ? ».

**Tradeoffs.**
- ➕ Un seul plan/slug. Tronc commun explicite = exactement la demande (« commun vs divergent »).
- ➕ Coverage par variante gratuit (resolve → calc existant).
- ➕ Robuste face à R1/R2 : pas d'auto-matching, l'utilisateur décide ce qui diverge.
- ➖ Complexité store : le routage base/override touche **toutes** les actions de mutation.
- ➖ Edge case : si une méca **de base** est supprimée, il faut nettoyer les `patched`/`removed_ids`
  qui la référencent dans chaque variante (intégrité référentielle à maintenir à la main).
- ➖ Sémantique « patched » subtile à exposer en UI sans confondre l'utilisateur (R3).

### Approche (b) — Import multi-log + auto-diff

**Idée.** Étendre [`importFightFromLog`](../../web/src/state/planStore.ts) l.446-568
pour ingérer **plusieurs** logs, aligner les mécas par fenêtre ±10 s, moyenner les
sorts stables et marquer les divergents A/B/C en transparence.

```ts
interface ImportedPull { source_url: string; mechanics: Mechanic[]; uses: Use[]; }
// diff: aligner par (name|game_id, time±10s) -> mech "stable" si présente partout,
// sinon mech "divergente" rattachée à la variante du log d'origine.
```

**Migration.** Le *résultat* d'un diff peut très bien se matérialiser dans le modèle
de l'approche (a) (base = mécas stables, variantes = divergences). Donc (b) n'est pas
un modèle concurrent : c'est **un générateur de (a)**.

**Tradeoffs.**
- ➕ « Magique » si ça marche : zéro saisie manuelle.
- ➖ **R1 (timer de départ) frontal.** FFLogs n'expose pas un `t=0` canonique aligné
  entre pulls ; il faut un ancrage (1er cast du boss ? 1er dégât raidwide ?) et ça
  reste fragile. Sans ancrage fiable, le ±10 s matche n'importe quoi.
- ➖ **R2 (phasing par debuffs) casse le matching.** Dès qu'une phase démarre sur un
  compteur de debuffs, le décalage temporel se cumule sur toute la suite du log →
  faux positifs/négatifs en cascade.
- ➖ **R3** : un diff automatique faux est *pire* qu'une saisie manuelle — l'utilisateur
  doit auditer/corriger, donc on lui doit quand même l'UI d'édition de variantes.
- ➖ Gros chantier (parsing, heuristiques d'alignement, gestion d'erreurs) pour un
  résultat non garanti. **Mauvais ratio risque/valeur en premier jet.**

### Approche (c) — Liaison manuelle de « mécas alternatives » (A/B) sur la timeline existante

**Idée.** Pas de variantes globales. On enrichit `Mechanic` pour qu'une méca puisse
déclarer des **alternatives mutuellement exclusives** au même instant.

```ts
interface Mechanic {
  // … existant …
  alt_group_id?: string;   // mécas partageant le même alt_group sont des "OU"
  alt_label?: string;      // "A", "B", "C" — badge affiché
}
```

Toutes les mécas d'un même `alt_group_id` occupent le même créneau ; l'UI les empile
avec des badges A/B/C et un sélecteur pour « voir la branche A ». Les `uses` restent
un seul jeu plat.

**Migration.** La plus légère : deux champs optionnels sur `Mechanic`, aucun nouveau
top-level, **rien à toucher dans le merge DO** (les mécas voyagent déjà). Backfill nul.

**Tradeoffs.**
- ➕ Coût data-model quasi nul, undo/autosave/DO inchangés (champs portés par `Mechanic`).
- ➕ Colle bien à la formulation « cette méca OU cette autre ».
- ➖ Ne couvre **pas** les *uses* divergents : si la branche A demande Reprisal et la
  branche B demande Feint au même instant, le modèle ne sait pas dire « ce CD n'existe
  que dans la branche B ». Or c'est *tout l'intérêt* (mapper les CDs sur plusieurs pulls).
- ➖ Coverage ambigu : `computeCoverage` sommerait les uses des deux branches au même
  instant → faux. Il faudrait filtrer les uses par branche active, ce qui réintroduit
  une notion de variante… donc on glisse vers (a) par la petite porte.
- ➖ Ne scale pas au-delà de divergences ponctuelles. Une vraie divergence de *phase*
  (R2) n'est pas « une méca OU une autre » mais « toute une sous-timeline ».

---

## 4. Recommandation : MVP incrémental vers (a), en s'appuyant sur `phases`

### 4.1 Pourquoi (a)

- C'est la seule approche qui répond aux **deux** demandes (commun **et** divergent,
  mécas **et** CDs). (c) ne gère pas les uses divergents ; (b) ne produit qu'un *contenu*
  pour (a), pas un modèle.
- Elle est **robuste face à R1/R2 par construction** : aucune dépendance à un alignement
  temporel automatique. L'utilisateur déclare lui-même ce qui diverge — ce qui est aussi
  ce que la statique fait déjà mentalement.
- Elle réutilise `computeCoverage` **sans le modifier** : on résout, puis on calcule.
- Sa migration copie le patron `phases` (optionnel + backfill), déjà éprouvé partout.

(b) est séduisant mais c'est le **plus risqué pour le moins de valeur garantie** : à
remettre à plus tard comme *générateur* de variantes (a), une fois (a) en place et stable.
(c) est un sous-ensemble de (a) qui se révèle insuffisant dès qu'on regarde les uses.

### 4.2 MVP en 3 incréments

Le piège de (a) est le routage base/override dans **toutes** les mutations du store
(§3a). On l'évite avec une montée en charge progressive :

**Incrément 1 — Variantes « full-copy » (pas d'overrides).**
Une variante stocke son **propre `mechanics[]` + `uses[]` complets**, pas des deltas.

```ts
interface PullVariant {
  id: string;
  name: string;
  mechanics: Mechanic[];
  uses: Use[];
}
interface Plan {
  // mechanics/uses top-level = variante 0 (rétro-compat : c'est "la base")
  variants?: PullVariant[];      // variantes 1..n, backfill []
}
```

- Création d'une variante = `structuredClone` de la variante courante (« dupliquer ce pull »).
- **Zéro routage conditionnel** : on swappe juste *quel* `{mechanics, uses}` est actif
  dans le store. Les actions CRUD existantes opèrent sur la variante active, telles quelles.
- Coverage : inchangé, on lui passe le `uses[]` de la variante active.
- Coût : faible. Risque : faible. Couvre déjà « mapper les CDs sur plusieurs pulls ».
- Limite assumée : duplication de données (une méca commune existe en N copies) → le
  « commun vs divergent » n'est pas encore *calculé*, juste *organisé*.

**Incrément 2 — Vue « diff » (lecture seule, calculée).**
Sans toucher au stockage de l'inc. 1, on **dérive** le commun vs divergent par une
fonction pure :

```ts
// commun = mécas présentes (par game_id|name + time±tol) dans TOUTES les variantes
// divergent = le reste, étiqueté par variante d'origine
function diffVariants(variants: PullVariant[]): { common: Mechanic[]; divergent: Map<string, Mechanic[]> }
```

C'est la pièce visuelle réclamée (« voir ce qui est commun vs divergent »), purement
calculée et testable en `node --test` (helper pur dans `web/src/lib/`, cf. CLAUDE.md
workflow §1). Les sorts stables s'affichent pleins, les divergents en transparence
avec un badge de variante — **exactement l'idée (I1)**, mais alimentée par de la saisie
manuelle fiable plutôt que par un auto-diff fragile.

**Incrément 3 (optionnel, plus tard) — Compaction en overrides + import multi-log.**
Si la duplication devient gênante, migrer le stockage vers le modèle deltas du §3a
(base + overrides), la vue diff de l'inc. 2 servant de spec de référence. C'est aussi
le moment de brancher (b) : un import multi-log produit directement des variantes,
et le diff existant fait le tri stable/divergent. R1/R2 restent gérés par une étape
de **validation manuelle** (l'utilisateur confirme/ajuste l'alignement) — pas d'auto-magie aveugle.

### 4.3 Articulation avec `phases` (déjà livré)

`phases` reste **orthogonal et complémentaire** : les phases découpent UNE timeline
horizontalement (P1 | P2 | INTER), les variantes empilent PLUSIEURS timelines pour le
même découpage. Pour R2 (phasing par debuffs), on peut **ancrer une variante sur une
phase** plutôt que sur `t=0` : « à partir de P2, voici le pattern B ». Concrètement,
une évolution future de `PullVariant` pourrait porter un `from_phase_id?` pour ne
diverger qu'à partir d'un marqueur — ce qui contourne proprement R1/R2 puisqu'on
raisonne en phases nommées, pas en secondes absolues. À garder en réserve, hors MVP.

---

## 5. Esquisse d'UI (approche recommandée, incréments 1-2)

### 5.1 Barre de variantes (au-dessus de la timeline)

```
┌──────────────────────────────────────────────────────────────────────┐
│  PULLS:  [ Pattern #1 ]  [ Pattern #2 ]  [ + ]      ◧ DIFF   ⤢ EMPILÉ │
│            ▔▔▔▔▔▔▔▔▔▔ (actif)                                          │
└──────────────────────────────────────────────────────────────────────┘
```

- Onglets angulaires (pas de border-radius, cf. CLAUDE.md), couleur d'accent par variante.
- `[ + ]` = « Dupliquer le pull actif » (full-copy, inc. 1).
- Double-clic sur un onglet = renommer (réutilise le pattern de
  [`PhaseNameEditor`](../../web/src/components/timeline/PhaseMarkers.tsx) l.94-125).
- Clic-droit = supprimer la variante.
- Toggle **DIFF** = bascule en vue calculée (inc. 2).
- Toggle **EMPILÉ** = superpose les variantes (vue avancée, post-MVP).

### 5.2 Vue normale (une variante active)

La timeline est **identique à aujourd'hui** — on a juste changé quel `{mechanics, uses}`
elle affiche. Zéro régression visuelle, R3 maîtrisé (on ne superpose rien par défaut).

### 5.3 Vue DIFF (lecture seule, inc. 2)

```
        0:00        1:00        2:00        3:00
BOSS A  │   ◆共通    ◆共通      ◆共通                     ← mécas communes (plein)
        │                   ┌─[A]─◇ Cleave G  (transparent, badge variante)
        │                   └─[B]─◇ Cleave D
─────────────────────────────────────────────────────────
MT PLD  │  ▭Rampart   ▭共通                              ← uses communs (plein)
        │                   ┌─[A]─▱ Reprisal
        │                   └─[B]─▱ Feint
```

- **Plein** = présent dans toutes les variantes (« commun »).
- **Transparent + badge `[A]`/`[B]`** = divergent, code couleur = variante (idée I1).
- Survol d'un élément divergent = tooltip « présent uniquement dans Pattern #2 ».
- Cette vue ne mute rien : pour éditer, l'utilisateur revient sur l'onglet de la variante.

### 5.4 Indicateur de couverture

Le panneau coverage existant tourne **par variante active** (resolve → `computeCoverage`).
En vue DIFF, on peut afficher un mini-récap « couverture A : 78 % · B : 81 % » pour
repérer un pattern sous-mité. Aucune modif de la fonction de calcul.

---

## 6. Synthèse

| Critère | (a) Variantes+overrides | (b) Import multi-log auto-diff | (c) Mécas alt A/B |
|---|---|---|---|
| Couvre mécas **et** uses divergents | ✅ | ✅ (si le diff marche) | ❌ (uses non gérés) |
| Robuste R1 (timer départ) | ✅ (manuel) | ❌ | ✅ |
| Robuste R2 (phasing debuffs) | ✅ (via phases) | ❌ | ⚠️ ponctuel |
| Coût data-model | Moyen | Élevé | Faible |
| Coverage réutilisé tel quel | ✅ | ✅ | ❌ (filtrage à ajouter) |
| Migration plans existants | Triviale (patron `phases`) | Triviale | Triviale |
| Risque UI (R3) | Maîtrisable | Élevé | Faible |
| Valeur garantie au 1er jet | ✅ | ⚠️ incertaine | partielle |

**Recommandation : approche (a), livrée en MVP incrémental** —
inc. 1 (variantes full-copy) → inc. 2 (vue diff calculée) → inc. 3 (overrides + import
multi-log en réserve). `phases` reste la primitive d'ancrage pour neutraliser R1/R2.
(b) est repositionné comme *générateur* de variantes (a), pas comme modèle ;
(c) est un sous-ensemble de (a) insuffisant sur les uses.

### Prochaines étapes (si validé)

1. **Valider l'approche (a) et le découpage en incréments** avant tout code
   (décision structurelle — cf. consigne « confirmer les choix d'architecture »).
2. Inc. 1 : ajouter `variants?: PullVariant[]` aux **3** `_types`/`types`, au merge DO
   (l.95-104), au `capture()`/compare de l'historique, aux deps de l'autosave.
3. Helper pur `diffVariants` + tests `node --test` dans `web/src/lib/` (inc. 2).
4. UI barre de variantes + vue DIFF.

> ⚠️ Tout ce qui précède est une **proposition de design**. Rien n'est implémenté ;
> les schémas de types sont illustratifs et à arbitrer avant d'écrire la moindre ligne
> de production.
