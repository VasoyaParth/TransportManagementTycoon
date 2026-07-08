// Economy engine — authoritative revenue/cost formulas (FR-6.11).
// The preview and the completed payout use exactly this code path (NFR-7).

export const BASE_RATE = 4.5; // ₹ per km per ton (realistic Indian full-load freight)
export const DIESEL_PRICE = 92; // ₹ / litre
export const KWH_PRICE = 9; // ₹ / kWh

export function fuelCost(model, distanceKm) {
  if (model.propulsion === 'electric') {
    const kwhPerKm = model.battery / model.range;
    return distanceKm * kwhPerKm * KWH_PRICE;
  }
  return (distanceKm / model.eff) * DIESEL_PRICE;
}

export function maintenanceCost(model, distanceKm) {
  return distanceKm * model.maint;
}

// Highway tolls — scale with truck size (more axles/heavier => higher toll).
export const TOLL_PER_KM = 2.2; // ₹ / km baseline (light truck)
export function tollCost(model, distanceKm) {
  const axleFactor = 0.6 + (model.cargo / 34) * 0.9; // ~0.6 (mini) .. 1.5 (super-heavy)
  return distanceKm * TOLL_PER_KM * axleFactor;
}

// Full realistic P&L for a delivery. Revenue is cargo-driven (rate = ₹/km/ton
// for THIS cargo type) and truck-driven: a higher-rated truck earns a small
// handling premium, while a bigger truck pays more fuel/maintenance/tolls.
// boosts: { marketing: 0..0.5, doubleNext: bool }
export function deliveryEconomics({ model, distanceKm, cargoTons, rate = BASE_RATE, boosts = {} }) {
  const marketing = 1 + (boosts.marketing || 0);
  const revBoost = boosts.doubleNext ? 2 : 1;
  // Better-rated trucks command a slightly higher freight rate (client trust).
  const handling = 1 + (((model.rating || 4) - 4) * 0.04);
  const gross = distanceKm * cargoTons * rate * marketing * revBoost * handling;
  const fuel = fuelCost(model, distanceKm);
  const maint = maintenanceCost(model, distanceKm);
  const tolls = tollCost(model, distanceKm);
  const net = gross - fuel - maint - tolls;
  return {
    gross: Math.round(gross),
    fuel: Math.round(fuel),
    maint: Math.round(maint),
    tolls: Math.round(tolls),
    net: Math.round(net),
  };
}

// Trip duration is driven by REAL driving physics: game-hours = distance / top
// speed, then each game-hour maps to REAL_SEC_PER_GAME_HOUR seconds on screen
// (the same time base as the game clock, so an 800 km trip at 80 km/h really
// takes 10 game-hours). No arbitrary compression — everything is in km.
export const REAL_SEC_PER_GAME_HOUR = 3600; // 1 game hour = 1 real hour (true real-life time; offline progress finishes long trips)
export function tripDurationSec(model, distanceKm, speedBoost = 1) {
  const drivingHours = distanceKm / model.speed;
  const sec = (drivingHours * REAL_SEC_PER_GAME_HOUR) / speedBoost;
  return Math.max(20, Math.round(sec));
}

// Indian-style currency formatting: ₹12,34,567
export function inr(n) {
  const neg = n < 0;
  let s = Math.round(Math.abs(n)).toString();
  if (s.length > 3) {
    const last3 = s.slice(-3);
    let rest = s.slice(0, -3);
    rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    s = rest + ',' + last3;
  }
  return (neg ? '-₹' : '₹') + s;
}

export function inrShort(n) {
  const abs = Math.abs(n);
  if (abs >= 1e7) return (n < 0 ? '-' : '') + '₹' + (abs / 1e7).toFixed(2) + ' Cr';
  if (abs >= 1e5) return (n < 0 ? '-' : '') + '₹' + (abs / 1e5).toFixed(1) + ' L';
  return inr(n);
}
