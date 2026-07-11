// Shared top-down truck artwork — single source of truth for the offline SVG
// map, the online Leaflet map (as an SVG string) and the Truck Showroom, so a
// model looks identical everywhere. Canvas is 40 units wide, height varies per
// body type. The truck faces DOWN (cab at the bottom); map markers rotate the
// art by heading+180, same convention as before.
import React from 'react';
import { G, Rect, Ellipse, Circle, Path } from 'react-native-svg';

// Darken/lighten a #rrggbb colour by pct (-1..1) for pseudo-3D shading.
export function shade(hex, pct) {
  const h = (hex || '#3A5A8C').replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  const f = pct < 0 ? 0 : 255, p = Math.abs(pct);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const to = v => Math.round((f - v) * p + v);
  return '#' + ((1 << 24) + (to(r) << 16) + (to(g) << 8) + to(b)).toString(16).slice(1);
}

// Which silhouette a model gets, from its catalog entry. `model.shape` lets a
// catalog entry force a specific silhouette (American long-nose, road-train…).
export function bodyTypeFor(model) {
  if (!model) return 'box';
  if (model.shape) return model.shape;
  if (model.icon === 'truck-trailer' || model.cargo >= 16) return 'semi';
  if (model.cargo >= 4) return 'rigid';
  if (model.cargo >= 2) return 'box';
  return 'mini';
}

// Proportional render scale so bigger/heavier models look visibly bigger —
// derived from cargo tonnage (capacity), not just body silhouette.
export function sizeScaleFor(model) {
  if (!model) return 1;
  const c = model.cargo || 0;
  return Math.max(0.78, Math.min(1.4, 0.8 + c / 70));
}

// Default livery colour when the player hasn't painted the truck.
export function defaultBodyColor(model) {
  return model && model.propulsion === 'electric' ? '#12A150'
    : model && model.propulsion === 'hybrid' ? '#0E7C86' : '#3A5A8C';
}

export const TRUCK_ART_W = 40;

// Headlight colours per propulsion: electric = white LEDs, diesel/hybrid = pale
// yellow halogens. `bulb` paints the lamp, ray0/ray1 the outer/inner beam cone.
// Frozen constants (not fresh objects per call) so memoized consumers keep
// referential equality across animation frames.
const LIGHTS_EV = { bulb: '#FFFFFF', ray0: 'rgba(255,255,255,0.26)', ray1: 'rgba(255,255,255,0.45)' };
const LIGHTS_ICE = { bulb: '#FFE9A8', ray0: 'rgba(255,224,120,0.30)', ray1: 'rgba(255,224,120,0.50)' };
export function headlightFor(model) {
  return model && model.propulsion === 'electric' ? LIGHTS_EV : LIGHTS_ICE;
}

// Night is 18:00–05:59 (6pm to 6am) on the player's REAL local clock — the
// same signal as the map's night tint, so headlights and darkness agree.
export function isNightHour(hour) { return hour >= 18 || hour < 6; }

// Returns { w, h, bodyH, shapes } — shapes are plain descriptors so they can be
// rendered both as react-native-svg elements and as an HTML SVG string.
// opts.lights = headlightFor(model) result to switch the headlights on and add
// cartoon torch-style beam cones in front of the truck (extends h by ~15).
// Shape descriptors are pure functions of (type, body, accent, lights) — cache
// them so the 12fps map animation doesn't rebuild ~40 primitives per truck per
// frame. Key space is tiny (few silhouettes × few liveries), bounded anyway.
const shapeCache = new Map();
export function truckShapes(type, body, accent, opts = {}) {
  const key = `${type}|${body}|${accent}|${opts.lights ? opts.lights.bulb : ''}`;
  const hit = shapeCache.get(key);
  if (hit) return hit;
  const out = buildTruckShapes(type, body, accent, opts);
  if (shapeCache.size > 300) shapeCache.clear();
  shapeCache.set(key, out);
  return out;
}

