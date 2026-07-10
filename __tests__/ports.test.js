// Port network + multi-hop ferry segment sanity (v1.8.0 sea overhaul).
import { computeRoute, ferryPorts } from '../src/engine/routing';
import { ROAD_NODES, ROAD_EDGES, FERRY_EDGES } from '../src/data/highways';

test('every ferry edge endpoint exists as a road node', () => {
  FERRY_EDGES.forEach(f => {
    expect(ROAD_NODES[f.a]).toBeDefined();
    expect(ROAD_NODES[f.b]).toBeDefined();
  });
});

test('every road edge endpoint exists as a road node', () => {
  const missing = [];
  ROAD_EDGES.forEach(e => {
    if (!ROAD_NODES[e.a]) missing.push(e.a);
    if (!ROAD_NODES[e.b]) missing.push(e.b);
  });
  expect(missing).toEqual([]);
});

test('ferryPorts lists the new coastal ports', () => {
  const ids = ferryPorts().map(p => p.id);
  ['ghogha-port', 'dahej-port', 'kandla-port', 'mumbai-port', 'chennai-port', 'vizag-port'].forEach(id =>
    expect(ids).toContain(id));
});

test('Chennai -> Port Blair routes over exactly one sea hop from the port', () => {
  const r = computeRoute(13.08, 80.27, 11.62, 92.73);
  expect(r).toBeTruthy();
  expect(r.usesFerry).toBe(true);
  expect(r.ferrySegments.length).toBe(1);
  expect(r.nodeIds).toContain('chennai-port');
});

test('Jamnagar -> Port Blair produces ordered, non-overlapping ferry segments', () => {
  const r = computeRoute(22.47, 70.05, 11.62, 92.73);
  expect(r).toBeTruthy();
  expect(r.usesFerry).toBe(true);
  let prev = 0;
  r.ferrySegments.forEach(s => {
    expect(s.startFrac).toBeGreaterThanOrEqual(prev);
    expect(s.endFrac).toBeGreaterThan(s.startFrac);
    prev = s.endFrac;
  });
});
