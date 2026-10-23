# تقویم مواعد هوشمند (Mavaed PWA)

A mobile-first Persian RTL PWA that computes the last valid day of a legal deadline under the Iranian Civil and Criminal Procedure Codes.

It has no build step, no backend and no third-party requests. Everything is stored in `localStorage` on the device.

## Structure
- `index.html`, `css/app.css`: the UI. The font is Vazirmatn v33.0.3 (OFL), bundled in `fonts/`.
- `js/jalali.js`: Jalali calendar math, an inline port of the jalaali-js algorithm.
- `js/holidays.js`: holiday data for 1405 (verified) and 1406 (computed).
- `js/rules.js`: deadline rules with article citations and source URLs.
- `js/calc.js`: the deadline engine (CPC arts. 443–446).
- `js/storage.js`: local storage plus JSON backup and restore.
- `js/ics.js`: calendar export, with alarms 3 days and 1 day before (09:00).
- `sw.js`: offline cache.
- `manifest.json` and `icons/`: install metadata, including the 180px apple-touch-icon.

## Run / test
```
python3 -m http.server 8765        # then open http://localhost:8765
npm test                           # unit tests (node:test), 20 tests
PW_DIR=/path/with/playwright-core node tests/e2e.mjs http://127.0.0.1:8765/   # headless 390x844 e2e
```

## Install on iPhone
1. Host the app over HTTPS (for example on GitHub Pages).
2. Open it in Safari.
3. Tap Share → Add to Home Screen.

See SOURCES.md for every legal rule and holiday source.
