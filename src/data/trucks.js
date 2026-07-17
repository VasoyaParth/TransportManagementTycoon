// Truck model catalog — SRS §3.5 / §7.2. 32 real Indian models, 3 tiers, 3 propulsion types.
// speeds km/h, cargo tons, tank L or battery kWh, eff km/L or range km,
// maint ₹/km, price ₹, build seconds. `icon` = MaterialCommunityIcons name.
export const TRUCK_MODELS = [
  {
    id: 'tata-ace-gold', name: 'Tatrax Nova Gold', brand: 'Tatrax',
    tier: 1, propulsion: 'diesel', rating: 4.0, icon: 'truck-delivery',
    desc: 'The legendary mini truck — India’s favourite for last-mile deliveries.',
    speed: 60, cargo: 1, tank: 30, eff: 15, range: 450, maint: 4, price: 550000, build: 240,
  },
  {
    id: 'tata-intra-v30', name: 'Tatrax Orbit V30', brand: 'Tatrax',
    tier: 1, propulsion: 'diesel', rating: 4.2, icon: 'truck-delivery',
    desc: 'Compact pickup with car-like comfort and a punchy little payload.',
    speed: 80, cargo: 1.5, tank: 40, eff: 13, range: 520, maint: 4, price: 850000, build: 300,
  },
  {
    id: 'tata-407-gold', name: 'Tatrax 407 Gold', brand: 'Tatrax',
    tier: 1, propulsion: 'diesel', rating: 4.1, icon: 'truck',
    desc: 'The timeless intermediate truck that built India’s transport backbone.',
    speed: 80, cargo: 2.5, tank: 60, eff: 9, range: 540, maint: 5, price: 1200000, build: 360,
  },
  {
    id: 'tata-ultra-t7', name: 'Tatrax Apex T.7', brand: 'Tatrax',
    tier: 2, propulsion: 'diesel', rating: 4.3, icon: 'truck',
    desc: 'Modern light hauler with a roomy cabin for tireless city-to-town runs.',
    speed: 80, cargo: 4.5, tank: 90, eff: 8, range: 720, maint: 5, price: 1600000, build: 480,
  },
  {
    id: 'tata-lpt-1109', name: 'Tatrax XLT 1109', brand: 'Tatrax',
    tier: 2, propulsion: 'diesel', rating: 4.2, icon: 'truck',
    desc: 'A rugged medium-duty veteran trusted on every state highway.',
    speed: 75, cargo: 6, tank: 160, eff: 6, range: 960, maint: 6, price: 1800000, build: 600,
  },
  {
    id: 'tata-signa-2821', name: 'Tatrax Sigma 2821.T', brand: 'Tatrax',
    tier: 3, propulsion: 'diesel', rating: 4.5, icon: 'truck-trailer',
    desc: 'Heavy tipper-hauler muscle for serious long-distance tonnage.',
    speed: 80, cargo: 18, tank: 300, eff: 4, range: 1200, maint: 9, price: 4000000, build: 1800,
  },
  {
    id: 'tata-signa-4825', name: 'Tatrax Sigma 4825.TK', brand: 'Tatrax',
    tier: 3, propulsion: 'diesel', rating: 4.6, icon: 'truck-trailer',
    desc: 'Multi-axle heavyweight built to swallow the biggest loads whole.',
    speed: 80, cargo: 30, tank: 400, eff: 3.5, range: 1400, maint: 10, price: 6500000, build: 2400,
  },
  {
    id: 'tata-prima-5530', name: 'Tatrax Crown 5530.S', brand: 'Tatrax',
    tier: 3, propulsion: 'diesel', rating: 4.8, icon: 'truck-trailer',
    desc: 'Premium long-haul tractor with world-class comfort and pulling power.',
    speed: 85, cargo: 35, tank: 450, eff: 3.4, range: 1530, maint: 11, price: 7000000, build: 2700,
  },
  {
    id: 'tata-ace-ev', name: 'Tatrax Nova EV', brand: 'Tatrax',
    tier: 1, propulsion: 'electric', rating: 4.2, icon: 'lightning-bolt-circle',
    desc: 'Silent zero-emission mini truck perfect for clean urban deliveries.',
    speed: 60, cargo: 1, battery: 21, range: 150, maint: 3, price: 900000, build: 300,
  },
  {
    id: 'tata-prima-h55s', name: 'Tatrax Crown H.55S', brand: 'Tatrax',
    tier: 3, propulsion: 'hybrid', rating: 4.9, icon: 'leaf-circle-outline',
    desc: 'Next-gen hydrogen-hybrid flagship — colossal range, minimal footprint.',
    speed: 85, cargo: 32, tank: 400, eff: 4.5, range: 1800, maint: 6, price: 8000000, build: 3000,
  },
  {
    id: 'al-dost-plus', name: 'Veerraj Motors Buddy+', brand: 'Veerraj Motors',
    tier: 1, propulsion: 'diesel', rating: 4.1, icon: 'truck-delivery',
    desc: 'The dependable small-business partner for brisk city cargo runs.',
    speed: 80, cargo: 1.5, tank: 45, eff: 13, range: 585, maint: 4, price: 900000, build: 300,
  },
  {
    id: 'al-bada-dost-i4', name: 'Veerraj Motors Buddy Max i4', brand: 'Veerraj Motors',
    tier: 1, propulsion: 'diesel', rating: 4.3, icon: 'truck-delivery',
    desc: 'Bigger, tougher Buddy sibling with best-in-class payload for its class.',
    speed: 80, cargo: 2, tank: 55, eff: 12, range: 660, maint: 4, price: 1000000, build: 360,
  },
  {
    id: 'al-boss-1215', name: 'Veerraj Motors Chief 1215', brand: 'Veerraj Motors',
    tier: 2, propulsion: 'diesel', rating: 4.2, icon: 'truck',
    desc: 'A powerful intermediate workhorse that just refuses to quit.',
    speed: 80, cargo: 8, tank: 160, eff: 6, range: 960, maint: 6, price: 2000000, build: 720,
  },
  {
    id: 'al-ecomet-1615', name: 'Veerraj Motors EcoLine 1615', brand: 'Veerraj Motors',
    tier: 2, propulsion: 'diesel', rating: 4.4, icon: 'truck-cargo-container',
    desc: 'Fuel-smart medium-duty hauler tuned for the modern distribution grind.',
    speed: 80, cargo: 10, tank: 220, eff: 5, range: 1100, maint: 7, price: 2800000, build: 900,
  },
  {
    id: 'al-captain-2820', name: 'Veerraj Motors Skipper 2820', brand: 'Veerraj Motors',
    tier: 3, propulsion: 'diesel', rating: 4.4, icon: 'truck-trailer',
    desc: 'Rock-solid heavy hauler engineered for punishing terrain and loads.',
    speed: 78, cargo: 18, tank: 300, eff: 4, range: 1200, maint: 9, price: 3800000, build: 1800,
  },
  {
    id: 'al-avtr-1922', name: 'Veerraj Motors Vantage 1922', brand: 'Veerraj Motors',
    tier: 2, propulsion: 'diesel', rating: 4.5, icon: 'truck-cargo-container',
    desc: 'Modular Vantage platform delivering flexible, high-uptime hauling.',
    speed: 80, cargo: 12, tank: 250, eff: 4.5, range: 1125, maint: 7, price: 3200000, build: 1200,
  },
  {
    id: 'al-avtr-4825', name: 'Veerraj Motors Vantage 4825', brand: 'Veerraj Motors',
    tier: 3, propulsion: 'diesel', rating: 4.6, icon: 'truck-trailer',
    desc: 'Multi-axle Vantage beast for maximum tonnage over long distances.',
    speed: 82, cargo: 30, tank: 400, eff: 3.5, range: 1400, maint: 10, price: 6200000, build: 2400,
  },
  {
    id: 'al-switch-ev', name: 'Veerraj Motors Volt EV', brand: 'Veerraj Motors',
    tier: 2, propulsion: 'electric', rating: 4.5, icon: 'lightning-bolt-circle',
    desc: 'Clean, quiet electric hauler reshaping urban freight logistics.',
    speed: 75, cargo: 8, battery: 200, range: 250, maint: 3, price: 4500000, build: 1200,
  },
  {
    id: 'bharatbenz-1217c', name: 'BharatDrive 1217C', brand: 'BharatDrive',
    tier: 2, propulsion: 'diesel', rating: 4.3, icon: 'truck',
    desc: 'German-engineered reliability with class-leading turnaround economics.',
    speed: 80, cargo: 7, tank: 150, eff: 6, range: 900, maint: 6, price: 2200000, build: 720,
  },
  {
    id: 'bharatbenz-1617r', name: 'BharatDrive 1617R', brand: 'BharatDrive',
    tier: 2, propulsion: 'diesel', rating: 4.5, icon: 'truck-cargo-container',
    desc: 'Refined medium-duty rigid with a cabin drivers actually love.',
    speed: 82, cargo: 10, tank: 220, eff: 5, range: 1100, maint: 7, price: 2900000, build: 900,
  },
  {
    id: 'bharatbenz-2823r', name: 'BharatDrive 2823R', brand: 'BharatDrive',
    tier: 3, propulsion: 'diesel', rating: 4.6, icon: 'truck-trailer',
    desc: 'Heavy-duty rigid delivering premium durability and low downtime.',
    speed: 80, cargo: 18, tank: 300, eff: 4, range: 1200, maint: 9, price: 4200000, build: 1800,
  },
  {
    id: 'bharatbenz-3523r', name: 'BharatDrive 3523R', brand: 'BharatDrive',
    tier: 3, propulsion: 'diesel', rating: 4.7, icon: 'truck-trailer',
    desc: 'Multi-axle powerhouse for high-tonnage mining and construction runs.',
    speed: 80, cargo: 24, tank: 365, eff: 3.6, range: 1314, maint: 10, price: 5200000, build: 2100,
  },
  {
    id: 'bharatbenz-4823tt', name: 'BharatDrive 4823TT', brand: 'BharatDrive',
    tier: 3, propulsion: 'diesel', rating: 4.8, icon: 'truck-trailer',
    desc: 'Flagship tractor built for relentless, high-speed long-haul freight.',
    speed: 85, cargo: 32, tank: 400, eff: 3.5, range: 1400, maint: 11, price: 6800000, build: 2700,
  },
  {
    id: 'eicher-pro-2049', name: 'Rathee Edge 2049', brand: 'Rathee Motors',
    tier: 1, propulsion: 'diesel', rating: 4.1, icon: 'truck',
    desc: 'Nimble light-duty Pro built for tight lanes and quick city loops.',
    speed: 80, cargo: 3, tank: 60, eff: 9, range: 540, maint: 5, price: 1300000, build: 360,
  },
  {
    id: 'eicher-pro-3015', name: 'Rathee Edge 3015', brand: 'Rathee Motors',
    tier: 2, propulsion: 'diesel', rating: 4.3, icon: 'truck',
    desc: 'Efficient medium-duty hauler with a low cost-per-kilometre edge.',
    speed: 80, cargo: 9, tank: 160, eff: 5.5, range: 880, maint: 6, price: 2500000, build: 840,
  },
  {
    id: 'eicher-pro-6019', name: 'Rathee Edge 6019', brand: 'Rathee Motors',
    tier: 3, propulsion: 'diesel', rating: 4.5, icon: 'truck-trailer',
    desc: 'Heavy-duty Pro series muscle for demanding long-distance haulage.',
    speed: 80, cargo: 16, tank: 275, eff: 4, range: 1100, maint: 9, price: 3900000, build: 1800,
  },
  {
    id: 'eicher-pro-8055-ev', name: 'Rathee Edge 8055 EV', brand: 'Rathee Motors',
    tier: 3, propulsion: 'electric', rating: 4.8, icon: 'lightning-bolt-circle',
    desc: 'Heavy electric hauler proving zero-emission freight can go big.',
    speed: 80, cargo: 20, battery: 350, range: 300, maint: 4, price: 9000000, build: 3000,
  },
  {
    id: 'mahindra-jeeto', name: 'Mahaveer Zippy', brand: 'Mahaveer Motors',
    tier: 1, propulsion: 'diesel', rating: 3.8, icon: 'van-utility',
    desc: 'Featherweight mini hauler that thrives in the narrowest bazaars.',
    speed: 60, cargo: 0.7, tank: 25, eff: 18, range: 450, maint: 3, price: 450000, build: 240,
  },
  {
    id: 'mahindra-bolero-maxi', name: 'Mahaveer Warrior Maxi Truck', brand: 'Mahaveer Motors',
    tier: 1, propulsion: 'diesel', rating: 4.0, icon: 'truck-delivery',
    desc: 'Tough Warrior-bred pickup with a surprisingly generous load bed.',
    speed: 80, cargo: 1.4, tank: 35, eff: 14, range: 490, maint: 4, price: 750000, build: 300,
  },
  {
    id: 'mahindra-furio-7', name: 'Mahaveer Fury 7', brand: 'Mahaveer Motors',
    tier: 2, propulsion: 'diesel', rating: 4.3, icon: 'truck',
    desc: 'Smart intermediate truck packing tech and torque for growing fleets.',
    speed: 80, cargo: 5, tank: 90, eff: 8, range: 720, maint: 5, price: 1700000, build: 540,
  },
  {
    id: 'mahindra-blazo-x28', name: 'Mahaveer Blaze X 28', brand: 'Mahaveer Motors',
    tier: 3, propulsion: 'diesel', rating: 4.5, icon: 'truck-trailer',
    desc: 'Fuel-champion heavy hauler backed by a bold mileage guarantee.',
    speed: 80, cargo: 18, tank: 300, eff: 4.2, range: 1260, maint: 9, price: 4100000, build: 1800,
  },
  {
    id: 'mahindra-blazo-x35', name: 'Mahaveer Blaze X 35', brand: 'Mahaveer Motors',
    tier: 3, propulsion: 'diesel', rating: 4.7, icon: 'truck-trailer',
    desc: 'Long-haul tractor blending big-torque power with frugal fuel burn.',
    speed: 82, cargo: 30, tank: 400, eff: 3.8, range: 1520, maint: 10, price: 6400000, build: 2400,
  },
  {
    id: 'sml-sartaj-gs', name: 'Sanraj Motors Regal GS', brand: 'Sanraj Motors',
    tier: 1, propulsion: 'diesel', rating: 4.0, icon: 'truck',
    desc: 'Light-duty Isuzu-bred workhorse famous for bulletproof reliability.',
    speed: 80, cargo: 4, tank: 60, eff: 9, range: 540, maint: 5, price: 1550000, build: 420,
  },
  {
    id: 'sml-supreme', name: 'Sanraj Motors Zenith', brand: 'Sanraj Motors',
    tier: 1, propulsion: 'diesel', rating: 4.1, icon: 'truck',
    desc: 'Comfortable intermediate hauler built for tireless regional runs.',
    speed: 80, cargo: 5, tank: 90, eff: 8, range: 720, maint: 5, price: 1750000, build: 480,
  },
  {
    id: 'sml-prestige', name: 'Sanraj Motors Honor', brand: 'Sanraj Motors',
    tier: 2, propulsion: 'diesel', rating: 4.2, icon: 'truck-cargo-container',
    desc: 'Premium-cabin medium-duty truck that pampers long-distance drivers.',
    speed: 80, cargo: 7, tank: 150, eff: 6, range: 900, maint: 6, price: 2000000, build: 600,
  },
  {
    id: 'sml-samrat-gs', name: 'Sanraj Motors Monarch GS', brand: 'Sanraj Motors',
    tier: 2, propulsion: 'diesel', rating: 4.1, icon: 'truck',
    desc: 'Sturdy multi-purpose hauler that punches well above its weight.',
    speed: 78, cargo: 6, tank: 120, eff: 6.5, range: 780, maint: 6, price: 1850000, build: 540,
  },
  {
    id: 'force-traveller-van', name: 'Torque Journeyer Delivery Van', brand: 'Torque Motors',
    tier: 1, propulsion: 'diesel', rating: 3.9, icon: 'van-utility',
    desc: 'Spacious panel van that owns the city courier and e-commerce lanes.',
    speed: 90, cargo: 1.2, tank: 70, eff: 11, range: 770, maint: 4, price: 1250000, build: 360,
  },
  {
    id: 'force-trump-40', name: 'Torque Champion 40', brand: 'Torque Motors',
    tier: 1, propulsion: 'diesel', rating: 3.8, icon: 'truck-delivery',
    desc: 'Compact light truck offering rugged value for small businesses.',
    speed: 80, cargo: 2.5, tank: 60, eff: 10, range: 600, maint: 5, price: 1150000, build: 360,
  },
  {
    id: 'volvo-fm-420', name: 'Voltra VM 420', brand: 'Voltra Trucks',
    tier: 3, propulsion: 'diesel', rating: 4.8, icon: 'truck-trailer',
    desc: 'Swedish-engineered heavy tractor blending safety, comfort and grunt.',
    speed: 95, cargo: 32, tank: 500, eff: 3.4, range: 1700, maint: 14, price: 11000000, build: 3600,
  },
  {
    id: 'volvo-fh-520', name: 'Voltra VH 520', brand: 'Voltra Trucks',
    tier: 3, propulsion: 'diesel', rating: 5.0, icon: 'truck-trailer',
    desc: 'The flagship long-haul icon — first-class cabin, relentless power.',
    speed: 105, cargo: 40, tank: 600, eff: 3.2, range: 1920, maint: 16, price: 14500000, build: 4200,
  },
  {
    id: 'scania-r-500', name: 'Scanix S 500', brand: 'Scanix',
    tier: 3, propulsion: 'diesel', rating: 5.0, icon: 'truck-trailer',
    desc: 'King-of-the-road premium tractor prized for elite fuel economy.',
    speed: 110, cargo: 40, tank: 600, eff: 3.3, range: 1980, maint: 16, price: 14000000, build: 4200,
  },
  {
    id: 'scania-g-460', name: 'Scanix K 460', brand: 'Scanix',
    tier: 3, propulsion: 'diesel', rating: 4.9, icon: 'truck-cargo-container',
    desc: 'Robust premium hauler built for punishing mining and tipper duty.',
    speed: 90, cargo: 35, tank: 500, eff: 3.4, range: 1700, maint: 15, price: 12500000, build: 3900,
  },
  {
    id: 'man-cla-49300', name: 'Vanguard VLA 49.300', brand: 'Vanguard Motors',
    tier: 3, propulsion: 'diesel', rating: 4.7, icon: 'truck-trailer',
    desc: 'German-bred heavy tractor engineered for rugged Indian long-haul.',
    speed: 95, cargo: 38, tank: 520, eff: 3.3, range: 1716, maint: 14, price: 10500000, build: 3600,
  },
  {
    id: 'man-tgs', name: 'Vanguard VGS', brand: 'Vanguard Motors',
    tier: 3, propulsion: 'diesel', rating: 4.8, icon: 'truck-trailer',
    desc: 'Premium European workhorse with efficiency-tuned long-distance muscle.',
    speed: 100, cargo: 40, tank: 560, eff: 3.3, range: 1848, maint: 15, price: 12000000, build: 3900,
  },
  {
    id: 'tata-prima-3530k', name: 'Tatrax Crown 3530.K', brand: 'Tatrax',
    tier: 3, propulsion: 'diesel', rating: 4.6, icon: 'truck-cargo-container',
    desc: 'Heavy-duty tipper built to shift mountains on mining and site work.',
    speed: 75, cargo: 25, tank: 365, eff: 3.6, range: 1314, maint: 10, price: 4800000, build: 2100,
  },
  {
    id: 'tata-winger-cargo', name: 'Tatrax Voyager Cargo', brand: 'Tatrax',
    tier: 1, propulsion: 'diesel', rating: 3.9, icon: 'van-utility',
    desc: 'Roomy maxi-van perfect for high-volume urban parcel deliveries.',
    speed: 90, cargo: 1.2, tank: 65, eff: 11, range: 715, maint: 4, price: 1300000, build: 360,
  },
  {
    id: 'al-ecomet-star-1115', name: 'Veerraj Motors EcoLine Star 1115', brand: 'Veerraj Motors',
    tier: 2, propulsion: 'diesel', rating: 4.3, icon: 'truck',
    desc: 'Fuel-smart medium-duty star with a modern, driver-friendly cabin.',
    speed: 80, cargo: 6, tank: 140, eff: 6, range: 840, maint: 6, price: 2100000, build: 660,
  },
  {
    id: 'mahindra-furio-14', name: 'Mahaveer Fury 14', brand: 'Mahaveer Motors',
    tier: 2, propulsion: 'diesel', rating: 4.4, icon: 'truck-cargo-container',
    desc: 'Tech-loaded intermediate truck delivering strong payload and uptime.',
    speed: 82, cargo: 9, tank: 160, eff: 5.5, range: 880, maint: 7, price: 2700000, build: 840,
  },
  // ——— High-performance / mega-hauler flagships (fast, big, high cargo) ———
  {
    id: 'volvo-fh16-mega', name: 'Voltra VH16 750 WorldRunner', brand: 'Voltra Trucks',
    tier: 3, propulsion: 'diesel', rating: 4.9, icon: 'truck-trailer',
    desc: '750 hp monster — the fastest heavy long-hauler on the highway.',
    speed: 115, cargo: 42, tank: 700, eff: 3.6, range: 2520, maint: 15, price: 16500000, build: 4200,
  },
  {
    id: 'scania-r770-v8', name: 'Scanix S770 V8', brand: 'Scanix',
    tier: 3, propulsion: 'diesel', rating: 5.0, icon: 'truck-trailer',
    desc: 'The legendary 770 hp V8 — colossal payload at serious speed.',
    speed: 118, cargo: 45, tank: 720, eff: 3.5, range: 2520, maint: 16, price: 18000000, build: 4200,
  },
  {
    id: 'benz-actros-2663', name: 'Sterling Crestor 2663', brand: 'Sterling Motors',
    tier: 3, propulsion: 'diesel', rating: 4.9, icon: 'truck-trailer',
    desc: '625 hp flagship tractor with a giant multi-axle trailer.',
    speed: 110, cargo: 48, tank: 800, eff: 3.4, range: 2720, maint: 15, price: 17000000, build: 4200,
  },
  {
    id: 'tata-prima-5540-mega', name: 'Tatrax Crown 5540.S Mega', brand: 'Tatrax',
    tier: 3, propulsion: 'diesel', rating: 4.7, icon: 'truck-trailer',
    desc: "India's biggest Crown hauler — huge cargo, highway-fast.",
    speed: 100, cargo: 50, tank: 760, eff: 3.6, range: 2736, maint: 13, price: 9500000, build: 3600,
  },
  {
    id: 'byd-t9-eplus', name: 'Voltek V9 e-Apex', brand: 'Voltek',
    tier: 3, propulsion: 'electric', rating: 4.8, icon: 'lightning-bolt-circle',
    desc: 'Flagship electric mega-hauler — silent, massive and quick.',
    speed: 108, cargo: 40, battery: 1000, range: 900, maint: 6, price: 14000000, build: 3900,
  },
  // ——— American long-nose conventionals, road-trains and mega-haulers ———
  {
    id: 'kenworth-w990', name: 'Ironclad IC990', brand: 'Ironclad',
    tier: 3, propulsion: 'diesel', rating: 4.8, icon: 'truck-trailer', shape: 'conventional',
    desc: 'American long-nose conventional — big hood, big attitude, big torque.',
    speed: 100, cargo: 38, tank: 550, eff: 3.3, range: 1815, maint: 14, price: 11500000, build: 3600,
  },
  {
    id: 'freightliner-cascadia', name: 'Longhaul Skyline', brand: 'Longhaul',
    tier: 3, propulsion: 'diesel', rating: 4.7, icon: 'truck-trailer', shape: 'conventional',
    desc: 'Aero-tuned American long-hauler with a spacious long-nose cab.',
    speed: 100, cargo: 36, tank: 530, eff: 3.4, range: 1802, maint: 13, price: 10800000, build: 3600,
  },
  {
    id: 'volvo-fh-roadtrain', name: 'Voltra VH B-Double Road Train', brand: 'Voltra Trucks',
    tier: 3, propulsion: 'diesel', rating: 4.9, icon: 'truck-trailer', shape: 'doubletrailer',
    desc: 'Twin-trailer road-train rig — two boxes chained for maximum tonnage per trip.',
    speed: 95, cargo: 55, tank: 800, eff: 2.8, range: 2240, maint: 18, price: 19000000, build: 4800,
  },
  {
    id: 'man-tgx-roadtrain', name: 'Vanguard VGX B-Double', brand: 'Vanguard Motors',
    tier: 3, propulsion: 'diesel', rating: 4.7, icon: 'truck-trailer', shape: 'doubletrailer',
    desc: 'German double-trailer combination built for high-volume corridor runs.',
    speed: 92, cargo: 52, tank: 780, eff: 2.9, range: 2262, maint: 17, price: 17500000, build: 4800,
  },
  {
    id: 'scania-titan-100', name: 'Scanix Titan 100X', brand: 'Scanix',
    tier: 3, propulsion: 'diesel', rating: 5.0, icon: 'truck-trailer',
    desc: 'The ultimate heavy hauler — a 100-ton multi-axle mega-rig for the biggest loads on Earth.',
    speed: 90, cargo: 100, tank: 900, eff: 2.2, range: 1980, maint: 22, price: 26000000, build: 5400,
  },
  {
    id: 'volvo-fh-electric', name: 'Voltra VH Electric', brand: 'Voltra Trucks',
    tier: 3, propulsion: 'electric', rating: 4.8, icon: 'lightning-bolt-circle',
    desc: 'Zero-emission flagship tractor — silent power for premium long-haul freight.',
    speed: 95, cargo: 38, battery: 540, range: 400, maint: 8, price: 15500000, build: 3900,
  },
  {
    id: 'mercedes-eactros-600', name: 'Sterling eCrestor 600', brand: 'Sterling Motors',
    tier: 3, propulsion: 'electric', rating: 4.9, icon: 'lightning-bolt-circle',
    desc: "Sterling's long-range electric flagship — silent, swift and spotless.",
    speed: 100, cargo: 40, battery: 621, range: 500, maint: 8, price: 17500000, build: 4200,
  },
  {
    id: 'daf-xg-hybrid', name: 'Roadmax RX Hybrid', brand: 'Roadmax',
    tier: 2, propulsion: 'hybrid', rating: 4.5, icon: 'leaf-circle-outline',
    desc: 'Diesel-electric hybrid tractor cutting fuel bills on the regional grind.',
    speed: 88, cargo: 14, tank: 260, eff: 5.5, range: 1430, maint: 8, price: 4600000, build: 1500,
  },
  // ---- v3.0.1 showroom additions ----
  {
    id: 'tata-ultra-t16', name: 'Tatrax Apex T.16', brand: 'Tatrax',
    tier: 2, propulsion: 'diesel', rating: 4.4, icon: 'truck',
    desc: 'Slim-cab city-to-city workhorse with a walk-through cabin.',
    speed: 85, cargo: 9, tank: 120, eff: 6.5, range: 780, maint: 6, price: 2600000, build: 700,
  },
  {
    id: 'eicher-pro-8055', name: 'Rathee Edge 8055', brand: 'Rathee Motors',
    tier: 3, propulsion: 'diesel', rating: 4.5, icon: 'truck-trailer', shape: 'semi',
    desc: 'Long-haul tractor with a fuel-coaching dashboard drivers swear by.',
    speed: 88, cargo: 26, tank: 365, eff: 3.6, range: 1310, maint: 9, price: 6200000, build: 2000,
  },
  {
    id: 'bharatbenz-5528', name: 'BharatDrive 5528C', brand: 'BharatDrive',
    tier: 3, propulsion: 'diesel', rating: 4.6, icon: 'truck-trailer', shape: 'conventional',
    desc: 'German-blood hood truck built for punishing mining corridors.',
    speed: 82, cargo: 28, tank: 400, eff: 3.4, range: 1360, maint: 10, price: 7400000, build: 2300,
  },
  {
    id: 'scania-r500', name: 'Scanix S500', brand: 'Scanix',
    tier: 3, propulsion: 'diesel', rating: 4.9, icon: 'truck-trailer', shape: 'semi',
    desc: 'The king of the highway — imported muscle with limo comfort.',
    speed: 95, cargo: 30, tank: 450, eff: 3.2, range: 1440, maint: 12, price: 12500000, build: 3200,
  },
  {
    id: 'volvo-fh16-roadtrain', name: 'Voltra VH16 Road Train', brand: 'Voltra',
    tier: 3, propulsion: 'diesel', rating: 5.0, icon: 'truck-trailer', shape: 'doubletrailer',
    desc: 'B-double monster — two full trailers behind 750 imported horses.',
    speed: 85, cargo: 42, tank: 600, eff: 2.6, range: 1560, maint: 14, price: 16500000, build: 3800,
  },
  // ---- v10.14.0 showroom additions ----
  {
    id: 'tata-ace-compact', name: 'Tatrax Nova Compact', brand: 'Tatrax',
    tier: 1, propulsion: 'diesel', rating: 3.9, icon: 'truck-delivery', shape: 'mini',
    desc: 'Rock-bottom entry mini truck for a player’s very first delivery run.',
    speed: 55, cargo: 0.75, tank: 25, eff: 17, range: 420, maint: 3, price: 380000, build: 200,
  },
  {
    id: 'al-dost-ev', name: 'Veerraj Motors Buddy EV', brand: 'Veerraj Motors',
    tier: 1, propulsion: 'electric', rating: 4.3, icon: 'lightning-bolt-circle', shape: 'mini',
    desc: 'Silent electric mini truck — cheapest way into a zero-emission fleet.',
    speed: 58, cargo: 1, battery: 24, range: 165, maint: 3, price: 950000, build: 320,
  },
  {
    id: 'bharatbenz-1417x', name: 'BharatDrive 1417 Xtra', brand: 'BharatDrive',
    tier: 2, propulsion: 'diesel', rating: 4.4, icon: 'truck-cargo-container', shape: 'rigid',
    desc: 'Extra-payload rigid built for distributors who hate empty runs.',
    speed: 80, cargo: 11, tank: 200, eff: 5.5, range: 1100, maint: 7, price: 3000000, build: 950,
  },
  {
    id: 'eicher-pro-hybrid16', name: 'Rathee Edge Hybrid 1618', brand: 'Rathee Motors',
    tier: 2, propulsion: 'hybrid', rating: 4.6, icon: 'leaf-circle-outline', shape: 'rigid',
    desc: 'Diesel-electric mid-hauler that quietly slashes the fuel bill.',
    speed: 82, cargo: 10, tank: 130, eff: 8.5, range: 1250, maint: 5, price: 3600000, build: 1000,
  },
  {
    id: 'al-switch-16e', name: 'Voltra Volt 16E', brand: 'Voltra',
    tier: 2, propulsion: 'electric', rating: 4.6, icon: 'lightning-bolt-circle', shape: 'box',
    desc: 'Mid-tier electric box truck for clean, quiet regional distribution.',
    speed: 78, cargo: 9, battery: 260, range: 280, maint: 3, price: 5200000, build: 1300,
  },
  {
    id: 'scania-s650', name: 'Scanix S650', brand: 'Scanix',
    tier: 3, propulsion: 'diesel', rating: 4.9, icon: 'truck-trailer', shape: 'semi',
    desc: 'Flagship highway tractor — more horses and a plusher sleeper cab than the S500.',
    speed: 96, cargo: 32, tank: 470, eff: 3.1, range: 1500, maint: 12, price: 13800000, build: 3300,
  },
  {
    id: 'rathee-frontier-8850', name: 'Rathee Frontier 8850', brand: 'Rathee Motors',
    tier: 3, propulsion: 'diesel', rating: 4.7, icon: 'truck-trailer', shape: 'conventional',
    desc: 'Long-nose American-style hauler bred for cross-border mining corridors.',
    speed: 84, cargo: 27, tank: 380, eff: 3.5, range: 1330, maint: 10, price: 6900000, build: 2100,
  },
  {
    id: 'volvo-vh20-maxtrain', name: 'Voltra VH20 MaxTrain', brand: 'Voltra',
    tier: 3, propulsion: 'diesel', rating: 5.0, icon: 'truck-trailer', shape: 'doubletrailer',
    desc: 'The ultimate B-double — bigger engine, bigger tanks, bigger everything.',
    speed: 87, cargo: 46, tank: 650, eff: 2.4, range: 1600, maint: 15, build: 4200, price: 18500000,
  },
  {
    id: 'scanix-ranger-6220', name: 'Scanix Ranger 6220', brand: 'Scanix',
    tier: 3, propulsion: 'diesel', rating: 4.7, icon: 'truck-trailer', shape: 'semi',
    desc: 'A stretched single-trailer semi that closes the gap between everyday haulers and the mega-tier — real tonnage, still an affordable buy.',
    speed: 82, cargo: 55, tank: 480, eff: 3.0, range: 1450, maint: 13, build: 3000, price: 10500000,
  },
  // ---- v10.17.0 mega-hauler tier — beyond anything else in the catalog,
  // priced (and taxed by maintenance/build time) to match: these are
  // aspirational trophy purchases for a company that's already an empire,
  // not a practical early buy. ----
  {
    id: 'bharatbenz-titan-8500', name: 'BharatDrive Titan 8500', brand: 'BharatDrive',
    tier: 3, propulsion: 'diesel', rating: 4.9, icon: 'truck-trailer', shape: 'conventional',
    desc: 'A quad-axle long-nose monster built for mining-grade tonnage on real highways.',
    speed: 76, cargo: 85, tank: 850, eff: 2.0, range: 1700, maint: 18, build: 6000, price: 32000000,
  },
  {
    id: 'scania-colossus-x', name: 'Scanix Colossus X', brand: 'Scanix',
    tier: 3, propulsion: 'diesel', rating: 5.0, icon: 'truck-trailer', shape: 'doubletrailer',
    desc: 'Triple-trailer imported giant — the heaviest thing legally allowed on the network.',
    speed: 72, cargo: 140, tank: 1100, eff: 1.6, range: 1750, maint: 24, build: 9000, price: 58000000,
  },
  {
    id: 'volvo-mh250-apex', name: 'Voltra Apex Mega-Hauler MH-250', brand: 'Voltra',
    tier: 3, propulsion: 'diesel', rating: 5.0, icon: 'truck-trailer', shape: 'doubletrailer',
    desc: 'The biggest thing that will ever touch these highways — a mining-class ultra-hauler, road-registered on a dare. One of these outmoves a small fleet.',
    speed: 64, cargo: 250, tank: 1600, eff: 1.1, range: 1850, maint: 35, build: 14000, price: 120000000,
  },
  {
    id: 'voltra-titan-hx350', name: 'Voltra Titan HX-350', brand: 'Voltra',
    tier: 3, propulsion: 'hybrid', rating: 5.0, icon: 'leaf-circle-outline', shape: 'doubletrailer',
    desc: 'The new top of the catalog — a diesel-electric hybrid mega-hauler that out-tons the MH-250 and still sips less fuel per ton, thanks to regenerative braking down every mountain pass.',
    speed: 60, cargo: 350, tank: 1900, eff: 1.3, range: 2000, maint: 42, build: 17000, price: 185000000,
  },
  {
    id: 'voltra-outback-roadtrain', name: 'Voltra Outback Road-Train', brand: 'Voltra',
    tier: 3, propulsion: 'diesel', rating: 4.9, icon: 'truck-trailer', shape: 'doubletrailer',
    desc: 'A quad-trailer road-train — the longest vehicle on the network by far. It backs up traffic at every toll booth and drivers need a special endorsement just to reverse it.',
    speed: 55, cargo: 300, tank: 1750, eff: 1.2, range: 1900, maint: 38, build: 15500, price: 150000000,
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

// Custom-route (Autopilot) line colours — a distinct palette from truck
// paint so a saved route's colour on the map never gets mistaken for a
// truck's livery.
export const ROUTE_COLORS = [
  { id: 'blue', name: 'Blue', hex: '#2563EB' },
  { id: 'green', name: 'Green', hex: '#12A150' },
  { id: 'orange', name: 'Orange', hex: '#E67E22' },
  { id: 'pink', name: 'Pink', hex: '#D6336C' },
  { id: 'purple', name: 'Purple', hex: '#7D3C98' },
  { id: 'teal', name: 'Teal', hex: '#0E7C86' },
  { id: 'red', name: 'Red', hex: '#C0392B' },
  { id: 'amber', name: 'Amber', hex: '#D97706' },
];

// Livery emblem choices for trucks (MaterialCommunityIcons).
export const TRUCK_LOGOS = ['shield-star', 'crown', 'lightning-bolt', 'pine-tree', 'anchor',
  'diamond-stone', 'fire', 'leaf', 'star-circle', 'wave', 'mountain', 'flash'];

// Vinyl/decal pattern painted over the body colour — a second customization
// axis on top of flat colour (see truckArt.js's addPattern for the geometry).
export const TRUCK_PATTERNS = [
  { id: 'none', name: 'Solid', icon: 'square-rounded' },
  { id: 'stripe', name: 'Racing Stripe', icon: 'road-variant' },
  { id: 'dualstripe', name: 'Dual Stripe', icon: 'view-week' },
  { id: 'flames', name: 'Flames', icon: 'fire' },
  { id: 'camo', name: 'Camo', icon: 'pine-tree' },
  { id: 'checker', name: 'Checkerboard', icon: 'checkerboard' },
];

// Cosmetic bolt-on mounted near the cab — purely visual, same free-preview/
// paid-apply flow as colour and pattern (see truckArt.js's addBooster).
export const TRUCK_BOOSTERS = [
  { id: 'none', name: 'None', icon: 'close-circle-outline' },
  { id: 'lightbar', name: 'Roof Light Bar', icon: 'lightbulb-on' },
  { id: 'spoiler', name: 'Spoiler Kit', icon: 'align-horizontal-center' },
  { id: 'stacks', name: 'Chrome Stacks', icon: 'weather-windy' },
  { id: 'bullbar', name: 'Bull Bar', icon: 'shield-outline' },
];

// Wheel/rim (hub cap) colour — a fourth, small-but-visible livery axis. The
// tyre itself always stays black; only the alloy/hub colour is customizable.
export const TRUCK_RIMS = [
  { id: 'steelgrey', name: 'Steel Grey', hex: '#3A4048' },
  { id: 'chromeRim', name: 'Chrome', hex: '#C9CFD8' },
  { id: 'blackout', name: 'Blackout', hex: '#0B0F14' },
  { id: 'goldRim', name: 'Gold', hex: '#B7791F' },
  { id: 'redRim', name: 'Red', hex: '#C0392B' },
  { id: 'blueRim', name: 'Electric Blue', hex: '#2980B9' },
];

// Trim/accent colour — the roof deflector, mirrors and windshield-adjacent
// panels on the truck art. Separate axis from the body colour so two players
// with the same paint job can still tell their rigs apart at a glance.
export const TRUCK_ACCENTS = [
  { id: 'chrome', name: 'Chrome Silver', hex: '#9DB2D6' },
  { id: 'ivory', name: 'Ivory', hex: '#F4EDE4' },
  { id: 'jet', name: 'Jet Black', hex: '#1C1F26' },
  { id: 'flame', name: 'Flame Red', hex: '#E63946' },
  { id: 'lime', name: 'Neon Lime', hex: '#9ACD32' },
  { id: 'cyan', name: 'Cyan', hex: '#22D3EE' },
  { id: 'amber', name: 'Amber', hex: '#F5A623' },
  { id: 'goldTrim', name: 'Gold Trim', hex: '#D4AF37' },
];

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
  // ---- v10.17.0 additions ----
  { id: 'mining', name: 'Mining Ore & Coal', rate: 3.2, mult: 0.8, icon: 'terrain', desc: 'Raw ore straight off the pit. The cheapest freight there is, but there’s always a mountain of it.' },
  { id: 'furniture', name: 'Furniture & Home Goods', rate: 4.6, mult: 1.15, icon: 'sofa', desc: 'Bulky wooden and upholstered goods — awkward to load, easy to move.' },
  { id: 'ecommerce', name: 'E-Commerce Parcels', rate: 5.6, mult: 1.4, icon: 'package-variant', desc: 'Mixed online-order boxes for the last-mile boom. Steady demand, decent pay.' },
  { id: 'defense', name: 'Defense Logistics', rate: 8.8, mult: 2.2, icon: 'shield-star', desc: 'Government contract freight — vetted drivers only, and it pays like it.' },
  { id: 'bullion', name: 'Gold & Bullion', rate: 9.6, mult: 2.4, icon: 'treasure-chest', desc: 'Armoured-transit precious metals. The single highest per-ton rate in the business.' },
];

export const CAMPAIGNS = [
  { id: 'digital', name: 'Digital Push', cost: 15000, days: 3, boost: 0.05, icon: 'cellphone-marker',
    desc: 'Quick social media ads and local search listings — cheap, short, fast to try.' },
  { id: 'city', name: 'City Campaign', cost: 50000, days: 7, boost: 0.10, icon: 'city-variant-outline',
    desc: 'Local radio spots and billboards around your HQ city.' },
  { id: 'regional', name: 'Regional Drive', cost: 200000, days: 14, boost: 0.25, icon: 'map-outline',
    desc: 'Regional TV, highway hoardings and dealer tie-ups across the state.' },
  { id: 'national', name: 'National Blitz', cost: 1000000, days: 30, boost: 0.50, icon: 'earth',
    desc: 'Prime-time national advertising. Everyone knows your name.' },
  { id: 'influencer', name: 'Influencer Tour', cost: 2500000, days: 45, boost: 0.65, icon: 'star-circle-outline',
    desc: 'Sponsored logistics-influencer tour across every major hub — the longest, strongest boost available.' },
];

export const POWERUPS = [
  { id: 'refuel', name: 'Instant Refuel', gold: 5, icon: 'gas-station', desc: 'Instantly refuel any truck to 100%.' },
  { id: 'speed', name: 'Speed Boost', gold: 10, icon: 'rocket-launch-outline', desc: '2× delivery speed for 60 real minutes.' },
  { id: 'repair', name: 'Instant Repair', gold: 15, icon: 'wrench', desc: 'Instantly fix a broken truck.' },
  { id: 'double', name: 'Double Revenue', gold: 20, icon: 'cash-multiple', desc: 'Doubles the payout of your next completed delivery.' },
  { id: 'skipbuild', name: 'Skip Build Time', gold: 30, icon: 'fast-forward', desc: 'Instantly finish a truck under construction.' },
  { id: 'contracts', name: 'Fresh Contracts', gold: 8, icon: 'file-refresh-outline', desc: 'Reroll today’s contract board with brand-new offers.' },
  { id: 'shield', name: 'Incident Shield', gold: 18, icon: 'shield-check', desc: 'No accidents, thefts, checkposts or breakdowns for 24 real hours.' },
  { id: 'refuel_all', name: 'Refuel Entire Fleet', gold: 20, icon: 'gas-station-outline', desc: 'Every truck to 100% fuel / charge in one tap.' },
  { id: 'service_all', name: 'Full Fleet Service', gold: 25, icon: 'car-wrench', desc: 'Restores every truck’s condition to a showroom-fresh 100%.' },
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