function buildTruckShapes(type, body, accent, opts = {}) {
  const dark = shade(body, -0.3);
  const darker = shade(body, -0.45);
  const roof = shade(body, 0.16);
  const glass = '#AECBF5';
  const tyre = '#14171C';
  const hub = '#3A4048';
  const chrome = '#C9CFD8';
  const lamp = '#FFE9A8';
  const s = [];
  // Flat 2D mode (v1.7): one rect per panel, no skew transforms, no auto
  // side-face/highlight extras — SVG element count per truck stays minimal so
  // dozens of moving markers render smoothly on low-end phones. o.skew is
  // accepted but ignored (kept so shape definitions stay untouched).
  const R = (x, y, w, h, rx, fill, o = {}) => {
    const { skew, ...rest } = o;
    s.push({ k: 'rect', x, y, w, h, rx, fill, ...rest });
  };
  const C_ = (cx, cy, r, fill) => s.push({ k: 'circle', cx, cy, r, fill });
  // Twin-tyre wheel with a hub cap line.
  const wheel = (x, y, h = 5) => { R(x, y, 2.7, h, 1.2, tyre); R(x + 0.9, y + h / 2 - 0.5, 0.9, 1, 0.4, hub); };
  const mirrors = (y) => { R(8.4, y, 2.6, 1.4, 0.6, tyre); R(29, y, 2.6, 1.4, 0.6, tyre); };
  const lights = opts.lights || null;
  let lampY = 0;
  const lamps = (y) => {
    lampY = y;
    const fill = lights ? lights.bulb : lamp;
    R(13, y, 3.8, 1.5, 0.7, fill); R(23.2, y, 3.8, 1.5, 0.7, fill);
  };
  // Cartoon torch-style beam cones in front of both headlights; widens the
  // canvas height so map markers/viewBoxes include the beams.
  const finish = (H) => {
    if (!lights) return { w: 40, h: H, bodyH: H, shapes: s };
    const len = 14, y0 = lampY + 1.6, y1 = y0 + len;
    [14.9, 25.1].forEach(cx => {
      s.push({ k: 'path', fill: lights.ray0,
        d: `M ${cx - 1.9} ${y0} L ${cx - 6} ${y1} Q ${cx} ${y1 + 2.4} ${cx + 6} ${y1} L ${cx + 1.9} ${y0} Z` });
      s.push({ k: 'path', fill: lights.ray1,
        d: `M ${cx - 1.2} ${y0} L ${cx - 3.4} ${y1 - 3} Q ${cx} ${y1 - 1.4} ${cx + 3.4} ${y1 - 3} L ${cx + 1.2} ${y0} Z` });
    });
    return { w: 40, h: Math.max(H, y1 + 3), bodyH: H, shapes: s };
  };

  if (type === 'mini') {
    // Small pickup (Tata Ace class) — short cab + open cargo bed.
    const H = 42;
    wheel(8.8, 6.5); wheel(28.5, 6.5); wheel(8.8, 27); wheel(28.5, 27);
    R(12, 3, 16, 34, 2.5, darker);                            // chassis
    R(11, 2, 18, 20, 2.4, body, { stroke: '#fff', sw: 1.1 }); // bed walls
    R(13.2, 4.2, 13.6, 15.6, 1.4, dark);                      // bed floor
    R(13.2, 8, 13.6, 0.9, 0, darker);                         // floor slats
    R(13.2, 12, 13.6, 0.9, 0, darker);
    R(13.2, 16, 13.6, 0.9, 0, darker);
    R(12.4, 2.6, 15.2, 2, 1, accent);                         // tail accent
    R(11.4, 23.5, 17.2, 12.4, 3, body, { stroke: '#fff', sw: 1.1 }); // cab
    R(12.8, 24.6, 14.4, 4.6, 1.4, roof, { skew: -6 });        // cab roof (angled top face)
    R(13.4, 29.8, 13.2, 3.6, 1.2, glass);                     // windshield
    mirrors(30.2); lamps(34.4);
    R(11.8, 36, 16.4, 1.8, 0.9, chrome);                      // bumper
    return finish(H);
  }

  if (type === 'box') {
    // Light box truck — tall cargo box with roof ribs + separate cab.
    const H = 50;
    wheel(8.7, 4, 5.5); wheel(28.6, 4, 5.5);
    wheel(8.7, 19, 5); wheel(28.6, 19, 5);
    wheel(8.7, 36.5, 5); wheel(28.6, 36.5, 5);
    R(12.5, 28, 15, 6, 1, darker);                            // chassis gap
    R(10.4, 2, 19.2, 28, 2.6, body, { stroke: '#fff', sw: 1.1 }); // cargo box
    R(19.6, 2.6, 0.8, 4.5, 0.3, darker);                      // rear door seam
    R(12, 8, 16, 0.9, 0, dark);                               // roof ribs
    R(12, 13, 16, 0.9, 0, dark);
    R(12, 18, 16, 0.9, 0, dark);
    R(12, 23, 16, 0.9, 0, dark);
    R(11.8, 3, 16.4, 2.2, 1, accent);                         // rear accent strip
    R(12.2, 30.6, 15.6, 2.4, 1, dark);                        // wind deflector
    R(11.4, 32.6, 17.2, 12.6, 2.8, body, { stroke: '#fff', sw: 1.1 }); // cab
    R(12.8, 33.8, 14.4, 4.6, 1.4, roof, { skew: -6 });        // cab roof (angled top face)
    R(13.4, 39, 13.2, 3.8, 1.2, glass);
    mirrors(39.4); lamps(43.4);
    R(11.8, 45.2, 16.4, 1.8, 0.9, chrome);
    return finish(H);
  }

  if (type === 'semi') {
    // Articulated tractor-trailer — long trailer, kingpin gap, big sleeper cab.
    const H = 64;
    wheel(8.6, 3.5, 5); wheel(28.7, 3.5, 5);                  // trailer tandem
    wheel(8.6, 9.5, 5); wheel(28.7, 9.5, 5);
    wheel(8.6, 40.5, 5); wheel(28.7, 40.5, 5);                // drive axle
    wheel(8.6, 50.5, 5.4); wheel(28.7, 50.5, 5.4);            // steer axle
    R(10, 2, 20, 36, 2, body, { stroke: '#fff', sw: 1.1 });   // trailer
    R(19.6, 2.6, 0.8, 5, 0.3, darker);                        // rear door seam
    R(11.8, 8, 16.4, 0.9, 0, dark);                           // roof ribs
    R(11.8, 13, 16.4, 0.9, 0, dark);
    R(11.8, 18, 16.4, 0.9, 0, dark);
    R(11.8, 23, 16.4, 0.9, 0, dark);
    R(11.8, 28, 16.4, 0.9, 0, dark);
    R(11.6, 3, 16.8, 2.4, 1, accent);                         // rear accent strip
    R(14.5, 38.4, 11, 4.2, 1, darker);                        // fifth-wheel plate
    C_(20, 40.5, 1.7, chrome);                                // kingpin
    R(13, 41, 14, 7.5, 1, darker);                            // tractor chassis
    R(9.9, 44.8, 1.5, 6.5, 0.7, chrome);                      // exhaust stacks
    R(28.6, 44.8, 1.5, 6.5, 0.7, chrome);
    R(11.2, 43.6, 17.6, 2.6, 1.2, dark);                      // roof deflector
    R(11, 45.6, 18, 13.6, 3, body, { stroke: '#fff', sw: 1.1 }); // cab
    R(12.4, 46.8, 15.2, 5, 1.6, roof, { skew: -6 });          // sleeper roof (angled top face)
    R(13.2, 52.6, 13.6, 4, 1.4, glass);                       // windshield
    mirrors(53); lamps(57.6);
    R(11.4, 59.4, 17.2, 2, 1, chrome);                        // bumper
    return finish(H);
  }

  if (type === 'conventional') {
    // American long-nose tractor-trailer — extended hood/grille ahead of the
    // cab, distinct from the European sleeper-cab 'semi' silhouette.
    const H = 76;
    wheel(8.6, 3.5, 5); wheel(28.7, 3.5, 5);                  // trailer tandem
    wheel(8.6, 9.5, 5); wheel(28.7, 9.5, 5);
    wheel(8.6, 40.5, 5); wheel(28.7, 40.5, 5);                // drive axle
    wheel(8.6, 50.5, 5.4); wheel(28.7, 50.5, 5.4);            // steer axle
    wheel(8.2, 62, 5.4); wheel(28.9, 62, 5.4);                // extra nose axle under the long hood
    R(10, 2, 20, 36, 2, body, { stroke: '#fff', sw: 1.1 });   // trailer
    R(19.6, 2.6, 0.8, 5, 0.3, darker);                        // rear door seam
    R(11.8, 8, 16.4, 0.9, 0, dark);                           // roof ribs
    R(11.8, 13, 16.4, 0.9, 0, dark);
    R(11.8, 18, 16.4, 0.9, 0, dark);
    R(11.8, 23, 16.4, 0.9, 0, dark);
    R(11.8, 28, 16.4, 0.9, 0, dark);
    R(11.6, 3, 16.8, 2.4, 1, accent);                         // rear accent strip
    R(14.5, 38.4, 11, 4.2, 1, darker);                        // fifth-wheel plate
    C_(20, 40.5, 1.7, chrome);                                // kingpin
    R(13, 41, 14, 7.5, 1, darker);                            // tractor chassis
    R(9.9, 44.8, 1.5, 9.4, 0.7, chrome);                      // tall exhaust stacks
    R(28.6, 44.8, 1.5, 9.4, 0.7, chrome);
    R(11.2, 43.6, 17.6, 2.6, 1.2, dark);                      // roof deflector
    R(11, 45.6, 18, 12, 3, body, { stroke: '#fff', sw: 1.1 }); // short flat-back cab
    R(12.4, 46.6, 15.2, 4.4, 1.6, roof, { skew: -6 });        // cab roof (angled top face)
    R(13.2, 51.4, 13.6, 3.6, 1.4, glass);                     // windshield
    mirrors(51.8);
    R(12, 57.6, 16, 16, 2.4, body, { stroke: '#fff', sw: 1.1 }); // long hood/nose
    R(13.2, 58.6, 13.6, 4.4, 1.2, roof, { skew: -4 });        // hood top face (lighter, angled)
    R(14.6, 65.8, 10.8, 3.6, 1, darker);                      // grille
    lamps(70.6);
    R(11.4, 72.6, 17.2, 2, 1, chrome);                        // bumper
    return finish(H);
  }

  if (type === 'doubletrailer') {
    // B-double / road-train — two trailer boxes chained on a dolly, tractor at
    // the bottom. Longest silhouette in the catalog for the heaviest haulers.
    const H = 98;
    wheel(8.6, 3.5, 5); wheel(28.7, 3.5, 5);                  // rear trailer tandem
    wheel(8.6, 9.5, 5); wheel(28.7, 9.5, 5);
    R(10, 2, 20, 27, 2, body, { stroke: '#fff', sw: 1.1 });   // trailer 2 (rear)
    R(19.6, 2.6, 0.8, 4, 0.3, darker);
    R(11.8, 7.5, 16.4, 0.9, 0, dark);
    R(11.8, 13, 16.4, 0.9, 0, dark);
    R(11.8, 18.5, 16.4, 0.9, 0, dark);
    R(11.6, 3, 16.8, 2, 1, accent);
    R(17, 29, 6, 9.5, 1, darker);                             // tow-bar/drawbar — closes the gap so trailer 2 visibly links to the dolly
    C_(20, 30.5, 1.4, chrome);                                // drawbar pivot pin
    C_(20, 37, 1.4, chrome);                                  // dolly hitch pin
    wheel(8.6, 35, 5); wheel(28.7, 35, 5);                    // dolly tandem
    R(10, 37.5, 20, 27, 2, body, { stroke: '#fff', sw: 1.1 }); // trailer 1 (front)
    R(19.6, 38.1, 0.8, 4, 0.3, darker);
    R(11.8, 43, 16.4, 0.9, 0, dark);
    R(11.8, 48.5, 16.4, 0.9, 0, dark);
    R(11.8, 54, 16.4, 0.9, 0, dark);
    R(11.6, 38.5, 16.8, 2, 1, accent);
    wheel(8.6, 63.5, 5); wheel(28.7, 63.5, 5);                // trailer-1 kingpin tandem
    R(17, 64.4, 6, 8.2, 1, darker);                           // kingpin drawbar — visibly couples trailer 1 to the tractor (was a floating gap)
    C_(20, 66.2, 1.4, chrome);                                // coupling pin
    R(14.5, 71.9, 11, 4.2, 1, darker);                        // fifth-wheel plate
    C_(20, 74, 1.7, chrome);                                  // kingpin
    wheel(8.6, 74, 5); wheel(28.7, 74, 5);                    // tractor drive axle
    wheel(8.6, 84, 5.4); wheel(28.7, 84, 5.4);                // tractor steer axle
    R(13, 74.5, 14, 7.5, 1, darker);                          // tractor chassis
    R(9.9, 78.3, 1.5, 6.5, 0.7, chrome);                      // exhaust stacks
    R(28.6, 78.3, 1.5, 6.5, 0.7, chrome);
    R(11.2, 77.1, 17.6, 2.6, 1.2, dark);                      // roof deflector
    R(11, 79.1, 18, 13.6, 3, body, { stroke: '#fff', sw: 1.1 }); // cab
    R(12.4, 80.3, 15.2, 5, 1.6, roof, { skew: -6 });          // sleeper roof (angled top face)
    R(13.2, 86.1, 13.6, 4, 1.4, glass);                       // windshield
    mirrors(86.5); lamps(91.1);
    R(11.4, 92.9, 17.2, 2, 1, chrome);                        // bumper
    return finish(H);
  }

  // 'rigid' — medium/heavy straight truck, long body + tandem rear axles.
  const H = 56;
  wheel(8.7, 3.5, 5); wheel(28.6, 3.5, 5);
  wheel(8.7, 9.5, 5); wheel(28.6, 9.5, 5);
  wheel(8.7, 24, 5); wheel(28.6, 24, 5);
  wheel(8.7, 42.5, 5.2); wheel(28.6, 42.5, 5.2);
  R(12.5, 33, 15, 5.5, 1, darker);                            // chassis gap
  R(10.2, 2, 19.6, 33, 2.6, body, { stroke: '#fff', sw: 1.1 }); // cargo body
  R(19.6, 2.6, 0.8, 4.5, 0.3, darker);                        // rear door seam
  R(11.8, 8.5, 16.4, 0.9, 0, dark);                           // roof ribs
  R(11.8, 14, 16.4, 0.9, 0, dark);
  R(11.8, 19.5, 16.4, 0.9, 0, dark);
  R(11.8, 25, 16.4, 0.9, 0, dark);
  R(11.6, 3, 16.8, 2.4, 1, accent);
  R(12.2, 35.8, 15.6, 2.4, 1, dark);                          // deflector
  R(11.2, 37.8, 17.6, 13, 3, body, { stroke: '#fff', sw: 1.1 }); // cab
  R(12.6, 39, 14.8, 4.8, 1.4, roof, { skew: -6 });          // cab roof (angled top face)
  R(13.4, 44.4, 13.2, 3.8, 1.2, glass);
  mirrors(44.8); lamps(49);
  R(11.6, 50.8, 16.8, 1.9, 0.9, chrome);
  return finish(H);
}

