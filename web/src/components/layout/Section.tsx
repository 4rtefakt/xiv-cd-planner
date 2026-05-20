import type { ReactNode } from 'react';

interface SectionProps {
  num: string;       // "01", "02"
  title: string;     // "ENCOUNTER & PARTY"
  meta?: ReactNode;  // optional right-aligned meta line
  children: ReactNode;
}

export function Section({ num, title, meta, children }: SectionProps) {
  return (
    <section className="section">
      <div className="section-header">
        <div className="section-num">{num}</div>
        <div className="section-title">{title}</div>
        {meta != null && <div className="section-meta">{meta}</div>}
      </div>
      {children}
    </section>
  );
}
