// Truck model catalog — SRS §3.5 / §7.2. 8 models, 3 tiers, 3 propulsion types.
// speeds km/h, cargo tons, tank L or battery kWh, eff km/L or range km,
// maint ₹/km, price ₹, build seconds. `icon` = MaterialCommunityIcons name.
export const TRUCK_MODELS = [
  {
    id: 'bharat-king-18w', name: 'Bharat King 18W', brand: 'Bharat Motors',
    tier: 1, propulsion: 'diesel', rating: 3.5, icon: 'truck',
    desc: 'The dependable workhorse of Indian highways. Nothing fancy, never lets you down.',
    speed: 70, cargo: 12, tank: 300, eff: 4.5, range: 1350, maint: 6, price: 800000, build: 300,
  },
  {
    id: 'swiftline-m12', name: 'Swiftline M12 Pro', brand: 'Swiftline',
    tier: 1, propulsion: 'diesel', rating: 3.8, icon: 'truck-fast',
    desc: 'Light, quick and cheap to run — perfect for short regional hops.',
    speed: 80, cargo: 9, tank: 240, eff: 5.5, range: 1320, maint: 5, price: 950000, build: 300,
  },
  {
    id: 'voltex-ev-thunder', name: 'Voltex EV-Thunder', brand: 'Voltex',
    tier: 1, propulsion: 'electric', rating: 4.0, icon: 'truck-flatbed',
    desc: 'Your first electric truck. Silent, clean, and dirt-cheap per kilometre.',
    speed: 75, cargo: 8, battery: 300, range: 400, maint: 3, price: 1200000, build: 420,
  },
  {
    id: 'himalaya-titan-xt', name: 'Himalaya Titan XT', brand: 'Himalaya Auto',
    tier: 2, propulsion: 'diesel', rating: 4.2, icon: 'truck-cargo-container',
    desc: 'Built for the long haul — big tank, big cargo bay, mountain-tested.',
    speed: 85, cargo: 20, tank: 450, eff: 4.0, range: 1800, maint: 8, price: 2500000, build: 900,
  },
  {
    id: 'rajputana-express-r9', name: 'Rajputana Express R9', brand: 'Rajputana',
    tier: 2, propulsion: 'diesel', rating: 4.3, icon: 'truck-delivery',
    desc: 'A desert-bred speedster that eats national highways for breakfast.',
    speed: 95, cargo: 16, tank: 400, eff: 4.2, range: 1680, maint: 7, price: 2800000, build: 900,
  },
  {
    id: 'greenlion-h-series', name: 'GreenLion H-Series', brand: 'GreenLion',
    tier: 2, propulsion: 'hybrid', rating: 4.4, icon: 'leaf-circle-outline',
    desc: 'Diesel muscle with electric economics. The sensible CEO choice.',
    speed: 88, cargo: 17, tank: 350, eff: 6.0, range: 2100, maint: 6, price: 3200000, build: 1200,
  },
  {
    id: 'indra-supermax-2600', name: 'Indra SuperMax 2600', brand: 'Indra Heavy',
    tier: 3, propulsion: 'diesel', rating: 4.7, icon: 'truck-trailer',
    desc: 'The undisputed cargo king. When the load is huge, the SuperMax answers.',
    speed: 90, cargo: 30, tank: 600, eff: 3.8, range: 2280, maint: 10, price: 5500000, build: 2400,
  },
  {
    id: 'voltex-ev2-ultra', name: 'Voltex EV2 Ultra', brand: 'Voltex',
    tier: 3, propulsion: 'electric', rating: 4.9, icon: 'lightning-bolt-circle',
    desc: 'Flagship electric long-hauler. The future of Indian logistics, today.',
    speed: 100, cargo: 22, battery: 800, range: 750, maint: 4, price: 6800000, build: 3600,
  },
  {
    id: 'metro-mini-hauler', name: 'Metro Mini Hauler', brand: 'Metro Motors',
    tier: 1, propulsion: 'diesel', rating: 3.3, icon: 'truck',
    desc: 'Nimble city hauler for last-mile runs and tight lanes.',
    speed: 75, cargo: 6, tank: 180, eff: 6.5, range: 1170, maint: 4, price: 650000, build: 300,
  },
  {
    id: 'sher-punjab-10w', name: 'Sher-e-Punjab 10W', brand: 'Sher Motors',
    tier: 1, propulsion: 'diesel', rating: 3.9, icon: 'truck-delivery',
    desc: 'A north-Indian favourite — rugged, roomy and proud.',
    speed: 82, cargo: 11, tank: 280, eff: 5.0, range: 1400, maint: 6, price: 1050000, build: 360,
  },
  {
    id: 'ecovolt-city-e', name: 'EcoVolt City-E', brand: 'EcoVolt',
    tier: 1, propulsion: 'electric', rating: 4.1, icon: 'truck-flatbed',
    desc: 'Zero-emission city EV with cheeky range for the price.',
    speed: 78, cargo: 7, battery: 260, range: 360, maint: 3, price: 1350000, build: 420,
  },
  {
    id: 'sahyadri-hybrid-lite', name: 'Sahyadri Hybrid Lite', brand: 'Sahyadri',
    tier: 1, propulsion: 'hybrid', rating: 4.0, icon: 'leaf-circle-outline',
    desc: 'Entry hybrid that sips fuel on the ghats.',
    speed: 80, cargo: 10, tank: 220, eff: 7.0, range: 1540, maint: 5, price: 1500000, build: 480,
  },
  {
    id: 'coromandel-cruiser', name: 'Coromandel Cruiser', brand: 'Coromandel',
    tier: 2, propulsion: 'diesel', rating: 4.2, icon: 'truck-cargo-container',
    desc: 'Coastal-corridor cruiser built for the eastern highways.',
    speed: 90, cargo: 18, tank: 420, eff: 4.3, range: 1806, maint: 7, price: 2650000, build: 900,
  },
  {
    id: 'vindhya-vahan-22', name: 'Vindhya Vahan 22', brand: 'Vindhya',
    tier: 2, propulsion: 'diesel', rating: 4.3, icon: 'truck-trailer',
    desc: 'Central-India heavy-mid workhorse with a big belly.',
    speed: 84, cargo: 22, tank: 480, eff: 3.9, range: 1872, maint: 8, price: 3000000, build: 1080,
  },
  {
    id: 'voltex-ev-cargo', name: 'Voltex EV-Cargo', brand: 'Voltex',
    tier: 2, propulsion: 'electric', rating: 4.5, icon: 'truck-flatbed',
    desc: 'Mid-tier EV with genuinely useful highway range.',
    speed: 90, cargo: 15, battery: 500, range: 520, maint: 3, price: 3600000, build: 1200,
  },
  {
    id: 'greenlion-h2-max', name: 'GreenLion H2 Max', brand: 'GreenLion',
    tier: 2, propulsion: 'hybrid', rating: 4.5, icon: 'leaf-circle-outline',
    desc: 'Bigger hybrid with class-leading economy.',
    speed: 90, cargo: 19, tank: 380, eff: 6.5, range: 2470, maint: 6, price: 3900000, build: 1320,
  },
  {
    id: 'maharaja-titan-3200', name: 'Maharaja Titan 3200', brand: 'Maharaja Heavy',
    tier: 3, propulsion: 'diesel', rating: 4.8, icon: 'truck-trailer',
    desc: 'Regal super-heavy hauler. Moves mountains of cargo.',
    speed: 88, cargo: 34, tank: 650, eff: 3.6, range: 2340, maint: 11, price: 6200000, build: 2700,
  },
  {
    id: 'ashwamedh-roadmaster', name: 'Ashwamedh Roadmaster', brand: 'Ashwamedh',
    tier: 3, propulsion: 'diesel', rating: 4.6, icon: 'truck-cargo-container',
    desc: 'Long-distance champion tuned for the Golden Quadrilateral.',
    speed: 95, cargo: 28, tank: 620, eff: 4.0, range: 2480, maint: 9, price: 5900000, build: 2400,
  },
  {
    id: 'greenlion-apex-hybrid', name: 'GreenLion Apex Hybrid', brand: 'GreenLion',
    tier: 3, propulsion: 'hybrid', rating: 4.8, icon: 'leaf-circle-outline',
    desc: 'Flagship hybrid — premium comfort, premium economy.',
    speed: 96, cargo: 26, tank: 500, eff: 7.5, range: 3750, maint: 7, price: 7200000, build: 3000,
  },
  {
    id: 'voltex-ev3-titan', name: 'Voltex EV3 Titan', brand: 'Voltex',
    tier: 3, propulsion: 'electric', rating: 5.0, icon: 'lightning-bolt-circle',
    desc: 'The apex electric titan. Silent, colossal, unstoppable.',
    speed: 105, cargo: 26, battery: 950, range: 820, maint: 4, price: 8200000, build: 3600,
  },
];

