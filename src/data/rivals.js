// Rival trucking companies for the Industry Rankings leaderboard — a
// competitive layer with no persisted simulation state: each rival's score
// is a pure, deterministic function of the current game day (see
// rivalScoreOf in gameStore.js), so the leaderboard evolves over time
// without needing its own tick loop or save-data migration/versioning.
// baseScore/growth are calibrated against companyXP() so a diligent player
// can realistically catch and pass the lower rivals early and chase the
// top one deep into a playthrough.
export const RIVAL_COMPANIES = [
  { id: 'bharat-express', name: 'Bharat Express Logistics', logo: 'truck-fast', color: '#C0392B', baseScore: 3000, growth: 900 },
  { id: 'himalaya-freight', name: 'Himalaya Freight Co.', logo: 'truck', color: '#2980B9', baseScore: 2200, growth: 700 },
  { id: 'deccan-carriers', name: 'Deccan Carriers', logo: 'truck-cargo-container', color: '#12A150', baseScore: 1500, growth: 520 },
  { id: 'coastal-cargo', name: 'Coastal Cargo Union', logo: 'truck-trailer', color: '#7D3C98', baseScore: 900, growth: 380 },
  { id: 'silk-route', name: 'Silk Route Transport', logo: 'truck-delivery', color: '#B7791F', baseScore: 500, growth: 260 },
];

// One-time reward for first reaching #1 — see claimIndustryLeaderBonus().
export const INDUSTRY_LEADER_REWARD = { gold: 50, cash: 2000000 };
