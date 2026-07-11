// Truck model catalog — SRS §3.5 / §7.2. 32 real Indian models, 3 tiers, 3 propulsion types.
// speeds km/h, cargo tons, tank L or battery kWh, eff km/L or range km,
// maint ₹/km, price ₹, build seconds. `icon` = MaterialCommunityIcons name.
export const TRUCK_MODELS = [
  {
    id: 'tata-ace-gold', name: 'Tata Ace Gold', brand: 'Tata Motors',
    tier: 1, propulsion: 'diesel', rating: 4.0, icon: 'truck-delivery',
    desc: 'The legendary Chhota Haathi — India’s favourite last-mile mini truck.',
    speed: 60, cargo: 1, tank: 30, eff: 15, range: 450, maint: 4, price: 550000, build: 240,
  },
  {
    id: 'tata-intra-v30', name: 'Tata Intra V30', brand: 'Tata Motors',
    tier: 1, propulsion: 'diesel', rating: 4.2, icon: 'truck-delivery',
    desc: 'Compact pickup with car-like comfort and a punchy little payload.',
    speed: 80, cargo: 1.5, tank: 40, eff: 13, range: 520, maint: 4, price: 850000, build: 300,
  },
  {
    id: 'tata-407-gold', name: 'Tata 407 Gold', brand: 'Tata Motors',
    tier: 1, propulsion: 'diesel', rating: 4.1, icon: 'truck',
    desc: 'The timeless intermediate truck that built India’s transport backbone.',
    speed: 80, cargo: 2.5, tank: 60, eff: 9, range: 540, maint: 5, price: 1200000, build: 360,
  },
  {
    id: 'tata-ultra-t7', name: 'Tata Ultra T.7', brand: 'Tata Motors',
    tier: 2, propulsion: 'diesel', rating: 4.3, icon: 'truck',
    desc: 'Modern light hauler with a roomy cabin for tireless city-to-town runs.',
    speed: 80, cargo: 4.5, tank: 90, eff: 8, range: 720, maint: 5, price: 1600000, build: 480,
  },
  {
    id: 'tata-lpt-1109', name: 'Tata LPT 1109', brand: 'Tata Motors',
    tier: 2, propulsion: 'diesel', rating: 4.2, icon: 'truck',
    desc: 'A rugged medium-duty veteran trusted on every state highway.',
    speed: 75, cargo: 6, tank: 160, eff: 6, range: 960, maint: 6, price: 1800000, build: 600,
  },
  {
    id: 'tata-signa-2821', name: 'Tata Signa 2821.T', brand: 'Tata Motors',
    tier: 3, propulsion: 'diesel', rating: 4.5, icon: 'truck-trailer',
    desc: 'Heavy tipper-hauler muscle for serious long-distance tonnage.',
    speed: 80, cargo: 18, tank: 300, eff: 4, range: 1200, maint: 9, price: 4000000, build: 1800,
  },
  {
    id: 'tata-signa-4825', name: 'Tata Signa 4825.TK', brand: 'Tata Motors',
    tier: 3, propulsion: 'diesel', rating: 4.6, icon: 'truck-trailer',
    desc: 'Multi-axle heavyweight built to swallow the biggest loads whole.',
    speed: 80, cargo: 30, tank: 400, eff: 3.5, range: 1400, maint: 10, price: 6500000, build: 2400,
  },
  {
    id: 'tata-prima-5530', name: 'Tata Prima 5530.S', brand: 'Tata Motors',
    tier: 3, propulsion: 'diesel', rating: 4.8, icon: 'truck-trailer',
    desc: 'Premium long-haul tractor with world-class comfort and pulling power.',
    speed: 85, cargo: 35, tank: 450, eff: 3.4, range: 1530, maint: 11, price: 7000000, build: 2700,
  },
  {
    id: 'tata-ace-ev', name: 'Tata Ace EV', brand: 'Tata Motors',
    tier: 1, propulsion: 'electric', rating: 4.2, icon: 'lightning-bolt-circle',
    desc: 'Silent zero-emission mini truck perfect for clean urban deliveries.',
    speed: 60, cargo: 1, battery: 21, range: 150, maint: 3, price: 900000, build: 300,
  },
  {
    id: 'tata-prima-h55s', name: 'Tata Prima H.55S', brand: 'Tata Motors',
    tier: 3, propulsion: 'hybrid', rating: 4.9, icon: 'leaf-circle-outline',
    desc: 'Next-gen hydrogen-hybrid flagship — colossal range, minimal footprint.',
    speed: 85, cargo: 32, tank: 400, eff: 4.5, range: 1800, maint: 6, price: 8000000, build: 3000,
  },
  {
    id: 'al-dost-plus', name: 'Ashok Leyland Dost+', brand: 'Ashok Leyland',
    tier: 1, propulsion: 'diesel', rating: 4.1, icon: 'truck-delivery',
    desc: 'The dependable small-business partner for brisk city cargo runs.',
    speed: 80, cargo: 1.5, tank: 45, eff: 13, range: 585, maint: 4, price: 900000, build: 300,
  },
  {
    id: 'al-bada-dost-i4', name: 'Ashok Leyland Bada Dost i4', brand: 'Ashok Leyland',
    tier: 1, propulsion: 'diesel', rating: 4.3, icon: 'truck-delivery',
    desc: 'Bigger, tougher Dost with best-in-class payload for its class.',
    speed: 80, cargo: 2, tank: 55, eff: 12, range: 660, maint: 4, price: 1000000, build: 360,
  },
  {
    id: 'al-boss-1215', name: 'Ashok Leyland Boss 1215', brand: 'Ashok Leyland',
    tier: 2, propulsion: 'diesel', rating: 4.2, icon: 'truck',
    desc: 'A powerful intermediate workhorse that just refuses to quit.',
    speed: 80, cargo: 8, tank: 160, eff: 6, range: 960, maint: 6, price: 2000000, build: 720,
  },
  {
    id: 'al-ecomet-1615', name: 'Ashok Leyland Ecomet 1615', brand: 'Ashok Leyland',
    tier: 2, propulsion: 'diesel', rating: 4.4, icon: 'truck-cargo-container',
    desc: 'Fuel-smart medium-duty hauler tuned for the modern distribution grind.',
    speed: 80, cargo: 10, tank: 220, eff: 5, range: 1100, maint: 7, price: 2800000, build: 900,
  },
  {
    id: 'al-captain-2820', name: 'Ashok Leyland Captain 2820', brand: 'Ashok Leyland',
    tier: 3, propulsion: 'diesel', rating: 4.4, icon: 'truck-trailer',
    desc: 'Rock-solid heavy hauler engineered for punishing terrain and loads.',
    speed: 78, cargo: 18, tank: 300, eff: 4, range: 1200, maint: 9, price: 3800000, build: 1800,
  },
  {
    id: 'al-avtr-1922', name: 'Ashok Leyland AVTR 1922', brand: 'Ashok Leyland',
    tier: 2, propulsion: 'diesel', rating: 4.5, icon: 'truck-cargo-container',
    desc: 'Modular AVTR platform delivering flexible, high-uptime hauling.',
    speed: 80, cargo: 12, tank: 250, eff: 4.5, range: 1125, maint: 7, price: 3200000, build: 1200,
  },
  {
    id: 'al-avtr-4825', name: 'Ashok Leyland AVTR 4825', brand: 'Ashok Leyland',
    tier: 3, propulsion: 'diesel', rating: 4.6, icon: 'truck-trailer',
    desc: 'Multi-axle AVTR beast for maximum tonnage over long distances.',
    speed: 82, cargo: 30, tank: 400, eff: 3.5, range: 1400, maint: 10, price: 6200000, build: 2400,
  },
  {
    id: 'al-switch-ev', name: 'Ashok Leyland Switch EV', brand: 'Ashok Leyland',
    tier: 2, propulsion: 'electric', rating: 4.5, icon: 'lightning-bolt-circle',
    desc: 'Clean, quiet electric hauler reshaping urban freight logistics.',
    speed: 75, cargo: 8, battery: 200, range: 250, maint: 3, price: 4500000, build: 1200,
  },
  {
    id: 'bharatbenz-1217c', name: 'BharatBenz 1217C', brand: 'BharatBenz',
    tier: 2, propulsion: 'diesel', rating: 4.3, icon: 'truck',
    desc: 'German-engineered reliability with class-leading turnaround economics.',
    speed: 80, cargo: 7, tank: 150, eff: 6, range: 900, maint: 6, price: 2200000, build: 720,
  },
  {
    id: 'bharatbenz-1617r', name: 'BharatBenz 1617R', brand: 'BharatBenz',
    tier: 2, propulsion: 'diesel', rating: 4.5, icon: 'truck-cargo-container',
    desc: 'Refined medium-duty rigid with a cabin drivers actually love.',
    speed: 82, cargo: 10, tank: 220, eff: 5, range: 1100, maint: 7, price: 2900000, build: 900,
  },
  {
    id: 'bharatbenz-2823r', name: 'BharatBenz 2823R', brand: 'BharatBenz',
    tier: 3, propulsion: 'diesel', rating: 4.6, icon: 'truck-trailer',
    desc: 'Heavy-duty rigid delivering premium durability and low downtime.',
    speed: 80, cargo: 18, tank: 300, eff: 4, range: 1200, maint: 9, price: 4200000, build: 1800,
  },
  {
    id: 'bharatbenz-3523r', name: 'BharatBenz 3523R', brand: 'BharatBenz',
    tier: 3, propulsion: 'diesel', rating: 4.7, icon: 'truck-trailer',
    desc: 'Multi-axle powerhouse for high-tonnage mining and construction runs.',
    speed: 80, cargo: 24, tank: 365, eff: 3.6, range: 1314, maint: 10, price: 5200000, build: 2100,
  },
  {
    id: 'bharatbenz-4823tt', name: 'BharatBenz 4823TT', brand: 'BharatBenz',
    tier: 3, propulsion: 'diesel', rating: 4.8, icon: 'truck-trailer',
    desc: 'Flagship tractor built for relentless, high-speed long-haul freight.',
    speed: 85, cargo: 32, tank: 400, eff: 3.5, range: 1400, maint: 11, price: 6800000, build: 2700,
  },
  {
    id: 'eicher-pro-2049', name: 'Eicher Pro 2049', brand: 'Eicher',
    tier: 1, propulsion: 'diesel', rating: 4.1, icon: 'truck',
    desc: 'Nimble light-duty Pro built for tight lanes and quick city loops.',
    speed: 80, cargo: 3, tank: 60, eff: 9, range: 540, maint: 5, price: 1300000, build: 360,
  },
  {
    id: 'eicher-pro-3015', name: 'Eicher Pro 3015', brand: 'Eicher',
    tier: 2, propulsion: 'diesel', rating: 4.3, icon: 'truck',
    desc: 'Efficient medium-duty hauler with a low cost-per-kilometre edge.',
    speed: 80, cargo: 9, tank: 160, eff: 5.5, range: 880, maint: 6, price: 2500000, build: 840,
  },
  {
    id: 'eicher-pro-6019', name: 'Eicher Pro 6019', brand: 'Eicher',
    tier: 3, propulsion: 'diesel', rating: 4.5, icon: 'truck-trailer',
    desc: 'Heavy-duty Pro series muscle for demanding long-distance haulage.',
    speed: 80, cargo: 16, tank: 275, eff: 4, range: 1100, maint: 9, price: 3900000, build: 1800,
  },
  {
    id: 'eicher-pro-8055-ev', name: 'Eicher Pro 8055 EV', brand: 'Eicher',
    tier: 3, propulsion: 'electric', rating: 4.8, icon: 'lightning-bolt-circle',
    desc: 'Heavy electric hauler proving zero-emission freight can go big.',
    speed: 80, cargo: 20, battery: 350, range: 300, maint: 4, price: 9000000, build: 3000,
  },
  {
    id: 'mahindra-jeeto', name: 'Mahindra Jeeto', brand: 'Mahindra',
    tier: 1, propulsion: 'diesel', rating: 3.8, icon: 'van-utility',
    desc: 'Featherweight mini hauler that thrives in the narrowest bazaars.',
    speed: 60, cargo: 0.7, tank: 25, eff: 18, range: 450, maint: 3, price: 450000, build: 240,
  },
  {
    id: 'mahindra-bolero-maxi', name: 'Mahindra Bolero Maxi Truck', brand: 'Mahindra',
    tier: 1, propulsion: 'diesel', rating: 4.0, icon: 'truck-delivery',
    desc: 'Tough Bolero-bred pickup with a surprisingly generous load bed.',
    speed: 80, cargo: 1.4, tank: 35, eff: 14, range: 490, maint: 4, price: 750000, build: 300,
  },
  {
    id: 'mahindra-furio-7', name: 'Mahindra Furio 7', brand: 'Mahindra',
    tier: 2, propulsion: 'diesel', rating: 4.3, icon: 'truck',
    desc: 'Smart intermediate truck packing tech and torque for growing fleets.',
    speed: 80, cargo: 5, tank: 90, eff: 8, range: 720, maint: 5, price: 1700000, build: 540,
  },
  {
    id: 'mahindra-blazo-x28', name: 'Mahindra Blazo X 28', brand: 'Mahindra',
    tier: 3, propulsion: 'diesel', rating: 4.5, icon: 'truck-trailer',
    desc: 'Fuel-champion heavy hauler backed by a bold mileage guarantee.',
    speed: 80, cargo: 18, tank: 300, eff: 4.2, range: 1260, maint: 9, price: 4100000, build: 1800,
  },
  {
    id: 'mahindra-blazo-x35', name: 'Mahindra Blazo X 35', brand: 'Mahindra',
    tier: 3, propulsion: 'diesel', rating: 4.7, icon: 'truck-trailer',
    desc: 'Long-haul tractor blending big-torque power with frugal fuel burn.',
    speed: 82, cargo: 30, tank: 400, eff: 3.8, range: 1520, maint: 10, price: 6400000, build: 2400,
  },
  {
    id: 'sml-sartaj-gs', name: 'SML Isuzu Sartaj GS', brand: 'SML Isuzu',
    tier: 1, propulsion: 'diesel', rating: 4.0, icon: 'truck',
    desc: 'Light-duty Isuzu-bred workhorse famous for bulletproof reliability.',
    speed: 80, cargo: 4, tank: 60, eff: 9, range: 540, maint: 5, price: 1550000, build: 420,
  },
  {
    id: 'sml-supreme', name: 'SML Isuzu Supreme', brand: 'SML Isuzu',
    tier: 1, propulsion: 'diesel', rating: 4.1, icon: 'truck',
    desc: 'Comfortable intermediate hauler built for tireless regional runs.',
    speed: 80, cargo: 5, tank: 90, eff: 8, range: 720, maint: 5, price: 1750000, build: 480,
  },
  {
    id: 'sml-prestige', name: 'SML Isuzu Prestige', brand: 'SML Isuzu',
    tier: 2, propulsion: 'diesel', rating: 4.2, icon: 'truck-cargo-container',
    desc: 'Premium-cabin medium-duty truck that pampers long-distance drivers.',
    speed: 80, cargo: 7, tank: 150, eff: 6, range: 900, maint: 6, price: 2000000, build: 600,
  },
  {
    id: 'sml-samrat-gs', name: 'SML Isuzu Samrat GS', brand: 'SML Isuzu',
    tier: 2, propulsion: 'diesel', rating: 4.1, icon: 'truck',
    desc: 'Sturdy multi-purpose hauler that punches well above its weight.',
    speed: 78, cargo: 6, tank: 120, eff: 6.5, range: 780, maint: 6, price: 1850000, build: 540,
  },
  {
    id: 'force-traveller-van', name: 'Force Traveller Delivery Van', brand: 'Force Motors',
    tier: 1, propulsion: 'diesel', rating: 3.9, icon: 'van-utility',
    desc: 'Spacious panel van that owns the city courier and e-commerce lanes.',
    speed: 90, cargo: 1.2, tank: 70, eff: 11, range: 770, maint: 4, price: 1250000, build: 360,
  },
  {
    id: 'force-trump-40', name: 'Force Trump 40', brand: 'Force Motors',
    tier: 1, propulsion: 'diesel', rating: 3.8, icon: 'truck-delivery',
    desc: 'Compact light truck offering rugged value for small businesses.',
    speed: 80, cargo: 2.5, tank: 60, eff: 10, range: 600, maint: 5, price: 1150000, build: 360,
  },
  {
    id: 'volvo-fm-420', name: 'Volvo FM 420', brand: 'Volvo Trucks',
    tier: 3, propulsion: 'diesel', rating: 4.8, icon: 'truck-trailer',
    desc: 'Swedish-engineered heavy tractor blending safety, comfort and grunt.',
    speed: 95, cargo: 32, tank: 500, eff: 3.4, range: 1700, maint: 14, price: 11000000, build: 3600,
  },
  {
    id: 'volvo-fh-520', name: 'Volvo FH 520', brand: 'Volvo Trucks',
    tier: 3, propulsion: 'diesel', rating: 5.0, icon: 'truck-trailer',
    desc: 'The flagship long-haul icon — first-class cabin, relentless power.',
    speed: 105, cargo: 40, tank: 600, eff: 3.2, range: 1920, maint: 16, price: 14500000, build: 4200,
  },
  {
    id: 'scania-r-500', name: 'Scania R 500', brand: 'Scania',
    tier: 3, propulsion: 'diesel', rating: 5.0, icon: 'truck-trailer',
    desc: 'King-of-the-road premium tractor prized for elite fuel economy.',
    speed: 110, cargo: 40, tank: 600, eff: 3.3, range: 1980, maint: 16, price: 14000000, build: 4200,
  },
  {
    id: 'scania-g-460', name: 'Scania G 460', brand: 'Scania',
    tier: 3, propulsion: 'diesel', rating: 4.9, icon: 'truck-cargo-container',
    desc: 'Robust premium hauler built for punishing mining and tipper duty.',
    speed: 90, cargo: 35, tank: 500, eff: 3.4, range: 1700, maint: 15, price: 12500000, build: 3900,
  },
  {
    id: 'man-cla-49300', name: 'MAN CLA 49.300', brand: 'MAN',
    tier: 3, propulsion: 'diesel', rating: 4.7, icon: 'truck-trailer',
    desc: 'German-bred heavy tractor engineered for rugged Indian long-haul.',
    speed: 95, cargo: 38, tank: 520, eff: 3.3, range: 1716, maint: 14, price: 10500000, build: 3600,
  },
  {
    id: 'man-tgs', name: 'MAN TGS', brand: 'MAN',
    tier: 3, propulsion: 'diesel', rating: 4.8, icon: 'truck-trailer',
    desc: 'Premium European workhorse with efficiency-tuned long-distance muscle.',
    speed: 100, cargo: 40, tank: 560, eff: 3.3, range: 1848, maint: 15, price: 12000000, build: 3900,
  },
  {
    id: 'tata-prima-3530k', name: 'Tata Prima 3530.K', brand: 'Tata Motors',
    tier: 3, propulsion: 'diesel', rating: 4.6, icon: 'truck-cargo-container',
    desc: 'Heavy-duty tipper built to shift mountains on mining and site work.',
    speed: 75, cargo: 25, tank: 365, eff: 3.6, range: 1314, maint: 10, price: 4800000, build: 2100,
  },
  {
    id: 'tata-winger-cargo', name: 'Tata Winger Cargo', brand: 'Tata Motors',
    tier: 1, propulsion: 'diesel', rating: 3.9, icon: 'van-utility',
    desc: 'Roomy maxi-van perfect for high-volume urban parcel deliveries.',
    speed: 90, cargo: 1.2, tank: 65, eff: 11, range: 715, maint: 4, price: 1300000, build: 360,
  },
  {
    id: 'al-ecomet-star-1115', name: 'Ashok Leyland Ecomet Star 1115', brand: 'Ashok Leyland',
    tier: 2, propulsion: 'diesel', rating: 4.3, icon: 'truck',
    desc: 'Fuel-smart medium-duty star with a modern, driver-friendly cabin.',
    speed: 80, cargo: 6, tank: 140, eff: 6, range: 840, maint: 6, price: 2100000, build: 660,
  },
  {
    id: 'mahindra-furio-14', name: 'Mahindra Furio 14', brand: 'Mahindra',
    tier: 2, propulsion: 'diesel', rating: 4.4, icon: 'truck-cargo-container',
    desc: 'Tech-loaded intermediate truck delivering strong payload and uptime.',
    speed: 82, cargo: 9, tank: 160, eff: 5.5, range: 880, maint: 7, price: 2700000, build: 840,
  },
  // ——— High-performance / mega-hauler flagships (fast, big, high cargo) ———
  {
    id: 'volvo-fh16-mega', name: 'Volvo FH16 750 Globetrotter', brand: 'Volvo Trucks',
    tier: 3, propulsion: 'diesel', rating: 4.9, icon: 'truck-trailer',
    desc: '750 hp monster — the fastest heavy long-hauler on the highway.',
    speed: 115, cargo: 42, tank: 700, eff: 3.6, range: 2520, maint: 15, price: 16500000, build: 4200,
  },
  {
    id: 'scania-r770-v8', name: 'Scania R770 V8', brand: 'Scania',
    tier: 3, propulsion: 'diesel', rating: 5.0, icon: 'truck-trailer',
    desc: 'The legendary 770 hp V8 — colossal payload at serious speed.',
    speed: 118, cargo: 45, tank: 720, eff: 3.5, range: 2520, maint: 16, price: 18000000, build: 4200,
  },
  {
    id: 'benz-actros-2663', name: 'Mercedes-Benz Actros 2663', brand: 'Mercedes-Benz',
    tier: 3, propulsion: 'diesel', rating: 4.9, icon: 'truck-trailer',
    desc: '625 hp flagship tractor with a giant multi-axle trailer.',
    speed: 110, cargo: 48, tank: 800, eff: 3.4, range: 2720, maint: 15, price: 17000000, build: 4200,
  },
  {
    id: 'tata-prima-5540-mega', name: 'Tata Prima 5540.S Mega', brand: 'Tata Motors',
    tier: 3, propulsion: 'diesel', rating: 4.7, icon: 'truck-trailer',
    desc: 'India\'s biggest Prima hauler — huge cargo, highway-fast.',
    speed: 100, cargo: 50, tank: 760, eff: 3.6, range: 2736, maint: 13, price: 9500000, build: 3600,
  },
  {
    id: 'byd-t9-eplus', name: 'BYD T9 e-Titan', brand: 'BYD',
    tier: 3, propulsion: 'electric', rating: 4.8, icon: 'lightning-bolt-circle',
    desc: 'Flagship electric mega-hauler — silent, massive and quick.',
    speed: 108, cargo: 40, battery: 1000, range: 900, maint: 6, price: 14000000, build: 3900,
  },
  // ——— American long-nose conventionals, road-trains and mega-haulers ———
  {
    id: 'kenworth-w990', name: 'Kenworth W990', brand: 'Kenworth',
    tier: 3, propulsion: 'diesel', rating: 4.8, icon: 'truck-trailer', shape: 'conventional',
    desc: 'American long-nose conventional — big hood, big attitude, big torque.',
    speed: 100, cargo: 38, tank: 550, eff: 3.3, range: 1815, maint: 14, price: 11500000, build: 3600,
  },
  {
    id: 'freightliner-cascadia', name: 'Freightliner Cascadia', brand: 'Freightliner',
    tier: 3, propulsion: 'diesel', rating: 4.7, icon: 'truck-trailer', shape: 'conventional',
    desc: 'Aero-tuned American long-hauler with a spacious long-nose cab.',
    speed: 100, cargo: 36, tank: 530, eff: 3.4, range: 1802, maint: 13, price: 10800000, build: 3600,
  },
  {
    id: 'volvo-fh-roadtrain', name: 'Volvo FH B-Double Road Train', brand: 'Volvo Trucks',
    tier: 3, propulsion: 'diesel', rating: 4.9, icon: 'truck-trailer', shape: 'doubletrailer',
    desc: 'Twin-trailer road-train rig — two boxes chained for maximum tonnage per trip.',
    speed: 95, cargo: 55, tank: 800, eff: 2.8, range: 2240, maint: 18, price: 19000000, build: 4800,
  },
  {
    id: 'man-tgx-roadtrain', name: 'MAN TGX B-Double', brand: 'MAN',
    tier: 3, propulsion: 'diesel', rating: 4.7, icon: 'truck-trailer', shape: 'doubletrailer',
    desc: 'German double-trailer combination built for high-volume corridor runs.',
    speed: 92, cargo: 52, tank: 780, eff: 2.9, range: 2262, maint: 17, price: 17500000, build: 4800,
  },
  {
    id: 'scania-titan-100', name: 'Scania Titan 100X', brand: 'Scania',
    tier: 3, propulsion: 'diesel', rating: 5.0, icon: 'truck-trailer',
    desc: 'The ultimate heavy hauler — a 100-ton multi-axle mega-rig for the biggest loads on Earth.',
    speed: 90, cargo: 100, tank: 900, eff: 2.2, range: 1980, maint: 22, price: 26000000, build: 5400,
  },
  {
    id: 'volvo-fh-electric', name: 'Volvo FH Electric', brand: 'Volvo Trucks',
    tier: 3, propulsion: 'electric', rating: 4.8, icon: 'lightning-bolt-circle',
    desc: 'Zero-emission flagship tractor — silent power for premium long-haul freight.',
    speed: 95, cargo: 38, battery: 540, range: 400, maint: 8, price: 15500000, build: 3900,
  },
  {
    id: 'mercedes-eactros-600', name: 'Mercedes-Benz eActros 600', brand: 'Mercedes-Benz',
    tier: 3, propulsion: 'electric', rating: 4.9, icon: 'lightning-bolt-circle',
    desc: "Mercedes' long-range electric flagship — silent, swift and spotless.",
    speed: 100, cargo: 40, battery: 621, range: 500, maint: 8, price: 17500000, build: 4200,
  },
  {
    id: 'daf-xg-hybrid', name: 'DAF XG Hybrid', brand: 'DAF',
    tier: 2, propulsion: 'hybrid', rating: 4.5, icon: 'leaf-circle-outline',
    desc: 'Diesel-electric hybrid tractor cutting fuel bills on the regional grind.',
    speed: 88, cargo: 14, tank: 260, eff: 5.5, range: 1430, maint: 8, price: 4600000, build: 1500,
  },
  // ---- v3.0.1 showroom additions ----
  {
    id: 'tata-ultra-t16', name: 'Tata Ultra T.16', brand: 'Tata Motors',
    tier: 2, propulsion: 'diesel', rating: 4.4, icon: 'truck',
    desc: 'Slim-cab city-to-city workhorse with a walk-through cabin.',
    speed: 85, cargo: 9, tank: 120, eff: 6.5, range: 780, maint: 6, price: 2600000, build: 700,
  },
  {
    id: 'eicher-pro-8055', name: 'Eicher Pro 8055', brand: 'Eicher',
    tier: 3, propulsion: 'diesel', rating: 4.5, icon: 'truck-trailer', shape: 'semi',
    desc: 'Long-haul tractor with a fuel-coaching dashboard drivers swear by.',
    speed: 88, cargo: 26, tank: 365, eff: 3.6, range: 1310, maint: 9, price: 6200000, build: 2000,
  },
  {
    id: 'bharatbenz-5528', name: 'BharatBenz 5528C', brand: 'BharatBenz',
    tier: 3, propulsion: 'diesel', rating: 4.6, icon: 'truck-trailer', shape: 'conventional',
    desc: 'German-blood hood truck built for punishing mining corridors.',
    speed: 82, cargo: 28, tank: 400, eff: 3.4, range: 1360, maint: 10, price: 7400000, build: 2300,
  },
  {
    id: 'scania-r500', name: 'Scania R500', brand: 'Scania',
    tier: 3, propulsion: 'diesel', rating: 4.9, icon: 'truck-trailer', shape: 'semi',
    desc: 'The king of the highway — imported muscle with limo comfort.',
    speed: 95, cargo: 30, tank: 450, eff: 3.2, range: 1440, maint: 12, price: 12500000, build: 3200,
  },
  {
    id: 'volvo-fh16-roadtrain', name: 'Volvo FH16 Road Train', brand: 'Volvo',
    tier: 3, propulsion: 'diesel', rating: 5.0, icon: 'truck-trailer', shape: 'doubletrailer',
    desc: 'B-double monster — two full trailers behind 750 imported horses.',
    speed: 85, cargo: 42, tank: 600, eff: 2.6, range: 1560, maint: 14, price: 16500000, build: 3800,
  },
  {
    id: 'tata-ace-ev', name: 'Tata Ace EV', brand: 'Tata Motors',
    tier: 1, propulsion: 'electric', rating: 4.3, icon: 'truck-delivery',
    desc: 'The Chhota Haathi goes electric — silent, cheap last-mile runs.',
    speed: 60, cargo: 1, battery: 22, range: 154, maint: 2, price: 850000, build: 300,
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
