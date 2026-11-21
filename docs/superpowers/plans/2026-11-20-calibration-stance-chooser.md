# Shared Stance Chooser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace four divergent copies of the write-in stance picker with one shared `StanceChooser`, give `/calibrate` write-ins it never had, and unify stance display order across the app.

**Architecture:** Pure placement math moves to `src/lib/writeIn.js`. A presentational `StanceChooser` component owns the stance list, the "Write your own..." affordance and the drag-to-place card, and reports through callbacks; every parent keeps its own persistence and navigation. Four surfaces adopt it; `ComparePanel` takes the order change only.

**Tech Stack:** React 19, Vite, `@dnd-kit/*`, Vitest + jsdom (raw `react-dom/client` + `act`, no testing-library), ESLint.

**Spec:** `docs/superpowers/specs/2026-11-20-calibration-stance-chooser-design.md`

## Global Constraints

- Stance display order, **everywhere**: not inverted → descending (value 5 first); inverted → ascending (value 1 first).
- Random spoke inversion via `shouldFlip` must not be weakened. Ordering is always defined *relative to* `isInverted`.
- A write-in value is a half-step `x.5`; `0.5` and `5.5` are legitimate edges.
- To clear a write-in, **omit** `write_in_text` from the POST. Never send `null` — the API returns 422.
- `data-testid="stance-option"` must appear on every stance button. It is the smoke suite's only stance selector.
- Stances arrive from the API ascending; `orderStances` sorts by `stance.value` and never trusts array order.
- Run commands: `npm test`, `npm run lint`, `npm run build`, `npm run smoke`.
- Commit messages end with: `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`

## Review Focus

Five failure modes the spec implies that no task's happy path exercises. Each has a test assigned to the task that owns the code.

1. **Stance count other than 5.** All 60 live topics have 5, so a 3- or 7-stance topic would be the first to hit untested math. → Task 1, parameterised round-trip.
2. **The `0.5` / `5.5` edges.** Placement above the first or below the last stance is where index↔value math goes off by one. → Task 1.
3. **A half-step value with no write-in text.** Orphaned state (text deleted, value kept) reaching a renderer that assumes text exists. → Task 2.
4. **Inversion toggled while the write-in card is open.** `FullCalibration`'s Flip button and the overlay's Stance Max/Min sit beside the list; the card must mirror, not strand. → Task 2.
5. **A topic with a missing or empty `stances` array.** The categories API returns stance-less topic objects. → Task 2.

---

### Task 1: Placement math in `src/lib/writeIn.js`

**Files:**
- Create: `src/lib/writeIn.js`
- Test: `src/lib/writeIn.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `orderStances(stances, isInverted) -> Stance[]`, `valueFromPlacement(writeInIndex, stanceCount, isInverted) -> number`, `placementFromValue(value, stanceCount, isInverted) -> number`, `isWriteIn(value) -> boolean`.

The two formulas, which the tests pin and the implementation must satisfy:

| | `valueFromPlacement` | `placementFromValue` |
|---|---|---|
| not inverted | `stanceCount - writeInIndex + 0.5` | `stanceCount + 0.5 - value` |
| inverted | `writeInIndex + 0.5` | `value - 0.5` |

- [ ] **Step 1: Write the failing tests**

```js
// src/lib/writeIn.test.js
describe("orderStances", () => {
  it("sorts descending when not inverted", () => {
    expect(orderStances(ASC_5, false).map(s => s.value)).toEqual([5, 4, 3, 2, 1]);
  });
  it("sorts ascending when inverted", () => {
    expect(orderStances(ASC_5, true).map(s => s.value)).toEqual([1, 2, 3, 4, 5]);
  });
  it("sorts by value, not by array order", () => {
    expect(orderStances(SHUFFLED_5, false).map(s => s.value)).toEqual([5, 4, 3, 2, 1]);
  });
  it("returns [] for missing or empty stances", () => {
    expect(orderStances(undefined, false)).toEqual([]);
    expect(orderStances([], false)).toEqual([]);
  });
});

describe("valueFromPlacement", () => {
  it("places above the top stance at the high edge", () => {
    expect(valueFromPlacement(0, 5, false)).toBe(5.5);   // above value 5
    expect(valueFromPlacement(0, 5, true)).toBe(0.5);    // above value 1
  });
  it("places below the bottom stance at the low edge", () => {
    expect(valueFromPlacement(5, 5, false)).toBe(0.5);
    expect(valueFromPlacement(5, 5, true)).toBe(5.5);
  });
  it("places between neighbours", () => {
    expect(valueFromPlacement(1, 5, false)).toBe(4.5);
    expect(valueFromPlacement(1, 5, true)).toBe(1.5);
  });
});

