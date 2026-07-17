// Shared top-down aircraft artwork — single source of truth for the Leaflet
// map (as an SVG string) and the in-app badges, so a model looks identical
// everywhere. Mirrors truckArt.js's design (shared shape descriptors feeding
// both a react-native-svg component and an HTML string) but drawn for
// aircraft: fuselage, swept wings, tail fin, engine pods. Canvas is 40 units
// wide, height varies per size class. The aircraft faces DOWN (nose at the
// bottom), same convention as the old truck art, so map heading rotation
// (heading+180) needed no changes.
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

// Which silhouette a model gets, from its catalog entry (by cargo capacity).
export function bodyTypeFor(model) {
  if (!model) return 'prop';
  if (model.cargo >= 35) return 'widebody';
  if (model.cargo >= 8) return 'jet';
  return 'prop';
}

// Proportional render scale so bigger aircraft look visibly bigger — derived
// from cargo tonnage (capacity), not just silhouette.
export function sizeScaleFor(model) {
  if (!model) return 1;
  const c = model.cargo || 0;
  return Math.max(0.75, Math.min(1.5, 0.78 + c / 90));
}

// Default livery colour when the player hasn't painted the aircraft.
export function defaultBodyColor(model) {
  return model && model.propulsion === 'electric' ? '#12A150'
    : model && model.propulsion === 'hybrid' ? '#0E7C86' : '#E7E9EE';
}

export const PLANE_ART_W = 40;

// Nav-light colours per propulsion: electric = white LEDs, diesel/hybrid =
// pale red/green wingtip strobes. `bulb` paints the lamp, ray0/ray1 the
// outer/inner beam cone (landing lights, shown at night while en route).
const LIGHTS_EV = { bulb: '#FFFFFF', ray0: 'rgba(255,255,255,0.26)', ray1: 'rgba(255,255,255,0.45)' };
const LIGHTS_ICE = { bulb: '#FFE9A8', ray0: 'rgba(255,224,120,0.30)', ray1: 'rgba(255,224,120,0.50)' };
export function headlightFor(model) {
  return model && model.propulsion === 'electric' ? LIGHTS_EV : LIGHTS_ICE;
}

// Night is 18:00–05:59 (6pm to 6am) on the player's REAL local clock — same
// signal as the map's night tint, so landing lights and darkness agree.
export function isNightHour(hour) { return hour >= 18 || hour < 6; }

// Returns { w, h, bodyH, shapes } — shapes are plain descriptors so they can
// be rendered both as react-native-svg elements and as an HTML SVG string.
const shapeCache = new Map();
export function planeShapes(type, body, accent, opts = {}) {
  const key = `${type}|${body}|${accent}|${opts.lights ? opts.lights.bulb : ''}`;
  const hit = shapeCache.get(key);
  if (hit) return hit;
  const out = buildPlaneShapes(type, body, accent, opts);
  if (shapeCache.size > 300) shapeCache.clear();
  shapeCache.set(key, out);
  return out;
}

