# Custom Lens Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users build, name, and switch to their own compass lenses, with a prompt to recalibrate any question whose wording has since changed.

**Architecture:** Replace the inferred "is a lens active" heuristic with an explicit `activeLensKey` in `CompassContext`, then build the lens UI on top of that fact. Guest lenses live in `localStorage` and never enter the shared ev-context payload; signed-in lenses use `GET`/`PUT /api/compass/my-lenses`, which is already live in production.

**Tech Stack:** React 18 + Vite, Tailwind, `@dnd-kit` for spoke ordering, `vitest` (added by Task 1), and the existing CDP smoke suite (`npm run smoke`).

**Spec:** `docs/superpowers/specs/2026-08-29-custom-lens-builder-design.md`

## Global Constraints

- **Branch:** `feat/lens-builder`, already created off `main`.
- **Lens key format:** `u_` + 6 lowercase hex characters (e.g. `u_7f3a91`). Server regex is `^u_[a-z0-9]{4,32}$` — do not emit uppercase, and do not drop the `u_` prefix; it is what prevents a user lens from shadowing the curated `local` / `federal` / `judicial` keys in the same switcher row.
- **Topic ceiling:** 8 per lens. Enforced by a `CHECK` constraint in migration 1849 and by the server's zod schema. The client must never `PUT` more than 8.
- **Lens count ceiling:** 20 per `PUT`. Server rejects more.
- **Guest lenses must never enter the ev-context payload.** They are Compass-local only. Nothing in this plan may add a field to the `compass` slice published to the broker.
- **`activeLensKey` is never sent to the server and never published to ev-context.** It is per-tab view state.
- **The invariant, from spec §4.2:** while `activeLensKey !== null`, `selectedTopics` is a view and the user's compass is `preLensTopics`. Only the compass is persisted to the server or published as `s`.
- **`publicNote` is rendered verbatim.** It is editorial's own wording; the client never paraphrases or truncates it.
- **Run `npm run lint` before every commit.** Lint is gated in CI (#67). Do not bulk-autofix or delete anything the linter calls unused without confirming in the running app that nothing renders it — "unused" findings in this repo have been false positives on live components.

---

### Task 1: Add vitest and the `userLenses` pure-function module

The repo has **no unit test framework today** — the only automated coverage is the CDP smoke suite. The key generation, storage, and merge logic are pure functions with real edge cases, and they should not need a browser to test. `vitest` is already the house tool in EV-Accounts (3.2.7).

**Files:**
- Modify: `package.json` (devDependency + `test` script)
- Create: `src/lib/userLenses.js`
- Test: `src/lib/userLenses.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `generateLensKey(): string` — `u_` + 6 lowercase hex
  - `readGuestLenses(): Array<{key, name, topicIds, visibility}>`
  - `writeGuestLenses(lenses): void`
  - `clearGuestLenses(): void`
  - `mergeLensSets(serverLenses, localLenses): Array<...>` — server wins by key, local-only appended
  - `toPutPayload(lenses): { lenses: Array<{key, name, topic_ids, visibility}> }`
  - `GUEST_LENS_STORAGE_KEY: 'customLenses'`

- [ ] **Step 1: Install vitest and add the test script**

```bash
npm install --save-dev vitest@^3.2.7
```

Then add to `package.json` `scripts`, after `"smoke"`:

```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 2: Write the failing tests**

Create `src/lib/userLenses.test.js`:

```js
import { describe, it, expect, beforeEach } from "vitest";
import {
  generateLensKey,
  readGuestLenses,
  writeGuestLenses,
  clearGuestLenses,
  mergeLensSets,
  toPutPayload,
  GUEST_LENS_STORAGE_KEY,
} from "./userLenses.js";

beforeEach(() => localStorage.clear());

describe("generateLensKey", () => {
  it("matches the server's key regex", () => {
    // Server: /^u_[a-z0-9]{4,32}$/. Uppercase or a missing prefix is a 422.
    for (let i = 0; i < 50; i++) {
      expect(generateLensKey()).toMatch(/^u_[a-z0-9]{6}$/);
    }
  });

  it("does not collide across many draws", () => {
    const keys = new Set();
    for (let i = 0; i < 500; i++) keys.add(generateLensKey());
    expect(keys.size).toBe(500);
  });
});

describe("guest storage", () => {
  it("round-trips a lens set", () => {
    const lenses = [{ key: "u_7f3a91", name: "Farm bill", topicIds: ["t1"], visibility: "private" }];
    writeGuestLenses(lenses);
    expect(readGuestLenses()).toEqual(lenses);
  });

  it("returns [] when nothing is stored", () => {
    expect(readGuestLenses()).toEqual([]);
  });

  it("returns [] rather than throwing on corrupt storage", () => {
    // Corrupt localStorage must degrade to "no custom lenses", never crash the
    // compass — the same rule safeParse applies everywhere else in this app.
    localStorage.setItem(GUEST_LENS_STORAGE_KEY, "{not json");
    expect(readGuestLenses()).toEqual([]);
  });

  it("returns [] when the stored value is not an array", () => {
    localStorage.setItem(GUEST_LENS_STORAGE_KEY, '{"key":"u_7f3a91"}');
    expect(readGuestLenses()).toEqual([]);
  });

  it("clears", () => {
    writeGuestLenses([{ key: "u_7f3a91", name: "x", topicIds: [], visibility: "private" }]);
    clearGuestLenses();
    expect(readGuestLenses()).toEqual([]);
  });
});

describe("mergeLensSets", () => {
  const server = [{ key: "u_aaaaaa", name: "Server copy", topicIds: ["t1"], visibility: "private" }];
  const local = [
    { key: "u_aaaaaa", name: "Local copy", topicIds: ["t2"], visibility: "private" },
    { key: "u_bbbbbb", name: "Local only", topicIds: ["t3"], visibility: "private" },
  ];

  it("lets the server win on a shared key", () => {
    // The account's own copy is canonical; a stale guest copy must not clobber it.
    const merged = mergeLensSets(server, local);
    expect(merged.find((l) => l.key === "u_aaaaaa").name).toBe("Server copy");
  });

  it("appends local-only lenses", () => {
    const merged = mergeLensSets(server, local);
    expect(merged.map((l) => l.key)).toEqual(["u_aaaaaa", "u_bbbbbb"]);
  });

  it("handles either side being empty", () => {
    expect(mergeLensSets([], local)).toHaveLength(2);
    expect(mergeLensSets(server, [])).toHaveLength(1);
    expect(mergeLensSets([], [])).toEqual([]);
  });
});

describe("toPutPayload", () => {
  it("renames topicIds to the wire's topic_ids", () => {
    const payload = toPutPayload([
      { key: "u_7f3a91", name: "Farm bill", topicIds: ["t1", "t2"], visibility: "private" },
    ]);
    expect(payload).toEqual({
      lenses: [{ key: "u_7f3a91", name: "Farm bill", topic_ids: ["t1", "t2"], visibility: "private" }],
    });
  });

  it("defaults visibility to private", () => {
    const payload = toPutPayload([{ key: "u_7f3a91", name: "x", topicIds: [] }]);
    expect(payload.lenses[0].visibility).toBe("private");
  });

  it("drops needsRecalibration and timestamps, which are server-owned", () => {
    const payload = toPutPayload([
      {
        key: "u_7f3a91", name: "x", topicIds: [], visibility: "private",
        needsRecalibration: [{ topicId: "t1" }], createdAt: "now", updatedAt: "now",
      },
    ]);
    expect(Object.keys(payload.lenses[0]).sort()).toEqual(["key", "name", "topic_ids", "visibility"]);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./userLenses.js"`

- [ ] **Step 4: Write the implementation**

Create `src/lib/userLenses.js`:

```js
// User-authored lenses: key generation, guest storage, and the shapes the
// /compass/my-lenses API expects.
//
// Pure functions only — no React, no fetch. Everything here is unit-tested; the
// wiring that uses it is covered by the smoke suite.

export const GUEST_LENS_STORAGE_KEY = "customLenses";

/**
 * A globally unique, client-generated lens key.
 *
 * Globally unique rather than per-user because lenses are meant to become
 * shareable: a per-user id would have to be rewritten at the moment of sharing,
 * invalidating any link already handed out. The `u_` prefix keeps user keys out
 * of the curated namespace ('local', 'federal', 'judicial') — both are read by
 * the same switcher row, so a user lens named 'federal' would otherwise shadow
 * the editorial one.
 *
 * Must satisfy the server's /^u_[a-z0-9]{4,32}$/.
 */
export function generateLensKey() {
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `u_${hex}`;
}

/** Guest lenses, or [] for anything unreadable. Never throws. */
export function readGuestLenses() {
  try {
    const parsed = JSON.parse(localStorage.getItem(GUEST_LENS_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeGuestLenses(lenses) {
  localStorage.setItem(GUEST_LENS_STORAGE_KEY, JSON.stringify(lenses));
}

export function clearGuestLenses() {
  localStorage.removeItem(GUEST_LENS_STORAGE_KEY);
}

/**
 * Merge a guest's local lenses into the account's on sign-in.
 *
 * The server copy wins on a shared key: it is the account's own canonical copy,
 * and a stale guest copy left in a browser must not overwrite it. Local-only
 * lenses are appended — they are work the user did that has no server copy yet.
 */
export function mergeLensSets(serverLenses, localLenses) {
  const server = Array.isArray(serverLenses) ? serverLenses : [];
  const local = Array.isArray(localLenses) ? localLenses : [];
  const seen = new Set(server.map((l) => l.key));
  return [...server, ...local.filter((l) => !seen.has(l.key))];
}

/**
 * The PUT body. Note `topicIds` -> `topic_ids`: the API is snake_case on the way
 * in and camelCase on the way out, matching the rest of /compass.
 *
 * Server-owned fields (needsRecalibration, createdAt, updatedAt) are dropped —
 * sending them back is harmless but meaningless, and it invites treating the
 * client's copy of a server computation as authoritative.
 */
export function toPutPayload(lenses) {
  return {
    lenses: lenses.map((l) => ({
      key: l.key,
      name: l.name,
      topic_ids: Array.isArray(l.topicIds) ? l.topicIds : [],
      visibility: l.visibility ?? "private",
    })),
  };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

These tests use `localStorage` and `crypto.getRandomValues`, which vitest's
default `node` environment does not provide. Install jsdom and configure it
before running — this is required, not conditional:

```bash
npm install --save-dev jsdom
```

Create `vitest.config.js`:

```js
import { defineConfig } from "vitest/config";

// jsdom, because these modules touch localStorage and crypto.getRandomValues.
export default defineConfig({
  test: { environment: "jsdom" },
});
```

Run: `npm test`
Expected: PASS, 14 tests.

- [ ] **Step 6: Lint and commit**

```bash
npm run lint
git add package.json package-lock.json src/lib/userLenses.js src/lib/userLenses.test.js vitest.config.js
git commit -m "test(compass): add vitest, and the userLenses key/storage module"
```

---

### Task 2: Replace inferred lens state with `activeLensKey` in `CompassContext`

This is the change the whole feature depends on. See spec §2 for why inference cannot survive user lenses.

**Files:**
- Modify: `src/components/CompassContext.jsx` (state, the publisher effect at ~185-253, provider value)

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces, on the compass context:
  - `activeLensKey: string | null`
  - `setActiveLensKey(key: string | null): void`

- [ ] **Step 1: Add the state, mirrored to sessionStorage**

Near the other `useState` calls (around line 66-86), add:

```jsx
  // Which lens is currently being viewed; null means "the user's own compass".
  //
  // 🔴 THIS REPLACES AN INFERENCE, AND THE INFERENCE WAS THE BUG. Activation used
  // to be derived by testing whether every selected topic belonged to some lens
  // (isLensTopicSet / lensIsActive). That works only while lenses are curated sets
  // of topics the user did not choose. A USER lens is built from the user's own
  // topics, so "save my compass as a lens" makes the user's compass match a lens
  // by definition — and the derived answer becomes "a lens is active" while they
  // are looking at their own compass. Everything downstream then treats the real
  // compass as a disposable view: it is not persisted, and a stale preLensTopics
  // goes out as `s`. That is the #68/#71 silent-non-persistence bug, structural.
  //
  // sessionStorage, not localStorage: a lens is a per-tab view choice, and two
  // tabs may legitimately show different lenses. It survives a reload so that a
  // refresh inside a lens does not silently reinterpret the topic set.
  const [activeLensKey, setActiveLensKeyState] = useState(
    () => sessionStorage.getItem("activeLensKey") || null
  );
  const setActiveLensKey = useCallback((key) => {
    setActiveLensKeyState(key);
    if (key) sessionStorage.setItem("activeLensKey", key);
    else sessionStorage.removeItem("activeLensKey");
  }, []);
```

Add `useCallback` to the React import at the top of the file if it is not already there.

- [ ] **Step 2: Switch the publisher to read the explicit key**

In the ev-context publishing effect, replace:

```jsx
    const lensActive = isLensTopicSet(selectedTopics, lenses);
```

with:

```jsx
    const lensActive = activeLensKey !== null;
```

Update the comment directly above it — it currently explains the heuristic — to:

```jsx
    // A lens is a local VIEW overlay, not the user's compass. While one is
    // active, `selectedTopics` holds the lens's topics — and publishing those as
    // `s` tells every other app that the lens IS the user's compass. Essentials
    // then draws the lens in its "custom" mode, the mode that means "my compass".
    //
    // `activeLensKey` is the fact; this used to be inferred from the topic set,
    // which cannot survive user lenses (see the state declaration above).
```

Add `activeLensKey` to that effect's dependency array (line ~253), and remove `lenses` from it if nothing else in the effect still uses it — check before removing.

- [ ] **Step 3: Remove the now-unused import**

If `isLensTopicSet` is no longer referenced in this file, remove it from the `../lib/lenses` import. Leave the symbol in `lenses.js` for now; Task 3 deletes it once `CombinedPage` also stops using it.

- [ ] **Step 4: Expose both on the provider**

In the `value={{ ... }}` object, after `lenses,`:

```jsx
        activeLensKey,
        setActiveLensKey,
```

- [ ] **Step 5: Verify the app still runs**

Run: `npm run dev`, open the app, confirm the compass renders and switching a curated lens still swaps the spokes. Lens switching is still driven by `CombinedPage`'s own inference at this point — that is expected and is fixed in Task 3.

- [ ] **Step 6: Lint and commit**

```bash
npm run lint
git add src/components/CompassContext.jsx
git commit -m "refactor(compass): make lens activation explicit in CompassContext"
```

---

### Task 3: Move `CombinedPage` onto `activeLensKey`, delete `isLensTopicSet`, and gate it with a smoke test

**Files:**
- Modify: `src/pages/CombinedPage.jsx` (~1160-1340: `lensIsActive`, `activeLens`, `exitLensMode`, `doStartLens`, `exitToCompass`)
- Modify: `src/lib/lenses.js` (delete `isLensTopicSet`)
- Modify: `smoke/run.mjs` (add the regression scenario)

**Interfaces:**
- Consumes: `activeLensKey`, `setActiveLensKey` from Task 2.
- Produces: `allLenses` — curated lenses concatenated with user lenses, the array the switcher and lookup use. In this task it is still just the curated `lenses`; Task 5 adds user lenses to it.

- [ ] **Step 1: Write the failing smoke scenario**

This is the scenario that proves the model changed. Under the old inference it fails; under `activeLensKey` it passes.

Add to the `scenarios` array in `smoke/run.mjs`:

```js
  {
    name: "compass-equal-to-lens-still-persists",
    // THE REGRESSION THIS WHOLE CHANGE EXISTS TO PREVENT.
    //
    // Lens activation used to be inferred: "every selected topic belongs to some
    // lens" meant "a lens is showing". Once a user can save their own compass AS
    // a lens, that inference reports a lens whenever the user's compass happens
    // to equal one — which, for the "save this view" flow, is immediately and by
    // construction. The compass then stops being persisted and a stale
    // preLensTopics is published as `s`.
    //
    // So: make the compass identical to a lens's topic set, and assert the
    // compass is still what goes on the wire.
    async run(b, baseUrl) {
      const lenses = await (await fetch(`${baseUrl}${API}/lenses`)).json();
      const lens = (Array.isArray(lenses) ? lenses : []).find(
        (l) => Array.isArray(l.topicIds) && l.topicIds.length >= 3
      );
      assert(lens, "no lens with topics returned by /compass/lenses");
      const topics = await (await fetch(`${baseUrl}${API}/topics`)).json();
      const own = lens.topicIds
        .map((id) => topics.find((t) => t.id === id))
        .filter(Boolean);
      assert(own.length >= 3, "lens topics not present in /topics");

      await b.navigate(`${baseUrl}/results`, { settleMs: 5000 });
      await b.evaluate(`(() => {
        const answers = {};
        ${JSON.stringify(own.map((t) => t.short_title))}.forEach((s, i) => { answers[s] = (i % 5) + 1; });
        localStorage.setItem('answers', JSON.stringify(answers));
        // The user's OWN compass — which happens to be exactly this lens's topics.
        localStorage.setItem('selectedTopics', JSON.stringify(${JSON.stringify(own.map((t) => t.id))}));
        localStorage.setItem('calibration_completed', 'true');
        // No lens is active. No preLensTopics. No activeLensKey.
        localStorage.removeItem('preLensTopics');
        sessionStorage.removeItem('activeLensKey');
      })()`);

      await b.send('Page.addScriptToEvaluateOnNewDocument', {
        source: `
          window.__published = [];
          window.addEventListener('message', (e) => {
            if (e.data && e.data.type === 'ev-context:update') {
              const c = e.data.value && e.data.value.compass;
              if (c && Array.isArray(c.s)) window.__published.push(c.s);
            }
          });
        `,
      });
      await b.navigate(`${baseUrl}/results`, { settleMs: 10000 });

      const published = await b.evaluate(`window.__published`);
      assert(published.length > 0, "compass never published to the broker");
      const latest = published[published.length - 1];
      const expected = ${'`'}${'$'}{JSON.stringify(own.map((t) => t.id))}${'`'};
      assert(
        latest.length === own.length,
        ${'`'}published ${'$'}{latest.length} topics, expected ${'$'}{own.length} — the compass was ${'`'} +
          ${'`'}treated as a lens overlay and replaced by a stale preLensTopics${'`'}
      );
      return ${'`'}compass of ${'$'}{own.length} topics survived matching the "${'$'}{lens.key}" lens${'`'};
    },
  },
```

Note: the template-literal escaping above is for the plan document. When writing the file, use ordinary backticks — the assertion messages are template strings.

- [ ] **Step 2: Run the smoke scenario to verify it fails**

Run: `npm run smoke -- --only=compass-equal-to-lens-still-persists`
Expected: FAIL. The compass matches a lens, so the old `isLensTopicSet` reports a lens is active and the publisher substitutes `preLensTopics` (absent) — the published `s` will be wrong or empty.

- [ ] **Step 3: Replace the inference in `CombinedPage`**

Replace lines ~1174-1179:

```jsx
  const lensIsActive = (lens) => selectedTopics.length > 0 && selectedTopics.every(id => lens.topicIds.includes(id));
  const localLensActive = lensIsActive(LOCAL_LENS);
  const judicialLensActive = lensIsActive(JUDICIAL_LENS);
  const federalLensActive = lensIsActive(FEDERAL_LENS);
  const activeLens = localLensActive ? LOCAL_LENS : (judicialLensActive ? JUDICIAL_LENS : (federalLensActive ? FEDERAL_LENS : null));
```

with:

```jsx
  // Every lens the switcher can show. User lenses join this list in Task 5.
  const allLenses = useMemo(
    () => [FEDERAL_LENS, LOCAL_LENS, JUDICIAL_LENS],
    [FEDERAL_LENS, LOCAL_LENS, JUDICIAL_LENS]
  );
  const lensIsActive = (lens) => activeLensKey === lens.key;
  const activeLens = activeLensKey
    ? allLenses.find((l) => l.key === activeLensKey) ?? null
    : null;
  const localLensActive = activeLensKey === LOCAL_LENS.key;
  const judicialLensActive = activeLensKey === JUDICIAL_LENS.key;
  const federalLensActive = activeLensKey === FEDERAL_LENS.key;
```

Pull `activeLensKey` and `setActiveLensKey` from `useCompass()` alongside `lenses` (the destructure at ~line 355).

- [ ] **Step 4: Set and clear the key in the lens transitions**

In `doStartLens`, replace the stash guard:

```jsx
    if (selectedTopics.length > 0 && !isLensTopicSet(selectedTopics, lenses)) {
      localStorage.setItem("preLensTopics", JSON.stringify(selectedTopics));
    }
```

with:

```jsx
    // Only ever stash when leaving the user's OWN compass. Switching lens to lens
    // must not overwrite the stash — that would bury the real compass behind two
    // overlays. With an explicit key this is a direct test rather than a guess.
    if (activeLensKey === null && selectedTopics.length > 0) {
      localStorage.setItem("preLensTopics", JSON.stringify(selectedTopics));
    }
```

and immediately after `setSelectedTopics(lensTopics);` add:

```jsx
    setActiveLensKey(lens.key);
```

In `exitLensMode`, after the `preLensTopics` read and removal, add `setActiveLensKey(null);` before returning — both the success and fallback returns.

Apply the same replacement to the second `isLensTopicSet` guard at ~line 1331.

- [ ] **Step 5: Delete `isLensTopicSet`**

Remove the function and its doc comment from `src/lib/lenses.js`, and remove it from `CombinedPage`'s import.

Leaving a second, wrong definition of "is a lens active" beside the right one is how this class of bug recurs. Confirm nothing else references it:

```bash
grep -rn "isLensTopicSet" src/ smoke/
```

Expected: no matches.

- [ ] **Step 6: Run the smoke scenario to verify it passes**

Run: `npm run smoke -- --only=compass-equal-to-lens-still-persists`
Expected: PASS

- [ ] **Step 7: Add the two transition scenarios**

Spec §10 scenarios 2 and 3. Both are about `preLensTopics`, which the explicit key
now governs.

```js
  {
    name: "lens-round-trip-restores-the-compass",
    async run(b, baseUrl) {
      const lenses = await (await fetch(`${baseUrl}${API}/lenses`)).json();
      const lens = lenses.find((l) => Array.isArray(l.topicIds) && l.topicIds.length >= 3);
      assert(lens, "no lens with topics");
      const topics = await (await fetch(`${baseUrl}${API}/topics`)).json();
      const own = topics.filter((t) => !lens.topicIds.includes(t.id)).slice(0, 8);
      assert(own.length === 8, "could not find 8 non-lens topics");

      await b.navigate(`${baseUrl}/results`, { settleMs: 5000 });
      await b.evaluate(`(() => {
        const answers = {};
        ${JSON.stringify(own.map((t) => t.short_title))}.forEach((s, i) => { answers[s] = (i % 5) + 1; });
        localStorage.setItem('answers', JSON.stringify(answers));
        localStorage.setItem('selectedTopics', JSON.stringify(${JSON.stringify(own.map((t) => t.id))}));
        localStorage.setItem('calibration_completed', 'true');
        localStorage.removeItem('preLensTopics');
        sessionStorage.removeItem('activeLensKey');
      })()`);
      await b.navigate(`${baseUrl}/results`, { settleMs: 6000 });

      await b.evaluate(`document.querySelector('[data-testid="lens-chip-${'$'}{lens.key}"]').click()`);
      await b.sleep(900);
      const inLens = await b.evaluate(`sessionStorage.getItem('activeLensKey')`);
      assert(inLens === lens.key, `expected activeLensKey=${'$'}{lens.key}, got ${'$'}{inLens}`);

      await b.evaluate(`document.querySelector('[data-testid="lens-chip-my-compass"]').click()`);
      await b.sleep(900);
      const afterKey = await b.evaluate(`sessionStorage.getItem('activeLensKey')`);
      assert(afterKey === null, "activeLensKey was not cleared on exit");
      const restored = await b.evaluate(`JSON.parse(localStorage.getItem('selectedTopics') || '[]')`);
      assert(
        JSON.stringify(restored) === JSON.stringify(${JSON.stringify(own.map((t) => t.id))}),
        `compass was not restored; got ${'$'}{JSON.stringify(restored)}`
      );
      return "compass survived a lens round trip";
    },
  },

  {
    name: "lens-to-lens-does-not-bury-the-compass",
    // preLensTopics must only ever be written when LEAVING the user's own
    // compass. Stashing again on a lens-to-lens switch buries the real compass
    // behind two overlays and it can never be restored.
    async run(b, baseUrl) {
      const lenses = await (await fetch(`${baseUrl}${API}/lenses`)).json();
      const usable = lenses.filter((l) => Array.isArray(l.topicIds) && l.topicIds.length >= 3);
      assert(usable.length >= 2, "need two lenses with topics");
      const [a, c] = usable;
      const topics = await (await fetch(`${baseUrl}${API}/topics`)).json();
      const own = topics
        .filter((t) => !a.topicIds.includes(t.id) && !c.topicIds.includes(t.id))
        .slice(0, 8);
      assert(own.length === 8, "could not find 8 topics outside both lenses");

      await b.navigate(`${baseUrl}/results`, { settleMs: 5000 });
      await b.evaluate(`(() => {
        const answers = {};
        ${JSON.stringify(own.map((t) => t.short_title))}.forEach((s, i) => { answers[s] = (i % 5) + 1; });
        localStorage.setItem('answers', JSON.stringify(answers));
        localStorage.setItem('selectedTopics', JSON.stringify(${JSON.stringify(own.map((t) => t.id))}));
        localStorage.setItem('calibration_completed', 'true');
        localStorage.removeItem('preLensTopics');
        sessionStorage.removeItem('activeLensKey');
      })()`);
      await b.navigate(`${baseUrl}/results`, { settleMs: 6000 });

      await b.evaluate(`document.querySelector('[data-testid="lens-chip-${'$'}{a.key}"]').click()`);
      await b.sleep(900);
      await b.evaluate(`document.querySelector('[data-testid="lens-chip-${'$'}{c.key}"]').click()`);
      await b.sleep(900);

      const stash = await b.evaluate(`JSON.parse(localStorage.getItem('preLensTopics') || 'null')`);
      assert(
        JSON.stringify(stash) === JSON.stringify(${JSON.stringify(own.map((t) => t.id))}),
        `preLensTopics was overwritten by the second lens; got ${'$'}{JSON.stringify(stash)}`
      );
      return "lens-to-lens switch preserved the stashed compass";
    },
  },
```

- [ ] **Step 8: Run the whole smoke suite**

Run: `npm run smoke`
Expected: all scenarios pass, including `lens-not-published-as-compass`, which must still hold — it covers the case where a lens genuinely IS active.

- [ ] **Step 9: Lint and commit**

```bash
npm run lint
git add src/pages/CombinedPage.jsx src/lib/lenses.js smoke/run.mjs
git commit -m "fix(compass): drive lens activation from an explicit key, not the topic set"
```

---

### Task 4: Extract the switcher row into `LensSwitcher.jsx`

`CombinedPage.jsx` is 2,125 lines. The switcher row is self-contained, and it is about to grow user chips, a create affordance, and a per-chip menu.

**Files:**
- Create: `src/components/LensSwitcher.jsx`
- Modify: `src/pages/CombinedPage.jsx` (remove the row at ~1518-1556 and the `renderLensIcon` helper)

**Interfaces:**
- Consumes: `allLenses`, `activeLens`, `doStartLens`, `exitToCompass` from Task 3.
- Produces: `<LensSwitcher lenses={} activeLensKey={} onSelect={} onExit={} />`

- [ ] **Step 1: Create the component**

```jsx
import { forwardRef } from "react";

/** House (local), Capitol dome (federal), gavel (judicial), tag (user lenses). */
function LensIcon({ lensKey }) {
  const cls = "w-3.5 h-3.5";
  const common = {
    xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24",
    strokeWidth: 2, stroke: "currentColor", className: cls,
  };
  if (lensKey === "federal") {
    return (
      <svg {...common}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0 0 12 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75Z" />
      </svg>
    );
  }
  if (lensKey === "local") {
    return (
      <svg {...common}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
      </svg>
    );
  }
  if (lensKey === "judicial") {
    return (
      <svg {...common}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0 0 12 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52 2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 0 1-2.031.352 5.988 5.988 0 0 1-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971Zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0 2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 0 1-2.031.352 5.989 5.989 0 0 1-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971Z" />
      </svg>
    );
  }
  // User lens.
  return (
    <svg {...common}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
    </svg>
  );
}

/**
 * The lens row. Curated lenses (Local/Federal/Judicial) and the user's own
 * lenses share it, which is why user keys are prefixed `u_` — without that a
 * user lens named "federal" would shadow the editorial one.
 */
const LensSwitcher = forwardRef(function LensSwitcher(
  { lenses, activeLensKey, isDark, onSelect, onExit, renderChipExtra },
  ref
) {
  return (
    <div
      ref={ref}
      className="w-full max-w-6xl mx-auto lg:px-4 mb-3 flex items-center gap-2 flex-wrap justify-center lg:justify-start"
    >
      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 mr-0.5">Lens:</span>
      {lenses.map((lens) => {
        const active = activeLensKey === lens.key;
        const color = lens.color || (isDark ? "#a1a1aa" : "#6B7280");
        return (
          <span key={lens.key} className="inline-flex items-center">
            <button
              onClick={() => onSelect(lens)}
              title={active ? `${lens.name} active — click to restore your compass` : lens.name}
              data-testid={`lens-chip-${lens.key}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer hover:opacity-90 active:scale-95"
              style={active
                ? { background: color, color: "#fff", borderColor: color }
                : { background: "transparent", color, borderColor: color }}
            >
              <LensIcon lensKey={lens.key} />
              {lens.shortLabel || lens.name}
            </button>
            {renderChipExtra ? renderChipExtra(lens, active) : null}
          </span>
        );
      })}
      <button
        onClick={onExit}
        title="Show my full compass"
        data-testid="lens-chip-my-compass"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer hover:opacity-90 active:scale-95"
        style={!activeLensKey
          ? { background: isDark ? "#52525b" : "#6B7280", color: "#fff", borderColor: isDark ? "#52525b" : "#6B7280" }
          : { background: "transparent", color: isDark ? "#a1a1aa" : "#6B7280", borderColor: isDark ? "#52525b" : "#d1d5db" }}
      >
        My compass
      </button>
    </div>
  );
});

export default LensSwitcher;
```

- [ ] **Step 2: Use it in `CombinedPage`**

Replace the switcher row JSX with:

```jsx
          <LensSwitcher
            ref={localLensRef}
            lenses={allLenses}
            activeLensKey={activeLensKey}
            isDark={isDark}
            onSelect={doStartLens}
            onExit={exitToCompass}
          />
```

Give the curated lenses their short labels where `allLenses` is built, so the component does not carry key-specific label logic:

```jsx
  const allLenses = useMemo(() => [
    { ...FEDERAL_LENS, shortLabel: "Federal" },
    { ...LOCAL_LENS, shortLabel: "Local" },
    { ...JUDICIAL_LENS, shortLabel: "Judicial" },
  ], [FEDERAL_LENS, LOCAL_LENS, JUDICIAL_LENS]);
```

Delete the now-unused `renderLensIcon` helper from `CombinedPage`.

- [ ] **Step 3: Verify in the browser**

Run `npm run dev`. The lens row must look and behave exactly as before: three chips plus "My compass", correct active styling, switching works.

- [ ] **Step 4: Run the smoke suite**

Run: `npm run smoke`
Expected: all pass. The suite clicks buttons by text, so the extraction must not change any label.

- [ ] **Step 5: Lint and commit**

```bash
npm run lint
git add src/components/LensSwitcher.jsx src/pages/CombinedPage.jsx
git commit -m "refactor(compass): extract the lens switcher row into its own component"
```

---

### Task 5: Load, create, and show user lenses

**Files:**
- Modify: `src/components/CompassContext.jsx` (fetch + state for user lenses)
- Create: `src/components/SaveLensModal.jsx`
- Modify: `src/pages/CombinedPage.jsx` (`allLenses` gains user lenses; `+ Save this view`)

**Interfaces:**
- Consumes: `generateLensKey`, `readGuestLenses`, `writeGuestLenses`, `toPutPayload` (Task 1); `LensSwitcher` (Task 4).
- Produces, on the compass context:
  - `userLenses: Array<{key, name, topicIds, visibility, needsRecalibration?}>`
  - `saveUserLenses(nextLenses): Promise<void>` — persists the whole set (guest: localStorage; authed: `PUT`) and updates state
  - `refreshUserLenses(): Promise<void>`

- [ ] **Step 1: Add user-lens state and loading to `CompassContext`**

```jsx
  const [userLenses, setUserLenses] = useState(() => readGuestLenses());

  // Signed-in: the API is the source of truth and carries needsRecalibration,
  // which a guest cannot have — staleness is computed from the answer's stamped
  // revision, which only the server holds.
  const refreshUserLenses = useCallback(async () => {
    if (!isLoggedIn) { setUserLenses(readGuestLenses()); return; }
    try {
      const res = await apiFetch("/compass/my-lenses");
      const data = res ? await res.json() : [];
      setUserLenses(Array.isArray(data) ? data : []);
    } catch (err) {
      // Custom lenses are additive. Their absence must never break the compass.
      console.error("[compass] could not load custom lenses:", err);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (authChecking) return;
    refreshUserLenses();
  }, [authChecking, isLoggedIn, refreshUserLenses]);

  const saveUserLenses = useCallback(async (next) => {
    setUserLenses(next);              // optimistic — the user just acted
    if (!isLoggedIn) { writeGuestLenses(next); return; }
    const res = await apiFetch("/compass/my-lenses", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toPutPayload(next)),
    });
    if (res && res.status === 422) {
      // Should be unreachable: topic ids come from the loaded topic set. If it
      // happens, the client is holding an id the server has never heard of —
      // log it loudly rather than showing the user a generic failure.
      const body = await res.json().catch(() => ({}));
      console.error("[compass] server rejected lens topics:", body.code, body.invalid_ids);
    }
    if (!res || !res.ok) {
      // Keep the local state. Never drop a lens the user just made because a
      // request failed; the next save retries the whole set.
      throw new Error(`saving lenses failed (${res ? res.status : "no response"})`);
    }
    const saved = await res.json();
    if (Array.isArray(saved)) setUserLenses(saved);
  }, [isLoggedIn]);
```

Import `apiFetch` from `../lib/auth` and the four helpers from `../lib/userLenses`. Expose `userLenses`, `saveUserLenses`, and `refreshUserLenses` on the provider value.

- [ ] **Step 2: Create `SaveLensModal.jsx`**

```jsx
import { useState } from "react";

/**
 * Names a lens. Creation reuses the compass the user has already arranged, so
 * this is the whole of "build a lens" — there is no second topic picker.
 */
export default function SaveLensModal({ topicCount, initialName = "", onSave, onClose }) {
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const trimmed = name.trim();

  const submit = async () => {
    if (!trimmed || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(trimmed);
      onClose();
    } catch {
      setError("Could not save this lens. Your lens is still here — try again.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl bg-white dark:bg-zinc-900 p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold dark:text-white mb-3">
          {initialName ? "Rename lens" : "Name this lens"}
        </h2>
        <input
          autoFocus
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          data-testid="lens-name-input"
          placeholder="Farm bill"
          className="w-full rounded-lg border border-gray-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm dark:text-white"
        />
        <p className="mt-2 text-xs text-gray-500 dark:text-zinc-400">
          {topicCount} {topicCount === 1 ? "topic" : "topics"} from your compass
        </p>
        {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm rounded-lg text-gray-600 dark:text-zinc-300">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!trimmed || saving}
            data-testid="lens-save-confirm"
            className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-blue-600 text-white disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add user lenses to `allLenses` and wire the create button**

In `CombinedPage`, extend `allLenses`:

```jsx
  const allLenses = useMemo(() => [
    { ...FEDERAL_LENS, shortLabel: "Federal" },
    { ...LOCAL_LENS, shortLabel: "Local" },
    { ...JUDICIAL_LENS, shortLabel: "Judicial" },
    ...userLenses.map((l) => ({ ...l, color: "#7C3AED" })),
  ], [FEDERAL_LENS, LOCAL_LENS, JUDICIAL_LENS, userLenses]);
```

Add the create control after `<LensSwitcher>`:

```jsx
          {activeLensKey === null && selectedTopics.length > 0 && (
            <button
              onClick={() => setSaveLensOpen(true)}
              data-testid="save-view-as-lens"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold border border-dashed border-gray-400 text-gray-500 dark:text-zinc-400 hover:opacity-80"
            >
              + Save this view
            </button>
          )}
```

and the modal:

```jsx
          {saveLensOpen && (
            <SaveLensModal
              topicCount={selectedTopics.length}
              onClose={() => setSaveLensOpen(false)}
              onSave={async (name) => {
                await saveUserLenses([
                  ...userLenses,
                  { key: generateLensKey(), name, topicIds: selectedTopics, visibility: "private" },
                ]);
                // 🔴 DO NOT setActiveLensKey HERE. The user is looking at their own
                // compass; it merely happens to match the lens they just saved.
                // Marking it active would reclassify the compass as a view, so it
                // would stop being persisted and a preLensTopics that was never
                // stashed would go out as `s` — the exact bug Task 3 removed.
              }}
            />
          )}
```

Add `const [saveLensOpen, setSaveLensOpen] = useState(false);` with the other page state.

- [ ] **Step 4: Verify by hand**

`npm run dev`. As a guest: arrange a compass, click `+ Save this view`, name it, confirm a purple chip appears, reload, confirm it is still there. Confirm clicking it swaps the spokes and `My compass` restores. Confirm `localStorage.customLenses` holds it and the published `compass.s` is unchanged while no lens is active.

- [ ] **Step 5: Add a smoke scenario for guest create**

```js
  {
    name: "guest-can-save-a-lens",
    async run(b, baseUrl) {
      await b.navigate(`${baseUrl}/results`, { settleMs: 5000 });
      await seedBuiltCompass(b, 8);
      await b.navigate(`${baseUrl}/results`, { settleMs: 6000 });

      await clickButton(b, "+ Save this view");
      await b.evaluate(`(() => {
        const input = document.querySelector('[data-testid="lens-name-input"]');
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, 'Smoke lens');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      })()`);
      await b.evaluate(`document.querySelector('[data-testid="lens-save-confirm"]').click()`);
      await b.sleep(1200);

      const stored = await b.evaluate(`JSON.parse(localStorage.getItem('customLenses') || '[]')`);
      assert(stored.length === 1, `expected 1 saved lens, got ${stored.length}`);
      assert(/^u_[a-z0-9]{6}$/.test(stored[0].key), `bad lens key ${stored[0].key}`);
      assert(stored[0].topicIds.length === 8, "lens did not capture the 8 compass topics");

      const activeKey = await b.evaluate(`sessionStorage.getItem('activeLensKey')`);
      assert(activeKey === null, "saving a lens must not activate it");

      return `saved "${stored[0].name}" as ${stored[0].key}`;
    },
  },
```

- [ ] **Step 6: Run the smoke suite**

Run: `npm run smoke`
Expected: all pass.

- [ ] **Step 7: Lint and commit**

```bash
npm run lint
git add src/components/CompassContext.jsx src/components/SaveLensModal.jsx src/pages/CombinedPage.jsx smoke/run.mjs
git commit -m "feat(compass): save the current view as a named custom lens"
```

---

### Task 6: Update, rename, and delete a lens

**Files:**
- Modify: `src/pages/CombinedPage.jsx` (dirty tracking, chip menu)
- Modify: `src/components/LensSwitcher.jsx` (use `renderChipExtra`)

**Interfaces:**
- Consumes: `saveUserLenses`, `userLenses`, `activeLensKey`, `SaveLensModal`.
- Produces: nothing new.

- [ ] **Step 1: Track whether the active user lens has unsaved topic changes**

```jsx
  const activeUserLens = activeLensKey?.startsWith("u_")
    ? userLenses.find((l) => l.key === activeLensKey) ?? null
    : null;

  // Dirty = the spokes on screen differ from what the lens stores. Order counts:
  // a lens remembers its spoke arrangement, so reordering is a real edit.
  const activeLensDirty = !!activeUserLens &&
    JSON.stringify(selectedTopics) !== JSON.stringify(activeUserLens.topicIds);
```

- [ ] **Step 2: Render Update / Rename / Delete beside the active user chip**

Pass `renderChipExtra` to `<LensSwitcher>`:

```jsx
            renderChipExtra={(lens, active) => {
              if (!active || !lens.key.startsWith("u_")) return null;
              return (
                <span className="ml-1 inline-flex items-center gap-1">
                  {activeLensDirty && (
                    <button
                      onClick={() => updateActiveLens()}
                      data-testid="lens-update"
                      className="px-2 py-1 text-[11px] font-bold rounded-full bg-violet-600 text-white"
                    >
                      Update
                    </button>
                  )}
                  <button
                    onClick={() => setRenameOpen(true)}
                    title="Rename this lens"
                    className="px-1.5 py-1 text-[11px] text-gray-500 dark:text-zinc-400 hover:underline"
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => deleteActiveLens()}
                    title="Delete this lens"
                    data-testid="lens-delete"
                    className="px-1.5 py-1 text-[11px] text-red-600 dark:text-red-400 hover:underline"
                  >
                    Delete
                  </button>
                </span>
              );
            }}
```

- [ ] **Step 3: Implement the three handlers**

```jsx
  const updateActiveLens = async () => {
    if (!activeUserLens) return;
    await saveUserLenses(
      userLenses.map((l) =>
        l.key === activeUserLens.key ? { ...l, topicIds: selectedTopics } : l
      )
    );
  };

  const renameActiveLens = async (name) => {
    if (!activeUserLens) return;
    await saveUserLenses(
      userLenses.map((l) => (l.key === activeUserLens.key ? { ...l, name } : l))
    );
  };

  const deleteActiveLens = async () => {
    if (!activeUserLens) return;
    if (!window.confirm(`Delete the lens "${activeUserLens.name}"? Your answers are not affected.`)) return;
    const key = activeUserLens.key;
    // Leave the lens BEFORE removing it, so the compass is restored from
    // preLensTopics rather than stranding the user on an orphaned topic set.
    exitToCompass();
    await saveUserLenses(userLenses.filter((l) => l.key !== key));
  };
```

Add `const [renameOpen, setRenameOpen] = useState(false);` and render a second `SaveLensModal` with `initialName={activeUserLens?.name}` and `onSave={renameActiveLens}` when `renameOpen && activeUserLens`.

- [ ] **Step 4: Verify by hand**

`npm run dev`. Activate a user lens, swap a topic, confirm `Update` appears; click it, switch away and back, confirm the change stuck. Rename, confirm the chip label changes. Delete, confirm the chip goes and the compass returns.

Confirm that switching away from a dirty lens **without** clicking Update discards the change — the lens must not be rewritten just by browsing.

- [ ] **Step 5: Run the smoke suite**

Run: `npm run smoke`
Expected: all pass.

- [ ] **Step 6: Lint and commit**

```bash
npm run lint
git add src/pages/CombinedPage.jsx src/components/LensSwitcher.jsx
git commit -m "feat(compass): update, rename, and delete custom lenses"
```

---

### Task 7: Promote guest lenses on sign-in

**Files:**
- Modify: `src/components/CompassContext.jsx`

**Interfaces:**
- Consumes: `mergeLensSets`, `readGuestLenses`, `clearGuestLenses`, `generateLensKey`, `toPutPayload`.
- Produces: nothing new.

- [ ] **Step 1: Write the failing unit test for the retry path**

Add to `src/lib/userLenses.test.js`:

```js
import { regenerateConflictingKeys } from "./userLenses.js";

describe("regenerateConflictingKeys", () => {
  it("gives a new key to exactly the conflicting lenses", () => {
    const lenses = [
      { key: "u_aaaaaa", name: "a", topicIds: [] },
      { key: "u_bbbbbb", name: "b", topicIds: [] },
    ];
    const out = regenerateConflictingKeys(lenses, ["u_bbbbbb"]);
    expect(out[0].key).toBe("u_aaaaaa");
    expect(out[1].key).not.toBe("u_bbbbbb");
    expect(out[1].key).toMatch(/^u_[a-z0-9]{6}$/);
    expect(out[1].name).toBe("b");
  });

  it("is a no-op when nothing conflicts", () => {
    const lenses = [{ key: "u_aaaaaa", name: "a", topicIds: [] }];
    expect(regenerateConflictingKeys(lenses, [])).toEqual(lenses);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — `regenerateConflictingKeys is not a function`

- [ ] **Step 3: Implement it in `src/lib/userLenses.js`**

```js
/**
 * Give a fresh key to any lens whose key the server reported as taken.
 *
 * Keys are globally unique, so a guest's randomly generated key can collide with
 * a different account's. The server answers 409 LENS_KEY_TAKEN with the offending
 * keys rather than silently dropping them — a no-op upsert was the original bug.
 */
export function regenerateConflictingKeys(lenses, conflictingKeys) {
  const taken = new Set(conflictingKeys || []);
  if (taken.size === 0) return lenses;
  return lenses.map((l) => (taken.has(l.key) ? { ...l, key: generateLensKey() } : l));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Wire promotion into `CompassContext`**

```jsx
  // Guest -> signed-in: fold whatever the browser holds into the account, once.
  const promotedRef = useRef(false);
  useEffect(() => {
    if (authChecking || !isLoggedIn || promotedRef.current) return;
    const local = readGuestLenses();
    if (local.length === 0) { promotedRef.current = true; return; }
    promotedRef.current = true;

    (async () => {
      try {
        const res = await apiFetch("/compass/my-lenses");
        const server = res ? await res.json() : [];
        let merged = mergeLensSets(Array.isArray(server) ? server : [], local);

        let put = await apiFetch("/compass/my-lenses", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(toPutPayload(merged)),
        });

        if (put && put.status === 409) {
          // Another account already holds one of these randomly generated keys.
          // Regenerate exactly those and retry ONCE — never loop.
          const body = await put.json().catch(() => ({}));
          merged = regenerateConflictingKeys(merged, body.conflicting_keys);
          put = await apiFetch("/compass/my-lenses", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(toPutPayload(merged)),
          });
        }

        if (!put || !put.ok) throw new Error(`promotion failed (${put ? put.status : "no response"})`);

        const saved = await put.json();
        if (Array.isArray(saved)) setUserLenses(saved);
        // Only now. Clearing local state that was not confirmed written is how
        // you lose a user's work to one bad response.
        clearGuestLenses();
      } catch (err) {
        console.error("[compass] lens promotion failed; keeping local copy:", err);
        promotedRef.current = false;   // let a later load try again
      }
    })();
  }, [authChecking, isLoggedIn]);
```

- [ ] **Step 6: Add the sign-in smoke scenario**

The suite has **no** `loginInBrowser` helper and no `API_BASE` in `run.mjs` — the
authed scenarios log the browser in by writing the token to `localStorage` under
`ev_token`, and reach the server through helpers in `smoke/auth.mjs` (which has
its own full-URL `API`). Follow that, and add the one missing helper.

First, add to `smoke/auth.mjs`, beside `getServerAnswers`:

```js
export async function getServerLenses(token) {
  const res = await fetch(`${API}/compass/my-lenses`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`GET /compass/my-lenses failed (${res.status})`);
  return res.json();
}

export async function clearServerLenses(token) {
  const res = await fetch(`${API}/compass/my-lenses`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ lenses: [] }),
  });
  if (!res.ok) throw new Error(`PUT /compass/my-lenses failed (${res.status})`);
}
```

Add both to the import list at the top of `smoke/run.mjs`. Then the scenario:

```js
  {
    name: "guest-lenses-promote-on-sign-in",
    async run(b, baseUrl) {
      const creds = loadCredentials();
      if (!creds) throw new Skip("no SMOKE_EMAIL / SMOKE_PASSWORD available");
      const token = await login(creds);
      // The smoke account is a throwaway; start from a known-empty lens set.
      await clearServerLenses(token);

      const topics = await (await fetch(`${baseUrl}${API}/topics`)).json();
      const chosen = topics.slice(0, 8).map((t) => t.id);

      // A guest who built a lens before signing in.
      await b.navigate(`${baseUrl}/results`, { settleMs: 5000 });
      await b.evaluate(`(() => {
        localStorage.clear();
        localStorage.setItem('selectedTopics', JSON.stringify(${JSON.stringify(chosen)}));
        localStorage.setItem('calibration_completed', 'true');
        localStorage.setItem('customLenses', JSON.stringify([{
          key: 'u_smoke1', name: 'Promoted lens',
          topicIds: ${JSON.stringify(chosen)}, visibility: 'private',
        }]));
      })()`);

      // Sign in the way every other authed scenario does.
      await b.evaluate(`localStorage.setItem('ev_token', ${JSON.stringify(token)})`);
      await b.navigate(`${baseUrl}/results`, { settleMs: 12000 });

      const local = await b.evaluate(`localStorage.getItem('customLenses')`);
      assert(local === null, `guest lenses were not cleared after promotion (still ${local})`);

      const server = await getServerLenses(token);
      assert(
        server.some((l) => l.name === "Promoted lens"),
        `promoted lens missing from the server, got ${JSON.stringify(server.map((l) => l.name))}`
      );
      await clearServerLenses(token);
      return `promoted 1 lens for ${creds.email}`;
    },
  },
```

Note `u_smoke1` is a fixed key so a rerun is deterministic; `clearServerLenses`
at both ends keeps the throwaway account clean and stops a previous run's row
from making the assertion pass vacuously.

- [ ] **Step 7: Run the suites**

Run: `npm test && npm run smoke`
Expected: both pass. The promotion scenario SKIPs without `~/.ev-compass-smoke/creds.env`.

- [ ] **Step 8: Lint and commit**

```bash
npm run lint
git add src/lib/userLenses.js src/lib/userLenses.test.js src/components/CompassContext.jsx smoke/run.mjs
git commit -m "feat(compass): promote a guest's lenses to their account on sign-in"
```

---

### Task 8: The recalibration marker and popover

**Files:**
- Create: `src/components/RecalibrationPopover.jsx`
- Modify: `src/pages/CombinedPage.jsx` (marker on the topic pills, count on the chip)

**Interfaces:**
- Consumes: `userLenses[].needsRecalibration` from Task 5's fetch.
- Produces: nothing new.

- [ ] **Step 1: Create the popover**

```jsx
/**
 * Why a question is asking to be recalibrated.
 *
 * The three reasons come from the server (compassUserLensService) and mean
 * different things, so they get different copy. `publicNote` is editorial's own
 * wording and is rendered verbatim — never paraphrased or truncated here.
 */
const COPY = {
  question_revised: {
    title: "This question was updated",
    body: "Your answer was given against the earlier wording.",
    action: "Recalibrate",
  },
  answer_invalidated: {
    title: "The option you chose no longer exists",
    body: "This question was rewritten and the stance you picked is not one of the choices any more.",
    action: "Recalibrate",
  },
  not_asked_this_season: {
    title: "This question isn't part of the current season",
    body: "Your answer is kept. It just isn't one of the questions being asked right now.",
    action: null,
  },
};

export default function RecalibrationPopover({ flag, topicTitle, onRecalibrate, onClose }) {
  const copy = COPY[flag.reason] || COPY.question_revised;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl bg-white dark:bg-zinc-900 p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        data-testid="recalibration-popover"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
          {topicTitle}
        </p>
        <h2 className="mt-1 text-base font-semibold dark:text-white">{copy.title}</h2>
        {flag.publicNote && (
          <blockquote className="mt-3 border-l-2 border-amber-400 pl-3 text-sm italic text-gray-700 dark:text-zinc-300">
            {flag.publicNote}
          </blockquote>
        )}
        <p className="mt-3 text-sm text-gray-600 dark:text-zinc-400">{copy.body}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm rounded-lg text-gray-600 dark:text-zinc-300">
            {copy.action ? "Later" : "Close"}
          </button>
          {copy.action && (
            <button
              onClick={onRecalibrate}
              data-testid="recalibrate-confirm"
              className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-amber-600 text-white"
            >
              {copy.action}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Index the flags for the active lens**

```jsx
  // Dismissals are per session and deliberately not persisted: a question whose
  // wording changed is a standing fact, and a permanently dismissible prompt is
  // one that never gets acted on.
  const [dismissedFlags, setDismissedFlags] = useState(() => new Set());

  const flagsByTopic = useMemo(() => {
    const map = new Map();
    (activeUserLens?.needsRecalibration || []).forEach((f) => {
      if (!dismissedFlags.has(f.topicId)) map.set(f.topicId, f);
    });
    return map;
  }, [activeUserLens, dismissedFlags]);
```

- [ ] **Step 3: Render the marker on each topic pill**

Inside the topic pill render, after the topic label:

```jsx
                    {flagsByTopic.has(topic.id) && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setOpenFlagTopicId(topic.id); }}
                        title="This question was updated"
                        data-testid={`recalibrate-marker-${topic.id}`}
                        className="ml-1 inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400"
                      >
                        ⚠ Updated
                      </button>
                    )}
```

Add `const [openFlagTopicId, setOpenFlagTopicId] = useState(null);` and render the
popover when it is set:

```jsx
          {openFlagTopicId && flagsByTopic.has(openFlagTopicId) && (
            <RecalibrationPopover
              flag={flagsByTopic.get(openFlagTopicId)}
              topicTitle={topics.find((t) => t.id === openFlagTopicId)?.short_title || ""}
              onRecalibrate={() => {
                setRecalibrateTopicIds([openFlagTopicId]);
                setCalibrationActive(true);
                setOpenFlagTopicId(null);
              }}
              onClose={() => {
                setDismissedFlags((prev) => new Set(prev).add(openFlagTopicId));
                setOpenFlagTopicId(null);
              }}
            />
          )}
```

`setRecalibrateTopicIds` and the overlay prop it feeds are built in Task 9. Until
Task 9 lands, `Recalibrate` opens the overlay unscoped — so **do Task 9 before
shipping**, and note that in the commit message.

Add `const [recalibrateTopicIds, setRecalibrateTopicIds] = useState(null);` with
the other page state.

- [ ] **Step 4: Show the count on the chip**

In the `allLenses` mapping, carry the count through:

```jsx
    ...userLenses.map((l) => ({
      ...l,
      color: "#7C3AED",
      flagCount: (l.needsRecalibration || []).length,
    })),
```

and in `LensSwitcher`, after the label inside the chip button:

```jsx
              {lens.flagCount > 0 && (
                <span className="ml-0.5 inline-flex items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold w-4 h-4">
                  {lens.flagCount}
                </span>
              )}
```

- [ ] **Step 5: Verify against a seeded flag**

There is no revised topic in the open season today — every answer resolves to the version its season serves, so the API correctly returns no flags. To exercise the UI, stub the fetch response in the browser console with a `needsRecalibration` entry carrying each of the three `reason` values in turn, and confirm the marker, the count, and all three copy variants render.

Record in the commit message that this path is not yet covered by real data.

- [ ] **Step 6: Run the suites**

Run: `npm test && npm run smoke && npm run lint`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/RecalibrationPopover.jsx src/components/LensSwitcher.jsx src/pages/CombinedPage.jsx
git commit -m "feat(compass): prompt to recalibrate questions whose wording changed"
```

---

### Task 9: Scope calibration to a single topic

`CalibrationOverlay` today can start on a lens, on all topics, or resume — but it
has no way to be pointed at one specific question. `Recalibrate` needs exactly
that: re-answer this one, not walk the whole compass.

**Files:**
- Modify: `src/components/CalibrationOverlay.jsx` (props, `getInitialState`)
- Modify: `src/pages/CombinedPage.jsx` (pass the prop, clear it on complete)

**Interfaces:**
- Consumes: `recalibrateTopicIds` from Task 8.
- Produces: `<CalibrationOverlay startWithTopicIds={string[] | null} />`

- [ ] **Step 1: Add the prop**

In the signature at `CalibrationOverlay.jsx:346`, add `startWithTopicIds = null`
after `startWithAllTopics = false`.

- [ ] **Step 2: Seed the queue from it**

In `getInitialState`, **before** the `startWithAllTopics` branch (a caller passing
an explicit list means that list, and nothing should outrank it except the lens
intros above it):

```jsx
    // An explicit list of questions to (re)answer — the recalibration path.
    // Straight to "answer": there is nothing to pick and no lens intro to show,
    // the user already said which question they are fixing.
    if (Array.isArray(startWithTopicIds) && startWithTopicIds.length > 0) {
      const valid = startWithTopicIds.filter((id) => topics.some((t) => t.id === id));
      if (valid.length > 0) {
        return { step: "answer", pickedTopics: valid, currentIndex: 0 };
      }
    }
```

Filtering against `topics` matters: a lens may hold a topic the current season
does not serve, and seeding the queue with an id that has no stances would render
an unanswerable question.

- [ ] **Step 3: Keep it out of the analytics lens label**

In the `lensType` chain, add a `startWithTopicIds ? 'recalibrate' :` branch before
`resumeMode ? 'resume'`, so recalibration is distinguishable in PostHog from a
full calibration.

- [ ] **Step 4: Do not let it overwrite saved progress**

`getInitialState` reads `localStorage[STORAGE_KEY]` for a resumable session. The
recalibration branch returns before that read, which is correct — but confirm the
overlay does not then *write* the single-topic queue over a half-finished full
calibration. If it does, guard the progress write with
`if (!startWithTopicIds)`. Check this by starting a full calibration, leaving it
at question 3, recalibrating one question, and confirming the original resumes.

- [ ] **Step 5: Pass it from `CombinedPage`**

```jsx
          startWithTopicIds={recalibrateTopicIds}
```

and add `setRecalibrateTopicIds(null);` to the `onComplete` handler beside the
other `setStartWith*` resets.

- [ ] **Step 6: Verify by hand**

`npm run dev`. With a stubbed flag (Task 8 Step 5), click `Recalibrate` and
confirm the overlay opens on that one question, completes after it, and returns
to the compass. Then confirm the flag clears after the next `GET /my-lenses` for
a signed-in user, because answering re-stamps `answered_revision_id`.

- [ ] **Step 7: Run everything**

Run: `npm test && npm run smoke && npm run lint`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add src/components/CalibrationOverlay.jsx src/pages/CombinedPage.jsx
git commit -m "feat(compass): let calibration be scoped to a single question"
```

---

## Done criteria

- `npm test`, `npm run smoke`, and `npm run lint` all pass.
- `grep -rn "isLensTopicSet" src/ smoke/` returns nothing.
- A guest can build a lens, reload, and still have it; signing in moves it to the account and clears local storage.
- Saving the current compass as a lens does **not** stop the compass being persisted — smoke scenario `compass-equal-to-lens-still-persists`.
- Nothing new appears in the ev-context `compass` slice.
- `Recalibrate` on a flagged question opens calibration scoped to that one
  question and leaves any half-finished full calibration resumable (Task 9).