// Truck livery colours for customization (id + hex + display name).
export const TRUCK_COLORS = [
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

// Livery emblem choices for trucks (MaterialCommunityIcons).
export const TRUCK_LOGOS = ['shield-star', 'crown', 'lightning-bolt', 'pine-tree', 'anchor',
  'diamond-stone', 'fire', 'leaf', 'star-circle', 'wave', 'mountain', 'flash'];

// Cargo catalog. `rate` = ₹ per km per ton — this is the real driver of the
// economy now (each cargo pays differently). `mult` kept for legacy references.
// Cheap/bulk goods (cement, grain) pay low per-ton but move in huge volume;
// premium goods (pharma, electronics) pay a lot per ton. Suits the truck class.
export const CARGO_TYPES = [
  { id: 'general', name: 'General Goods', rate: 4.0, mult: 1.0, icon: 'package-variant-closed', desc: 'Mixed everyday freight. Steady, reliable pay.' },
  { id: 'agriculture', name: 'Grain & Agri', rate: 3.8, mult: 0.95, icon: 'sack', desc: 'Bulk foodgrain and produce sacks. Low rate, high volume.' },
  { id: 'construction', name: 'Cement & Sand', rate: 3.4, mult: 0.85, icon: 'wall', desc: 'Heavy construction material. Cheap per ton but always in demand.' },
  { id: 'steel', name: 'Steel & Metal', rate: 3.9, mult: 0.98, icon: 'gate', desc: 'Steel coils, rods and scrap. Dense and heavy.' },
  { id: 'textiles', name: 'Textiles', rate: 4.4, mult: 1.1, icon: 'tshirt-crew', desc: 'Cloth, garments and yarn bales. Light and easy.' },
  { id: 'retail', name: 'FMCG / Retail', rate: 5.0, mult: 1.25, icon: 'cart-variant', desc: 'Packaged consumer goods for stores. Good margins.' },
  { id: 'livestock', name: 'Livestock', rate: 5.2, mult: 1.3, icon: 'cow', desc: 'Live animals — needs care and quick transit.' },
  { id: 'machinery', name: 'Machinery', rate: 6.0, mult: 1.5, icon: 'cog-outline', desc: 'Industrial equipment and heavy parts.' },
  { id: 'automobiles', name: 'Automobiles', rate: 6.5, mult: 1.6, icon: 'car-multiple', desc: 'Cars and two-wheelers on carriers. Premium freight.' },
  { id: 'fragile', name: 'Fragile Goods', rate: 7.0, mult: 1.75, icon: 'glass-fragile', desc: 'Glass and delicate items. Handle with care, paid well.' },
  { id: 'perishable', name: 'Perishable (Reefer)', rate: 7.2, mult: 1.8, icon: 'fruit-watermelon', desc: 'Refrigerated fruit, dairy and frozen food.' },
  { id: 'electronics', name: 'Electronics', rate: 8.0, mult: 2.0, icon: 'television', desc: 'High-value gadgets and appliances. Lucrative.' },
  { id: 'hazmat', name: 'Hazmat / Fuel', rate: 8.5, mult: 2.1, icon: 'radioactive', desc: 'Fuel, chemicals and explosives. Dangerous, top pay.' },
  { id: 'pharma', name: 'Pharma', rate: 9.0, mult: 2.25, icon: 'pill', desc: 'Temperature-controlled medicines. The highest per-ton rate.' },
];

export const CAMPAIGNS = [
  { id: 'city', name: 'City Campaign', cost: 50000, days: 7, boost: 0.10, icon: 'city-variant-outline',
    desc: 'Local radio spots and billboards around your HQ city.' },
  { id: 'regional', name: 'Regional Drive', cost: 200000, days: 14, boost: 0.25, icon: 'map-outline',
    desc: 'Regional TV, highway hoardings and dealer tie-ups across the state.' },
  { id: 'national', name: 'National Blitz', cost: 1000000, days: 30, boost: 0.50, icon: 'earth',
    desc: 'Prime-time national advertising. Everyone knows your name.' },
];

export const POWERUPS = [
  { id: 'refuel', name: 'Instant Refuel', gold: 5, icon: 'gas-station', desc: 'Instantly refuel any truck to 100%.' },
  { id: 'speed', name: 'Speed Boost', gold: 10, icon: 'rocket-launch-outline', desc: '2× delivery speed for 60 real minutes.' },
  { id: 'repair', name: 'Instant Repair', gold: 15, icon: 'wrench', desc: 'Instantly fix a broken truck.' },
  { id: 'double', name: 'Double Revenue', gold: 20, icon: 'cash-multiple', desc: 'Doubles the payout of your next completed delivery.' },
  { id: 'skipbuild', name: 'Skip Build Time', gold: 30, icon: 'fast-forward', desc: 'Instantly finish a truck under construction.' },
  { id: 'goldpack', name: 'Buy Gold Pack', cash: 500000, goldGain: 100, icon: 'gold', desc: 'Convert ₹5,00,000 into 100 Gold.' },
];

export const CONTRACT_FLAVORS = [
  { id: 'bulk', name: 'Bulk Order', mult: 1.3, icon: 'package-variant', desc: 'A warehouse chain needs a massive shipment moved.' },
  { id: 'longhaul', name: 'Long Haul', mult: 1.4, icon: 'highway', desc: 'A cross-country marathon to a major metro.' },
  { id: 'government', name: 'Government Contract', mult: 1.5, icon: 'bank', desc: 'Official state cargo. Prestige and paperwork.' },
  { id: 'mining', name: 'Mining Haul', mult: 1.5, icon: 'pickaxe', desc: 'Heavy ore from the mining belt.' },
  { id: 'urgent', name: 'Urgent Delivery', mult: 1.6, icon: 'clock-fast', desc: 'They needed it yesterday. Pays extra for speed.' },
  { id: 'pharma', name: 'Pharmaceutical Delivery', mult: 1.7, icon: 'pill', desc: 'Temperature-controlled medical cargo.' },
  { id: 'green', name: 'Green Route Bonus', mult: 1.8, icon: 'leaf', desc: 'EV-only eco delivery. Great PR, better pay.', evOnly: true },
  { id: 'island', name: 'Island Freight', mult: 2.0, icon: 'ferry', desc: 'Ferry-linked island cargo. The rarest routes pay the most.' },
];

// Company logo choices (MaterialCommunityIcons names)
export const LOGOS = ['truck', 'truck-fast', 'steering', 'engine', 'compass-rose', 'earth',
  'lightning-bolt', 'shield-crown', 'rocket-launch', 'crown', 'diamond-stone', 'gauge',
  'tiger', 'elephant', 'bird', 'pine-tree', 'anchor', 'fire', 'shield-star', 'medal',
  'road-variant', 'map-marker-radius', 'cog', 'star-four-points'];

// CEO avatar choices (MaterialCommunityIcons names)
export const AVATARS = ['account-tie', 'face-woman', 'face-man', 'account-tie-woman', 'account-cowboy-hat',
  'face-man-shimmer', 'face-woman-shimmer', 'account-hard-hat', 'glasses', 'account-star', 'account-heart', 'ninja',
  'account-tie-hat', 'face-man-profile', 'account-cog', 'account-supervisor', 'account-box',
  'emoticon-cool-outline', 'account-circle', 'account-tie-voice', 'karate', 'crown-circle'];

export const COMPANY_NAME_IDEAS = [
  'Ashoka Logistics', 'Trans-Bharat Freight', 'Golden Quadrilateral Cargo', 'Monsoon Movers',
  'Himalayan Haulage', 'Deccan Express Lines', 'Saffron Star Transport', 'Konkan Cargo Co.',
  'GangaFreight', 'Peacock Prime Logistics', 'IndiRoad Carriers', 'Lotus Line Haulers',
];
