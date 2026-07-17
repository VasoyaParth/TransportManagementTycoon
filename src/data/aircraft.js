// Aircraft model catalog — cargo airline edition (forked from the trucking
// game's truck catalog; same field shape so every store/economy formula
// that consumed the old truck catalog works unchanged). 3 tiers, 3 propulsion types.
// speeds km/h (cruise), cargo tons, tank L (jet fuel) or battery kWh,
// eff km/L or range km, maint ₹/km, price ₹, build seconds (fit-out time).
// `icon` = MaterialCommunityIcons name.
export const AIRCRAFT_MODELS = [
  {
    id: 'cessline-208', name: 'Cessline Caravan 208F', brand: 'Cessline',
    tier: 1, propulsion: 'diesel', rating: 4.0, icon: 'airplane',
    desc: 'The legendary light freighter — perfect for short feeder hops and remote strips.',
    speed: 340, cargo: 1.4, tank: 1250, eff: 0.6, range: 1800, maint: 18, price: 3200000, build: 480,
  },
  {
    id: 'cessline-408', name: 'Cessline SkyCourier 408F', brand: 'Cessline',
    tier: 1, propulsion: 'diesel', rating: 4.2, icon: 'airplane',
    desc: 'Twin-turboprop feeder with a boxy cargo hold built for parcel runs.',
    speed: 359, cargo: 2.7, tank: 1650, eff: 0.55, range: 1750, maint: 20, price: 4800000, build: 540,
  },
  {
    id: 'aeroturbo-42f', name: 'AeroTurbo ATX 42F', brand: 'AeroTurbo',
    tier: 1, propulsion: 'diesel', rating: 4.1, icon: 'airplane',
    desc: 'Rugged regional turboprop that built the short-haul feeder network.',
    speed: 480, cargo: 5.4, tank: 3000, eff: 0.45, range: 1400, maint: 24, price: 9500000, build: 660,
  },
  {
    id: 'aeroturbo-72f', name: 'AeroTurbo ATX 72F', brand: 'AeroTurbo',
    tier: 2, propulsion: 'diesel', rating: 4.3, icon: 'airplane',
    desc: 'The modern regional-freight workhorse — efficient, quick to turn around.',
    speed: 510, cargo: 8.1, tank: 5000, eff: 0.42, range: 1500, maint: 28, price: 14000000, build: 780,
  },
  {
    id: 'havitech-q400f', name: 'Havitech Dash Q400F', brand: 'Havitech',
    tier: 2, propulsion: 'diesel', rating: 4.2, icon: 'airplane',
    desc: 'Fast turboprop freighter that out-runs the jets on short sectors.',
    speed: 555, cargo: 7.5, tank: 4800, eff: 0.4, range: 1600, maint: 27, price: 13200000, build: 780,
  },
  {
    id: 'cessline-ecaravan', name: 'Cessline eCaravan 208E', brand: 'Cessline',
    tier: 1, propulsion: 'electric', rating: 4.3, icon: 'lightning-bolt-circle',
    desc: 'Silent zero-emission feeder — proving electric freight can fly today.',
    speed: 300, cargo: 1.1, battery: 900, range: 320, maint: 10, price: 5200000, build: 540,
  },
  {
    id: 'embravia-e190f', name: 'Embravia Regional E190F', brand: 'Embravia',
    tier: 2, propulsion: 'diesel', rating: 4.4, icon: 'airplane-takeoff',
    desc: 'Regional jet freighter blending speed with real cargo economics.',
    speed: 830, cargo: 11, tank: 13000, eff: 0.24, range: 3300, maint: 34, price: 26000000, build: 1200,
  },
  {
    id: 'bomberlyne-crj700f', name: 'Bomberlyne CJ700F', brand: 'Bomberlyne',
    tier: 2, propulsion: 'diesel', rating: 4.2, icon: 'airplane-takeoff',
    desc: 'Compact regional jet freighter, nimble on shorter city-pair routes.',
    speed: 790, cargo: 9, tank: 11500, eff: 0.23, range: 3000, maint: 32, price: 22000000, build: 1080,
  },
  {
    id: 'skymax-146f', name: 'SkyMax RJ146 Quiet Freighter', brand: 'SkyMax',
    tier: 2, propulsion: 'diesel', rating: 4.1, icon: 'airplane-takeoff',
    desc: 'Four-engine quiet freighter, welcome at noise-restricted night airports.',
    speed: 780, cargo: 10.5, tank: 12500, eff: 0.22, range: 2900, maint: 33, price: 24000000, build: 1140,
  },
  {
    id: 'boeng-737-800bcf', name: 'Boeng 737-800BCF', brand: 'Boeng',
    tier: 2, propulsion: 'diesel', rating: 4.6, icon: 'airplane-takeoff',
    desc: 'The narrow-body freighter that runs the world’s express networks.',
    speed: 850, cargo: 23, tank: 26000, eff: 0.19, range: 5000, maint: 44, price: 52000000, build: 1800,
  },
  {
    id: 'airbis-a321p2f', name: 'Airbis A321 P2F', brand: 'Airbis',
    tier: 2, propulsion: 'diesel', rating: 4.5, icon: 'airplane-takeoff',
    desc: 'Passenger-to-freighter conversion with class-leading fuel economics.',
    speed: 830, cargo: 28, tank: 27000, eff: 0.2, range: 4000, maint: 42, price: 55000000, build: 1800,
  },
  {
    id: 'airbis-a320f', name: 'Airbis A320F', brand: 'Airbis',
    tier: 2, propulsion: 'diesel', rating: 4.4, icon: 'airplane-takeoff',
    desc: 'Everyday narrow-body freighter, cheap to run, easy to crew.',
    speed: 828, cargo: 20, tank: 24000, eff: 0.21, range: 3800, maint: 38, price: 46000000, build: 1620,
  },
  {
    id: 'skymax-e195f', name: 'SkyMax E195 CargoLite', brand: 'SkyMax',
    tier: 2, propulsion: 'diesel', rating: 4.3, icon: 'airplane-takeoff',
    desc: 'Stretched regional freighter with a surprisingly deep belly hold.',
    speed: 833, cargo: 13.5, tank: 14500, eff: 0.23, range: 3400, maint: 35, price: 29000000, build: 1260,
  },
  {
    id: 'airbis-a320ev', name: 'Airbis A320 hybridEV', brand: 'Airbis',
    tier: 2, propulsion: 'hybrid', rating: 4.5, icon: 'leaf-circle-outline',
    desc: 'Hybrid-electric narrow-body — trims fuel burn without trimming payload.',
    speed: 800, cargo: 18, tank: 18000, eff: 0.3, range: 3600, maint: 24, price: 61000000, build: 1800,
  },
  {
    id: 'boeng-767-300f', name: 'Boeng 767-300F', brand: 'Boeng',
    tier: 3, propulsion: 'diesel', rating: 4.7, icon: 'airplane-takeoff',
    desc: 'Wide-body express freighter trusted on the world’s busiest cargo lanes.',
    speed: 850, cargo: 52, tank: 63000, eff: 0.13, range: 6000, maint: 68, price: 130000000, build: 2700,
  },
  {
    id: 'airbis-a330-200f', name: 'Airbis A330-200F', brand: 'Airbis',
    tier: 3, propulsion: 'diesel', rating: 4.8, icon: 'airplane-takeoff',
    desc: 'Wide-body freighter with a huge main deck and long-legged range.',
    speed: 870, cargo: 70, tank: 97000, eff: 0.12, range: 7400, maint: 78, price: 165000000, build: 3000,
  },
  {
    id: 'boeng-777f', name: 'Boeng 777F', brand: 'Boeng',
    tier: 3, propulsion: 'diesel', rating: 4.9, icon: 'airplane-takeoff',
    desc: 'The long-haul cargo king — flies farther fully loaded than almost anything.',
    speed: 900, cargo: 103, tank: 145000, eff: 0.1, range: 9000, maint: 96, price: 320000000, build: 3900,
  },
  {
    id: 'boeng-747-8f', name: 'Boeng 747-8F', brand: 'Boeng',
    tier: 3, propulsion: 'diesel', rating: 4.9, icon: 'airplane-takeoff',
    desc: 'The iconic nose-loading jumbo freighter — outsized cargo, no problem.',
    speed: 920, cargo: 137, tank: 183000, eff: 0.085, range: 8000, maint: 105, price: 380000000, build: 4200,
  },
  {
    id: 'antonyx-124', name: 'Antonyx AX-124 Heavylift', brand: 'Antonyx',
    tier: 3, propulsion: 'diesel', rating: 4.6, icon: 'airplane-takeoff',
    desc: 'Outsized heavylift giant — built for cargo nothing else can carry.',
    speed: 800, cargo: 150, tank: 220000, eff: 0.07, range: 5200, maint: 130, price: 420000000, build: 4800,
  },
  {
    id: 'boeng-747-8f-freight', name: 'Boeng 747-8F WorldRunner', brand: 'Boeng',
    tier: 3, propulsion: 'diesel', rating: 5.0, icon: 'airplane-takeoff',
    desc: 'Freight-record flagship, the fastest heavy freighter in the sky.',
    speed: 933, cargo: 140, tank: 190000, eff: 0.088, range: 8200, maint: 108, price: 400000000, build: 4200,
  },
  {
    id: 'voltair-e19', name: 'Voltair E19 Electric Freighter', brand: 'Voltair',
    tier: 2, propulsion: 'electric', rating: 4.6, icon: 'lightning-bolt-circle',
    desc: 'Flagship electric regional freighter — silent approach, zero emissions.',
    speed: 620, cargo: 9, battery: 4200, range: 900, maint: 20, price: 42000000, build: 1500,
  },
  {
    id: 'voltair-e77', name: 'Voltair E77 Electric Wide', brand: 'Voltair',
    tier: 3, propulsion: 'electric', rating: 4.7, icon: 'lightning-bolt-circle',
    desc: 'Wide-body electric prototype freighter — the future of clean cargo.',
    speed: 700, cargo: 40, battery: 12000, range: 1600, maint: 40, price: 210000000, build: 3300,
  },
  {
    id: 'roadmax-atr-hybrid', name: 'Roadmax RX Turboprop Hybrid', brand: 'Roadmax',
    tier: 2, propulsion: 'hybrid', rating: 4.4, icon: 'leaf-circle-outline',
    desc: 'Diesel-electric hybrid turboprop cutting fuel bills on regional feeder runs.',
    speed: 500, cargo: 8, tank: 3600, eff: 0.55, range: 1600, maint: 22, price: 18500000, build: 900,
  },
];