// React renderer (react-native-svg) — place inside an <Svg>/<G>. Origin is the
// art's top-left; centre it yourself with translate(-20, -h/2).
// React.memo + the shape cache above means a moving truck re-renders only its
// parent transform per frame — the SVG subtree itself is completely stable.
export const TruckTopShapes = React.memo(function TruckTopShapes({ type, body, accent, lights }) {
  const { shapes } = truckShapes(type, body, accent, { lights });
  return (
    <G>
      {shapes.map((p, i) => p.k === 'rect'
        ? <Rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} rx={p.rx} fill={p.fill} stroke={p.stroke} strokeWidth={p.sw} />
        : p.k === 'circle'
          ? <Circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill={p.fill} />
          : p.k === 'path'
            ? <Path key={i} d={p.d} fill={p.fill} />
            : <Ellipse key={i} cx={p.cx} cy={p.cy} rx={p.rx} ry={p.ry} fill={p.fill} />)}
    </G>
  );
});

// Big top-down RO-RO steamer for sea crossings — a proper cargo ship with the
// player's truck visibly lashed on deck (never a truck "driving on water").
// Faces DOWN (bow at the bottom) like the truck art so heading rotation works.
export const FERRY_W = 48;
export const FERRY_H = 72;
const FERRY_SHAPES = [
  // wake + hull
  { k: 'ellipse', cx: 24, cy: 12, rx: 14, ry: 5, fill: 'rgba(255,255,255,0.35)' },
  { k: 'path', d: 'M 9 8 L 39 8 L 39 48 Q 39 62 24 69 Q 9 62 9 48 Z', fill: '#26415C' },
  { k: 'path', d: 'M 11 10 L 37 10 L 37 47 Q 37 60 24 66 Q 11 60 11 47 Z', fill: '#4A7AA8', stroke: '#fff', sw: 1.2 },
  // main cargo deck
  { k: 'rect', x: 13, y: 20, w: 22, h: 32, rx: 2, fill: '#5C82A8' },
  // deck containers (port side)
  { k: 'rect', x: 14.5, y: 23, w: 6, h: 12, rx: 0.8, fill: '#C25048' },
  { k: 'rect', x: 14.5, y: 37, w: 6, h: 12, rx: 0.8, fill: '#2E8B57' },
  // the truck lashed on deck (cab + trailer, facing the bow)
  { k: 'rect', x: 23.5, y: 22.5, w: 9.5, h: 18, rx: 1.2, fill: '#3A5A8C', stroke: '#fff', sw: 0.8 },
  { k: 'rect', x: 24.6, y: 24, w: 7.3, h: 3.5, rx: 0.8, fill: '#5B8DF0' },
  { k: 'rect', x: 23.5, y: 42.5, w: 9.5, h: 7.5, rx: 1.4, fill: '#3A5A8C', stroke: '#fff', sw: 0.8 },
  { k: 'rect', x: 25, y: 46, w: 6.5, h: 2.6, rx: 0.8, fill: '#AECBF5' },
  // bridge / superstructure at the stern
  { k: 'rect', x: 14, y: 11.5, w: 20, h: 7, rx: 1.4, fill: '#E8ECF2', stroke: '#9DB2D6', sw: 1 },
  { k: 'rect', x: 16, y: 13, w: 4.5, h: 3.4, rx: 0.6, fill: '#AECBF5' },
  { k: 'rect', x: 22, y: 13, w: 4.5, h: 3.4, rx: 0.6, fill: '#AECBF5' },
  { k: 'rect', x: 28, y: 13, w: 4.5, h: 3.4, rx: 0.6, fill: '#AECBF5' },
  // funnel with stripe
  { k: 'rect', x: 21.5, y: 5.5, w: 5, h: 5.5, rx: 1, fill: '#DC3D43' },
  { k: 'rect', x: 21.5, y: 7.3, w: 5, h: 1.6, rx: 0, fill: '#fff' },
  // bow mast light
  { k: 'circle', cx: 24, cy: 63.5, r: 1.4, fill: '#FFE9A8' },
];

