import { useMemo } from 'react';
import type { Job, Player } from '../../types';
import { JobIcon } from '../Icon';
import { MitChip } from './MitChip';

interface PlayerCardProps {
  player: Player;
  job: Job | undefined;
}

export function PlayerCard({ player, job }: PlayerCardProps) {
  const role = job?.role ?? 'dps';

  // Sort abilities by recast desc — longest CDs first like the mockup.
  const sortedAbilities = useMemo(
    () => (job ? [...job.abilities].sort((a, b) => b.recast - a.recast) : []),
    [job],
  );

  return (
    <div className={`player-card-mini role-${role}`}>
      <div className="pcm-head">
        <div className="pcm-job-icon">
          {job ? <JobIcon src={job.icon} fallbackCode={job.code} alt={job.name} /> : null}
        </div>
        <div className="pcm-info">
          <div className="pcm-name" title={player.name}>{player.name}</div>
          <div className="pcm-badge">{player.badge}</div>
        </div>
      </div>
      <div className="pcm-chips">
        {sortedAbilities.map((ab) => (
          <MitChip key={ab.id} playerId={player.id} ability={ab} />
        ))}
      </div>
    </div>
  );
}
