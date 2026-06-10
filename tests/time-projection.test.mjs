// Tests for the pure time-projection helpers in web/src/lib/time.ts.
// As with the other suites, we mirror the (tiny) pure functions here so
// `node --test` runs without a TS toolchain. Keep these in lockstep with
// the source — they encode the contract the vertical timeline relies on.

import { test } from 'node:test';
import assert from 'node:assert/strict';

const pct = (t, dur) => (dur <= 0 ? 0 : Math.max(0, Math.min(100, (t / dur) * 100)));
const spanPct = (s, dur) => (dur <= 0 ? 0 : Math.min(100, (s / dur) * 100));
const ratioToTime = (ratio, dur) => Math.max(0, Math.min(dur, Math.round(ratio * dur)));

test('pct clamps to 0..100 and maps endpoints', () => {
  assert.equal(pct(0, 600), 0);
  assert.equal(pct(600, 600), 100);
  assert.equal(pct(300, 600), 50);
  assert.equal(pct(-30, 600), 0); // clamped low
  assert.equal(pct(900, 600), 100); // clamped high
  assert.equal(pct(42, 0), 0); // guard against /0
});

test('spanPct caps a duration at 100% but does not clamp low', () => {
  assert.equal(spanPct(60, 600), 10);
  assert.equal(spanPct(600, 600), 100);
  assert.equal(spanPct(900, 600), 100); // a recast longer than the fight
  assert.equal(spanPct(0, 600), 0);
  assert.equal(spanPct(30, 0), 0); // guard against /0
});

test('ratioToTime rounds and clamps to [0, dur] — same for X and Y', () => {
  assert.equal(ratioToTime(0, 600), 0);
  assert.equal(ratioToTime(1, 600), 600);
  assert.equal(ratioToTime(0.5, 600), 300);
  assert.equal(ratioToTime(0.501, 600), 301); // rounds, not floors
  assert.equal(ratioToTime(-0.2, 600), 0); // clamp low (cursor above/left of axis)
  assert.equal(ratioToTime(1.5, 600), 600); // clamp high (cursor past the end)
});

test('pct and ratioToTime round-trip at the sampled point', () => {
  // A timestamp → fraction → back to the same timestamp.
  const dur = 480;
  for (const t of [0, 15, 137, 240, 480]) {
    const ratio = pct(t, dur) / 100;
    assert.equal(ratioToTime(ratio, dur), t);
  }
});
