# Smoke suite

Drives the real app in headless Chrome and asserts the critical guest paths
still work.

```bash
npm run smoke                              # all scenarios
npm run smoke -- --only=preflight          # one scenario
CHROME_PATH=/path/to/chrome npm run smoke  # if Chrome is somewhere unusual
```

Takes ~85s. Exits non-zero on failure. Runs on every PR via
`.github/workflows/build-check.yml`.

## Why it exists

`npm run build` only proves the app compiles. The bug in #65 compiled fine,
passed CI, and silently deleted every answer given on `/calibrate` — it was
found only when a broken feature got demoed to an outside collaborator.

Two properties of that bug shaped this suite:

- **A fresh browser did not reproduce it.** It only appeared once the user
  arrived with a compass already built, because that is when `answers` contains
  topics outside `selectedTopics`. Developers testing locally rarely have that
  state. Every real user does. So scenarios seed realistic state rather than
  starting clean.
- **The telemetry already knew.** `compass_calibration_question_answered` had
  never fired once in the project's history. Nobody was looking. Tests fail
  loudly; dashboards need somebody to check them.

## Design notes

- **Dependency-free.** Node's built-in `WebSocket` (>= 22) talks the Chrome
  DevTools Protocol directly, against whatever Chrome is already installed. No
  Playwright/Puppeteer install, no browser download in CI.
- **Dev server, not a production build.** `src/lib/auth.js` only uses the
  relative `/api` base when `import.meta.env.DEV` is true, which routes through
  the Vite proxy. A production build calls the absolute API host and would be
  blocked by CORS from localhost.
- **A fresh browser profile per scenario.** The ev-context broker keeps state in
  its own origin's storage; a shared profile lets scenarios bleed together.
- **Hits the live API and broker on purpose.** The answer-loss regression only
  reproduces when the broker actually echoes writes back to the tab, so stubbing
  it would make the test pass vacuously. `preflight` fails loudly if either
  dependency is down, so an outage is legible instead of silent.
  The tradeoff: a prod API outage turns CI red. That is deliberate — a silent
  pass is what let #65 ship.
- **Selectors use `data-testid`, not classes.** A suite that breaks on a CSS
  tweak gets disabled, which defeats the point. `stance-option` and
  `calibration-progress` are the contract; keep them when restyling.

## Scenarios

| Scenario | Asserts |
|---|---|
| `preflight` | Topics API returns topics and *all* have stances (no stances = unanswerable questions); categories load; ev-context broker is reachable and mounted. |
| `guest-onboarding` | A brand-new visitor can go welcome → Local Lens → answer 8 → rendered compass. |
| `full-calibration-persists` | Regression for #65. A returning guest answering on `/calibrate` has answers stick: `8 / 44` → `14 / 44`. |
| `answers-survive-navigation` | The other half of #65: 20 answers are not truncated back to the selected 8 on the next compass load. |

## Verifying the suite still bites

A regression test that cannot fail is worse than none. To confirm it still
catches #65, revert the fix and run it:

```bash
git show 9d46027:src/components/CompassContext.jsx > src/components/CompassContext.jsx
npm run smoke   # full-calibration-persists and answers-survive-navigation must FAIL
git checkout src/components/CompassContext.jsx
```

`guest-onboarding` passes even with the bug reverted, and that is correct —
during the overlay every answered topic *is* selected, so nothing gets capped.
If it starts failing too, the suite has become non-specific.