// Aircraft livery colours for customization (id + hex + display name).
export const AIRCRAFT_COLORS = [
  { id: 'steel', name: 'Steel Blue', hex: '#3A5A8C' },
  { id: 'crimson', name: 'Crimson', hex: '#C0392B' },
  { id: 'emerald', name: 'Emerald', hex: '#12A150' },
  { id: 'sunset', name: 'Sunset Orange', hex: '#E67E22' },
  { id: 'royal', name: 'Royal Purple', hex: '#7D3C98' },
  { id: 'teal', name: 'Teal', hex: '#0E7C86' },
  { id: 'graphite', name: 'Graphite', hex: '#2C3E50' },
  { id: 'gold', name: 'Golden', hex: '#B7791F' },
  { id: 'rose', name: 'Rose', hex: '#D6336C' },
  { id: 'sky', name: 'Sky', hex: '#2980B9' },
];

// Livery emblem choices (MaterialCommunityIcons).
export const AIRCRAFT_LOGOS = ['shield-star', 'crown', 'lightning-bolt', 'pine-tree', 'compass-rose',
  'diamond-stone', 'fire', 'leaf', 'star-circle', 'wave', 'mountain', 'flash'];

// Trim/accent colour — tail stripe, engine cowl and cockpit-window trim on
// the aircraft art. Separate axis from the body colour so two players with
// the same paint job can still tell their fleets apart at a glance.
export const AIRCRAFT_ACCENTS = [
  { id: 'chrome', name: 'Chrome Silver', hex: '#9DB2D6' },
  { id: 'ivory', name: 'Ivory', hex: '#F4EDE4' },
  { id: 'jet', name: 'Jet Black', hex: '#1C1F26' },
  { id: 'flame', name: 'Flame Red', hex: '#E63946' },
  { id: 'lime', name: 'Neon Lime', hex: '#9ACD32' },
  { id: 'cyan', name: 'Cyan', hex: '#22D3EE' },
  { id: 'amber', name: 'Amber', hex: '#F5A623' },
  { id: 'goldTrim', name: 'Gold Trim', hex: '#D4AF37' },
];

