# Smoke suite

Drives the real app in headless Chrome and asserts the critical guest paths
still work.

```bash
npm run smoke                              # all scenarios
npm run smoke -- --only=preflight          # one scenario
CHROME_PATH=/path/to/chrome npm run smoke  # if Chrome is somewhere unusual
SMOKE_CONCURRENCY=1 npm run smoke          # one scenario at a time (default 3)
```

The three signed-in scenarios (`authed-*`, `guest-lenses-promote-on-sign-in`)
need credentials (below) and **skip** rather than fail without them, so the
suite still runs for anyone. Exits non-zero on failure. Runs on every PR via
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
- **Several scenarios at once.** Scenarios run `SMOKE_CONCURRENCY` at a time
  (default 3), each in its own Chrome with its own profile and debug port,
  against one shared dev server. Most of a scenario's time is fixed settle
  delays, not CPU, so this cuts the run to roughly a third. Each scenario's
  lines are held and printed together when it finishes, so the output is in
  finishing order, not file order. Set `SMOKE_CONCURRENCY=1` to get the old
  one-at-a-time run when a failure looks like it might be timing.
- **Signed-in scenarios never overlap each other.** Scenarios marked
  `sharedAccount: true` all sign in to the one test account and delete and
  rewrite its answers and lenses. They run one after another in a single lane,
  which takes one worker slot beside the guest scenarios. **Mark any new
  scenario that signs in `sharedAccount: true`**, or it will race the others
  for the account.
- **Wait for what you can see; sleep only for what must not happen.** A fixed
  `b.sleep()` that waits for something observable can be `settleUntil()`
  instead: it polls, returns early when the condition holds, and leaves the
  pass/fail call to the assertion after it. Keep the fixed sleep where it
  proves something did *not* happen (an empty broker payload must not wipe a
  compass), or where the thing is invisible to the page (fire-and-forget
  POSTs, the broker echo in `answers-survive-navigation`).
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
| `remote-update-persists` | A spoke inversion arriving from another tab or subdomain survives a reload — every slice the subscribe callback writes needs a persistence path behind it. |
| `remote-clear-propagates` | Reset Compass in one tab clears the others — and, the harder half, an unhydrated tab publishing empty content does NOT wipe a populated one. |
| `authed-hydrates-server-answers` | A signed-in user with one stray local answer still loads their server answers, and does not lose the local one. Runs on `/calibrate` on purpose (see below). |
| `authed-answer-reaches-server` | An answer given while signed in actually persists server-side. Those POSTs are fire-and-forget, so a failure is otherwise silent. |
| `compare-links-reach-essentials` | "Compare on Essentials" points at Essentials, and a saved comparison's "View full profile on Essentials" link goes to `/politician/<id>#compass=…`. Comparing lives on Essentials now (#111), so these links are the whole compare feature from here. |

### Authed scenarios

Everything else runs as a guest, but signed-in users take a different path
entirely: the server, not localStorage, is their source of truth.

Credentials come from `SMOKE_EMAIL` / `SMOKE_PASSWORD`, or from
`~/.ev-compass-smoke/creds.env` (override with `SMOKE_CREDS_FILE`). They are
never committed. To run them in CI, add the two as repository secrets and pass
them through to the `smoke` job; without them the scenarios skip.

Use a **dedicated throwaway account** — these scenarios delete and rewrite the
account's compass answers on every run.

`authed-hydrates-server-answers` deliberately runs on `/calibrate`, not
`/results`. `CombinedPage` issues its own `/compass/answers` fetch that masks a
hydration failure on the results page; `/calibrate` does not mount
`CombinedPage`, so `CompassContext`'s hydration is the only path and a
regression there is actually visible. Pointing this scenario at `/results`
makes it pass whether the bug is present or not — it was written that way
first, and the mistake is what surfaced the real, narrower bug.

## Verifying the suite still bites

A regression test that cannot fail is worse than none. To confirm it still
catches #65, put the bug back and run it.

⚠ Do **not** restore an old `CompassContext.jsx` wholesale (the earlier recipe
here used `git show 9d46027:...`). That file is many commits behind the rest of
the app now, so the app fails to start, *every* scenario fails, and the check
proves nothing about #65.

Instead, put back only the bug. In `src/components/CompassContext.jsx`, in the
guest `evContext.subscribe` callback, replace the whole
`if (c.a && typeof c.a === 'object') { const scope = ... }` block with the
pre-#65 line:

```js
if (c.a && typeof c.a === 'object') setAnswers(c.a);
```

That replaces local answers with the broker's capped (≤8 topic) copy instead of
merging it in. Then:

```bash
npm run smoke   # full-calibration-persists and answers-survive-navigation must FAIL
git checkout src/components/CompassContext.jsx
```

Last checked 2026-11-07, three at a time and one at a time: both FAIL at the
assertion they exist for — `answer 1 did not stick: expected 9 answers, got 8`,
and `answers were truncated on load: had 20, now 8`. Several lens and compare
scenarios fail too.

If either one fails at its *seeding* check instead, the scenario has stopped
testing #65. Both seed from the topics JSON page, not an app page, so the app's
first load already sees the built compass; seeding from an app page lets that
load publish an empty compass that the buggy code then applies on reload.

`guest-onboarding` passes even with the bug reverted, and that is correct —
during the overlay every answered topic *is* selected, so nothing gets capped.
If it starts failing too, the suite has become non-specific.
