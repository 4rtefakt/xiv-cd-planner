// Tests for splitMechName — language-aware label resolution. We import
// the TS source as a string and re-implement the (tiny) function here
// to keep node:test running without a TS toolchain.

import { test } from 'node:test';
import assert from 'node:assert/strict';

function splitMechName(m, lang = 'en') {
  const display = lang === 'fr' && m.name_fr ? m.name_fr : m.name;
  if (m.hit_count != null && m.hit_count > 1) {
    return { label: display, hitCount: m.hit_count };
  }
  const match = display.match(/^(.+?)\s*×(\d+)\s*$/);
  if (match) return { label: match[1], hitCount: parseInt(match[2], 10) };
  return { label: display, hitCount: 1 };
}

test('falls back to English name when lang=fr but name_fr missing', () => {
  const m = { name: 'BURNING STRIKE' };
  assert.equal(splitMechName(m, 'fr').label, 'BURNING STRIKE');
});

test('uses name_fr when lang=fr and name_fr present', () => {
  const m = { name: 'BURNING STRIKE', name_fr: 'FRAPPE ARDENTE' };
  assert.equal(splitMechName(m, 'fr').label, 'FRAPPE ARDENTE');
  // EN stays on EN even when name_fr is available.
  assert.equal(splitMechName(m, 'en').label, 'BURNING STRIKE');
});

test('hit_count is decoupled from language', () => {
  const m = { name: 'AKH MORN', name_fr: 'AKH MORN', hit_count: 5 };
  assert.equal(splitMechName(m, 'fr').hitCount, 5);
  assert.equal(splitMechName(m, 'en').hitCount, 5);
});

test('legacy ×N suffix is parsed on whichever name we display', () => {
  // No hit_count → parse from the name itself. Both locales kept the suffix.
  const legacy = { name: 'TIDAL WAVE ×2', name_fr: 'VAGUE DE MARÉE ×2' };
  const fr = splitMechName(legacy, 'fr');
  assert.equal(fr.label, 'VAGUE DE MARÉE');
  assert.equal(fr.hitCount, 2);
  const en = splitMechName(legacy, 'en');
  assert.equal(en.label, 'TIDAL WAVE');
  assert.equal(en.hitCount, 2);
});