export function FerryTopShape() {
  return (
    <G>
      {FERRY_SHAPES.map((p, i) => p.k === 'rect'
        ? <Rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} rx={p.rx} fill={p.fill} stroke={p.stroke} strokeWidth={p.sw} />
        : p.k === 'circle'
          ? <Circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill={p.fill} />
          : p.k === 'path'
            ? <Path key={i} d={p.d} fill={p.fill} stroke={p.stroke} strokeWidth={p.sw} />
            : <Ellipse key={i} cx={p.cx} cy={p.cy} rx={p.rx} ry={p.ry} fill={p.fill} />)}
    </G>
  );
}

export function ferrySvgString() {
  const els = FERRY_SHAPES.map(p => p.k === 'rect'
    ? `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="${p.rx}" fill="${p.fill}"${p.stroke ? ` stroke="${p.stroke}" stroke-width="${p.sw}"` : ''}/>`
    : p.k === 'circle'
      ? `<circle cx="${p.cx}" cy="${p.cy}" r="${p.r}" fill="${p.fill}"/>`
      : p.k === 'path'
        ? `<path d="${p.d}" fill="${p.fill}"${p.stroke ? ` stroke="${p.stroke}" stroke-width="${p.sw}"` : ''}/>`
        : `<ellipse cx="${p.cx}" cy="${p.cy}" rx="${p.rx}" ry="${p.ry}" fill="${p.fill}"/>`).join('');
  return `<svg width="${FERRY_W}" height="${FERRY_H}" viewBox="0 0 ${FERRY_W} ${FERRY_H}">${els}</svg>`;
}

// HTML SVG string for the Leaflet WebView marker.
export function truckSvgString(type, body, accent, opts = {}) {
  const { w, h, shapes } = truckShapes(type, body, accent, opts);
  const els = shapes.map(p => p.k === 'rect'
    ? `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="${p.rx}" fill="${p.fill}"${p.stroke ? ` stroke="${p.stroke}" stroke-width="${p.sw}"` : ''}/>`
    : p.k === 'circle'
      ? `<circle cx="${p.cx}" cy="${p.cy}" r="${p.r}" fill="${p.fill}"/>`
      : p.k === 'path'
        ? `<path d="${p.d}" fill="${p.fill}"/>`
        : `<ellipse cx="${p.cx}" cy="${p.cy}" rx="${p.rx}" ry="${p.ry}" fill="${p.fill}"/>`).join('');
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${els}</svg>`;
}
