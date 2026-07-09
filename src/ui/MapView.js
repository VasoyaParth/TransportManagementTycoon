// Offline India map — pure SVG, no tiles, no internet. Pan/zoom via
// PanResponder, states rendered from bundled GeoJSON, highways drawn as the
// real road network, trucks animate along real route polylines with heading
// rotation. India only.
import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { View, PanResponder, Text, Pressable, StyleSheet, Animated } from 'react-native';
import Svg, { G, Polygon, Polyline, Circle, Path, Rect, Ellipse, Text as SvgText } from 'react-native-svg';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { INDIA_STATES } from '../data/indiaMap';
import { ROAD_NODES, ROAD_EDGES } from '../data/highways';
import { CITIES } from '../data/cities';
import { STATIONS } from '../engine/stations';
import { project, WORLD_W, WORLD_H, pointAlong } from '../engine/geo';
import { C } from './theme';
import { useGame, modelById } from '../store/gameStore';
import { cityById } from '../engine/routing';
import { TruckTopShapes, truckShapes, bodyTypeFor, defaultBodyColor, headlightFor, isNightHour, FerryTopShape } from './truckArt';
import { useEasterEggTap } from './components';

// Darken/lighten a #rrggbb colour by pct (-1..1) for pseudo-3D shading.
function shade(hex, pct) {
  const h = (hex || '#3A5A8C').replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  const f = pct < 0 ? 0 : 255, p = Math.abs(pct);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const to = v => Math.round((f - v) * p + v);
  return '#' + ((1 << 24) + (to(r) << 16) + (to(g) << 8) + to(b)).toString(16).slice(1);
}

// ---- Precomputed static geometry (projected once) ----
const STATE_POLYS = INDIA_STATES.map((s, i) => ({
  name: s.name,
  alt: i % 2 === 0,
  polys: s.polys.map(ring => ring.map(([lng, lat]) => {
    const p = project(lat, lng);
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }).join(' ')),
}));

const ROAD_LINES = ROAD_EDGES.map(e => {
  const a = ROAD_NODES[e.a], b = ROAD_NODES[e.b];
  if (!a || !b) return null;
  const pts = [a, ...(e.via || []).map(([lat, lng]) => ({ lat, lng })), b];
  return pts.map(p => { const q = project(p.lat, p.lng); return `${q.x.toFixed(1)},${q.y.toFixed(1)}`; }).join(' ');
}).filter(Boolean);

const CITY_PTS = CITIES.map(c => ({ ...c, ...project(c.lat, c.lng) }));
const STATION_PTS = STATIONS.map(s => ({ ...s, ...project(s.lat, s.lng) }));

function routeToSvg(points) {
  return points.map(p => { const q = project(p.lat, p.lng); return `${q.x.toFixed(1)},${q.y.toFixed(1)}`; }).join(' ');
}

