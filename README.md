# Hafiz Quran

A Quran reader for huffaz that reproduces the Taj Company 16-line Mushaf Page by Page. Every Line starts and ends on the same word as in print. Built with [Expo](https://expo.dev) (SDK 57), Expo Router and [React Native Skia](https://shopify.github.io/react-native-skia/). See [ADR 0001](docs/adr/0001-page-rendering-approach.md) for the rendering approach and [GLOSSARY.md](GLOSSARY.md) for the terms used.

## Requirements

- **Node.js 22.13 or newer.** The Mushaf data prep uses Node's built-in SQLite.
- **npm**, which comes with Node.
- To run the app, either:
  - the **Expo Go** app for SDK 57 on your phone ([iOS](https://apps.apple.com/app/expo-go/id982107779) / [Android](https://play.google.com/store/apps/details?id=host.exp.exponent)), or
  - an iOS simulator (needs Xcode) or an Android emulator (needs Android Studio).

## Run it from a fresh clone

1. Clone the repo and install dependencies:

   ```bash
   git clone https://github.com/AxeemHaider/hafiz-quran.git
   cd hafiz-quran
   npm install
   ```

2. Prepare the Mushaf data. The reader needs this step; without it the app shows a "run data prep" message instead of a Page.

   ```bash
   npm run prepare:mushaf
   ```

   It should end with a line like `prepare-mushaf: Indopak 16 lines: 8742 Lines on 548 Pages, ...`.

3. Start the dev server. The `-c` flag clears Metro's cache so it picks up the generated files:

   ```bash
   npx expo start -c
   ```

4. Open the app:
   - **On your phone:** connect it to the same Wi-Fi as your computer and scan the QR code. On Android, scan from inside Expo Go; on iPhone, use the Camera app. If it can't connect, run `npx expo start -c --tunnel` instead.
   - **On a simulator or emulator:** press `i` (iOS) or `a` (Android) in the terminal.

The app opens on printed Page 2 (Al-Fatiha). Swipe to turn Pages: the next Page comes in from the left, as in the printed Mushaf. To open a specific Page, use the route `/<printed page number>`, for example `/401`.

## Mushaf data

The committed QUL source data lives in `sandbox/qul/`: the Taj 16-line layout, the Indopak Nastaleeq word-by-word script and the fonts. See [its README](sandbox/qul/README.md). The licences for this data are still unresolved (see #8), so confirm them before shipping it in a published app.

`npm run prepare:mushaf` turns that data into what the app bundles:

- `assets/generated/mushaf/mushaf.db` (the prepared Mushaf database)
- `assets/generated/mushaf/mushaf.ttf` (the font)

Both are git-ignored. The script checks the data and fails without writing anything if it is wrong. The schema is documented at the top of `scripts/prepare-mushaf.mjs`.

Run it again after you pull changes to `scripts/prepare-mushaf.mjs` or swap the font:

```bash
MUSHAF_FONT=/path/to/font.ttf npm run prepare:mushaf   # swap the font
QUL_DIR=/path/to/sandbox/qul npm run prepare:mushaf    # read QUL data from elsewhere (e.g. from a git worktree)
# the same as flags: --font <file>, --qul <dir>, --out <dir>
```

## Development

```bash
npx expo start -c     # start the dev server
npm test              # unit tests (Jest, jest-expo preset)
npx expo lint         # lint
npx tsc --noEmit      # typecheck
```

Run the tests, lint and typecheck before calling a change done.

Where things live:

- `src/app/`: Expo Router routes (`[page].tsx` is the Page reader route)
- `src/layout/`: the pure Page layout module, the one unit-tested seam
- `src/reader/`: the Skia renderer, pager and Page Frame drawing
- `src/frame/`: Page Frame geometry, the Para table and Urdu digits
- `src/mushaf/`: data access, the printed page number mapping, surah names and special Lines
- `scripts/prepare-mushaf.mjs`: the Mushaf data prep script
- `docs/`: the ADR, research notes and the Taj reference Page

`typecheck` needs the `expo-env.d.ts` and `.expo/types/` files that `npx expo start` generates. On a fresh clone, start the dev server once before running `npx tsc --noEmit`.

Native `ios/` and `android/` folders are generated (Continuous Native Generation). Configure native behaviour in `app.json`, never in those folders.
