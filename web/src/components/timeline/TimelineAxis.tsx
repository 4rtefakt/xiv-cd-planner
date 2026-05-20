import { useMemo } from 'react';
import { fmt, pct } from '../../lib/time';

interface TimelineAxisProps {
  fightDuration: number;
}

export function TimelineAxis({ fightDuration }: TimelineAxisProps) {
  const { ticks, labels } = useMemo(() => {
    const step = fightDuration > 300 ? 30 : 15;
    const major = fightDuration > 300 ? 60 : 30;
    const ticksOut: Array<{ t: number; isMajor: boolean }> = [];
    const labelsOut: Array<{ t: number; label: string }> = [];
    for (let t = 0; t <= fightDuration; t += step) {
      const isMajor = t % major === 0;
      ticksOut.push({ t, isMajor });
      if (isMajor) labelsOut.push({ t, label: fmt(t) });
    }
    return { ticks: ticksOut, labels: labelsOut };
  }, [fightDuration]);

  return (
    <div className="tl-axis">
      {ticks.map(({ t, isMajor }) => (
        <div
          key={`tick-${t}`}
          className={`tl-tick ${isMajor ? 'major' : 'minor'}`}
          style={{ left: `${pct(t, fightDuration)}%` }}
        />
      ))}
      {labels.map(({ t, label }) => (
        <div
          key={`label-${t}`}
          className="tl-tick-label"
          style={{ left: `${pct(t, fightDuration)}%` }}
        >
          {label}
        </div>
      ))}
    </div>
  );
}
