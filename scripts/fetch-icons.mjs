#!/usr/bin/env node
/**
 * fetch-icons.mjs — idempotent vendoring of FFXIV job + ability icons.
 *
 * - Job SVGs from github.com/xivapi/classjob-icons (master/svg/*.svg)
 * - Ability PNGs from xivapi.com/i/<folder>/<id>.png (official transparent PNGs)
 *
 * Reads the list of jobs from seed/data.json and the list of abilities from
 * each job's `abilities[].icon` field. Skips downloads if the destination
 * file already exists. Outputs a summary at the end.
 *
 * Usage:
 *   npm run fetch:icons
 *
 * Exit code 0 even if some fetches fail — failures are listed for manual
 * follow-up so the script can be re-run safely.
 */

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const SEED_PATH = resolve(REPO_ROOT, 'seed/data.json');
const JOB_ICON_DIR = resolve(REPO_ROOT, 'web/public/icons/jobs');
const ABILITY_ICON_DIR = resolve(REPO_ROOT, 'web/public/icons/abilities');

const JOB_ICON_BASE = 'https://raw.githubusercontent.com/xivapi/classjob-icons/master/svg';
const ABILITY_ICON_FALLBACK = 'https://xivapi.com/i';

async function exists(path) {
  try {
    await access(path, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function downloadIfMissing(url, destPath) {
  if (await exists(destPath)) return { url, destPath, status: 'skipped' };

  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) return { url, destPath, status: 'failed', reason: `HTTP ${res.status}` };
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(destPath, buf);
    return { url, destPath, status: 'downloaded', bytes: buf.length };
  } catch (e) {
    return { url, destPath, status: 'failed', reason: e?.message ?? String(e) };
  }
}

function summarize(results, label) {
  const downloaded = results.filter(r => r.status === 'downloaded').length;
  const skipped = results.filter(r => r.status === 'skipped').length;
  const failed = results.filter(r => r.status === 'failed');
  console.log(`  ${label}: downloaded=${downloaded} skipped=${skipped} failed=${failed.length}`);
  if (failed.length) {
    for (const f of failed) {
      console.log(`    ✗ ${f.url} → ${f.destPath}  (${f.reason})`);
    }
  }
}

async function main() {
  await mkdir(JOB_ICON_DIR, { recursive: true });
  await mkdir(ABILITY_ICON_DIR, { recursive: true });

  const raw = await readFile(SEED_PATH, 'utf8');
  const data = JSON.parse(raw);
  if (!Array.isArray(data.jobs) || data.jobs.length === 0) {
    console.warn('⚠ seed/data.json has no jobs yet — populate it before running this script.');
    process.exit(0);
  }

  // --- Jobs ---
  console.log(`Fetching job icons (${data.jobs.length})…`);
  const jobResults = await Promise.all(
    data.jobs.map(j =>
      downloadIfMissing(`${JOB_ICON_BASE}/${j.code}.svg`, resolve(JOB_ICON_DIR, `${j.code}.svg`)),
    ),
  );
  summarize(jobResults, 'Jobs');

  // --- Abilities ---
  const allAbilities = data.jobs.flatMap(j => j.abilities ?? []);
  // Filter to those declaring an `icon_remote` path (e.g. "002000/002562.png")
  // Use icon_remote field for the source; the local file lives at
  // /icons/abilities/<id>.png matching the `icon` field in seed.
  const abilityFetches = allAbilities
    .filter(a => a.icon_remote)
    .map(a => ({
      url: `${ABILITY_ICON_FALLBACK}/${a.icon_remote}`,
      destPath: resolve(REPO_ROOT, 'web/public' + a.icon),
    }));

  console.log(`Fetching ability icons (${abilityFetches.length})…`);
  const abilityResults = [];
  // Sequential with small batches to be nice to xivapi
  const BATCH = 4;
  for (let i = 0; i < abilityFetches.length; i += BATCH) {
    const chunk = abilityFetches.slice(i, i + BATCH);
    const batch = await Promise.all(chunk.map(f => downloadIfMissing(f.url, f.destPath)));
    abilityResults.push(...batch);
  }
  summarize(abilityResults, 'Abilities');

  const totalFailed =
    jobResults.filter(r => r.status === 'failed').length +
    abilityResults.filter(r => r.status === 'failed').length;
  console.log(totalFailed ? `Done with ${totalFailed} failures — re-run to retry.` : 'Done.');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
