/**
 * Minimal i18n — no external dependency, no JSX magic.
 *
 * Usage :
 *   const t = useT();
 *   <button>{t('header.new')}</button>
 *
 * Add a new key by adding it under BOTH `en` and `fr`. Missing keys
 * silently fall back to the English string (or the key itself).
 *
 * Job codes, badge codes (MT/OT/H1/…), mech-kind glyphs (P/M/✕/◇),
 * and the cyberpunk all-caps labels of FFXIV-canonical mechanic types
 * (RAIDWIDE / TANKBUSTER / AUTOS) stay in English in both languages —
 * they're shorthand the raid community uses regardless of locale.
 */

import { usePlanStore } from './state/planStore';

export type Lang = 'fr' | 'en';

const messages = {
  en: {
    // Header
    'header.new':           '+ NEW',
    'header.importParty':   '+ IMPORT PARTY',
    'header.importLog':     '+ IMPORT LOG',
    'header.copyEdit':      '⟁ EDIT',
    'header.copyView':      '⟁ VIEW',
    'header.copied':        '✓ COPIED',
    'header.editMode':      '✎ EDIT',
    'header.titleNew':      'Start a fresh plan',
    'header.titleImport':   'Paste a JSON party',
    'header.titleImportLog':'Import mechanics from FFLogs',
    'header.titleCopyEdit': 'Copy editable link',
    'header.titleCopyView': 'Copy read-only link',
    'header.titleEditMode': 'Switch to edit mode',
    // Save status pill
    'save.saving':          '● SAVING',
    'save.saved':           '● SAVED',
    'save.error':           '✕ ERROR',
    'save.idle':            '○ IDLE',
    'save.readonly':        '◇ READ-ONLY',
    // Section titles
    'section.party.title':  'ENCOUNTER & PARTY',
    'section.party.meta1':  'BLIND-PROG MODE',
    'section.party.meta2':  '8 PLAYERS',
    'section.party.meta3':  '{n} JOBS',
    'section.timeline.title':'TIMELINE',
    'section.timeline.help':'CLICK BOSS LANE → ADD MECHANIC / DRAG CHIP → DROP ON ABILITY ROW',
    // Encounter fields
    'enc.fightName':        'FIGHT NAME',
    'enc.duration':         'DURATION (S)',
    'enc.ilvl':             'ILVL',
    'enc.level':            'LEVEL',
    'enc.mechs':            'MECHS',
    'enc.assigns':          'ASSIGNS',
    // Ability hide affordance
    'ability.hide':         'Hide for this room',
    'ability.unhide':       'Show again',
    'ability.hiddenHint':   'Right-click an ability to hide / show it for this room',
    'ability.lockedAtLevel':'Unlocks at lvl {n}',
    // Timeline toolbar
    'tl.quickAdd':          'QUICK-ADD MECH',
    'tl.raidwide':          'RAIDWIDE',
    'tl.tankbuster':        'TANKBUSTER',
    'tl.autos':             'AUTOS',
    'tl.placement':         'PLACEMENT',
    'tl.lanes':             'LANES',
    'tl.addLane':           'ADD BOSS LANE',
    'tl.addPhase':          'ADD PHASE',
    'tl.addPhase.hint':     'Add a phase marker (drag its label to move it, double-click to rename, right-click to remove)',
    'tl.reset':             '◆ RESET',
    'tl.resetConfirm':      'Reset all mechanics and assignments?',
    'tl.view':              'VIEW',
    'tl.view.damage':       'DAMAGE',
    'tl.view.placement':    'PLACEMENT',
    'tl.view.showDamage':   'Show damage mechs',
    'tl.view.hideDamage':   'Hide damage mechs',
    'tl.view.showPlacement':'Show placement mechs',
    'tl.view.hidePlacement':'Hide placement mechs',
    'tl.view.compact':      'COMPACT',
    'tl.view.compact.on':   'Compact boss mechs (icons only, hover for name)',
    'tl.view.compact.off':  'Expand boss mech labels back',
    // Mechanic modal
    'mech.addTitle':        '◆ ADD MECHANIC',
    'mech.editTitle':       '◆ EDIT MECHANIC',
    'mech.name':            'Name',
    'mech.namePlaceholder': 'e.g. Brutal Impact',
    'mech.lane':            'Boss lane',
    'mech.timestamp':       'Timestamp',
    'mech.castTime':        'Cast time (s)',
    'mech.castTime.hint':   '0 = instant. The cast bar extends backwards from the impact time.',
    'mech.category':        'Category',
    'mech.cat.damage':      'DAMAGE',
    'mech.cat.damage.help': 'Deals damage to one or more players',
    'mech.cat.placement':   'PLACEMENT',
    'mech.cat.placement.help':'Positional cue — no damage to mitigate',
    'mech.damageKind':      'Damage Kind',
    'mech.kind.physical':   'PHYSICAL',
    'mech.kind.magical':    'MAGICAL',
    'mech.kind.pure':       'PURE',
    'mech.kind.pure.help':  'Cannot be mitigated',
    'mech.targets':         'Targets',
    'mech.targetsShortcut.all':    'ALL',
    'mech.targetsShortcut.tanks':  'TANKS',
    'mech.targetsShortcut.heals':  'HEALS',
    'mech.targetsShortcut.melee':  'MELEE',
    'mech.targetsShortcut.ranged': 'RANGED',
    'mech.targetsShortcut.lp1':    'LIGHT 1',
    'mech.targetsShortcut.lp2':    'LIGHT 2',
    'mech.tags':            'Tags',
    'mech.tags.hint':       'Readability labels (TB, RB, share, …) shown next to the mech name',
    'mech.tags.placeholder':'+ custom',
    'mech.tags.removeHint': 'Remove this tag',
    // Modal generic buttons
    'btn.cancel':           'CANCEL',
    'btn.confirm':          'CONFIRM',
    'btn.save':             'SAVE',
    'btn.delete':           'DELETE',
    'btn.import':           'IMPORT',
    'btn.load':             'LOAD',
    // Import party
    'imp.party.title':      '◆ IMPORT PARTY',
    'imp.party.label':      'JSON',
    // Import log
    'imp.log.title':        '◆ IMPORT FROM FFLOGS',
    'imp.log.urlLabel':     'FFLogs URL or report code',
    'imp.log.urlPlaceholder':'https://www.fflogs.com/reports/abcDEF123',
    'imp.log.loadingFight': 'Loading fight events…',
    'imp.log.previewMech':  '{n} mechanic',
    'imp.log.previewMechs': '{n} mechanics',
    'imp.log.previewLane':  '{n} lane',
    'imp.log.previewLanes': '{n} lanes',
    'imp.log.in':           'in',
    'imp.log.more':         '… +{n} more',
    'imp.log.targetsHint':  'Targets are mapped heuristically : full party → raidwide, single hit → MT. Anything in between leaves targets empty so you can fill them in by clicking the mech in the timeline.',
    'imp.log.noFights':     'No encounter fights in this report.',
    'imp.log.noMechsTitle': 'No mechs found in this fight (very short pull or parse miss)',
    // Player card tooltips
    'player.changeJob':     'Change job',
    'player.clickRename':   'Click to rename',
    'player.pickerLabel':   'CHANGE JOB',
    'player.moveLeft':      'Swap with the previous slot (badge stays on the slot)',
    'player.moveRight':     'Swap with the next slot (badge stays on the slot)',
    // Boss lane
    'lane.rename':          'Rename lane',
    'lane.remove':          'Remove lane',
    'lane.merge':           'Merge into another lane',
    'lane.mergePicker':     'MERGE INTO',
    'lane.mergeNoTargets':  'No other lane to merge with',
    'lane.moveUp':          'Move lane up',
    'lane.moveDown':        'Move lane down',
    // Phase markers
    'phase.hint':           'drag to move · double-click to rename · right-click to remove',
    // Mech marker
    'mech.remove':          'Remove',
    'mech.removeUse':       'Remove',
    // App-loading / error
    'app.loadingJobs':      'Loading jobs…',
    'app.failJobs':         'Failed to load jobs: {msg} — did you run `npm run seed:kv -- --local`?',
    // Lang toggle itself
    'lang.toggle':          'Switch to French',
  },
  fr: {
    'header.new':           '+ NOUVEAU',
    'header.importParty':   '+ IMPORTER ÉQUIPE',
    'header.importLog':     '+ IMPORTER LOG',
    'header.copyEdit':      '⟁ ÉDITION',
    'header.copyView':      '⟁ LECTURE',
    'header.copied':        '✓ COPIÉ',
    'header.editMode':      '✎ ÉDITER',
    'header.titleNew':      'Repartir d\'un plan vierge',
    'header.titleImport':   'Coller un JSON d\'équipe',
    'header.titleImportLog':'Importer les mechs depuis FFLogs',
    'header.titleCopyEdit': 'Copier le lien éditable',
    'header.titleCopyView': 'Copier le lien lecture seule',
    'header.titleEditMode': 'Repasser en mode édition',
    'save.saving':          '● SAUVEGARDE',
    'save.saved':           '● ENREGISTRÉ',
    'save.error':           '✕ ERREUR',
    'save.idle':            '○ INACTIF',
    'save.readonly':        '◇ LECTURE SEULE',
    'section.party.title':  'COMBAT & ÉQUIPE',
    'section.party.meta1':  'MODE BLIND-PROG',
    'section.party.meta2':  '8 JOUEURS',
    'section.party.meta3':  '{n} JOBS',
    'section.timeline.title':'TIMELINE',
    'section.timeline.help':'CLIC SUR LA LANE BOSS → AJOUTER MÉCA / DRAG CHIP → DROP SUR LIGNE ABILITY',
    'enc.fightName':        'NOM DU COMBAT',
    'enc.duration':         'DURÉE (S)',
    'enc.ilvl':             'ILVL',
    'enc.level':            'NIVEAU',
    'enc.mechs':            'MÉCAS',
    'enc.assigns':          'PLACÉS',
    'ability.hide':         'Cacher pour cette room',
    'ability.unhide':       'Réafficher',
    'ability.hiddenHint':   'Clic-droit sur une ability pour la cacher / réafficher dans cette room',
    'ability.lockedAtLevel':'Débloqué au niveau {n}',
    'tl.quickAdd':          'AJOUT RAPIDE MÉCA',
    'tl.raidwide':          'RAIDWIDE',
    'tl.tankbuster':        'TANKBUSTER',
    'tl.autos':             'AUTOS',
    'tl.placement':         'PLACEMENT',
    'tl.lanes':             'LANES',
    'tl.addLane':           'AJOUTER LANE BOSS',
    'tl.addPhase':          'AJOUTER PHASE',
    'tl.addPhase.hint':     'Ajoute un marqueur de phase (glisser le label pour le déplacer, double-clic pour renommer, clic droit pour supprimer)',
    'tl.reset':             '◆ RÉINIT.',
    'tl.resetConfirm':      'Effacer toutes les mécas et placements ?',
    'tl.view':              'VOIR',
    'tl.view.damage':       'DÉGÂTS',
    'tl.view.placement':    'PLACEMENT',
    'tl.view.showDamage':   'Afficher les mécas de dégâts',
    'tl.view.hideDamage':   'Cacher les mécas de dégâts',
    'tl.view.showPlacement':'Afficher les mécas de placement',
    'tl.view.hidePlacement':'Cacher les mécas de placement',
    'tl.view.compact':      'COMPACT',
    'tl.view.compact.on':   'Compacter les mécas (icônes seulement, nom au hover)',
    'tl.view.compact.off':  'Réafficher les labels complets',
    'mech.addTitle':        '◆ AJOUTER MÉCA',
    'mech.editTitle':       '◆ ÉDITER MÉCA',
    'mech.name':            'Nom',
    'mech.namePlaceholder': 'ex. Brutal Impact',
    'mech.lane':            'Lane boss',
    'mech.timestamp':       'Horodatage',
    'mech.castTime':        'Temps de cast (s)',
    'mech.castTime.hint':   '0 = instantané. La barre de cast s\'étend en arrière depuis le moment d\'impact.',
    'mech.category':        'Catégorie',
    'mech.cat.damage':      'DÉGÂTS',
    'mech.cat.damage.help': 'Inflige des dégâts à un ou plusieurs joueurs',
    'mech.cat.placement':   'PLACEMENT',
    'mech.cat.placement.help':'Indication de position — pas de dégâts à mit',
    'mech.damageKind':      'Type de dégâts',
    'mech.kind.physical':   'PHYSIQUE',
    'mech.kind.magical':    'MAGIQUE',
    'mech.kind.pure':       'PURE',
    'mech.kind.pure.help':  'Non-mitigeable',
    'mech.targets':         'Cibles',
    'mech.targetsShortcut.all':    'TOUT',
    'mech.targetsShortcut.tanks':  'TANKS',
    'mech.targetsShortcut.heals':  'HEALS',
    'mech.targetsShortcut.melee':  'MELEE',
    'mech.targetsShortcut.ranged': 'RANGED',
    'mech.targetsShortcut.lp1':    'LIGHT 1',
    'mech.targetsShortcut.lp2':    'LIGHT 2',
    'mech.tags':            'Tags',
    'mech.tags.hint':       'Labels de lisibilité (TB, RB, share, …) affichés à côté du nom de la méca',
    'mech.tags.placeholder':'+ perso',
    'mech.tags.removeHint': 'Retirer ce tag',
    'btn.cancel':           'ANNULER',
    'btn.confirm':          'CONFIRMER',
    'btn.save':             'ENREGISTRER',
    'btn.delete':           'SUPPRIMER',
    'btn.import':           'IMPORTER',
    'btn.load':             'CHARGER',
    'imp.party.title':      '◆ IMPORTER ÉQUIPE',
    'imp.party.label':      'JSON',
    'imp.log.title':        '◆ IMPORTER DEPUIS FFLOGS',
    'imp.log.urlLabel':     'URL FFLogs ou code de report',
    'imp.log.urlPlaceholder':'https://www.fflogs.com/reports/abcDEF123',
    'imp.log.loadingFight': 'Chargement des events…',
    'imp.log.previewMech':  '{n} méca',
    'imp.log.previewMechs': '{n} mécas',
    'imp.log.previewLane':  '{n} lane',
    'imp.log.previewLanes': '{n} lanes',
    'imp.log.in':           'sur',
    'imp.log.more':         '… +{n} de plus',
    'imp.log.targetsHint':  'Les cibles sont mappées heuristiquement : équipe complète → raidwide, hit unique → MT. Les cas intermédiaires laissent les cibles vides ; tu les remplis ensuite en cliquant sur la méca dans la timeline.',
    'imp.log.noFights':     'Aucun combat dans ce report.',
    'imp.log.noMechsTitle': 'Aucune méca trouvée (pull très courte ou parse loupé)',
    'player.changeJob':     'Changer de job',
    'player.clickRename':   'Cliquer pour renommer',
    'player.pickerLabel':   'CHANGER DE JOB',
    'player.moveLeft':      'Échanger avec le slot précédent (le badge reste sur le slot)',
    'player.moveRight':     'Échanger avec le slot suivant (le badge reste sur le slot)',
    'lane.rename':          'Renommer la lane',
    'lane.remove':          'Supprimer la lane',
    'lane.merge':           'Fusionner dans une autre lane',
    'lane.mergePicker':     'FUSIONNER DANS',
    'lane.mergeNoTargets':  'Pas d\'autre lane à fusionner',
    'lane.moveUp':          'Monter la lane',
    'lane.moveDown':        'Descendre la lane',
    'phase.hint':           'glisser pour déplacer · double-clic pour renommer · clic droit pour supprimer',
    'mech.remove':          'Supprimer',
    'mech.removeUse':       'Supprimer',
    'app.loadingJobs':      'Chargement des jobs…',
    'app.failJobs':         'Échec du chargement des jobs : {msg} — as-tu lancé `npm run seed:kv -- --local` ?',
    'lang.toggle':          'Passer en anglais',
  },
} as const;

