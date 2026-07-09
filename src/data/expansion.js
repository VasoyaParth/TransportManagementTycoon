// ============================================================================
// v1.4.0 "Around India" expansion — DATA ONLY.
// Adds neighbouring Asian countries, their cities, and a road/sea network that
// links into India's existing highway graph via flagged BORDER edges. No game
// logic lives here; cities.js / highways.js merge these in, and the store gates
// deliveries by unlocked country + charges customs time/fee per border crossing.
//
// Foreign ids are country-prefixed (e.g. 'pk-lahore') so they never collide
// with Indian ids. Each foreign city is ALSO a road node (same id) so routing
// snaps cleanly onto the network.
// ============================================================================

// ---- Countries -------------------------------------------------------------
// `unlocked: true` => available from the start (India only). Others are unlocked
// in-game for `unlockCost` cash and pay a one-time `bonusCash` + `bonusGold`.
export const COUNTRIES = [
  { code: 'IN', name: 'India', icon: 'flag', unlocked: true, unlockCost: 0, bonusCash: 0, bonusGold: 0,
    blurb: 'Your home turf — the backbone of the empire.' },
  { code: 'NP', name: 'Nepal', icon: 'terrain', unlockCost: 8000000, bonusCash: 2000000, bonusGold: 30,
    blurb: 'Himalayan trade routes to Kathmandu and Pokhara.' },
  { code: 'BT', name: 'Bhutan', icon: 'pine-tree', unlockCost: 10000000, bonusCash: 2500000, bonusGold: 40,
    blurb: 'The Land of the Thunder Dragon — scenic mountain hauls.' },
  { code: 'BD', name: 'Bangladesh', icon: 'waves', unlockCost: 15000000, bonusCash: 3000000, bonusGold: 40,
    blurb: 'Dense delta cities and the busy Petrapole border.' },
  { code: 'LK', name: 'Sri Lanka', icon: 'ferry', unlockCost: 20000000, bonusCash: 4000000, bonusGold: 50,
    blurb: 'Island freight across the Palk Strait ferry.' },
  { code: 'PK', name: 'Pakistan', icon: 'flag-variant', unlockCost: 18000000, bonusCash: 3500000, bonusGold: 50,
    blurb: 'The Grand Trunk Road west through Lahore and Karachi.' },
  { code: 'MM', name: 'Myanmar', icon: 'rice', unlockCost: 22000000, bonusCash: 4000000, bonusGold: 50,
    blurb: 'The eastern gateway via Moreh–Tamu into Mandalay.' },
  { code: 'AF', name: 'Afghanistan', icon: 'castle', unlockCost: 25000000, bonusCash: 4500000, bonusGold: 60,
    blurb: 'Rugged routes beyond the Khyber Pass.' },
  { code: 'MY', name: 'Malaysia', icon: 'palm-tree', unlockCost: 30000000, bonusCash: 6000000, bonusGold: 70,
    blurb: 'Tropical peninsular corridors to Kuala Lumpur.' },
  { code: 'CN', name: 'China', icon: 'wall', unlockCost: 50000000, bonusCash: 10000000, bonusGold: 100,
    blurb: 'The giant to the north — Tibet, Yunnan and the mega-cities.' },
];

export const COUNTRY_BY_CODE = COUNTRIES.reduce((m, c) => (m[c.code] = c, m), {});

// ---- Cities (country-prefixed ids) -----------------------------------------
// [id, name, region, lat, lng, pop, tier]
const C = (country) => (rows) => rows.map(([id, name, region, lat, lng, pop, tier]) =>
  ({ id: `${country.toLowerCase()}-${id}`, name, state: region, country, lat, lng, pop, tier }));

