import { useEffect } from 'react';
import { Header } from './components/layout/Header';
import { Section } from './components/layout/Section';
import { Footer } from './components/layout/Footer';
import { EncounterFields } from './components/encounter/EncounterFields';
import { PartyRow } from './components/party/PartyRow';
import { TimelineShell } from './components/timeline/TimelineShell';
import { AddMechanicModal } from './components/modals/AddMechanicModal';
import { usePlanStore } from './state/planStore';
import { api } from './api/client';
import './styles/components.css';

export function App() {
  const jobsLoading = usePlanStore((s) => s.jobsLoading);
  const jobsError = usePlanStore((s) => s.jobsError);
  const jobsCount = usePlanStore((s) => s.jobs.length);
  const setJobs = usePlanStore((s) => s.setJobs);
  const setJobsError = usePlanStore((s) => s.setJobsError);
  const setJobsLoading = usePlanStore((s) => s.setJobsLoading);

  useEffect(() => {
    let cancelled = false;
    setJobsLoading(true);
    api
      .jobs()
      .then((r) => {
        if (!cancelled) setJobs(r.jobs);
      })
      .catch((err) => {
        if (!cancelled) setJobsError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [setJobs, setJobsError, setJobsLoading]);

  return (
    <div className="app">
      <Header />

      {jobsLoading && <div className="app-loading">Loading jobs…</div>}
      {jobsError && (
        <div className="app-error">
          Failed to load jobs: {jobsError} — did you run `npm run seed:kv -- --local`?
        </div>
      )}

      {jobsCount > 0 && (
        <>
          <Section
            num="01"
            title="ENCOUNTER & PARTY"
            meta={
              <>
                BLIND-PROG MODE <span className="sep">/</span> 8 PLAYERS{' '}
                <span className="sep">/</span> {jobsCount} JOBS
              </>
            }
          >
            <EncounterFields />
            <PartyRow />
          </Section>

          <Section
            num="02"
            title="TIMELINE"
            meta={
              <>
                CLICK BOSS LANE → ADD MECHANIC <span className="sep">/</span> DRAG CHIP → DROP ON ABILITY ROW
              </>
            }
          >
            <TimelineShell />
          </Section>
        </>
      )}

      <Footer />
      <AddMechanicModal />
    </div>
  );
}
