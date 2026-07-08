// Premium light business-dashboard theme (NFR-4). Color is meaning:
// green = profit, red = loss, blue = info, amber = warning.
export const C = {
  bg: '#FFFFFF',
  bgSoft: '#F6F7F9',
  card: '#FFFFFF',
  border: '#E7E9EE',
  text: '#0B0F14',
  sub: '#5C6470',
  faint: '#98A1AD',
  green: '#0E9F5B',
  greenSoft: '#E7F7EF',
  red: '#DC3D43',
  redSoft: '#FDEBEC',
  blue: '#2563EB',
  blueSoft: '#EAF0FE',
  amber: '#D97706',
  amberSoft: '#FDF3E3',
  gold: '#B7791F',
  mapLand: '#EEF1F4',
  mapLandAlt: '#E8ECF0',
  mapStroke: '#FFFFFF',
  mapWater: '#DCE9F5',
  road: '#C3CAD4',
  route: '#2563EB',
};

export const FONT = {
  h1: { fontSize: 24, fontWeight: '800', color: C.text, letterSpacing: -0.4 },
  h2: { fontSize: 18, fontWeight: '700', color: C.text, letterSpacing: -0.2 },
  h3: { fontSize: 15, fontWeight: '700', color: C.text },
  body: { fontSize: 14, color: C.text },
  sub: { fontSize: 12.5, color: C.sub },
  tiny: { fontSize: 11, color: C.faint },
  mono: { fontSize: 13, fontVariant: ['tabular-nums'], color: C.text },
};

export const SHADOW = {
  card: {
    shadowColor: '#0B0F14', shadowOpacity: 0.06, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  pop: {
    shadowColor: '#0B0F14', shadowOpacity: 0.14, shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 }, elevation: 8,
  },
};

export const RADIUS = { sm: 8, md: 12, lg: 16, xl: 22 };
