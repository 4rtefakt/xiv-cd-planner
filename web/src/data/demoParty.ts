import type { Player } from '../types';

/**
 * Default 8-player party used when the planner starts with no slug.
 * Names/badges mirror the V0.4 mockup demo so visual parity is immediate.
 * Replace via the (future) "Import party" modal.
 */
export const demoParty: Player[] = [
  { id: 'p1', name: 'Galaxonno', job: 'PLD', badge: 'MT' },
  { id: 'p2', name: 'Fuh Zuki',  job: 'WAR', badge: 'OT' },
  { id: 'p3', name: "Rhesh'a",   job: 'WHM', badge: 'H1' },
  { id: 'p4', name: 'Onyxis',    job: 'SCH', badge: 'H2' },
  { id: 'p5', name: 'Silaron',   job: 'SAM', badge: 'M1' },
  { id: 'p6', name: 'Laura',     job: 'DRG', badge: 'M2' },
  { id: 'p7', name: 'Bonnemine', job: 'BRD', badge: 'R1' },
  { id: 'p8', name: 'Sionra',    job: 'BLM', badge: 'R2' },
];