export const INTL_CITIES = [
  ...C('PK')([
    ['lahore', 'Lahore', 'Punjab', 31.55, 74.34, 11100000, 1],
    ['karachi', 'Karachi', 'Sindh', 24.86, 67.01, 14900000, 1],
    ['islamabad', 'Islamabad', 'Capital Territory', 33.68, 73.05, 1100000, 1],
    ['rawalpindi', 'Rawalpindi', 'Punjab', 33.60, 73.04, 2100000, 2],
    ['faisalabad', 'Faisalabad', 'Punjab', 31.42, 73.08, 3200000, 2],
    ['multan', 'Multan', 'Punjab', 30.20, 71.47, 1900000, 2],
    ['peshawar', 'Peshawar', 'Khyber Pakhtunkhwa', 34.01, 71.58, 1970000, 2],
    ['quetta', 'Quetta', 'Balochistan', 30.18, 66.98, 1000000, 2],
    ['hyderabad', 'Hyderabad', 'Sindh', 25.39, 68.37, 1730000, 2],
    ['gujranwala', 'Gujranwala', 'Punjab', 32.16, 74.19, 2000000, 2],
    ['sialkot', 'Sialkot', 'Punjab', 32.49, 74.53, 660000, 3],
    ['sargodha', 'Sargodha', 'Punjab', 32.08, 72.67, 660000, 3],
    ['bahawalpur', 'Bahawalpur', 'Punjab', 29.40, 71.68, 760000, 3],
    ['sukkur', 'Sukkur', 'Sindh', 27.70, 68.86, 500000, 3],
    ['mardan', 'Mardan', 'Khyber Pakhtunkhwa', 34.20, 72.04, 360000, 3],
    ['abbottabad', 'Abbottabad', 'Khyber Pakhtunkhwa', 34.15, 73.22, 230000, 3],
    ['gwadar', 'Gwadar', 'Balochistan', 25.13, 62.33, 90000, 3],
  ]),
  ...C('NP')([
    ['kathmandu', 'Kathmandu', 'Bagmati', 27.71, 85.32, 1500000, 1],
    ['pokhara', 'Pokhara', 'Gandaki', 28.21, 83.99, 520000, 2],
    ['biratnagar', 'Biratnagar', 'Koshi', 26.45, 87.28, 240000, 2],
    ['birgunj', 'Birgunj', 'Madhesh', 27.00, 84.87, 240000, 2],
    ['bharatpur', 'Bharatpur', 'Bagmati', 27.68, 84.43, 280000, 2],
    ['butwal', 'Butwal', 'Lumbini', 27.70, 83.45, 200000, 3],
    ['bhairahawa', 'Bhairahawa', 'Lumbini', 27.50, 83.45, 120000, 3],
    ['dharan', 'Dharan', 'Koshi', 26.81, 87.28, 170000, 3],
    ['nepalgunj', 'Nepalgunj', 'Lumbini', 28.05, 81.62, 140000, 3],
    ['hetauda', 'Hetauda', 'Bagmati', 27.43, 85.03, 150000, 3],
    ['janakpur', 'Janakpur', 'Madhesh', 26.73, 85.92, 160000, 3],
    ['dhangadhi', 'Dhangadhi', 'Sudurpashchim', 28.69, 80.58, 150000, 3],
  ]),
  ...C('BT')([
    ['thimphu', 'Thimphu', 'Thimphu', 27.47, 89.64, 115000, 1],
    ['phuentsholing', 'Phuentsholing', 'Chukha', 26.85, 89.39, 28000, 2],
    ['paro', 'Paro', 'Paro', 27.43, 89.42, 12000, 3],
    ['punakha', 'Punakha', 'Punakha', 27.59, 89.87, 25000, 3],
    ['gelephu', 'Gelephu', 'Sarpang', 26.87, 90.49, 10000, 3],
    ['samdrup-jongkhar', 'Samdrup Jongkhar', 'S. Jongkhar', 26.80, 91.50, 10000, 3],
    ['wangdue', 'Wangdue Phodrang', 'Wangdue', 27.49, 89.90, 9000, 3],
  ]),
  ...C('BD')([
    ['dhaka', 'Dhaka', 'Dhaka', 23.81, 90.41, 10200000, 1],
    ['chittagong', 'Chittagong', 'Chattogram', 22.36, 91.78, 5200000, 1],
    ['khulna', 'Khulna', 'Khulna', 22.81, 89.57, 1500000, 2],
    ['rajshahi', 'Rajshahi', 'Rajshahi', 24.37, 88.60, 900000, 2],
    ['sylhet', 'Sylhet', 'Sylhet', 24.90, 91.87, 530000, 2],
    ['rangpur', 'Rangpur', 'Rangpur', 25.75, 89.24, 340000, 3],
    ['barisal', 'Barisal', 'Barisal', 22.70, 90.37, 420000, 3],
    ['comilla', 'Comilla', 'Chattogram', 23.46, 91.18, 390000, 3],
    ['mymensingh', 'Mymensingh', 'Mymensingh', 24.75, 90.40, 480000, 3],
    ['bogra', 'Bogra', 'Rajshahi', 24.85, 89.37, 350000, 3],
    ['jessore', 'Jessore', 'Khulna', 23.17, 89.21, 240000, 3],
    ['coxs-bazar', "Cox's Bazar", 'Chattogram', 21.43, 92.00, 220000, 3],
    ['narayanganj', 'Narayanganj', 'Dhaka', 23.62, 90.50, 290000, 3],
    ['dinajpur', 'Dinajpur', 'Rangpur', 25.63, 88.64, 190000, 3],
  ]),
  ...C('LK')([
    ['colombo', 'Colombo', 'Western', 6.93, 79.86, 750000, 1],
    ['kandy', 'Kandy', 'Central', 7.29, 80.64, 125000, 2],
    ['galle', 'Galle', 'Southern', 6.05, 80.22, 100000, 2],
    ['jaffna', 'Jaffna', 'Northern', 9.66, 80.02, 90000, 2],
    ['trincomalee', 'Trincomalee', 'Eastern', 8.57, 81.23, 100000, 3],
    ['negombo', 'Negombo', 'Western', 7.21, 79.84, 140000, 3],
    ['anuradhapura', 'Anuradhapura', 'North Central', 8.31, 80.40, 60000, 3],
    ['batticaloa', 'Batticaloa', 'Eastern', 7.71, 81.70, 90000, 3],
    ['kurunegala', 'Kurunegala', 'North Western', 7.49, 80.36, 30000, 3],
    ['ratnapura', 'Ratnapura', 'Sabaragamuwa', 6.68, 80.40, 50000, 3],
    ['matara', 'Matara', 'Southern', 5.95, 80.54, 75000, 3],
    ['vavuniya', 'Vavuniya', 'Northern', 8.75, 80.50, 70000, 3],
  ]),
  ...C('MM')([
    ['yangon', 'Yangon', 'Yangon', 16.87, 96.20, 5200000, 1],
    ['mandalay', 'Mandalay', 'Mandalay', 21.98, 96.08, 1200000, 1],
    ['naypyidaw', 'Naypyidaw', 'Naypyidaw', 19.75, 96.10, 920000, 2],
    ['bagan', 'Bagan', 'Mandalay', 21.17, 94.86, 60000, 3],
    ['mawlamyine', 'Mawlamyine', 'Mon', 16.49, 97.63, 290000, 3],
    ['taunggyi', 'Taunggyi', 'Shan', 20.79, 97.04, 380000, 3],
    ['monywa', 'Monywa', 'Sagaing', 22.11, 95.14, 190000, 3],
    ['sittwe', 'Sittwe', 'Rakhine', 20.15, 92.90, 150000, 3],
    ['pathein', 'Pathein', 'Ayeyarwady', 16.78, 94.73, 240000, 3],
    ['meiktila', 'Meiktila', 'Mandalay', 20.87, 95.86, 180000, 3],
    ['kalay', 'Kalay', 'Sagaing', 23.20, 94.06, 120000, 3],
    ['tamu', 'Tamu', 'Sagaing', 24.20, 94.30, 40000, 3],
  ]),
  ...C('AF')([
    ['kabul', 'Kabul', 'Kabul', 34.56, 69.21, 4600000, 1],
    ['kandahar', 'Kandahar', 'Kandahar', 31.61, 65.71, 610000, 2],
    ['herat', 'Herat', 'Herat', 34.35, 62.20, 570000, 2],
    ['mazar-i-sharif', 'Mazar-i-Sharif', 'Balkh', 36.71, 67.11, 470000, 3],
    ['jalalabad', 'Jalalabad', 'Nangarhar', 34.43, 70.45, 360000, 3],
  ]),
  ...C('MY')([
    ['kuala-lumpur', 'Kuala Lumpur', 'Federal Territory', 3.14, 101.69, 1800000, 1],
    ['george-town', 'George Town', 'Penang', 5.41, 100.33, 710000, 1],
    ['johor-bahru', 'Johor Bahru', 'Johor', 1.49, 103.74, 860000, 2],
    ['ipoh', 'Ipoh', 'Perak', 4.60, 101.07, 660000, 2],
    ['malacca', 'Malacca', 'Malacca', 2.19, 102.25, 580000, 2],
    ['kuantan', 'Kuantan', 'Pahang', 3.82, 103.33, 500000, 3],
    ['kota-bharu', 'Kota Bharu', 'Kelantan', 6.13, 102.24, 490000, 3],
    ['alor-setar', 'Alor Setar', 'Kedah', 6.12, 100.37, 400000, 3],
    ['seremban', 'Seremban', 'Negeri Sembilan', 2.73, 101.94, 560000, 3],
    ['kuching', 'Kuching', 'Sarawak', 1.55, 110.34, 680000, 2],
    ['kota-kinabalu', 'Kota Kinabalu', 'Sabah', 5.98, 116.07, 460000, 3],
    ['miri', 'Miri', 'Sarawak', 4.40, 113.99, 230000, 3],
  ]),
  ...C('CN')([
    ['lhasa', 'Lhasa', 'Tibet', 29.65, 91.13, 870000, 1],
    ['shigatse', 'Shigatse', 'Tibet', 29.27, 88.88, 120000, 3],
    ['gyirong', 'Gyirong', 'Tibet', 28.37, 85.30, 15000, 3],
    ['nyingchi', 'Nyingchi', 'Tibet', 29.65, 94.36, 230000, 3],
    ['kunming', 'Kunming', 'Yunnan', 25.04, 102.71, 6600000, 1],
    ['chengdu', 'Chengdu', 'Sichuan', 30.57, 104.07, 16300000, 1],
    ['chongqing', 'Chongqing', 'Chongqing', 29.56, 106.55, 15900000, 1],
    ['guangzhou', 'Guangzhou', 'Guangdong', 23.13, 113.26, 15300000, 1],
    ['shenzhen', 'Shenzhen', 'Guangdong', 22.54, 114.06, 12500000, 1],
    ['nanning', 'Nanning', 'Guangxi', 22.82, 108.32, 7400000, 2],
    ['guiyang', 'Guiyang', 'Guizhou', 26.65, 106.63, 4900000, 2],
    ['xian', "Xi'an", 'Shaanxi', 34.34, 108.94, 12900000, 1],
    ['lanzhou', 'Lanzhou', 'Gansu', 36.06, 103.83, 4000000, 2],
    ['xining', 'Xining', 'Qinghai', 36.62, 101.78, 2400000, 2],
    ['chengdu2', 'Ya\'an', 'Sichuan', 29.98, 103.00, 1500000, 3],
    ['kashgar', 'Kashgar', 'Xinjiang', 39.47, 75.99, 710000, 2],
    ['beijing', 'Beijing', 'Beijing', 39.90, 116.40, 21500000, 1],
    ['shanghai', 'Shanghai', 'Shanghai', 31.23, 121.47, 26300000, 1],
  ]),
];

