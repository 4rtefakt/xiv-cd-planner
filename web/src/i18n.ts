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
    'enc.mechs':            'MECHS',
    'enc.assigns':          'ASSIGNS',
    // Timeline toolbar
    'tl.quickAdd':          'QUICK-ADD MECH',
    'tl.raidwide':          'RAIDWIDE',
    'tl.tankbuster':        'TANKBUSTER',
    'tl.autos':             'AUTOS',
    'tl.placement':         'PLACEMENT',
    'tl.lanes':             'LANES',
    'tl.addLane':           'ADD BOSS LANE',
    'tl.reset':             '◆ RESET',
    'tl.resetConfirm':      'Reset all mechanics and assignments?',
    'tl.view':              'VIEW',
    'tl.view.damage':       'DAMAGE',
    'tl.view.placement':    'PLACEMENT',
    'tl.view.showDamage':   'Show damage mechs',
    'tl.view.hideDamage':   'Hide damage mechs',
    'tl.view.showPlacement':'Show placement mechs',
    'tl.view.hidePlacement':'Hide placement mechs',
    // Mechanic modal
    'mech.addTitle':        '◆ ADD MECHANIC',
    'mech.editTitle':       '◆ EDIT MECHANIC',
    'mech.name':            'Name',
    'mech.namePlaceholder': 'e.g. Brutal Impact',
    'mech.timestamp':       'Timestamp',
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
    // Boss lane
    'lane.rename':          'Rename lane',
    'lane.remove':          'Remove lane',
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
    'enc.mechs':            'MÉCAS',
    'enc.assigns':          'PLACÉS',
    'tl.quickAdd':          'AJOUT RAPIDE MÉCA',
    'tl.raidwide':          'RAIDWIDE',
    'tl.tankbuster':        'TANKBUSTER',
    'tl.autos':             'AUTOS',
    'tl.placement':         'PLACEMENT',
    'tl.lanes':             'LANES',
    'tl.addLane':           'AJOUTER LANE BOSS',
    'tl.reset':             '◆ RÉINIT.',
    'tl.resetConfirm':      'Effacer toutes les mécas et placements ?',
    'tl.view':              'VOIR',
    'tl.view.damage':       'DÉGÂTS',
    'tl.view.placement':    'PLACEMENT',
    'tl.view.showDamage':   'Afficher les mécas de dégâts',
    'tl.view.hideDamage':   'Cacher les mécas de dégâts',
    'tl.view.showPlacement':'Afficher les mécas de placement',
    'tl.view.hidePlacement':'Cacher les mécas de placement',
    'mech.addTitle':        '◆ AJOUTER MÉCA',
    'mech.editTitle':       '◆ ÉDITER MÉCA',
    'mech.name':            'Nom',
    'mech.namePlaceholder': 'ex. Brutal Impact',
    'mech.timestamp':       'Horodatage',
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
    'lane.rename':          'Renommer la lane',
    'lane.remove':          'Supprimer la lane',
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
