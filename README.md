<div align="center">

# 🚚 Truck Empire Tycoon

**Build and run your own Asian trucking empire — real highways, real cities, real-time hauls. 100% offline. Made in India.**

![platform](https://img.shields.io/badge/platform-Android-3DDC84?logo=android&logoColor=white)
![framework](https://img.shields.io/badge/React%20Native-0.74-61DAFB?logo=react&logoColor=white)
![version](https://img.shields.io/badge/version-v1.4.0-blue)
![offline](https://img.shields.io/badge/play-offline-success)

</div>

---

## 🌏 About

Truck Empire Tycoon is an offline logistics tycoon game. Start with a single mini-truck in an Indian metro and grow into a cross-border freight giant — buy trucks, hire drivers, win contracts, open garages, run marketing campaigns and expand across Asia. Every route is computed over a **real national-highway graph**, so trucks never travel in straight lines — they roll through the towns you'd actually pass.

## ✨ Features

- 🗺️ **Real road routing** — Dijkstra over a hand-built highway network across India and 9 neighbouring countries.
- 🚛 **50+ real truck models** — from the Tata Ace to Volvo & Scania mega-haulers, across 3 tiers and diesel / electric / hybrid.
- 📦 **Live shipment tracking** — watch each haul pass intermediate cities, fuel stops, sleep breaks and short breaks, in real time.
- 👷 **Drivers & staff** — hire drivers, mechanics and managers; driver hours & distance update live as they drive.
- 📄 **Contracts** — a board that refreshes every few hours with bonus-paying freight jobs.
- 💰 **Deep economy** — cargo-type pricing, fuel/maintenance/tolls, tunable per-km rates, and a Gold ↔ Cash exchange.
- 🌏 **"Around India" world expansion** — unlock Nepal, Bhutan, Bangladesh, Sri Lanka, Pakistan, Myanmar, Afghanistan, Malaysia & China; cross-border hauls pay big but incur customs time + fees.
- 🔄 **In-app updates** — check for new releases, view version history and download the latest APK from the About screen.
- 📴 **Fully offline** — timestamp-based simulation settles progress even while the app is closed. No account, no backend.

## 🌏 The World

| Region | Status | Highlights |
| --- | --- | --- |
| 🇮🇳 India | Home market | 36 states · 440+ cities · endless highways |
| 🇳🇵 Nepal · 🇧🇹 Bhutan | Unlockable | Himalayan trade routes |
| 🇧🇩 Bangladesh · 🇱🇰 Sri Lanka | Unlockable | Delta cities & the Palk Strait ferry |
| 🇵🇰 Pakistan · 🇦🇫 Afghanistan | Unlockable | The Grand Trunk Road & Khyber Pass |
| 🇲🇲 Myanmar · 🇲🇾 Malaysia · 🇨🇳 China | Unlockable | The eastern gateway & the giant to the north |

## 🚀 Getting Started (development)

Requires the [React Native environment](https://reactnative.dev/docs/environment-setup) (Node, JDK 17, Android SDK).

```bash
npm install          # install dependencies
npm start            # start the Metro bundler
npm run android      # build & run on an Android device/emulator
```

To build a release APK:

```bash
cd android && ./gradlew assembleRelease
# output: android/app/build/outputs/apk/release/app-release.apk
```

## 🧱 Project Structure

```
src/
├── data/        cities, highways, trucks, staff, expansion (countries)
├── engine/      routing (Dijkstra), economy, stations, geo, sound, haptics
├── store/       gameStore.js — single Zustand source of truth (offline persistence)
├── net/         updates.js — GitHub-release auto-updater
└── ui/          screens, components, theme, map
```

## 📦 Versioning & Releases

> Read this before changing the app version — for humans and AI assistants alike.

The version must stay in sync in **three** places:

1. `src/net/updates.js` → `APP_VERSION` (e.g. `'v1.4.0'`) — what the app reports and compares against GitHub for the in-app "Check for Update".
2. `android/app/build.gradle` → `versionName` (`"1.4.0"`) and `versionCode` (integer, e.g. `140`).
3. The GitHub Release tag `vX.Y.Z` — created **automatically** by `.github/workflows/release.yml`.

**CI rule (source of truth = gradle `versionName`):** every merge to `main` reads `android/app/build.gradle`'s `versionName` and releases `v<versionName>` (e.g. `1.4.0` → `v1.4.0`). If that tag already exists, it falls back to patch-bumping the latest tag so tags never collide. So **to ship a specific version, set `versionName` (+ `APP_VERSION`) to it before merging.**

Keep `APP_VERSION` equal to the gradle `versionName` so the running app doesn't flag itself as out of date. The About tab reads releases from the [Releases API](https://api.github.com/repos/VasoyaParth/TransportManagementTycoon/releases).

## 👥 Team

| | Role |
| --- | --- |
| **Parth Vasoya** | Lead Developer & Designer |
| **Jeel Gajera** | Developer |

## 🙏 Credits

Built on wonderful open data & open source: **OpenStreetMap**, **Leaflet**, **Esri World Imagery**, **React Native**, **Material Community Icons**, and public National Highway references.

---

<div align="center">
Made with ♥ in India
</div>
