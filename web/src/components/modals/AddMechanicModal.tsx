import { useEffect, useRef, useState } from 'react';
import type { DamageKind, MechCategory, Player } from '../../types';
import { fmt, parseTime } from '../../lib/time';
import { usePlanStore } from '../../state/planStore';
import { useT } from '../../i18n';

const CATEGORY_KEYS: MechCategory[] = ['damage', 'placement', 'cast'];
const DAMAGE_KINDS: DamageKind[] = ['physical', 'magical', 'pure'];

/** Common raid-callout tags offered as one-click toggles. Free text is
 *  accepted too — these are a convenience, not a whitelist. */
const PRESET_TAGS = ['TB', 'RB', 'SHARE', 'SPREAD', 'BAIT', 'KB'];
const TAG_MAX_LEN = 12;

let mechSeq = 0;

/**
 * Mechanic editor — opens for both creating (click on empty boss lane,
 * or quick-add button) and editing (click on an existing mech marker).
 *
 * Mode is driven by planStore.mechanicModal.mode :
 *   - 'create' : confirm calls addMechanic
 *   - 'edit'   : confirm calls updateMechanic(id, …); DELETE button
 *                shows as a third footer action
 */
export function AddMechanicModal() {
  const modal = usePlanStore((s) => s.mechanicModal);
  const fightDuration = usePlanStore((s) => s.encounter.fight_duration);
  const party = usePlanStore((s) => s.party);
  const bossLanes = usePlanStore((s) => s.bossLanes);
  const setMechanicModal = usePlanStore((s) => s.setMechanicModal);
  const close = usePlanStore((s) => s.closeMechanicModal);
  const addMechanic = usePlanStore((s) => s.addMechanic);
  const updateMechanic = usePlanStore((s) => s.updateMechanic);
  const removeMechanic = usePlanStore((s) => s.removeMechanic);
  const t = useT();

  const [name, setName] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [castTimeStr, setCastTimeStr] = useState('0');
  const [category, setCategory] = useState<MechCategory>('damage');
  const [damageKind, setDamageKind] = useState<DamageKind>('magical');
  const [targets, setTargets] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  // Sync local form state from the store every time the modal opens.
  useEffect(() => {
    if (!modal) return;
    setName(modal.name);
    setTimeStr(fmt(modal.time));
    setCastTimeStr(String(modal.cast_time ?? 0));
    setCategory(modal.category);
    setDamageKind(modal.damage_kind);
    setTargets(modal.targets);
    setTags(modal.tags ?? []);
    setTagDraft('');
    const t = setTimeout(() => nameRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [modal]);

  function toggleTag(tag: string) {
    setTags((cur) => (cur.includes(tag) ? cur.filter((x) => x !== tag) : [...cur, tag]));
  }
  function commitTagDraft() {
    const tag = tagDraft.trim().toUpperCase().slice(0, TAG_MAX_LEN);
    setTagDraft('');
    if (!tag) return;
    setTags((cur) => (cur.includes(tag) ? cur : [...cur, tag]));
  }

  useEffect(() => {
    if (!modal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'Enter') confirm();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modal, name, timeStr, castTimeStr, category, damageKind, targets, tags]);

  if (!modal) return null;

  const isEdit = modal.mode === 'edit';

  function confirm() {
    if (!modal) return;
    const t = Math.max(0, Math.min(fightDuration, parseTime(timeStr)));
    const finalName = (name.trim() || 'UNNAMED').toUpperCase();
    // Only damage mechs carry targets ; placement + cast are
    // non-mitigable cues with no one to "hit".
    const effectiveTargets = category === 'damage' ? targets : [];
    // Cast time : parsed as a positive float, clamped to [0, time] so
    // the cast bar can't start before the fight does. 0 → undefined to
    // keep the stored mechanic small for instant casts.
    const parsedCast = parseFloat(castTimeStr.replace(',', '.'));
    const castClamped = Number.isFinite(parsedCast) ? Math.max(0, Math.min(t, parsedCast)) : 0;
    const finalCastTime = castClamped > 0 ? castClamped : undefined;

    if (isEdit && modal.mechanicId) {
      // The field was pre-filled with the LOCALIZED name. Only persist a
      // rename when the user actually edited it — otherwise saving a FR
      // display name into `name` would clobber the EN one. A real rename
      // clears name_fr : the custom name wins in both languages.
      const state = usePlanStore.getState();
      const orig = state.mechanics.find((m) => m.id === modal.mechanicId);
      const origDisplay = orig
        ? (state.lang === 'fr' && orig.name_fr ? orig.name_fr : orig.name).toUpperCase()
        : undefined;
      const renamed = orig ? finalName !== origDisplay : true;
      updateMechanic(modal.mechanicId, {
        lane_id: modal.laneId,
        name: renamed ? finalName : orig!.name,
        ...(renamed ? { name_fr: undefined } : {}),
        time: t,
        category,
        targets: effectiveTargets,
        damage_kind: category === 'damage' ? damageKind : undefined,
        cast_time: finalCastTime,
        tags: tags.length > 0 ? tags : undefined,
      });
    } else {
      addMechanic({
        id: `mech-${Date.now()}-${++mechSeq}`,
        lane_id: modal.laneId,
        name: finalName,
        time: t,
        category,
        targets: effectiveTargets,
        damage_kind: category === 'damage' ? damageKind : undefined,
        cast_time: finalCastTime,
        tags: tags.length > 0 ? tags : undefined,
      });
    }
    close();
  }

  function deleteAndClose() {
    if (isEdit && modal?.mechanicId) {
      removeMechanic(modal.mechanicId);
      close();
    }
  }

  return (
    <div
      className="modal-backdrop show"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          {isEdit ? t('mech.editTitle') : t('mech.addTitle')}
        </div>
        <div className="modal-body">
          <div className="modal-row">
            <label className="modal-label">{t('mech.name')}</label>
            <input
              ref={nameRef}
              className="modal-input"
              type="text"
              placeholder={t('mech.namePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          {/* Lane selector — only when editing AND several lanes exist :
              FFLogs sometimes attributes a cast to the wrong actor, so
              the user must be able to re-home a mech. */}
          {isEdit && bossLanes.length > 1 && (
            <div className="modal-row">
              <label className="modal-label">{t('mech.lane')}</label>
              <select
                className="modal-input"
                value={modal.laneId}
                onChange={(e) => setMechanicModal({ laneId: e.target.value })}
              >
                {bossLanes.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="modal-row">
            <label className="modal-label">{t('mech.timestamp')}</label>
            <input
              className="modal-input"
              type="text"
              placeholder="0:00"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
              value={timeStr}
              onChange={(e) => setTimeStr(e.target.value)}
            />
          </div>

          <div className="modal-row">
            <label className="modal-label" title={t('mech.castTime.hint')}>
              {t('mech.castTime')}
            </label>
            <input
              className="modal-input"
              type="number"
              min={0}
              step={0.1}
              placeholder="0"
              style={{ fontFamily: "'JetBrains Mono', monospace", width: 100 }}
              value={castTimeStr}
              onChange={(e) => setCastTimeStr(e.target.value)}
              title={t('mech.castTime.hint')}
            />
          </div>

          <div className="modal-row">
            <label className="modal-label">{t('mech.category')}</label>
            <div className="category-grid">
              {CATEGORY_KEYS.map((key) => {
                const label = t(`mech.cat.${key}` as 'mech.cat.damage' | 'mech.cat.placement' | 'mech.cat.cast');
                const help = t(`mech.cat.${key}.help` as 'mech.cat.damage.help' | 'mech.cat.placement.help' | 'mech.cat.cast.help');
                return (
                  <div
                    key={key}
                    className={`category-opt c-${key}${category === key ? ' selected' : ''}`}
                    onClick={() => setCategory(key)}
                    title={help}
                  >
                    <div className="category-label">{label}</div>
                    <div className="category-help">{help}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {category === 'damage' && (
            <>
              <div className="modal-row">
                <label className="modal-label">{t('mech.damageKind')}</label>
                <div className="kind-grid">
                  {DAMAGE_KINDS.map((key) => (
                    <div
                      key={key}
                      className={`kind-opt k-${key}${damageKind === key ? ' selected' : ''}`}
                      onClick={() => setDamageKind(key)}
                      title={key === 'pure' ? t('mech.kind.pure.help') : ''}
                    >
                      {t(`mech.kind.${key}` as 'mech.kind.physical' | 'mech.kind.magical' | 'mech.kind.pure')}
                    </div>
                  ))}
                </div>
              </div>

              <div className="modal-row">
                <label className="modal-label">
                  {t('mech.targets')} ({targets.length}/{party.length})
                </label>
                <TargetsPicker party={party} targets={targets} onChange={setTargets} />
              </div>
            </>
          )}

          <div className="modal-row">
            <label className="modal-label" title={t('mech.tags.hint')}>{t('mech.tags')}</label>
            <div className="tags-picker">
              {PRESET_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={`tag-opt${tags.includes(tag) ? ' on' : ''}`}
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </button>
              ))}
              {/* Custom (non-preset) tags appear as removable chips. */}
              {tags
                .filter((tag) => !PRESET_TAGS.includes(tag))
                .map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className="tag-opt on tag-custom"
                    title={t('mech.tags.removeHint')}
                    onClick={() => toggleTag(tag)}
                  >
                    {tag} ×
                  </button>
                ))}
              <input
                className="tags-input"
                type="text"
                placeholder={t('mech.tags.placeholder')}
                maxLength={TAG_MAX_LEN}
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    // Swallow the modal-level Enter→confirm shortcut :
                    // Enter in this field just commits the tag.
                    e.preventDefault();
                    e.stopPropagation();
                    commitTagDraft();
                  }
                }}
                onBlur={commitTagDraft}
              />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          {isEdit && (
            <button
              type="button"
              className="modal-btn modal-btn-danger"
              onClick={deleteAndClose}
            >
              {t('btn.delete')}
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button type="button" className="modal-btn" onClick={close}>{t('btn.cancel')}</button>
          <button type="button" className="modal-btn primary" onClick={confirm}>
            {isEdit ? t('btn.save') : t('btn.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Per-mechanic targets picker. Shortcuts (top row) snap the selection
 * to common subsets; the per-player chips toggle individually.
 */
function TargetsPicker({
  party,
  targets,
  onChange,
}: {
  party: Player[];
  targets: string[];
  onChange: (next: string[]) => void;
}) {
  const t = useT();
  const tanks  = party.filter((p) => p.badge === 'MT' || p.badge === 'OT');
  const heals  = party.filter((p) => p.badge === 'H1' || p.badge === 'H2');
  const melee  = party.filter((p) => p.badge === 'M1' || p.badge === 'M2');
  const ranged = party.filter((p) => p.badge === 'R1' || p.badge === 'R2');
  // Light parties — the canonical 4-4 split for stack/spread mechs.
  const LP1_BADGES = ['MT', 'H1', 'M1', 'R1'];
  const LP2_BADGES = ['OT', 'H2', 'M2', 'R2'];
  const lp1 = party.filter((p) => LP1_BADGES.includes(p.badge));
  const lp2 = party.filter((p) => LP2_BADGES.includes(p.badge));

  // Render the grid as LP1 on top, LP2 on bottom :
  //   [MT] [H1] [M1] [R1]
  //   [OT] [H2] [M2] [R2]
  // This mirrors the standard FFXIV party-split convention and makes
  // toggling per-role pairs (MT+OT, H1+H2…) a column-wise gesture.
  const GRID_ORDER = [...LP1_BADGES, ...LP2_BADGES];
  const ordered = [...party].sort(
    (a, b) => GRID_ORDER.indexOf(a.badge) - GRID_ORDER.indexOf(b.badge),
  );

  function setIds(ids: string[]) {
    onChange(ids);
  }
  function toggle(id: string) {
    onChange(targets.includes(id) ? targets.filter((x) => x !== id) : [...targets, id]);
  }

  return (
    <div className="targets-picker">
      <div className="targets-shortcuts">
        <button type="button" className="targets-shortcut" onClick={() => setIds(party.map((p) => p.id))}>
          {t('mech.targetsShortcut.all')}
        </button>
        <button type="button" className="targets-shortcut" onClick={() => setIds(tanks.map((p) => p.id))}>
          {t('mech.targetsShortcut.tanks')}
        </button>
        <button type="button" className="targets-shortcut" onClick={() => setIds(heals.map((p) => p.id))}>
          {t('mech.targetsShortcut.heals')}
        </button>
        <button type="button" className="targets-shortcut" onClick={() => setIds(melee.map((p) => p.id))}>
          {t('mech.targetsShortcut.melee')}
        </button>
        <button type="button" className="targets-shortcut" onClick={() => setIds(ranged.map((p) => p.id))}>
          {t('mech.targetsShortcut.ranged')}
        </button>
        <button type="button" className="targets-shortcut" onClick={() => setIds(lp1.map((p) => p.id))} title="MT · H1 · M1 · R1">
          {t('mech.targetsShortcut.lp1')}
        </button>
        <button type="button" className="targets-shortcut" onClick={() => setIds(lp2.map((p) => p.id))} title="OT · H2 · M2 · R2">
          {t('mech.targetsShortcut.lp2')}
        </button>
      </div>
      <div className="targets-grid">
        {ordered.map((p) => {
          const on = targets.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              className={`target-chip${on ? ' on' : ''}`}
              onClick={() => toggle(p.id)}
              title={p.name}
            >
              <span className="target-chip-badge">{p.badge}</span>
              <span className="target-chip-name">{p.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