// ---- Road nodes: every foreign city + a couple of Indian-side helper nodes --
const EXTRA_IN_NODES = {
  'rameswaram': { lat: 9.29, lng: 79.31 }, // ferry head to Sri Lanka (Palk Strait)
};

export const INTL_NODES = INTL_CITIES.reduce((m, c) => {
  m[c.id] = { lat: c.lat, lng: c.lng };
  return m;
}, { ...EXTRA_IN_NODES });

// ---- Edges -----------------------------------------------------------------
// Intra-country roads (chains/hubs) + flagged border crossings. `border: true`
// (with from/to codes) is what the store uses to charge customs time + fee.
const road = (a, b, nh = 'Intl') => ({ a, b, nh });
const border = (a, b, from, to, nh = 'Border') => ({ a, b, nh, border: true, from, to });
const sea = (a, b, from, to) => ({ a, b, nh: 'Sea Route', ferry: true, border: true, from, to });

export const INTL_EDGES = [
  // ——— Pakistan: GT Road + Sindh + Balochistan ———
  border('pk-lahore', 'amritsar', 'PK', 'IN', 'Wagah Border'),
  road('pk-lahore', 'pk-gujranwala'), road('pk-gujranwala', 'pk-sialkot'),
  road('pk-gujranwala', 'pk-faisalabad'), road('pk-lahore', 'pk-faisalabad'),
  road('pk-faisalabad', 'pk-sargodha'), road('pk-lahore', 'pk-multan'),
  road('pk-multan', 'pk-bahawalpur'), road('pk-bahawalpur', 'pk-sukkur'),
  road('pk-sukkur', 'pk-hyderabad'), road('pk-hyderabad', 'pk-karachi'),
  road('pk-multan', 'pk-quetta'), road('pk-quetta', 'pk-karachi'),
  road('pk-karachi', 'pk-gwadar'), road('pk-quetta', 'pk-gwadar'),
  road('pk-lahore', 'pk-islamabad'), road('pk-islamabad', 'pk-rawalpindi'),
  road('pk-rawalpindi', 'pk-abbottabad'), road('pk-islamabad', 'pk-peshawar'),
  road('pk-peshawar', 'pk-mardan'),
  // ——— Afghanistan (via Pakistan / Khyber) ———
  border('af-jalalabad', 'pk-peshawar', 'AF', 'PK', 'Khyber Pass'),
  road('af-jalalabad', 'af-kabul'), road('af-kabul', 'af-kandahar'),
  road('af-kabul', 'af-mazar-i-sharif'), road('af-kandahar', 'af-herat'),
  road('af-herat', 'af-mazar-i-sharif'), border('af-kandahar', 'pk-quetta', 'AF', 'PK', 'Chaman Border'),
  // ——— Nepal ———
  border('np-bhairahawa', 'gorakhpur', 'NP', 'IN', 'Sunauli Border'),
  border('np-biratnagar', 'siliguri', 'NP', 'IN', 'Kakarbhitta Border'),
  road('np-bhairahawa', 'np-butwal'), road('np-butwal', 'np-pokhara'),
  road('np-pokhara', 'np-kathmandu'), road('np-butwal', 'np-bharatpur'),
  road('np-bharatpur', 'np-hetauda'), road('np-hetauda', 'np-kathmandu'),
  road('np-bharatpur', 'np-birgunj'), road('np-birgunj', 'np-janakpur'),
  road('np-janakpur', 'np-biratnagar'), road('np-biratnagar', 'np-dharan'),
  road('np-butwal', 'np-nepalgunj'), road('np-nepalgunj', 'np-dhangadhi'),
  // ——— Bhutan ———
  border('bt-phuentsholing', 'siliguri', 'BT', 'IN', 'Jaigaon Border'),
  border('bt-gelephu', 'bongaigaon', 'BT', 'IN', 'Gelephu Border'),
  border('bt-samdrup-jongkhar', 'guwahati', 'BT', 'IN', 'Samdrup Border'),
  road('bt-phuentsholing', 'bt-thimphu'), road('bt-thimphu', 'bt-paro'),
  road('bt-thimphu', 'bt-punakha'), road('bt-punakha', 'bt-wangdue'),
  road('bt-wangdue', 'bt-gelephu'), road('bt-gelephu', 'bt-samdrup-jongkhar'),
  // ——— Bangladesh ———
  border('bd-jessore', 'kolkata', 'BD', 'IN', 'Petrapole Border'),
  border('bd-rangpur', 'siliguri', 'BD', 'IN', 'Burimari Border'),
  border('bd-sylhet', 'guwahati', 'BD', 'IN', 'Dawki Border'),
  road('bd-jessore', 'bd-khulna'), road('bd-jessore', 'bd-dhaka'),
  road('bd-khulna', 'bd-barisal'), road('bd-barisal', 'bd-dhaka'),
  road('bd-dhaka', 'bd-narayanganj'), road('bd-dhaka', 'bd-comilla'),
  road('bd-comilla', 'bd-chittagong'), road('bd-chittagong', 'bd-coxs-bazar'),
  road('bd-dhaka', 'bd-mymensingh'), road('bd-mymensingh', 'bd-sylhet'),
  road('bd-dhaka', 'bd-bogra'), road('bd-bogra', 'bd-rajshahi'),
  road('bd-bogra', 'bd-rangpur'), road('bd-rangpur', 'bd-dinajpur'),
  // ——— Sri Lanka (Palk Strait ferry) ———
  road('rameswaram', 'madurai'),
  sea('rameswaram', 'lk-jaffna', 'IN', 'LK'),
  road('lk-jaffna', 'lk-vavuniya'), road('lk-vavuniya', 'lk-anuradhapura'),
  road('lk-anuradhapura', 'lk-trincomalee'), road('lk-anuradhapura', 'lk-kurunegala'),
  road('lk-kurunegala', 'lk-kandy'), road('lk-kurunegala', 'lk-negombo'),
  road('lk-negombo', 'lk-colombo'), road('lk-colombo', 'lk-ratnapura'),
  road('lk-colombo', 'lk-galle'), road('lk-galle', 'lk-matara'),
  road('lk-kandy', 'lk-batticaloa'),
  // ——— Myanmar (Moreh–Tamu) ———
  border('mm-tamu', 'imphal', 'MM', 'IN', 'Moreh–Tamu Border'),
  road('mm-tamu', 'mm-kalay'), road('mm-kalay', 'mm-monywa'),
  road('mm-monywa', 'mm-mandalay'), road('mm-mandalay', 'mm-bagan'),
  road('mm-bagan', 'mm-meiktila'), road('mm-meiktila', 'mm-naypyidaw'),
  road('mm-mandalay', 'mm-taunggyi'), road('mm-naypyidaw', 'mm-yangon'),
  road('mm-yangon', 'mm-pathein'), road('mm-yangon', 'mm-mawlamyine'),
  road('mm-mandalay', 'mm-sittwe'),
  // ——— China (via Nepal & Myanmar) ———
  border('cn-gyirong', 'np-kathmandu', 'CN', 'NP', 'Gyirong–Rasuwa Border'),
  border('cn-kunming', 'mm-mandalay', 'CN', 'MM', 'Muse–Ruili Border'),
  road('cn-gyirong', 'cn-shigatse'), road('cn-shigatse', 'cn-lhasa'),
  road('cn-lhasa', 'cn-nyingchi'), road('cn-lhasa', 'cn-chengdu2'),
  road('cn-chengdu2', 'cn-chengdu'), road('cn-chengdu', 'cn-chongqing'),
  road('cn-chengdu', 'cn-xian'), road('cn-xian', 'cn-lanzhou'),
  road('cn-lanzhou', 'cn-xining'), road('cn-xining', 'cn-lhasa'),
  road('cn-lanzhou', 'cn-kashgar'), road('cn-kunming', 'cn-guiyang'),
  road('cn-guiyang', 'cn-chongqing'), road('cn-kunming', 'cn-nanning'),
  road('cn-nanning', 'cn-guangzhou'), road('cn-guangzhou', 'cn-shenzhen'),
  road('cn-chongqing', 'cn-xian'), road('cn-xian', 'cn-beijing'),
  road('cn-guangzhou', 'cn-shanghai'), road('cn-shanghai', 'cn-beijing'),
  // ——— Malaysia (sea link via Myanmar, then peninsular + Borneo ferries) ———
  sea('mm-yangon', 'my-george-town', 'MM', 'MY'),
  road('my-george-town', 'my-alor-setar'), road('my-george-town', 'my-ipoh'),
  road('my-ipoh', 'my-kuala-lumpur'), road('my-kuala-lumpur', 'my-seremban'),
  road('my-seremban', 'my-malacca'), road('my-malacca', 'my-johor-bahru'),
  road('my-kuala-lumpur', 'my-kuantan'), road('my-kuantan', 'my-kota-bharu'),
  sea('my-kuala-lumpur', 'my-kuching', 'MY', 'MY'),
  road('my-kuching', 'my-miri'), road('my-miri', 'my-kota-kinabalu'),
];