// Cargo catalog. `rate` = ₹ per km per ton — real air freight carries the
// same category mix as road freight, just paid at air-cargo rates.
export const CARGO_TYPES = [
  { id: 'general', name: 'General Goods', rate: 4.0, mult: 1.0, icon: 'package-variant-closed', desc: 'Mixed everyday air freight. Steady, reliable pay.' },
  { id: 'agriculture', name: 'Fresh Produce', rate: 3.8, mult: 0.95, icon: 'sack', desc: 'Bulk foodgrain and fresh produce. Low rate, high volume.' },
  { id: 'construction', name: 'Bulk Materials', rate: 3.4, mult: 0.85, icon: 'wall', desc: 'Heavy construction material. Cheap per ton but always in demand.' },
  { id: 'steel', name: 'Steel & Metal', rate: 3.9, mult: 0.98, icon: 'gate', desc: 'Steel coils, rods and scrap. Dense and heavy.' },
  { id: 'textiles', name: 'Textiles', rate: 4.4, mult: 1.1, icon: 'tshirt-crew', desc: 'Cloth, garments and yarn bales. Light and easy.' },
  { id: 'retail', name: 'FMCG / Retail', rate: 5.0, mult: 1.25, icon: 'cart-variant', desc: 'Packaged consumer goods for stores. Good margins.' },
  { id: 'livestock', name: 'Live Animals', rate: 5.2, mult: 1.3, icon: 'cow', desc: 'Live animal air freight — needs care and quick transit.' },
  { id: 'machinery', name: 'Machinery', rate: 6.0, mult: 1.5, icon: 'cog-outline', desc: 'Industrial equipment and heavy parts.' },
  { id: 'automobiles', name: 'Auto Parts', rate: 6.5, mult: 1.6, icon: 'car-multiple', desc: 'Urgent automotive parts on carriers. Premium freight.' },
  { id: 'fragile', name: 'Fragile Goods', rate: 7.0, mult: 1.75, icon: 'glass-fragile', desc: 'Glass and delicate items. Handle with care, paid well.' },
  { id: 'perishable', name: 'Perishable (Cold Chain)', rate: 7.2, mult: 1.8, icon: 'fruit-watermelon', desc: 'Refrigerated fruit, dairy and frozen food — why airlines exist.' },
  { id: 'electronics', name: 'Electronics', rate: 8.0, mult: 2.0, icon: 'television', desc: 'High-value gadgets and appliances. Lucrative.' },
  { id: 'hazmat', name: 'Hazmat / Dangerous Goods', rate: 8.5, mult: 2.1, icon: 'radioactive', desc: 'Regulated chemicals and dangerous goods. Top pay.' },
  { id: 'pharma', name: 'Pharma', rate: 9.0, mult: 2.25, icon: 'pill', desc: 'Temperature-controlled medicines. The highest per-ton rate.' },
];

