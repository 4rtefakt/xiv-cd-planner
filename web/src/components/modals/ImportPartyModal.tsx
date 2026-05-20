import { useEffect, useRef, useState } from 'react';
import type { Player } from '../../types';
import { usePlanStore } from '../../state/planStore';

const BADGES = ['MT', 'OT', 'H1', 'H2', 'M1', 'M2', 'R1', 'R2'] as const;
type Badge = (typeof BADGES)[number];

/**
 * Two accepted input shapes :
 *   [{name, job, badge}, ...]          // 8-element array
 *   {players: [{name, job, badge}, ...]} // wrapped form (bootstrap doc)
 *
 * Plus a friendly extension:
 *   {MT: 'PLD', OT: 'WAR', H1: 'WHM', ...}  // badge→job map (names auto)
 *
 * The function returns a Player[] with IDs p1..p8 in BADGES order, so
 * existing uses keep mapping correctly to MT/OT/H1/… by index.
 */
function parseInput(raw: string): { players: Player[]; warning?: string } | { error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return { error: `JSON parse error: ${(e as Error).message}` };
  }

  // Shape detection
  let rawPlayers: Array<{ name?: string; job?: string; badge?: string }> | null = null;
  if (Array.isArray(parsed)) rawPlayers = parsed as any;
  else if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.players)) rawPlayers = obj.players as any;
    else {
      // badge→job shortcut
      const candidates: Array<{ name?: string; job?: string; badge?: string }> = [];
      for (const b of BADGES) {
        const v = obj[b];
        if (typeof v === 'string') candidates.push({ badge: b, job: v });
        else if (v && typeof v === 'object' && 'job' in v) {
          const vo = v as Record<string, unknown>;
          candidates.push({ badge: b, job: String(vo.job ?? ''), name: typeof vo.name === 'string' ? vo.name : undefined });
        }
      }
      if (candidates.length > 0) rawPlayers = candidates;
    }
  }

  if (!rawPlayers || rawPlayers.length === 0) {
    return { error: 'Expected an array of players or {players: [...]} or {MT: "PLD", OT: "WAR", ...}.' };
  }
  if (rawPlayers.length !== 8) {
    return { error: `Expected 8 players, got ${rawPlayers.length}.` };
  }

  // Validate + normalize
  const seenBadges = new Set<Badge>();
  const players: Player[] = [];
  for (let i = 0; i < rawPlayers.length; i++) {
    const r = rawPlayers[i];
    const badge = (r?.badge ?? '').toUpperCase() as Badge;
    if (!BADGES.includes(badge)) {
      return { error: `Player #${i + 1}: invalid badge "${r?.badge}". Expected one of ${BADGES.join(', ')}.` };
    }
    if (seenBadges.has(badge)) return { error: `Duplicate badge: ${badge}.` };
    seenBadges.add(badge);
    const job = (r?.job ?? '').toUpperCase().trim();
    if (!job) return { error: `Player #${i + 1} (${badge}): missing job code.` };
    const name = (r?.name ?? '').trim() || badge;
    players.push({ id: `p${i + 1}`, name, badge, job });
  }

  // Sort to BADGES order so id p1..p8 maps to MT/OT/.../R2 consistently.
  players.sort((a, b) => BADGES.indexOf(a.badge as Badge) - BADGES.indexOf(b.badge as Badge));
  // Re-id by position.
  for (let i = 0; i < players.length; i++) players[i].id = `p${i + 1}`;

  return { players };
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ImportPartyModal({ open, onClose }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const importParty = usePlanStore((s) => s.importParty);

  useEffect(() => {
    if (!open) return;
    setText('');
    setError(null);
    const t = setTimeout(() => ref.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  function confirm() {
    const result = parseInput(text);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    importParty(result.players);
    onClose();
  }

  const placeholder = JSON.stringify(
    [
      { name: 'Galaxonno', job: 'PLD', badge: 'MT' },
      { name: 'Fuh Zuki', job: 'WAR', badge: 'OT' },
      { name: 'Soa Naya', job: 'WHM', badge: 'H1' },
      { name: 'Tito Renn', job: 'SCH', badge: 'H2' },
      { name: 'Silaron', job: 'SAM', badge: 'M1' },
      { name: 'Aoun Rhonu', job: 'DRG', badge: 'M2' },
      { name: 'Ifo Pana', job: 'BRD', badge: 'R1' },
      { name: 'Maru Iko', job: 'BLM', badge: 'R2' },
    ],
    null,
    2,
  );

  return (
    <div
      className="modal-backdrop show"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">◆ IMPORT PARTY</div>
        <div className="modal-body">
          <div className="modal-row">
            <label className="modal-label">JSON</label>
            <textarea
              ref={ref}
              className="modal-input modal-textarea"
              placeholder={placeholder}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (error) setError(null);
              }}
              rows={14}
              spellCheck={false}
            />
          </div>
          {error && <div className="modal-error">{error}</div>}
          <div className="modal-hint">
            Accepted shapes: <code>[{`{name,job,badge}`}…]</code>,{' '}
            <code>{`{players:[…]}`}</code>, or shortcut{' '}
            <code>{`{MT:"PLD",OT:"WAR",H1:"WHM",…}`}</code>. Uses are
            kept where the new job has an ability with the same name.
          </div>
        </div>
        <div className="modal-footer">
          <div style={{ flex: 1 }} />
          <button type="button" className="modal-btn" onClick={onClose}>CANCEL</button>
          <button type="button" className="modal-btn primary" onClick={confirm}>IMPORT</button>
        </div>
      </div>
    </div>
  );
}
