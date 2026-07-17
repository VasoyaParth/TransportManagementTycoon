<div align="center">

# ✈️ Airline Empire Tycoon

**Build and run your own Asian cargo airline empire — real airports, point-to-point flights, real-time hauls. 100% offline. Made in India.**

![platform](https://img.shields.io/badge/platform-Android-3DDC84?logo=android&logoColor=white)
![framework](https://img.shields.io/badge/React%20Native-0.76-61DAFB?logo=react&logoColor=white)
![version](https://img.shields.io/badge/version-v1.0.0-blue)
![offline](https://img.shields.io/badge/play-offline-success)

</div>

---

## About

Airline Empire Tycoon is an offline cargo-airline tycoon game — forked from the trucking game in this same repo (`main` branch), reskinned end to end: aircraft instead of trucks, airports instead of garages, point-to-point flight routing instead of a road network. Start with a single light freighter out of an Indian metro and grow into a cross-border air-cargo giant — buy aircraft, hire crew, win contracts, open regional airports, run marketing campaigns and expand across Asia. Every route flies a real **great-circle path** between airports — no roads, no ferries, just the shortest line a plane would actually fly.

## Features

- **Point-to-point flight routing** — great-circle paths between airports, not roads. Cross-border flights still clear customs time + fees.
- **20+ aircraft models** — from light turboprop freighters to widebody cargo jets, across 3 tiers and diesel / electric / hybrid.
- **Live shipment tracking** — watch each flight in real time, with fuel-depot technical stops on the longest routes.
- **Crew & ground staff** — hire pilots, ground engineers and managers; crew hours & distance update live as they fly.
- **In-flight delays** — mechanical faults, bird strikes, cargo pilferage, customs holds and weather holds, each with its own odds, cost and (where it makes sense) a ground-crew call-out to cut the delay short.
- **Contracts** — a board that refreshes every few hours with bonus-paying freight jobs.
- **Fleet capacity** — your home hub and every regional airport contribute capacity toward one company-wide aircraft cap; upgrade a tier or open another airport to grow past it.
- **Aircraft & airport customization** — livery colour/accent/emblem on every aircraft, paint + tier upgrades on the home hub and every airport, all visible live on the map.
- **Deep economy** — cargo-type pricing, fuel/maintenance/landing fees, tunable per-km rates, and a Gold ↔ Cash exchange.
- **"Around India" world expansion** — unlock Nepal, Bhutan, Bangladesh, Sri Lanka, Pakistan, Myanmar, Afghanistan, Malaysia & China.
- **In-app updates** — check for new releases, view version history and download the latest APK from the About screen.
- **Fully offline** — timestamp-based simulation settles progress even while the app is closed. No account, no backend.

## Getting Started (development)

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

## Project Structure

```
src/
├── data/        cities (airport locations), aircraft, buildings, staff, expansion (countries)
├── engine/      routing (great-circle flight paths), economy, stations (fuel depots), geo, sound, haptics
├── store/       gameStore.js — single Zustand source of truth (offline persistence)
├── net/         updates.js — GitHub-release auto-updater
└── ui/          screens, components, theme, map (planeArt.js / buildingArt.js)
```

## Relationship to Truck Empire Tycoon

This app lives in the **same repository** as Truck Empire Tycoon but is a fully separate product: its own Android `applicationId` (`com.airlineempiretycoon`), its own CI pipeline (`.github/workflows/release-airline.yml`, triggered only on the `airlines-manager-app` branch), and its own release-tag namespace (`airline-vX.Y.Z`, never colliding with the trucking game's plain `vX.Y.Z` tags). Development happens on the `airlines-manager-app` branch; `main` continues to be Truck Empire Tycoon.

## Versioning & Releases

> Read this before changing the app version — for humans and AI assistants alike.

The version must stay in sync in **three** places:

1. `src/net/updates.js` → `APP_VERSION` (e.g. `'airline-v1.0.0'`) — what the app reports and compares against GitHub for the in-app "Check for Update". Only releases tagged `airline-v*` are considered (the trucking game's releases in this same repo are filtered out).
2. `android/app/build.gradle` → `versionName` (`"1.0.0"`) and `versionCode` (integer, e.g. `10000`).
3. The GitHub Release tag `airline-vX.Y.Z` — created **automatically** by `.github/workflows/release-airline.yml` on push to `airlines-manager-app`.

**CI rule (source of truth = gradle `versionName`):** every push to `airlines-manager-app` reads `android/app/build.gradle`'s `versionName` and releases `airline-v<versionName>` (e.g. `1.0.0` → `airline-v1.0.0`). If that tag already exists, it falls back to patch-bumping the latest `airline-v*` tag so tags never collide. So **to ship a specific version, set `versionName` (+ `APP_VERSION`) to it before merging.**

Keep `APP_VERSION` equal to `airline-v<gradle versionName>` so the running app doesn't flag itself as out of date.

## Team

| | Role |
| --- | --- |
| **Parth Vasoya** | Lead Developer & Designer |
| **Jeel Gajera** | Developer |

## Credits

Built on wonderful open data & open source: **OpenStreetMap**, **Leaflet**, **Esri World Imagery**, **React Native**, **Material Community Icons**.

---

<div align="center">
Made with ♥ in India
</div>