export default function IndiaMap({ onCityPick, pickingMode, onCancelPick, focus, onTruckTap, showStationsDefault = true }) {
  const { width: undefined_w } = {};
  const [size, setSize] = useState({ w: 1, h: 1 });
  const [view, setView] = useState({ x: WORLD_W * 0.28, y: WORLD_H * 0.25, scale: 1.4 }); // center-ish on India
  const viewRef = useRef(view);
  viewRef.current = view;
  const [showCities, setShowCities] = useState(true);
  const [showStations, setShowStations] = useState(showStationsDefault);
  const [popup, setPopup] = useState(null); // {kind, data, x, y}
  const trucks = useGame(s => s.trucks);
  const deliveries = useGame(s => s.deliveries);
  const company = useGame(s => s.company);
  const corridors = useGame(s => s.corridors || []);
  const [, setFrame] = useState(0);

  // Throttled ~12fps rerender only while trucks are moving (smooth but light).
  useEffect(() => {
    if (!deliveries.length) return;
    const iv = setInterval(() => setFrame(f => (f + 1) % 100000), 80);
    return () => clearInterval(iv);
  }, [deliveries.length]);

  // focus camera on {lat,lng} when requested
  useEffect(() => {
    if (!focus) return;
    const p = project(focus.lat, focus.lng);
    const scale = focus.scale || Math.max(viewRef.current.scale, 3);
    setView({ x: p.x - size.w / 2 / scale, y: p.y - size.h / 2 / scale, scale });
  }, [focus]);

  const gesture = useRef({ startView: null, startDist: 0, startScale: 1 });
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 3 || Math.abs(g.dy) > 3,
    onPanResponderGrant: (evt) => {
      gesture.current.startView = { ...viewRef.current };
      gesture.current.startDist = 0;
      setPopup(null);
    },
    onPanResponderMove: (evt, g) => {
      const t = evt.nativeEvent.touches;
      const sv = gesture.current.startView;
      if (t.length >= 2) {
        const dx = t[0].pageX - t[1].pageX, dy = t[0].pageY - t[1].pageY;
        const dist = Math.hypot(dx, dy);
        if (!gesture.current.startDist) {
          gesture.current.startDist = dist;
          gesture.current.startScale = viewRef.current.scale;
          gesture.current.startView = { ...viewRef.current };
          return;
        }
        const factor = dist / gesture.current.startDist;
        const ns = Math.min(24, Math.max(0.8, gesture.current.startScale * factor));
        const cx = sv.x + (size.w / 2) / gesture.current.startScale;
        const cy = sv.y + (size.h / 2) / gesture.current.startScale;
        setView({ scale: ns, x: cx - size.w / 2 / ns, y: cy - size.h / 2 / ns });
      } else if (sv) {
        setView({ ...viewRef.current, x: sv.x - g.dx / viewRef.current.scale, y: sv.y - g.dy / viewRef.current.scale });
      }
    },
  }), [size]);

  const toScreen = useCallback(p => ({
    x: (p.x - view.x) * view.scale,
    y: (p.y - view.y) * view.scale,
  }), [view]);

  const screenTapToWorld = (px, py) => ({ x: view.x + px / view.scale, y: view.y + py / view.scale });

  const handleTap = (evt) => {
    const { locationX, locationY } = evt.nativeEvent;
    const w = screenTapToWorld(locationX, locationY);
    const hitR = 14 / view.scale;
    // trucks first
    for (const t of trucks) {
      const tp = truckPos(t);
      const q = project(tp.lat, tp.lng);
      if (Math.hypot(q.x - w.x, q.y - w.y) < hitR) {
        if (onTruckTap) onTruckTap(t);
        return;
      }
    }
    // cities
    let best = null, bd = hitR;
    for (const c of CITY_PTS) {
      const d = Math.hypot(c.x - w.x, c.y - w.y);
      if (d < bd) { bd = d; best = c; }
    }
    if (best) {
      if (pickingMode && onCityPick) { onCityPick(best); return; }
      setPopup({ kind: 'city', data: best, sx: locationX, sy: locationY });
      return;
    }
    // stations
    if (showStations && view.scale > 5) {
      for (const s of STATION_PTS) {
        if (Math.hypot(s.x - w.x, s.y - w.y) < hitR) {
          setPopup({ kind: 'station', data: s, sx: locationX, sy: locationY });
          return;
        }
      }
    }
    setPopup(null);
  };

  const truckPos = (t) => {
    const d = deliveries.find(x => x.truckId === t.id);
    if (!d) return { lat: t.lat, lng: t.lng, heading: 0, ferryOn: false, ferryLoading: false };
    const now = Date.now();
    // While an accident/theft incident is unresolved, freeze the truck in place
    // instead of letting it keep crawling forward — it visibly stops until the
    // mechanic arrives (or the incident times out), then resumes with no jump.
    let effNow = now;
    if (d.incident) {
      effNow = now < d.incident.resolveAt ? d.incident.startedAt : now - (d.incident.resolveAt - d.incident.startedAt);
    }
    const prog = Math.min(1, Math.max(0, (effNow - d.startedAt) / (d.endsAt - d.startedAt)));
    const pos = pointAlong(d.route.points, d.route.cum, prog);
    const fs = d.route.ferrySegment;
    let ferryOn = false, ferryLoading = false;
    if (fs && prog >= fs.startFrac && prog <= fs.endFrac) {
      ferryOn = true;
      const loadWin = Math.min((fs.endFrac - fs.startFrac) * 0.25, 0.015);
      ferryLoading = prog <= fs.startFrac + loadWin;
    }
    return { ...pos, ferryOn, ferryLoading, incident: d.incident || null };
  };

  const zoomBy = (f) => {
    const ns = Math.min(24, Math.max(0.8, view.scale * f));
    const cx = view.x + size.w / 2 / view.scale;
    const cy = view.y + size.h / 2 / view.scale;
    setView({ scale: ns, x: cx - size.w / 2 / ns, y: cy - size.h / 2 / ns });
  };

  const tapHqEgg = useEasterEggTap('hq_home', 5);
  const centerHQ = () => {
    if (!company) return;
    const hq = cityById(company.hqCityId);
    const p = project(hq.lat, hq.lng);
    const scale = 4;
    setView({ scale, x: p.x - size.w / 2 / scale, y: p.y - size.h / 2 / scale });
    tapHqEgg();
  };

  const hq = company ? cityById(company.hqCityId) : null;
  const hqP = hq ? project(hq.lat, hq.lng) : null;
  const hubs = useGame(s => s.hubs || []);
  const buyHub = useGame(s => s.buyHub);

  const cityVisible = c => (c.tier === 1) || (c.tier === 2 && view.scale > 2.2) || view.scale > 4.5;
  // Partial (not full) zoom compensation — HQ/hub/truck icons, roads and city
  // labels still shrink somewhat when zoomed out instead of staying pinned
  // at a constant, oversized screen size at every zoom level.
  const inv = 1 / Math.sqrt(view.scale);

  // Static layer (land, highways, unlocked corridors, stations, cities, HQ,
  // hubs) — only recomputed when the camera or toggles change, NOT every truck
  // animation frame. This is the key performance fix for smooth movement.
  const staticLayer = useMemo(() => (
    <G>
      {STATE_POLYS.map((s, i) => s.polys.map((pts, j) => (
        <Polygon key={`${i}-${j}`} points={pts}
          fill={s.alt ? C.mapLand : C.mapLandAlt} stroke={C.mapStroke} strokeWidth={0.8 * inv} />
      )))}
      {view.scale > 1.4 && ROAD_LINES.map((pts, i) => (
        <Polyline key={i} points={pts} fill="none" stroke={C.road}
          strokeWidth={Math.min(1.6, 2.2 * inv)} strokeLinejoin="round" strokeLinecap="round" />
      ))}
      {/* Unlocked corridors — stay highlighted after you run them */}
      {corridors.map(c => (
        <Polyline key={c.id} points={routeToSvg(c.points)} fill="none" stroke={C.blue}
          strokeWidth={2 * inv} opacity={0.28} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {showStations && view.scale > 4 && STATION_PTS.map(s => (
        <Circle key={s.id} cx={s.x} cy={s.y} r={2.6 * inv}
          fill={s.type === 'ev' ? C.green : C.amber} stroke="#fff" strokeWidth={0.6 * inv} opacity={0.9} />
      ))}
      {showCities && CITY_PTS.filter(cityVisible).map(c => (
        <G key={c.id}>
          <Circle cx={c.x} cy={c.y} r={(c.tier === 1 ? 5 : c.tier === 2 ? 3.4 : 2.4) / Math.sqrt(view.scale)}
            fill={pickingMode ? C.blue : '#8792A0'} stroke="#fff" strokeWidth={inv} />
          {(c.tier === 1 || view.scale > 3.4) && (
            <SvgText x={c.x + 6 * inv} y={c.y + 3 * inv}
              fontSize={Math.max(3.2, 11 * inv)} fill={C.sub} fontWeight="600">{c.name}</SvgText>
          )}
        </G>
      ))}
      {/* Purchased hubs (garages) — small pseudo-3D building */}
      {hubs.filter(h => !h.hq).map(h => {
        const c = cityById(h.cityId); if (!c) return null; const q = project(c.lat, c.lng);
        return <G key={h.cityId} transform={`translate(${q.x},${q.y}) scale(${inv})`}>
          <Ellipse cx={1} cy={7} rx={9} ry={3} fill="rgba(11,15,20,0.18)" />
          {/* extruded body */}
          <Path d="M -7 6 L -7 -2 L 7 -2 L 7 6 Z" fill="#5C6470" />
          <Path d="M 7 6 L 7 -2 L 10 -4 L 10 4 Z" fill="#464C56" />
          <Path d="M -7 -2 L 7 -2 L 10 -4 L -4 -4 Z" fill="#767E8A" />
          {/* garage door */}
          <Rect x={-4} y={0} width={8} height={6} rx={0.6} fill="#E7E9EE" />
        </G>;
      })}
      {/* HQ — pseudo-3D headquarters tower with shadow */}
      {hqP && (
        <G transform={`translate(${hqP.x},${hqP.y}) scale(${inv})`}>
          <Ellipse cx={1.5} cy={11} rx={13} ry={4} fill="rgba(11,15,20,0.20)" />
          {/* right side face (darker) */}
          <Path d="M 8 10 L 8 -5 L 12 -8 L 12 7 Z" fill="#1E4FB8" />
          {/* top face */}
          <Path d="M -8 -5 L 8 -5 L 12 -8 L -4 -8 Z" fill="#5B8DF0" />
          {/* front face */}
          <Rect x={-8} y={-5} width={16} height={15} fill="#2563EB" />
          {/* windows */}
          <Rect x={-5.5} y={-2} width={3} height={3} fill="#DCE7FA" /><Rect x={-1} y={-2} width={3} height={3} fill="#DCE7FA" />
          <Rect x={3.5} y={-2} width={3} height={3} fill="#DCE7FA" /><Rect x={-5.5} y={3.5} width={3} height={3} fill="#DCE7FA" />
          <Rect x={-1} y={3.5} width={3} height={3} fill="#DCE7FA" /><Rect x={3.5} y={3.5} width={3} height={3} fill="#DCE7FA" />
          {/* flag */}
          <Rect x={-0.4} y={-14} width={0.8} height={6} fill="#0B0F14" />
          <Path d="M 0.4 -14 L 5 -12.5 L 0.4 -11 Z" fill={C.amber} />
        </G>
      )}
    </G>
  ), [view, showCities, showStations, pickingMode, corridors, hubs, hqP && hqP.x]);

  return (
    <View style={{ flex: 1, backgroundColor: C.mapWater }}
      onLayout={e => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      {...pan.panHandlers}
    >
      <Pressable style={StyleSheet.absoluteFill} onPress={handleTap}>
        <Svg width="100%" height="100%">
          <G transform={`scale(${view.scale}) translate(${-view.x}, ${-view.y})`}>
            {staticLayer}
            {/* Active routes (animated dashes) */}
            {deliveries.map(d => (
              <Polyline key={d.id} points={routeToSvg(d.route.points)} fill="none"
                stroke={C.route} strokeWidth={3 * inv}
                strokeDasharray={`${8 * inv},${6 * inv}`}
                strokeLinecap="round" opacity={0.95} />
            ))}
            {deliveries.flatMap(d => d.stops.map((s, i) => {
              const q = project(s.lat, s.lng);
              return <Circle key={d.id + i} cx={q.x} cy={q.y} r={4 * inv} fill={C.amber} stroke="#fff" strokeWidth={1.2 * inv} />;
            }))}
            {/* Trucks — shared per-model top-down artwork (same as the showroom) */}
            {trucks.map(t => {
              const p = truckPos(t);
              const q = project(p.lat, p.lng);
              const model = modelById(t.modelId);
              const body = t.color || defaultBodyColor(model);
              const accent = t.status === 'delivering' ? C.green : t.status === 'building' ? C.amber : t.status === 'broken' ? C.red : '#9DB2D6';
              const bt = bodyTypeFor(model);
              // Headlights on for trucks driving at night (in-game clock).
              const night = isNightHour(useGame.getState().gameDay().hour);
              const lights = night && t.status === 'delivering' ? headlightFor(model) : null;
              // Marker footprint per silhouette; art canvas is 40 units wide.
              const sz = (bt === 'semi' ? 2.1 : bt === 'rigid' ? 1.7 : bt === 'box' ? 1.45 : 1.2) * inv;
              const { bodyH } = truckShapes(bt, body, accent, { lights });
              const k = sz * 0.32; // art units -> map units
              // Damage/theft badge — small colored dot with a glyph, offset
              // above the truck, shown regardless of ferry state.
              const incidentBadge = p.incident ? (
                <G transform={`translate(${q.x + 5 * sz}, ${q.y - 5 * sz})`}>
                  <Circle r={3.2 * sz} fill={p.incident.type === 'accident' ? C.red : '#7D3C98'} stroke="#fff" strokeWidth={0.8 * sz} />
                  <SvgText x={0} y={1.2 * sz} fontSize={4.2 * sz} fontWeight="700" fill="#fff" textAnchor="middle">
                    {p.incident.type === 'accident' ? '!' : '$'}
                  </SvgText>
                </G>
              ) : null;
              if (p.ferryOn && !p.ferryLoading) {
                // Crossing the sea hop — swap the truck art for a ferry icon.
                return (
                  <G key={t.id}>
                    <Ellipse cx={q.x + 1.2 * sz} cy={q.y + 2 * sz} rx={6.4 * sz} ry={3.4 * sz} fill="rgba(11,15,20,0.20)" />
                    <G transform={`translate(${q.x}, ${q.y}) rotate(${p.heading + 180}) scale(${k}) translate(-20, -18)`}>
                      <FerryTopShape />
                    </G>
                    {incidentBadge}
                  </G>
                );
              }
              if (p.ferryLoading) {
                // Brief loading state at the ferry dock — truck fades/shrinks with a pulsing dot.
                const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 260);
                return (
                  <G key={t.id}>
                    <Circle cx={q.x} cy={q.y} r={(7 + 5 * pulse) * sz} fill={C.blue} opacity={0.18} />
                    <G opacity={0.55} transform={`translate(${q.x}, ${q.y}) rotate(${p.heading + 180}) scale(${k * 0.8}) translate(-20, ${-bodyH / 2})`}>
                      <TruckTopShapes type={bt} body={body} accent={accent} lights={lights} />
                    </G>
                    {incidentBadge}
                  </G>
                );
              }
              return (
                <G key={t.id}>
                  {/* soft ground shadow (kept flat, not rotated) */}
                  <Ellipse cx={q.x + 1.2 * sz} cy={q.y + 2 * sz} rx={5.6 * sz} ry={3.2 * sz} fill="rgba(11,15,20,0.20)" />
                  <G transform={`translate(${q.x}, ${q.y}) rotate(${p.heading + 180}) scale(${k}) translate(-20, ${-bodyH / 2})`}>
                    <TruckTopShapes type={bt} body={body} accent={accent} lights={lights} />
                  </G>
                  {incidentBadge}
                </G>
              );
            })}
          </G>
        </Svg>
      </Pressable>

      {/* Picking-mode banner */}
      {pickingMode && (
        <View style={st.pickBanner}>
          <Icon name="map-marker-question" size={16} color="#fff" />
          <Text style={st.pickTxt}>Tap a city to set the destination</Text>
          <Pressable onPress={onCancelPick}><Text style={[st.pickTxt, { textDecorationLine: 'underline' }]}>Cancel</Text></Pressable>
        </View>
      )}

      {/* Popup */}
      {popup && (
        <View style={[st.popup, { left: Math.min(popup.sx, size.w - 190), top: Math.max(10, popup.sy - 90) }]}>
          {popup.kind === 'city' ? (
            <>
              <Text style={st.popTitle}>{popup.data.name}</Text>
              <Text style={st.popSub}>{popup.data.state} · Pop {(popup.data.pop / 1e5).toFixed(1)}L · Tier {popup.data.tier}</Text>
              {hubs.some(h => h.cityId === popup.data.id) ? (
                <View style={st.hubTag}><Icon name="garage" size={12} color={C.blue} /><Text style={st.hubTagTxt}>Your hub</Text></View>
              ) : (
                <Pressable style={st.hubBtn} onPress={() => {
                  const r = buyHub(popup.data.id);
                  setPopup(null);
                }}>
                  <Icon name="garage-variant" size={13} color="#fff" />
                  <Text style={st.hubBtnTxt}>Buy Hub · ₹15L</Text>
                </Pressable>
              )}
            </>
          ) : (
            <>
              <Text style={st.popTitle}>{popup.data.name}</Text>
              <Text style={st.popSub}>{popup.data.type === 'ev' ? `EV charging · ₹${popup.data.price}/kWh` : `Diesel · ₹${popup.data.price}/L`}</Text>
            </>
          )}
        </View>
      )}

      {/* Map controls (pinch to zoom — no +/- buttons) */}
      <View style={st.controls}>
        <Ctl icon="home-map-marker" onPress={centerHQ} />
        <Ctl icon="gas-station" active={showStations} onPress={() => setShowStations(v => !v)} />
        <Ctl icon="city-variant-outline" active={showCities} onPress={() => setShowCities(v => !v)} />
      </View>

    </View>
  );
}

function Ctl({ icon, onPress, active }) {
  return (
    <Pressable onPress={onPress} style={[st.ctl, active === false && { opacity: 0.45 }]}>
      <Icon name={icon} size={20} color={C.text} />
    </Pressable>
  );
}

const st = StyleSheet.create({
  controls: { position: 'absolute', right: 12, top: 12 },
  ctl: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
    borderWidth: 1, borderColor: C.border,
  },
  legend: {
    position: 'absolute', left: 12, bottom: 12, flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: C.border,
  },
  pickBanner: {
    position: 'absolute', top: 12, alignSelf: 'center', flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.blue, borderRadius: 24, paddingHorizontal: 14, paddingVertical: 8, gap: 8,
  },
  pickTxt: { color: '#fff', fontWeight: '700', fontSize: 12.5, marginHorizontal: 4 },
  popup: {
    position: 'absolute', width: 180, backgroundColor: '#fff', borderRadius: 12, padding: 10,
    borderWidth: 1, borderColor: C.border, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, elevation: 5,
  },
  popTitle: { fontWeight: '800', fontSize: 13.5, color: C.text },
  popSub: { fontSize: 11.5, color: C.sub, marginTop: 2 },
  hubBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    backgroundColor: C.text, borderRadius: 8, paddingVertical: 7, marginTop: 8 },
  hubBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 12 },
  hubTag: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  hubTagTxt: { color: C.blue, fontWeight: '700', fontSize: 11.5 },
});
