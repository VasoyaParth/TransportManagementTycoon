// Stock Market — a pool of randomly-named, randomly-performing companies the
// player can research, buy/sell shares in, or found their own IPO in. Pure
// data generation, no React/RN imports, so it's trivial to unit test in Node.

const PREFIXES = [
  'Shree', 'Bharat', 'National', 'Global', 'United', 'Om', 'Surya', 'Ganga',
  'Silver', 'Golden', 'Prime', 'Apex', 'Metro', 'Royal', 'Star', 'Vishnu',
  'Laxmi', 'Continental', 'Horizon', 'Summit', 'Pioneer', 'Everest', 'Delta',
  'Titan', 'Falcon', 'Eagle', 'Pinnacle', 'NorthStar', 'Crescent', 'Radiant',
  'Zenith', 'Orbit', 'Vertex', 'Meridian', 'Century', 'Alpine', 'Coastal',
];
const CORES = [
  'Textiles', 'Motors', 'Steel', 'Chemicals', 'Pharma', 'Energy', 'Infra',
  'Foods', 'Retail', 'Finserv', 'Tech', 'Systems', 'Realty', 'Cement',
  'Power', 'Agro', 'Petro', 'Logistics', 'Media', 'Digital', 'Auto',
  'Mining', 'Ports', 'Aviation', 'Shipping', 'Renewables', 'Telecom',
  'Bank', 'Capital', 'Industries',
];
const SUFFIXES = ['Ltd', 'Group', 'Corp', 'Holdings', 'Enterprises', 'Industries', '& Sons', 'Ventures'];

export const STOCK_SECTORS = [
  'Logistics', 'Energy', 'Technology', 'Retail', 'Finance', 'Manufacturing',
  'Agriculture', 'Realty', 'Pharma', 'Media', 'Automotive', 'Mining',
];

function pick(arr, rnd) { return arr[Math.floor(rnd() * arr.length)]; }

// Generates `count` unique-named companies with a random starting price,
// volatility and drift — every company's future performance is otherwise
// unscripted, it just random-walks day to day (see stockDailyStep below).
export function generateStockPool(count, rnd = Math.random) {
  const used = new Set();
  const out = [];
  let guard = 0;
  while (out.length < count && guard < count * 25) {
    guard++;
    const name = `${pick(PREFIXES, rnd)} ${pick(CORES, rnd)} ${pick(SUFFIXES, rnd)}`;
    if (used.has(name)) continue;
    used.add(name);
    const sector = pick(STOCK_SECTORS, rnd);
    const basePrice = Math.round((20 + rnd() * 980) * 100) / 100; // ₹20 - ₹1,000
    const vol = 0.01 + rnd() * 0.05; // 1%-6% daily volatility
    const drift = (rnd() - 0.45) * 0.01; // small bias, slightly upward on average
    out.push({
      id: `stk-${out.length}-${Math.floor(rnd() * 1e6)}`,
      name, sector, price: basePrice, vol, drift,
      history: [{ day: 1, price: basePrice }],
      founder: null,
    });
  }
  return out;
}

// One random-walk day-step for a single stock's price. Kept as a pure
// function (rnd injectable) so it's independently testable.
export function stockDailyStep(stock, day, rnd = Math.random) {
  const shock = (rnd() - 0.5) * 2; // -1..1
  const pct = stock.drift + stock.vol * shock;
  const next = Math.max(2, Math.round(stock.price * (1 + pct) * 100) / 100);
  // Cap history so 1,500+ companies don't bloat AsyncStorage forever — 120
  // daily points (~4 months of continuous play) keeps 1Y/3Y returns using
  // best-available data (see stockReturnOverDays) without unbounded growth.
  const history = [...(stock.history || []), { day, price: next }].slice(-120);
  return { ...stock, price: next, history };
}

// Return over the trailing N game-days, comparing current price against the
// oldest history point that's still >= N days old (or the very first point
// if the stock hasn't existed that long yet — degrades gracefully instead
// of showing a misleading number).
export function stockReturnOverDays(stock, days) {
  const hist = stock.history || [];
  if (hist.length < 2) return 0;
  const nowDay = hist[hist.length - 1].day;
  const targetDay = nowDay - days;
  let base = hist[0];
  for (const h of hist) {
    if (h.day <= targetDay) base = h;
    else break;
  }
  if (!base.price) return 0;
  return (stock.price - base.price) / base.price;
}

