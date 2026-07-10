// Core store logic smoke tests (replaces the template's full-app render test,
// which can't mount the map/WebView stack in a headless jest environment).
import { deliveryPhase, incidentMeta, EASTER_EGGS } from '../src/store/gameStore';

const mkDelivery = (over = {}) => ({
  startedAt: 0, endsAt: 1000 * 1000, loadSec: 100, unloadSec: 100,
  route: {}, ...over,
});

test('deliveryPhase: loading -> driving -> unloading without ferry', () => {
  const d = mkDelivery();
  expect(deliveryPhase(d, 50 * 1000).phase).toBe('loading');
  expect(deliveryPhase(d, 500 * 1000).phase).toBe('driving');
  expect(deliveryPhase(d, 950 * 1000).phase).toBe('unloading');
  expect(deliveryPhase(d, 2000 * 1000).phase).toBe('done');
});

test('deliveryPhase: multi-hop route boards/unboards per ferry segment', () => {
  const d = mkDelivery({
    ferryBoardSec: 50, ferryUnboardSec: 50,
    route: { ferrySegments: [{ startFrac: 0.2, endFrac: 0.4 }, { startFrac: 0.6, endFrac: 0.8 }] },
  });
  const phases = [];
  for (let t = 0; t <= 1000; t += 5) phases.push(deliveryPhase(d, t * 1000).phase);
  const seq = phases.filter((p, i) => p !== phases[i - 1]);
  expect(seq).toEqual(['loading', 'driving', 'ferry-board', 'ferry', 'ferry-unboard',
    'driving', 'ferry-board', 'ferry', 'ferry-unboard', 'driving', 'unloading']);
});

test('deliveryPhase frac is monotonically non-decreasing', () => {
  const d = mkDelivery({
    ferryBoardSec: 50, ferryUnboardSec: 50,
    route: { ferrySegments: [{ startFrac: 0.3, endFrac: 0.7 }] },
  });
  let prev = 0;
  for (let t = 0; t <= 1100; t += 3) {
    const { frac } = deliveryPhase(d, t * 1000);
    expect(frac).toBeGreaterThanOrEqual(prev);
    prev = frac;
  }
});

test('incidentMeta falls back to a valid type and eggs are unique', () => {
  expect(incidentMeta('nope')).toBeDefined();
  const ids = EASTER_EGGS.map(e => e.id);
  expect(new Set(ids).size).toBe(ids.length);
});