describe("round trip", () => {
  it.each([3, 5, 7])("survives every placement for %i stances", (count) => {
    for (const inverted of [false, true]) {
      for (let i = 0; i <= count; i++) {
        const v = valueFromPlacement(i, count, inverted);
        expect(placementFromValue(v, count, inverted)).toBe(i);
      }
    }
  });
});

describe("isWriteIn", () => {
  it.each([[2.5, true], [0.5, true], [5.5, true], [3, false], [0, false], [null, false], [undefined, false]])(
    "%s -> %s", (value, expected) => expect(isWriteIn(value)).toBe(expected)
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/writeIn.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the four functions in `src/lib/writeIn.js`**

`isWriteIn(value)` is `value != null && !Number.isInteger(value)`. `orderStances` copies before sorting. `placementFromValue` rounds its result so float noise cannot produce a fractional index.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/writeIn.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/writeIn.js src/lib/writeIn.test.js
git commit -m "feat(compass): one home for write-in placement math"
```

---

### Task 2: `StanceChooser` component

**Files:**
- Create: `src/components/StanceChooser.jsx`
- Test: `src/components/StanceChooser.test.jsx`

**Interfaces:**
- Consumes: Task 1's four functions; `useTheme()` from `src/ThemeProvider.jsx`; `DARK_THEME`/`LIGHT_THEME` from `src/lib/calibrationTheme.js`.
- Produces: default export `StanceChooser`, props:
  `topic`, `stances`, `currentAnswer`, `pendingValue`, `writeInText`, `isInverted`, `disabled`,
  `onSelectStance(topic, value)`, `onSelectWriteIn(topic, value, text)`, `onCancelWriteIn(topic)`,
  `onWriteInModeChange(isOpen)`, `onOpenWriteIn()`.

Behaviour the component owns: render `orderStances(stances, isInverted)` as buttons each carrying `data-testid="stance-option"`; a "Write your own..." button; on open, swap to a `DndContext` list with the write-in card appended; on drag, compute the value via `valueFromPlacement` and call `onSelectWriteIn`; on mount or topic change, restore an existing write-in to `placementFromValue`; clearing the text cancels. It calls `useTheme()` itself and takes no `isDark` prop.

Lift verbatim from `CalibrationOverlay.jsx`: `SMOOTH_TRANSITION` (`:626-629`) and the sensor config (`:1109-1114` — `PointerSensor` distance 3, `TouchSensor` delay 150 / tolerance 5).

- [ ] **Step 1: Write the failing tests**

Follow `src/components/QuestionNotes.test.jsx`'s pattern: `createRoot` + `act`, no testing-library.

```jsx
it("renders stances descending when not inverted, each tagged for the smoke suite", ...)
  // 5 buttons, textContent order matches values [5,4,3,2,1],
  // every button has data-testid="stance-option"

it("renders ascending when inverted", ...)

it("clears a write-in before reporting a pre-written stance pick", ...)
  // with an existing write-in, click a stance:
  // onCancelWriteIn fires, and fires BEFORE onSelectStance

it("reports placement as a half-step value", ...)
  // open write-in, type, drag to index 1 of 5, not inverted
  // -> onSelectWriteIn called with 4.5

it("tells the parent when write-in mode opens and closes", ...)
  // onWriteInModeChange(true) on open, (false) on cancel
  // onOpenWriteIn fires once on open

// Review Focus 5
it("renders nothing rather than throwing when stances are missing or empty", ...)

// Review Focus 3
it("shows the write-in card for a half-step value with no text", ...)
  // currentAnswer=2.5, writeInText="" -> card present and empty, no crash

// Review Focus 4
it("re-derives the card position when inversion changes", ...)
  // currentAnswer=4.5, isInverted false -> card at index 1
  // re-render with isInverted true -> card at index 4, card still present
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/components/StanceChooser.test.jsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `StanceChooser` in `src/components/StanceChooser.jsx`**

Restore effect depends on `[topic?.id, isInverted]` so an inversion change re-derives the card position (Review Focus 4) — not the drawer's `[topic?.id]`-only form. The internal drag hint is `!!writeInText.trim() && !hasRepositioned`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/components/StanceChooser.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/StanceChooser.jsx src/components/StanceChooser.test.jsx
git commit -m "feat(compass): one StanceChooser for every answering surface"
```

---

### Task 3: `CalibrationOverlay` adopts `StanceChooser`

Adopted first because its usage is the richest — if the component survives here it will survive the rest. Display order does not change.

**Files:**
- Modify: `src/components/CalibrationOverlay.jsx` — delete `SortableStanceLabel` (`:631`), `SortableWriteInCard` (`:795`), `handleDragEnd` (`:1553`), `handleWriteInTextChange` (`:1619`), `handleCancelWriteIn` (`:1500`), the write-in half of the restore effect (`:1160-1188`); render `StanceChooser` in the `answer` step (`:2770-2865`).

**Interfaces:**
- Consumes: Task 2's `StanceChooser`.
- Produces: nothing new.

- [ ] **Step 1: Wire `StanceChooser` into the `answer` step**

`onSelectStance` → existing `handleSelectStance`. `onSelectWriteIn` → existing `selectWriteInPlacement`, extended to take the text. `onOpenWriteIn` → writes `onboarding_writeInHint` and sets `writeInHintShown`. The first-question hint copy (`:2823-2827`) stays in the overlay.

- [ ] **Step 2: Verify no behaviour changed**

Run: `npm test && npm run lint && npm run build`
Expected: all pass, no new lint warnings.

- [ ] **Step 3: Verify the flow by hand**

Run `npm run dev`, take the Local Lens path to the questions. Write a stance, drag it, confirm the radar spoke moves. Reload and confirm it returns at the same position with the same text. Check both themes.

- [ ] **Step 4: Commit**

```bash
git add src/components/CalibrationOverlay.jsx
git commit -m "refactor(compass): overlay answers through StanceChooser"
```

---

### Task 4: `LibraryDrawer` and `ComparePanel` flip to descending

These ship together: both render on `/results` via `CombinedPage` (`:2084`, `:2355`), so flipping one alone would show the same topic's stances in opposite orders on one screen.

**Files:**
- Modify: `src/components/LibraryDrawer.jsx` — delete `SortableStanceLabel` (`:26`), `SortableWriteInCard` (`:49`), `SMOOTH_TRANSITION` (`:21-24`), `handleDragEnd` (`:194`), `handleWriteInTextChange` (`:208`), `handleCancelWriteIn` (`:226`), and the restore half of the effect at `:161-192`; render `StanceChooser`.
- Modify: `src/components/ComparePanel.jsx:126` and the comment at `:123-124`.

**Interfaces:**
- Consumes: Task 2's `StanceChooser`, Task 1's `orderStances`.
- Produces: nothing new.

- [ ] **Step 1: Replace the drawer's stance block with `StanceChooser`**

Keep the `showRemoveConfirm` reset in the drawer's effect — it is not the component's. Parent callbacks from `CombinedPage` (`:2355-2370`) are unchanged; the drawer passes them straight through. The drawer's own Tailwind `dark:` classes for the stance area go, since the component themes itself.

- [ ] **Step 2: Flip `ComparePanel` to `orderStances`**

Replace `:126` with `orderStances(stances, isInverted)`. Correct `:123-124`, which claims it matches "the stance order LibraryDrawer/CalibrationOverlay show" — those two disagreed, which is why this work exists. Also replace its inline write-in check at `:40` with `isWriteIn`.

- [ ] **Step 3: Verify**

Run: `npm test && npm run lint && npm run build`
Expected: all pass.

- [ ] **Step 4: Verify the flip by hand**

On `/results`, open a topic in the drawer with the compare panel showing the same topic. Confirm both list stances in the same order, and that the order matches what onboarding showed for that topic. Check both themes — this task restyles the drawer.

- [ ] **Step 5: Commit**

```bash
git add src/components/LibraryDrawer.jsx src/components/ComparePanel.jsx
git commit -m "fix(compass): one stance order on the results page"
```

---

### Task 5: `Quiz` adopts `StanceChooser`

Kills the fourth copy and, with it, a real bug: `Quiz.jsx:302-305` rebuilds the write-in card position from the **unreversed** stance array with no inversion term while the render uses the ordered array (`:418`), so on an inverted topic a user's own stance returns mirrored to the wrong side.

**Files:**
- Modify: `src/pages/Quiz.jsx` — delete `SortableStanceLabel` (`:32`), `SortableWriteInCard` (`:55`), `SMOOTH_TRANSITION`, restore (`:297-312`), `handleDragEnd` (`:428-440`), `handleWriteInTextChange` (`:442-464`), `handleCancelWriteIn` (`:466-481`); render `StanceChooser` at `:510-555`.
- Test: `src/lib/writeIn.test.js` (add the regression case)

**Interfaces:**
- Consumes: Task 2's `StanceChooser`.
- Produces: nothing new.

- [ ] **Step 1: Write the failing regression test**

```js
// src/lib/writeIn.test.js — the bug Quiz shipped
it("restores an inverted write-in to the side the user placed it on", () => {
  // placed just below the strong end on an inverted spoke
  const v = valueFromPlacement(4, 5, true);          // 4.5
  expect(placementFromValue(v, 5, true)).toBe(4);     // not 1, which the old code gave
});
```

- [ ] **Step 2: Run it**

Run: `npm test -- src/lib/writeIn.test.js`
Expected: PASS — Task 1's math is already correct. This pins it so the bug cannot return.

- [ ] **Step 3: Replace Quiz's stance block with `StanceChooser`**

`onSelectWriteIn` and `onSelectStance` route to Quiz's existing save path, which already sends `answer_type` (`:339`). Quiz's display order flips to descending with everything else.

- [ ] **Step 4: Verify**

Run: `npm test && npm run lint && npm run build`
Expected: all pass.

- [ ] **Step 5: Verify the fix by hand**

On the quiz, find a topic whose spoke is inverted, write a stance and place it near one end, reload, and confirm it returns on the same side.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Quiz.jsx src/lib/writeIn.test.js
git commit -m "fix(quiz): a custom stance comes back where you put it"
```

---

### Task 6: `/calibrate` gains write-ins

The reported bug. `FullCalibration` does not even destructure `writeIns` from `useCompass` (`:94-98`), so an existing write-in shows as answered in the sidebar while highlighting nothing.

**Files:**
- Modify: `src/lib/calibrationEvents.js:57,112-122`
- Modify: `src/pages/FullCalibration.jsx` — `:94-98`, `:358`, `:440-470`, `:1073-1100`, the DARK/LIGHT objects at `:32-72`
- Modify: `src/components/Layout.jsx:116`
- Test: `src/lib/calibrationEvents.test.js`

**Interfaces:**
- Consumes: Task 2's `StanceChooser`.
- Produces: `eventForAnswer({ topicSlug, answeredCount, totalTopics, answerType, surface })` — `surface` defaults to `"overlay"`.

- [ ] **Step 1: Write the failing test for the `surface` parameter**

```js
// src/lib/calibrationEvents.test.js
it("defaults surface to overlay", () => {
  expect(eventForAnswer({ topicSlug: "t", answeredCount: 1, totalTopics: 8, answerType: "stance" })
    .props.surface).toBe("overlay");
});
it("carries an explicit surface", () => {
  expect(eventForAnswer({ topicSlug: "t", answeredCount: 1, totalTopics: 8, answerType: "write_in", surface: "full" })
    .props.surface).toBe("full");
});
```

- [ ] **Step 2: Run it**

Run: `npm test -- src/lib/calibrationEvents.test.js`
Expected: FAIL on the second — `surface` is the hardcoded `SURFACE` constant.

- [ ] **Step 3: Add the `surface` parameter, defaulting to `"overlay"`**

Keep `const SURFACE = "overlay"` as the default value so the existing assertion at `:110` still passes.

- [ ] **Step 4: Run it**

Run: `npm test -- src/lib/calibrationEvents.test.js`
Expected: PASS.

- [ ] **Step 5: Wire `StanceChooser` into `FullCalibration`**

Destructure `writeIns` and `setWriteIns` from `useCompass`. Replace the hand-rolled button list (`:1073-1100`) and `orderedStances` (`:458-462`) with the component. Add `stanceText`, `stanceBorder`, `writeOwnColor` and `yellowBg` to the local DARK/LIGHT objects — **do not** adopt `calibrationTheme` wholesale; it lacks the seven chrome keys this page renders with and would shift light-mode `textMuted` page-wide.

Route the answered event through `eventForAnswer` with `surface: 'full'`. The other three hand-rolled `track()` calls (`:334-338`, `:411-415`, `:426-431`) are out of scope.

- [ ] **Step 6: Suspend auto-advance in write-in mode**

`onWriteInModeChange(true)` holds the topic; picking a pre-written stance keeps the existing 420 ms advance unchanged. The `selectedValue !== null` guard at `:358` must clear when write-in mode opens, or `handleAnswer` early-returns on that topic forever.

- [ ] **Step 7: Harden the backup re-post**

`Layout.jsx:116` attaches `write_in_text` whenever `writeIns[shortTitle]` is truthy, with no check on the value. Gate it on `isWriteIn(value)` so stale local text cannot resurrect what the server already cleared.

- [ ] **Step 8: Verify**

Run: `npm test && npm run lint && npm run build`
Expected: all pass.

- [ ] **Step 9: Verify the reported bug is fixed**

Write a custom stance during onboarding, then open the same topic on `/calibrate`: it must appear, correctly placed, showing your text. Then switch it to a pre-written stance, reload, and confirm the write-in is gone.

- [ ] **Step 10: Commit**

```bash
git add src/lib/calibrationEvents.js src/lib/calibrationEvents.test.js src/pages/FullCalibration.jsx src/components/Layout.jsx
git commit -m "feat(calibrate): write your own stance in full calibration"
```

---

### Task 7: `lens_intro` stops being draggable

**Files:**
- Modify: `src/components/CalibrationOverlay.jsx` — `:2180-2200` (the `DndContext`), `reorderLensTopics` (`:2173-2177`), the copy at `:2314-2317`, `SortableLensTopicRow` (`:698`)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

- [ ] **Step 1: Remove the drag wiring**

Drop `DndContext`/`SortableContext`/`reorderLensTopics`; render the rows as a static list. Topics can still be removed and put back — `canRemove`, `removeLensTopic` and the "Put back all N" control stay. `SortableLensTopicRow` becomes a plain row; rename it accordingly and drop its `useSortable`.

- [ ] **Step 2: Rewrite the copy**

`:2314-2317` currently reads "This is your running order. Drag a topic to move it, or drop the ones you don't care about. We'll ask them exactly like this." Drag is gone, so that is now untrue. Replace with copy that describes the list and the one action that remains — removal — and says nothing about ordering.

- [ ] **Step 3: Keep `lensEdited` on removal only**

`lensEdited` (`:1035-1051`, `:2179`) still has removals to track for the resume path; only its reorder trigger goes.

- [ ] **Step 4: Verify**

Run: `npm test && npm run lint && npm run build`
Expected: all pass.

- [ ] **Step 5: Verify by hand**

Take the Local Lens path. The topic list must not drag. Remove a topic, go forward, come back, and confirm the removal survived.

- [ ] **Step 6: Commit**

```bash
git add src/components/CalibrationOverlay.jsx
git commit -m "fix(onboarding): the lens topic list no longer invites a drag"
```

---

### Task 8: Smoke suite reconciliation

`data-testid="stance-option"` lived on exactly two surfaces and now lives on four. On `/results` the drawer's buttons join the DOM, so any scenario that indexes or counts `STANCE_BUTTONS` there may now select a different element. Four scenarios touch `/results` or `/`: `guest-onboarding` (`:257`), the two lens scenarios (`:1081`, `:1205`), and `calibrate-param-opens-the-named-lens` (`:1707`).

**Files:**
- Modify: `smoke/run.mjs` (only where a scenario actually breaks)

**Interfaces:**
- Consumes: everything above.
- Produces: a green suite.

- [ ] **Step 1: Run the full suite**

Run: `npm run smoke`
Expected: all scenarios pass or skip. Note any failure and which selector caused it.

- [ ] **Step 2: Scope only the selectors that broke**

Where a scenario meant "the overlay's stances" and now also matches the drawer's, scope its query to the container it meant. Do not weaken an assertion to make it pass, and do not change `STANCE_BUTTONS` itself — the comment at `:104-106` explains why it is deliberately shared.

- [ ] **Step 3: Re-run everything**

Run: `npm test && npm run lint && npm run build && npm run smoke`
Expected: all pass.

- [ ] **Step 4: Confirm no copy of the math survives**

Run: `git grep -n "displayMidpoint\|SortableWriteInCard\|SortableStanceLabel" -- src/`
Expected: matches only in `src/components/StanceChooser.jsx`.

Run: `git grep -n "Number.isInteger" -- src/`
Expected: matches only in `src/lib/writeIn.js`. All ten inline write-in checks — `CalibrationOverlay:1172,1625,1663`, `LibraryDrawer:173,210,226`, `ComparePanel:40`, `Quiz:298,444,470` — are gone, replaced by `isWriteIn`. They were not equivalent: the overlay and Quiz tested truthiness, the drawer tested `!= null`.

- [ ] **Step 5: Commit**

```bash
git add smoke/run.mjs
git commit -m "test(smoke): scope stance selectors now four surfaces carry them"
```