export const CAMPAIGNS = [
  { id: 'digital', name: 'Digital Push', cost: 15000, days: 3, boost: 0.05, icon: 'cellphone-marker',
    desc: 'Quick social media ads and freight-forwarder outreach — cheap, short, fast to try.' },
  { id: 'city', name: 'Hub Campaign', cost: 50000, days: 7, boost: 0.10, icon: 'city-variant-outline',
    desc: 'Local radio spots and terminal signage around your home hub.' },
  { id: 'regional', name: 'Regional Drive', cost: 200000, days: 14, boost: 0.25, icon: 'map-outline',
    desc: 'Regional trade press, airport ads and forwarder tie-ups across the region.' },
  { id: 'national', name: 'National Blitz', cost: 1000000, days: 30, boost: 0.50, icon: 'earth',
    desc: 'Prime-time national advertising. Every shipper knows your name.' },
  { id: 'influencer', name: 'Aviation Roadshow', cost: 2500000, days: 45, boost: 0.65, icon: 'star-circle-outline',
    desc: 'Sponsored logistics-conference tour across every major hub — the longest, strongest boost available.' },
];

export const POWERUPS = [
  { id: 'refuel', name: 'Instant Refuel', gold: 5, icon: 'gas-station', desc: 'Instantly refuel any aircraft to 100%.' },
  { id: 'speed', name: 'Speed Boost', gold: 10, icon: 'rocket-launch-outline', desc: '2× flight speed for 60 real minutes.' },
  { id: 'repair', name: 'Instant Repair', gold: 15, icon: 'wrench', desc: 'Instantly fix a grounded aircraft.' },
  { id: 'double', name: 'Double Revenue', gold: 20, icon: 'cash-multiple', desc: 'Doubles the payout of your next completed flight.' },
  { id: 'skipbuild', name: 'Skip Fit-Out Time', gold: 30, icon: 'fast-forward', desc: 'Instantly finish an aircraft under fit-out.' },
  { id: 'contracts', name: 'Fresh Contracts', gold: 8, icon: 'file-refresh-outline', desc: 'Reroll today’s contract board with brand-new offers.' },
  { id: 'shield', name: 'Delay Shield', gold: 18, icon: 'shield-check', desc: 'No weather holds, technical faults or ATC delays for 24 real hours.' },
  { id: 'refuel_all', name: 'Refuel Entire Fleet', gold: 20, icon: 'gas-station-outline', desc: 'Every aircraft to 100% fuel / charge in one tap.' },
  { id: 'service_all', name: 'Full Fleet Service', gold: 25, icon: 'car-wrench', desc: 'Restores every aircraft’s condition to a hangar-fresh 100%.' },
];