type MessageKey = keyof typeof messages.en;

/**
 * Returns the localized string. If the key is missing in the chosen
 * lang, falls back to English, then to the raw key.
 *
 * Interpolation : `{name}` placeholders are replaced from the optional
 * `vars` argument. e.g. `t('imp.log.more', {n: 12})` → "… +12 more".
 */
export function translate(key: MessageKey, lang: Lang, vars?: Record<string, string | number>): string {
  const raw = (messages[lang] as Record<string, string>)[key]
    ?? (messages.en as Record<string, string>)[key]
    ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? `{${name}}`));
}

/**
 * React hook bound to planStore.lang. Re-renders the calling component
 * when the user switches languages.
 */
export function useT(): (key: MessageKey, vars?: Record<string, string | number>) => string {
  const lang = usePlanStore((s) => s.lang);
  return (key, vars) => translate(key, lang, vars);
}

/** Persist + reload the user's language preference across sessions. */
const STORAGE_KEY = 'cooldown-planner.lang';

export function loadStoredLang(): Lang {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === 'fr' || v === 'en') return v;
  } catch {
    /* localStorage might be disabled (private mode, sandboxed iframe). */
  }
  // Default : detect from the browser, prefer FR for francophone users.
  if (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('fr')) return 'fr';
  return 'en';
}

