// Building tier catalog for the home hub and regional airports — mirrors the
// aircraft livery system (AIRCRAFT_COLORS in aircraft.js, reused here as the
// shared paint palette) so upgrading/painting real estate feels like the
// same feature, just for buildings instead of aircraft. `floors`/`bays` also
// drive the building art's silhouette (see ui/buildingArt.js) — a tier
// upgrade is visibly bigger, not just a number going up.
//
// `capacity` is the tier's real gameplay payoff: every owned building
// contributes its tier's capacity toward one company-wide fleet-size cap
// (see gameStore.fleetCapacity()) — buyTruck() (the aircraft-buy action) is
// blocked once the fleet hits the total. A maxed-out home hub alone caps out
// at 20 aircraft; regional airports are the other lever to grow past that
// without maxing the hub's tier.
export const HQ_TIERS = [
  { id: 0, name: 'Regional Airfield', cost: 0, floors: 3, capacity: 5 },
  { id: 1, name: 'City Airport', cost: 5000000, floors: 4, capacity: 10 },
  { id: 2, name: 'International Hub', cost: 20000000, floors: 5, capacity: 15 },
  { id: 3, name: 'Mega Cargo Hub', cost: 75000000, floors: 6, capacity: 20 },
];

export const GARAGE_TIERS = [
  { id: 0, name: 'Cargo Apron', cost: 0, bays: 2, capacity: 5 },
  { id: 1, name: 'Regional Terminal', cost: 2000000, bays: 3, capacity: 10 },
  { id: 2, name: 'International Cargo Terminal', cost: 8000000, bays: 4, capacity: 15 },
];
