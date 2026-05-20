import { useEffect, useRef, useState } from 'react';
import type { Job, Player } from '../../types';
import { JobIcon } from '../Icon';
import { usePlanStore } from '../../state/planStore';

interface PlayerCardProps {
  player: Player;
  job: Job | undefined;
}

/**
 * Section 01 party card — header-only display, with inline name edit
 * and a job-picker popover.
 *
 * Name : click on the name → editable input ; Enter / blur saves ; Esc
 * cancels. The original value is restored on cancel.
 *
 * Job : click on the job icon → popover with same-role alternatives
 * available in the seed. Picking remaps the player's uses by ability
 * name (shared abilities survive, job-specific ones drop).
 */
export function PlayerCard({ player, job }: PlayerCardProps) {
  const role = job?.role ?? 'dps';
  const jobs = usePlanStore((s) => s.jobs);
  const setPlayerName = usePlanStore((s) => s.setPlayerName);
  const switchPlayerJob = usePlanStore((s) => s.switchPlayerJob);

  const [editingName, setEditingName] = useState(false);
  const [draft, setDraft] = useState(player.name);
  const [picking, setPicking] = useState(false);

  return (
    <div className={`player-card-mini role-${role}`}>
      <div className="pcm-head">
        <div
          className="pcm-job-icon pcm-job-icon-editable"
          role="button"
          tabIndex={0}
          title="Change job"
          onClick={(e) => {
            e.stopPropagation();
            setPicking((v) => !v);
          }}
        >
          {job ? <JobIcon src={job.icon} fallbackCode={job.code} alt={job.name} /> : null}
        </div>
        <div className="pcm-info">
          {editingName ? (
            <NameEditor
              initial={draft}
              onCancel={() => {
                setEditingName(false);
                setDraft(player.name);
              }}
              onSave={(v) => {
                const trimmed = v.trim() || player.name;
                setPlayerName(player.id, trimmed);
                setDraft(trimmed);
                setEditingName(false);
              }}
            />
          ) : (
            <div
              className="pcm-name pcm-name-editable"
              role="button"
              tabIndex={0}
              title="Click to rename"
              onClick={() => {
                setDraft(player.name);
                setEditingName(true);
              }}
            >
              {player.name}
            </div>
          )}
          <div className="pcm-badge">{player.badge}</div>
        </div>
      </div>

      {picking && job && (
        <JobPickerPopover
          currentJob={job}
          allJobs={jobs}
          onClose={() => setPicking(false)}
          onPick={(code) => {
            switchPlayerJob(player.id, code);
            setPicking(false);
          }}
        />
      )}
    </div>
  );
}

function NameEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: string;
  onSave: (v: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  return (
    <input
      ref={ref}
      className="pcm-name-input"
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSave(value);
        else if (e.key === 'Escape') onCancel();
      }}
      onBlur={() => onSave(value)}
      maxLength={20}
    />
  );
}

function JobPickerPopover({
  currentJob,
  allJobs,
  onClose,
  onPick,
}: {
  currentJob: Job;
  allJobs: Job[];
  onClose: () => void;
  onPick: (code: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Filter: tank↔tank and heal↔heal use the broad role. DPS splits into
  // melee / phys_ranged / magic_ranged via sub_role, since a Samurai
  // raid slot can't be filled by a Bard or a Black Mage.
  const options =
    currentJob.role === 'dps'
      ? allJobs.filter((j) => j.role === 'dps' && j.sub_role === currentJob.sub_role)
      : allJobs.filter((j) => j.role === currentJob.role);

  // Dismiss on outside click + Escape.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    // Defer so the opening click doesn't immediately close.
    const t = setTimeout(() => document.addEventListener('click', onDoc), 0);
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener('click', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div ref={ref} className="job-picker-pop">
      <div className="job-picker-label">CHANGE JOB</div>
      <div className="job-picker-grid">
        {options.map((j) => (
          <button
            key={j.code}
            type="button"
            className={`job-picker-opt${j.code === currentJob.code ? ' selected' : ''}`}
            onClick={() => onPick(j.code)}
            title={j.name}
          >
            <JobIcon src={j.icon} fallbackCode={j.code} alt={j.name} />
            <span className="job-picker-code">{j.code}</span>
          </button>
        ))}
      </div>
      {options.length === 1 && (
        <div className="job-picker-empty">
          No other {currentJob.role} jobs in the seed yet.
        </div>
      )}
    </div>
  );
}