export function storeLang(lang: Lang): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* ignore */
  }
}

/**
 * Pick the localized name of an ability or a job. Falls back to the
 * English `name` field if `name_fr` isn't set on the entry (which
 * shouldn't happen on a fresh seed — scripts/fetch-fr-names.mjs fills
 * them all in).
 */
export function abilityName(ab: { name: string; name_fr?: string }, lang: Lang): string {
  return lang === 'fr' && ab.name_fr ? ab.name_fr : ab.name;
}
export function jobName(job: { name: string; name_fr?: string }, lang: Lang): string {
  return lang === 'fr' && job.name_fr ? job.name_fr : job.name;
}

/**
 * Build the player-row tooltip string with the right localization for
 * both the ability label and the descriptors ("recast", "effect",
 * "personal", "magic only", …). Centralised so PlayerGroups and any
 * other consumer stay in sync.
 */
export function abilityTooltip(ab: {
  name: string;
  name_fr?: string;
  recast: number;
  effect: number;
  mit_type: string;
  mit_potency: number;
  mit_kind?: string;
}, lang: Lang): string {
  const name = abilityName(ab, lang);
  const recast = lang === 'fr' ? 'récupé' : 'recast';
  const effect = lang === 'fr' ? 'durée' : 'effect';
  const type =
    lang === 'fr'
      ? { personal: 'personnel', party: 'équipe', heal: 'soin' }[ab.mit_type] ?? ab.mit_type
      : ab.mit_type;
  const kindSuffix = ab.mit_kind && ab.mit_kind !== 'all'
    ? (lang === 'fr'
        ? ` (${ab.mit_kind === 'physical' ? 'physique' : 'magique'} uniquement)`
        : ` (${ab.mit_kind} only)`)
    : '';
  return `${name} · ${ab.recast}s ${recast} · ${ab.effect}s ${effect} · ${ab.mit_potency}% ${type}${kindSuffix}`;
}
