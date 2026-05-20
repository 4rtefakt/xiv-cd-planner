#!/usr/bin/env node
/**
 * find-icon-ids.mjs — one-shot data plumbing tool.
 *
 * Reads seed/data.json + a local copy of Action.csv (from
 * xivapi/ffxiv-datamining) and produces a mapping
 *    ability.id → { action_id, icon_id, icon_path }
 *
 * The match is by ability `name`, picking the first row whose
 * Recast100ms matches the seed's `recast` (×10). If no exact recast
 * match, falls back to the first row by name.
 *
 * Usage:
 *   curl -sS -o /tmp/action.csv \\
 *     https://raw.githubusercontent.com/xivapi/ffxiv-datamining/master/csv/en/Action.csv
 *   node scripts/find-icon-ids.mjs /tmp/action.csv > /tmp/ability-icons.json
 *
 * Then a small sed/jq pass injects the icon paths back into seed/data.json.
 */

import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

const csvPath = process.argv[2];
if (!csvPath) {
  console.error('usage: node scripts/find-icon-ids.mjs <path-to-Action.csv>');
  process.exit(2);
}

// Tiny CSV-row parser — handles double-quote-escaped fields with commas.
function parseRow(line) {
  const out = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuote) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQuote = false;
      else cur += c;
    } else {
      if (c === '"') inQuote = true;
      else if (c === ',') { out.push(cur); cur = ''; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

function iconPath(iconId) {
  const id = Number(iconId);
  if (!Number.isFinite(id) || id <= 0) return null;
  const folder = String(Math.floor(id / 1000) * 1000).padStart(6, '0');
  const file = String(id).padStart(6, '0');
  return `/i/${folder}/${file}.png`;
}

const seed = JSON.parse(await readFile(resolve(REPO_ROOT, 'seed/data.json'), 'utf8'));
const csv = await readFile(csvPath, 'utf8');
const lines = csv.split(/\r?\n/);

// Skip the 3 header rows that ffxiv-datamining emits (col names, types, key).
const dataLines = lines.slice(3).filter(l => l.length > 0);

// Build name → [{id, icon, recast100, level}] index for fast lookup.
const byName = new Map();
for (const raw of dataLines) {
  const cells = parseRow(raw);
  const id = Number(cells[0]);
  const name = cells[1];
  const icon = Number(cells[3]);
  const recast100 = Number(cells[10]);
  const level = Number(cells[21]);
  if (!name || !icon) continue;
  if (!byName.has(name)) byName.set(name, []);
  byName.get(name).push({ id, icon, recast100, level });
}

const out = {};
const misses = [];
for (const job of seed.jobs) {
  for (const ab of job.abilities) {
    // Try the seed's name first; if that misses, try a few fallbacks.
    const candidates = byName.get(ab.name) || [];
    // Prefer exact recast match (recast100 / 10 === seed.recast)
    let pick =
      candidates.find(c => Math.abs(c.recast100 / 10 - ab.recast) < 0.5 && c.level > 0) ||
      candidates.find(c => c.level > 0) ||
      candidates[0];
    if (!pick) {
      misses.push({ id: ab.id, name: ab.name });
      continue;
    }
    out[ab.id] = {
      action_id: pick.id,
      icon_id: pick.icon,
      icon_path: iconPath(pick.icon),
      level: pick.level,
      recast_csv_s: pick.recast100 / 10,
    };
  }
}

process.stdout.write(JSON.stringify({ matches: out, misses }, null, 2));
process.stderr.write(`matched ${Object.keys(out).length}, missed ${misses.length}\n`);
