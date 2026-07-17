// Building tier catalog for HQ and garages — mirrors the truck livery system
// (TRUCK_COLORS in trucks.js, reused here as the shared paint palette) so
// upgrading/painting real estate feels like the same feature, just for
// buildings instead of rigs. `floors`/`bays` also drive the building art's
// silhouette (see ui/buildingArt.js) — a tier upgrade is visibly bigger, not
// just a number going up.
export const HQ_TIERS = [
  { id: 0, name: 'Startup Office', cost: 0, floors: 3 },
  { id: 1, name: 'Corporate HQ', cost: 5000000, floors: 4 },
  { id: 2, name: 'Regional Tower', cost: 20000000, floors: 5 },
  { id: 3, name: 'Flagship Skyscraper', cost: 75000000, floors: 6 },
];

export const GARAGE_TIERS = [
  { id: 0, name: 'Roadside Garage', cost: 0, bays: 2 },
  { id: 1, name: 'Full-Service Depot', cost: 2000000, bays: 3 },
  { id: 2, name: 'Mega Hub', cost: 8000000, bays: 4 },
];