export const CONTRACT_FLAVORS = [
  { id: 'bulk', name: 'Bulk Order', mult: 1.3, icon: 'package-variant', desc: 'A freight forwarder needs a massive shipment moved.' },
  { id: 'longhaul', name: 'Long Haul', mult: 1.4, icon: 'airplane-takeoff', desc: 'A trans-continental haul to a major cargo hub.' },
  { id: 'government', name: 'Government Contract', mult: 1.5, icon: 'bank', desc: 'Official state cargo. Prestige and paperwork.' },
  { id: 'mining', name: 'Heavy Freight', mult: 1.5, icon: 'pickaxe', desc: 'Dense industrial cargo from the mining belt.' },
  { id: 'urgent', name: 'Urgent Delivery', mult: 1.6, icon: 'clock-fast', desc: 'They needed it yesterday. Pays extra for speed.' },
  { id: 'pharma', name: 'Pharmaceutical Delivery', mult: 1.7, icon: 'pill', desc: 'Temperature-controlled medical cargo.' },
  { id: 'green', name: 'Green Route Bonus', mult: 1.8, icon: 'leaf', desc: 'Electric-only eco flight. Great PR, better pay.', evOnly: true },
  { id: 'island', name: 'Remote Airstrip Freight', mult: 2.0, icon: 'island', desc: 'Cargo to a remote island airstrip. The rarest routes pay the most.' },
];

// Company logo choices (MaterialCommunityIcons names)
export const LOGOS = ['airplane', 'airplane-takeoff', 'compass-rose', 'radar', 'earth',
  'lightning-bolt', 'shield-crown', 'rocket-launch', 'crown', 'diamond-stone', 'gauge',
  'tiger', 'elephant', 'bird', 'pine-tree', 'anchor', 'fire', 'shield-star', 'medal',
  'weather-windy', 'map-marker-radius', 'cog', 'star-four-points'];

// CEO avatar choices (MaterialCommunityIcons names)
export const AVATARS = ['account-tie', 'face-woman', 'face-man', 'account-tie-woman', 'account-cowboy-hat',
  'face-man-shimmer', 'face-woman-shimmer', 'account-hard-hat', 'glasses', 'account-star', 'account-heart', 'ninja',
  'account-tie-hat', 'face-man-profile', 'account-cog', 'account-supervisor', 'account-box',
  'emoticon-cool-outline', 'account-circle', 'account-tie-voice', 'karate', 'crown-circle'];

export const COMPANY_NAME_IDEAS = [
  'Ashoka SkyLines', 'Trans-Bharat Air Cargo', 'Golden Quadrilateral Airways', 'Monsoon Wings',
  'Himalayan Air Cargo', 'Deccan Express Airlines', 'Saffron Sky Cargo', 'Konkan Air Freight',
  'GangaWings Cargo', 'Peacock Prime Airlines', 'IndiSky Carriers', 'Lotus Wings Cargo',
];