export function stockYearReturn(stock) { return stockReturnOverDays(stock, 365); }

// Deterministic "fundamentals" — market cap, profit, tax, P/E — derived
// purely from the stock's own id/price/vol so they're stable across
// renders and sessions without needing to store extra fields per company.
function seedFrom(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 100000;
  return h / 100000;
}
export function stockFundamentals(stock) {
  const seed = seedFrom(stock.id);
  const sharesOutstanding = 500000 + Math.round(seed * 4500000); // 5L–50L shares
  const marketCap = stock.price * sharesOutstanding;
  const margin = 0.06 + seed * 0.22; // 6%–28% net margin, flavor of the sector
  const annualRevenue = marketCap * (0.4 + seed * 1.2); // rough revenue multiple
  const annualProfit = annualRevenue * margin;
  const taxRate = 0.25; // flat corporate tax, India flavor
  const eps = annualProfit / sharesOutstanding;
  const peRatio = eps > 0 ? stock.price / eps : 0;
  return { sharesOutstanding, marketCap, annualRevenue, annualProfit, taxRate, eps, peRatio };
}

// Timeframe presets for the detail chart / return badges. 1H/3H are "live"
// timeframes — driven by liveJitterPct below (real-clock movement) rather
// than the daily-close history, for a market that visibly ticks while
// you're actually looking at it.
export const STOCK_TIMEFRAMES = [
  { key: '1H', label: '1H', live: true, hours: 1 },
  { key: '3H', label: '3H', live: true, hours: 3 },
  { key: '1D', label: '1D', days: 1 },
  { key: '3D', label: '3D', days: 3 },
  { key: '1M', label: '1M', days: 30 },
  { key: '3M', label: '3M', days: 90 },
  { key: '1Y', label: '1Y', days: 365 },
  { key: '3Y', label: '3Y', days: 1095 },
];

// Deterministic tiny live wiggle (±~1.5%) layered on top of a stock's last
// daily close — a pure function of (id, real-clock ms), so it's reproducible
// across re-renders (no jarring jumps) but genuinely moves second to second.
// This gives the "market never sleeps" feel for 1H/3H views without storing
// any intraday history for 1000s of companies.
export function liveJitterPct(seed, now) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 9973;
  const t = now / 60000; // minutes
  return Math.sin(t / 3 + h) * 0.008 + Math.sin(t / 11 + h * 1.7) * 0.005 + Math.sin(t / 1.3 + h * 3.1) * 0.002;
}

// Real trading hours (device clock), same window as NSE/BSE: 9:15 AM to
// 3:30 PM. Outside that window the exchange is closed — the live ticker and
// ambient trade feed freeze at the last close instead of pretending to move.
export function isMarketOpen(now = Date.now()) {
  const d = new Date(now);
  const mins = d.getHours() * 60 + d.getMinutes();
  return mins >= 9 * 60 + 15 && mins <= 15 * 60 + 30;
}

export function liveStockPrice(stock, now) {
  if (!isMarketOpen(now)) return stock.price;
  return Math.max(0.5, stock.price * (1 + liveJitterPct(stock.id, now)));
}

// Fabricated ambient market activity — no real other players exist offline,
// so bots/system simulate the "someone just traded" feel. Purely cosmetic:
// doesn't touch price or the player's portfolio.
const BOT_NAMES = [
  'RK Traders', 'Anonymous HNI', 'Sharma Capital', 'QuantDesk Bot', 'Retail Investor',
  'Patel Fund', 'Momentum Algo', 'Gupta Family Office', 'Nifty Bull', 'Bear Cartel',
];
export function fakeTradeFor(stock, now, rnd = Math.random) {
  const trending = liveJitterPct(stock.id, now) >= liveJitterPct(stock.id, now - 60000);
  const side = rnd() < (trending ? 0.65 : 0.35) ? 'buy' : 'sell';
  const qty = Math.round(10 + rnd() * 490);
  const trader = BOT_NAMES[Math.floor(rnd() * BOT_NAMES.length)];
  return { trader, side, qty, ts: now };
}
