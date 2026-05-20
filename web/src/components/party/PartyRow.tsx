import { useMemo } from 'react';
import { usePlanStore } from '../../state/planStore';
import { PlayerCard } from './PlayerCard';

export function PartyRow() {
  const party = usePlanStore((s) => s.party);
  const jobs = usePlanStore((s) => s.jobs);

  const jobByCode = useMemo(() => {
    const map = new Map<string, typeof jobs[number]>();
    for (const j of jobs) map.set(j.code, j);
    return map;
  }, [jobs]);

  return (
    <div className="party-row">
      {party.map((p) => (
        <PlayerCard key={p.id} player={p} job={jobByCode.get(p.job)} />
      ))}
    </div>
  );
}
