# Smoke suite

Drives the real app in headless Chrome and asserts the critical guest paths
still work.

```bash
npm run smoke                              # all scenarios
npm run smoke -- --only=preflight          # one scenario
CHROME_PATH=/path/to/chrome npm run smoke  # if Chrome is somewhere unusual
SMOKE_CONCURRENCY=1 npm run smoke          # one scenario at a time (default 3)
```

The signed-in scenarios — every one marked `sharedAccount: true`, which is not
only the `authed-*` ones — need credentials (below) and **skip** rather than
fail without them, so the suite still runs for anyone. Exits non-zero on failure. Runs on every PR via
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
  `sharedAccount: true` all sign in to the one test account and rewrite its
  answers and lenses. They run one after another in a single lane,
  which takes one worker slot beside the guest scenarios. **Mark any new
  scenario that signs in `sharedAccount: true`**, or it will race the others
  for the account.
- 🔴 **NEVER DELETE A LENS ON THE SERVER FROM HERE.** Answers are reset freely;
  lenses are not, and the difference is not a style choice. ev-accounts runs a
  nightly `lens durability` check that reads every soft delete over seven days
  and fails when one owner lost more than one lens — the shape of a member
  losing work. Nothing marks this account as a test account, so every lens we
  delete reads as exactly that, and a tripwire that is red every morning is one
  nobody reads. ⚠ Restoring afterwards does **not** help: the check counts
  removal *events*, not the lens set as it stands. Reuse a fixed key, overwrite
  it, and put a per-run nonce where the assertion reads it — see
  `guest-lenses-promote-on-sign-in`, and the note where `clearServerLenses`
  used to live in `auth.mjs`.
- **…and no two RUNS overlap either, which is a separate problem.** That lane
  is per-run. Nothing stopped two CI runs holding the same account at once, and
  two PRs pushed two minutes apart duly wiped each other's seeded answers:
  `authed-hydrates-server-answers` failed with *"12 on the server, but ended up
  with 1"*, which reads as a hydration bug and is not one. It passed on re-run
  and locally — the worst shape a CI failure can take.

  The `smoke` job now carries its own `concurrency` group keyed on a **literal**
  (`smoke-shared-test-account`), not on `github.ref` like the workflow-level
  one, because the resource is one account shared by every run. GitHub keeps at
  most one run pending per group, so a third concurrent run cancels the
  second's wait: a cancelled check is honest and re-runnable, which the silent
  wrong failure was not. If three smoke jobs at once becomes normal here, the
  answer is a second test account, not a longer queue.

  ⚠ **A local `npm run smoke` is outside that lock.** Nothing in GitHub can
  serialise your laptop against CI. Don't start one while CI is running, or
  point it at a different `SMOKE_EMAIL`. `authed-hydrates-server-answers` now
  re-checks the server before it blames hydration and names contention as the
  first thing to rule out — see `seedStillOnServer`.
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
| `write-in-survives-the-broker-echo` | A guest can answer in their own words on `/calibrate` — open the card, type, drag it into place — and both the text and its half-step value survive a page load and the broker round trip. |
| `write-in-reaches-the-server` | A signed-in user's write-in reaches the server *with* `write_in_text`, at a non-integer value. The POST is debounced and fire-and-forget, so losing the text is otherwise silent. |
| `write-in-placed-by-keyboard` | The same placement with no pointer at all: Shift+Tab out of the editor must land on the handle, and the arrow keys must put the card where the equivalent drag would. Asserts the identical value to the drag scenario. |

This table has never listed every scenario; `run.mjs` is the complete list.

### Driving the write-in card

The two write-in scenarios are the only ones that drive a real drag, and the
helpers in `run.mjs` carry the two details that make it work: the press must
land on `write-in-grip` (the only element with dnd-kit's listeners, so the
textarea stays typeable), and the travel is measured from the **card's** centre
rather than the cursor's, because `closestCenter` compares the dragged node's
rect against the droppables. Aiming the pointer at the target row moves the
card by the wrong delta and it lands a slot or two off — intermittently.

Text goes in via `Input.insertText`, never `el.value = …`: React owns that
property, so an assignment updates the DOM and leaves component state behind.

### The keyboard route, and why it is here rather than in a unit test

The card can also be placed with the arrow keys, and `placeWriteInByKeyboard`
drives that. Nearly all of it is better covered by
`src/components/StanceChooser.test.jsx` — an arrow press needs no geometry, so
those are real unit tests rather than a mocked `DndContext`.

One thing is not. The helper reaches the handle by pressing **Shift+Tab out of
the editor** and asserting where focus landed, because focus order belongs to
the browser and jsdom will not tell you the truth about it. The bug this covers
was exactly that: the handle was a plain div carrying dnd-kit's listeners, so
it was never in the tab order, while the card's own text told the user to move
it. A helper that called `.focus()` on the handle would sail straight past it.

Keys go through `Input.dispatchKeyEvent`, not `new KeyboardEvent(…)`: a
synthetic event has no default action, so a synthetic Shift+Tab moves focus
nowhere.

### Authed scenarios

Everything else runs as a guest, but signed-in users take a different path
entirely: the server, not localStorage, is their source of truth.

Credentials come from `SMOKE_EMAIL` / `SMOKE_PASSWORD`, or from
`~/.ev-compass-smoke/creds.env` (override with `SMOKE_CREDS_FILE`). They are
never committed. To run them in CI, add the two as repository secrets and pass
them through to the `smoke` job; without them the scenarios skip.

Use a **dedicated throwaway account** — these scenarios delete and rewrite the
account's compass answers on every run. One account is shared by every run of
the suite everywhere, which is why the `smoke` job serialises itself repo-wide
and why a local run must not overlap CI (see the design note above).

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

The write-in pair was checked the same way on 2026-11-21, one bug at a time:

- Remove the `localStorage.setItem("writeIns", …)` effect in
  `CompassContext.jsx` → `write-in-survives-the-broker-echo` FAILS with
  `the typed stance was not saved for "<topic>": got undefined`.
- Drop `write_in_text` from the POST body in `FullCalibration.jsx`'s
  `persistWriteIn` → `write-in-reaches-the-server` FAILS with
  `the server has 0 row(s) carrying that text out of 1`.

If either one starts failing at `expected the write-in to answer exactly one
topic, got []`, the drag stopped registering and the scenario is no longer
testing persistence at all — fix the drag before trusting the result.

`write-in-placed-by-keyboard` was checked the same way on 2026-11-21, by
putting back the shape that shipped before it, one piece at a time, in
`StanceChooser.jsx`:

- Turn the handle back into `<div {...listeners}>` and move `{...attributes}`
  back onto the card → FAILS with `Shift+Tab out of the editor reached
  "write-in-card", not the write-in handle`. That message is the old bug
  verbatim: focus went to the card, which carried dnd-kit's `tabIndex`, and
  the handle itself was not reachable at all.
- Pass `onMove={undefined}` to the card → FAILS with `expected the arrow keys
  to answer exactly one topic, got []`. The handle takes focus but the keys
  move nothing.

The first of those is the one that needs a browser. The second is also caught
by ten unit tests, and if only the smoke scenario is failing, read those first.

`guest-onboarding` passes even with the bug reverted, and that is correct —
during the overlay every answered topic *is* selected, so nothing gets capped.
If it starts failing too, the suite has become non-specific.