function buildPlaneShapes(type, body, accent, opts = {}) {
  const dark = shade(body, -0.25);
  const darker = shade(body, -0.4);
  const light = shade(body, 0.2);
  const glass = '#AECBF5';
  const engineC = '#3A4048';
  const lamp = '#FFE9A8';
  const s = [];
  const R = (x, y, w, h, rx, fill, o = {}) => s.push({ k: 'rect', x, y, w, h, rx, fill, ...o });
  const C_ = (cx, cy, r, fill) => s.push({ k: 'circle', cx, cy, r, fill });
  const P = (d, fill) => s.push({ k: 'path', d, fill });
  const engine = (x, y, r = 2.4) => { C_(x, y, r, engineC); C_(x, y, r * 0.55, '#181B20'); };
  const lights = opts.lights || null;
  let noseY = 0;
  const navLights = (y) => {
    noseY = y;
    const fill = lights ? lights.bulb : lamp;
    C_(9, y - 6, 1.1, '#DC3D43'); // port (red) wingtip
    C_(31, y - 6, 1.1, '#4ADE80'); // starboard (green) wingtip
    C_(20, y, 1.3, fill); // nose landing light
  };
  // Cartoon landing-light beam cone in front of the nose; widens the canvas
  // height so map markers/viewBoxes include the beam.
  const finish = (H) => {
    if (!lights) return { w: 40, h: H, bodyH: H, shapes: s };
    const len = 12, y0 = noseY + 1, y1 = y0 + len;
    s.push({ k: 'path', fill: lights.ray0, d: `M ${20 - 2.4} ${y0} L ${20 - 5.5} ${y1} Q 20 ${y1 + 2} ${20 + 5.5} ${y1} L ${20 + 2.4} ${y0} Z` });
    s.push({ k: 'path', fill: lights.ray1, d: `M ${20 - 1.4} ${y0} L ${20 - 3} ${y1 - 3} Q 20 ${y1 - 1.4} ${20 + 3} ${y1 - 3} L ${20 + 1.4} ${y0} Z` });
    return { w: 40, h: Math.max(H, y1 + 2), bodyH: H, shapes: s };
  };

  if (type === 'prop') {
    // Light/regional turboprop — short fuselage, twin wing-mounted props.
    const H = 46;
    R(11, 4, 18, 3, 1, dark); // tailplane
    R(18, 2, 4, 7, 1, accent); // tail fin footprint
    R(16, 6, 8, 34, 4, body, { stroke: '#fff', sw: 1 }); // fuselage
    P('M2 25 L38 25 L31 31 L9 31 Z', light); // wings (swept trapezoid)
    P('M2 25 L38 25 L34 22 L6 22 Z', dark); // wing leading-edge shade
    engine(9, 28); engine(31, 28); // wing-mounted props
    R(17, 36, 6, 5, 1.4, glass); // cockpit windows
    P('M15 40 L20 46 L25 40 Z', darker); // nose taper
    C_(20, 45, 2, 'rgba(255,255,255,0.5)'); // spinning prop disc
    navLights(38);
    return finish(H);
  }

  if (type === 'widebody') {
    // Wide-body freighter — long fuselage, four underwing engines, big span.
    const H = 66;
    R(9, 4, 22, 3, 1, dark); // tailplane
    R(17, 1, 6, 9, 1.2, accent); // tail fin footprint
    R(14, 6, 12, 50, 5, body, { stroke: '#fff', sw: 1.1 }); // fuselage
    P('M-2 32 L42 32 L33 42 L7 42 Z', light); // wings
    P('M-2 32 L42 32 L36 27 L4 27 Z', dark); // wing leading-edge shade
    engine(4, 34); engine(14, 38); engine(26, 38); engine(36, 34); // four engines
    R(15.5, 44, 9, 6, 1.6, glass); // cockpit windows
    R(15.5, 51, 9, 1, 0, darker); // deck line
    P('M14 56 L20 66 L26 56 Z', darker); // nose taper
    navLights(58);
    return finish(H);
  }

  // 'jet' — narrow-body freighter, twin underwing engines.
  const H = 58;
  R(10, 4, 20, 3, 1, dark); // tailplane
  R(17.5, 1.5, 5, 8, 1.2, accent); // tail fin footprint
  R(15, 6, 10, 44, 4.5, body, { stroke: '#fff', sw: 1.1 }); // fuselage
  P('M0 30 L40 30 L31 39 L9 39 Z', light); // wings
  P('M0 30 L40 30 L34 25.5 L6 25.5 Z', dark); // wing leading-edge shade
  engine(9, 33); engine(31, 33); // two underwing engines
  R(16, 42, 8, 5.5, 1.5, glass); // cockpit windows
  P('M15 48 L20 58 L25 48 Z', darker); // nose taper
  navLights(50);
  return finish(H);
}

// React renderer (react-native-svg) — place inside an <Svg>/<G>.
export const PlaneTopShapes = React.memo(function PlaneTopShapes({ type, body, accent, lights }) {
  const { shapes } = planeShapes(type, body, accent, { lights });
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

// HTML SVG string for the Leaflet WebView marker.
export function planeSvgString(type, body, accent, opts = {}) {
  const { w, h, shapes } = planeShapes(type, body, accent, opts);
  const els = shapes.map(p => p.k === 'rect'
    ? `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="${p.rx}" fill="${p.fill}"${p.stroke ? ` stroke="${p.stroke}" stroke-width="${p.sw}"` : ''}/>`
    : p.k === 'circle'
      ? `<circle cx="${p.cx}" cy="${p.cy}" r="${p.r}" fill="${p.fill}"/>`
      : p.k === 'path'
        ? `<path d="${p.d}" fill="${p.fill}"/>`
        : `<ellipse cx="${p.cx}" cy="${p.cy}" rx="${p.rx}" ry="${p.ry}" fill="${p.fill}"/>`).join('');
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${els}</svg>`;
}
