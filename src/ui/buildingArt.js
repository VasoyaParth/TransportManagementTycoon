// Shared top-down building artwork for the home hub control tower and
// regional airport terminals — mirrors planeArt.js: one shape-descriptor
// builder feeds both the in-app RN preview and the Leaflet WebView map (see
// leafletHtml.js, which hand-writes an equivalent plain-JS version of these
// same two functions since a WebView string can't import RN modules — same
// split the aircraft art already lives with).
import React from 'react';
import { G, Rect, Path } from 'react-native-svg';
import { shade } from './planeArt';

export const DEFAULT_HQ_COLOR = '#2563EB';
export const DEFAULT_GARAGE_COLOR = '#5C6470';

// kind: 'hq' (home hub control tower) | 'garage' (regional airport
// terminal). `tier` is the catalog entry from data/buildings.js
// (HQ_TIERS[n] / GARAGE_TIERS[n]) — floors/bays drive the silhouette size.
export function buildingShapes(kind, color, tier) {
  const s = [];
  const R = (x, y, w, h, rx, fill) => s.push({ k: 'rect', x, y, w, h, rx, fill });
  const P = (d, fill) => s.push({ k: 'path', d, fill });

  if (kind === 'hq') {
    const body = color || DEFAULT_HQ_COLOR;
    const dark = shade(body, -0.3), light = shade(body, 0.25);
    const glass = '#DCE7FA';
    const floors = tier?.floors || 3;
    const W = 44, floorH = 8, y0 = 14;
    const faceH = floors * floorH + 4;
    const H = y0 + faceH + 4;
    R(21, 2, 2, y0 - 2, 0, '#0B0F14');
    P(`M23 2 L33 5.5 L23 9 Z`, '#D97706');
    P(`M30 ${H} L30 ${y0} L38 ${y0 - 5} L38 ${H - 5} Z`, dark);
    P(`M6 ${y0} L30 ${y0} L38 ${y0 - 5} L14 ${y0 - 5} Z`, light);
    R(6, y0, 24, faceH, 0, body);
    for (let f = 0; f < floors; f++) {
      const wy = y0 + 4 + f * floorH;
      for (let c = 0; c < 3; c++) R(9 + c * 7, wy, 5, 5, 0, glass);
    }
    R(14, H - 4, 8, 4, 0, glass);
    return { w: W, h: H, shapes: s };
  }

  // 'garage'
  const body = color || DEFAULT_GARAGE_COLOR;
  const dark = shade(body, -0.3), light = shade(body, 0.2);
  const glass = '#E7E9EE';
  const bays = tier?.bays || 2;
  const W = 16 + bays * 12, H = 26;
  P(`M${W - 5} ${H - 2} L${W - 5} 8 L${W - 1} 5 L${W - 1} ${H - 5} Z`, dark);
  P(`M3 8 L${W - 5} 8 L${W - 1} 5 L7 5 Z`, light);
  R(3, 8, W - 8, H - 8, 0, body);
  for (let b = 0; b < bays; b++) {
    const bx = 6 + b * 12;
    R(bx, 13, 9, H - 13, 1, glass);
    R(bx, 15.5, 9, 1.4, 0, '#B9BFC9');
    R(bx, 19, 9, 1.4, 0, '#B9BFC9');
  }
  return { w: W, h: H, shapes: s };
}

export const BuildingTopShapes = React.memo(function BuildingTopShapes({ kind, color, tier }) {
  const { shapes } = buildingShapes(kind, color, tier);
  return (
    <G>
      {shapes.map((p, i) => p.k === 'rect'
        ? <Rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} rx={p.rx} fill={p.fill} />
        : <Path key={i} d={p.d} fill={p.fill} />)}
    </G>
  );
});
