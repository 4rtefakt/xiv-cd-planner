import type { Player } from '../types';

/**
 * Default 8-player party used when the planner starts with no slug.
 * Names are deliberately generic (matching the slot's role tag) so the
 * planner ships without prior commitment to a specific raid roster.
 * The user renames each player by clicking the name on their card,
 * or wipes the whole party via the "+ IMPORT PARTY" modal.
 */
export const demoParty: Player[] = [
  { id: 'p1', name: 'Tank 1',    job: 'PLD', badge: 'MT' },
  { id: 'p2', name: 'Tank 2',    job: 'WAR', badge: 'OT' },
  { id: 'p3', name: 'Healer 1',  job: 'WHM', badge: 'H1' },
  { id: 'p4', name: 'Healer 2',  job: 'SCH', badge: 'H2' },
  { id: 'p5', name: 'Melee 1',   job: 'SAM', badge: 'M1' },
  { id: 'p6', name: 'Melee 2',   job: 'DRG', badge: 'M2' },
  { id: 'p7', name: 'Ranged 1',  job: 'BRD', badge: 'R1' },
  { id: 'p8', name: 'Ranged 2',  job: 'BLM', badge: 'R2' },
];
