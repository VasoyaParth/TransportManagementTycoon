// Building tier catalog for HQ and garages — mirrors the truck livery system
// (TRUCK_COLORS in trucks.js, reused here as the shared paint palette) so
// upgrading/painting real estate feels like the same feature, just for
// buildings instead of rigs. `floors`/`bays` also drive the building art's
// silhouette (see ui/buildingArt.js) — a tier upgrade is visibly bigger, not
// just a number going up.
//
// `capacity` is the tier's real gameplay payoff: every owned building
// contributes its tier's capacity toward one company-wide fleet-size cap
// (see gameStore.fleetCapacity()) — buyTruck() is blocked once the fleet
// hits the total. A maxed-out HQ alone caps out at 20 trucks; garages are
// the other lever to grow past that without maxing the HQ tier.
export const HQ_TIERS = [
  { id: 0, name: 'Startup Office', cost: 0, floors: 3, capacity: 5 },
  { id: 1, name: 'Corporate HQ', cost: 5000000, floors: 4, capacity: 10 },
  { id: 2, name: 'Regional Tower', cost: 20000000, floors: 5, capacity: 15 },
  { id: 3, name: 'Flagship Skyscraper', cost: 75000000, floors: 6, capacity: 20 },
];

export const GARAGE_TIERS = [
  { id: 0, name: 'Roadside Garage', cost: 0, bays: 2, capacity: 5 },
  { id: 1, name: 'Full-Service Depot', cost: 2000000, bays: 3, capacity: 10 },
  { id: 2, name: 'Mega Hub', cost: 8000000, bays: 4, capacity: 15 },
];
