# Shared stance chooser, and a calibration-flow trim

**Date:** 2026-11-20
**Branch:** `calibration-stance-chooser`
**Status:** approved 2026-11-20

## Intent and why

Two things, from one session of using the compass:

1. **Write-ins are missing from the full calibration section.** You can write your own
   stance during onboarding, but `/calibrate` offers only the five pre-written ones. Worse
   than "missing": `FullCalibration.jsx` reads no write-ins at all — it does not even
   destructure them from `useCompass` (`:94-98`) — so a topic you *already* answered in your
   own words shows as answered in the sidebar while highlighting no option and displaying
   none of your text. The words are loaded in context; the page never looks at them.

2. **The lens intro's topic list is draggable, and the payoff is a screen away.** Reordering
   it sets the order calibration actually walks, but nothing on that screen shows it, so the
   affordance asks for a decision and appears to do nothing with it.

The governing principle, in the user's words: *"I'm not sure why we should ignore write-ins
anywhere."* A write-in is a first-class answer. Every surface that lets you answer should let
you write your own, show you the one you wrote, and record it as a write-in.

(ev-ui was also stale in `node_modules` — 0.11.1 installed against a lockfile already pinning
0.17.0. Fixed by `npm install` on this branch; no file change was needed.)

## Goals

- `FullCalibration` gains write-ins: create, place, edit, and see an existing one restored
  to its position.
- **One** implementation of stance-choosing, used by all four answering surfaces.
- Write-ins persist their text **and** their half-step value, display under the user's own
  words, and report `answer_type: 'write_in'` to analytics.
- One stance display order across the whole app.
- The `lens_intro` topic list stops being draggable.

## Non-goals

- **The welcome screen is not touched.** It duplicates `learn`'s explanation of the
  visualization, and the fix is deferred by explicit decision — the user wants to sit with
  that screen before changing it. Recorded so it is not lost, not actioned here.
- The draggable pill strips on `pick` and `answer` stay draggable. They show their effect on
  the compass immediately, which is exactly what `lens_intro` lacks.
- No change to the `/compass/answers` API. Probed live on 2026-11-20 (below) and it already
  behaves correctly.
- No new write-in capability in admin screens. They edit topics, they don't answer them.

## Anti-goals

- **Another copy of the half-step math.** It exists three times today and has already
  drifted. Ending that is the point; adding a fourth would be failure.
- **Regressing the screens that work today** to fix the one that doesn't.
- **Weakening random spoke inversion.** See the dedicated section — this is a product
  commitment, not an implementation detail.

## Constraints

- `src/lib/calibrationTheme.js` exports `stanceBg`, `stanceText`, `stanceBorder`,
  `writeOwnColor`, `yellowBg`, `yellow`. Verified present.
- ev-ui 0.17.0 exports no stance-picking component (`StanceAccordion` *displays* a
  politician's stances). So this component belongs in this repo; CLAUDE.md's "use ev-ui
  rather than copying" does not apply.
- Stances arrive from `GET /api/compass/topics` **ascending** (1 → 5). Verified live
  2026-11-20: all 60 topics, 5 stances each.
- A write-in's value is a half-step (`x.5`), with `0.5` and `5.5` the legitimate edges.

## Approaches

**A — Copy the pattern into `FullCalibration`.** Fastest; produces a fourth copy of a formula
that has already drifted. Rejected.

**B — Extract the math and the card only; each screen keeps its own list.** Lower risk, but
leaves four list layouts and four places to drift again. Rejected as a half-measure.

**C — One shared `StanceChooser` across all answering surfaces. ← chosen**

C was initially ranked last on the assumption that differing styling systems made it
expensive. Two findings overturned that:

- `calibrationTheme.js` already exists and already carries stance-specific tokens.
- `LibraryDrawer` is already presentational — it takes `onSelectStance(topic, value)` and
  `onSelectWriteIn(topic, value, text)` and leaves persistence and navigation to its parent.
  That disposes of the main objection: the surfaces' differing *after-answer* behaviours
  (FullCalibration's 420 ms auto-advance, the drawer's close, the overlay's manual Next) live
  in the parents and never enter the component. It needs one behaviour, not four.

The real cost is that `LibraryDrawer` and `Quiz` are styled with Tailwind `dark:` classes
while the others use inline tokens, so adopting the component restyles them. Cosmetic-only,
on screens whose behaviour does not change, verifiable by eye in both themes.

## Random spoke inversion is preserved — and repaired

`shouldFlip` (`CompassContext.jsx:47-54`) hashes `guestId + topicId` and takes the low bit.
Inversion is therefore a coin flip **per user, per topic**: stable for one person so their
compass does not jitter between sessions, spread across the population so neither pole
systematically holds the top slot. This is deliberate anti-bias design and must not be
weakened.

**Unifying display order does not touch it.** The ordering rule is defined *relative to* the
inversion state — not inverted → descending (5 at top), inverted → ascending (1 at top).
Because `shouldFlip` randomises that state per topic, which pole lands on top remains a coin
flip per topic. Within a single screen the user still sees a mix.

**The present inconsistency actively undermines the goal.** Today the same topic in the same
inversion state renders one way in onboarding and the opposite way in the drawer — a second
flip, invisible, not random, keyed to which screen you are on. Unification removes that stray
flip and leaves only the intended one.

`Quiz`'s restore bug is the sharpest case: `Quiz.jsx:302-305` rebuilds the write-in card
position from the **unreversed** stance array with no inversion term, while the render uses
the ordered array (`:418`). On an inverted topic a user's own custom stance returns mirrored
to the wrong side of the scale. That misrepresents where they placed themselves, and fixing
it protects the answer's integrity.

## Display order — decided: descending everywhere

Five surfaces order stance lists, and they disagree. With stances served ascending and the
spoke **not** inverted:

| Surface | Rule | Order shown |
|---|---|---|
| `CalibrationOverlay:1168,1685` | `isFlipped ? natural : reverse` | **5,4,3,2,1** |
| `FullCalibration:458-462` | `sort(b.value - a.value)` | **5,4,3,2,1** |
| `LibraryDrawer:147` | `isInverted ? reverse : natural` | 1,2,3,4,5 |
| `ComparePanel:126` | `isInverted ? reverse : natural` | 1,2,3,4,5 |
| `Quiz:418` | `isFlipped ? reverse : natural` | 1,2,3,4,5 |

The real split is **2 descending / 3 ascending**. Every drag formula is internally correct
against its own screen's ordering, which is why this went unnoticed.

**Decided 2026-11-20: descending everywhere.** The argument is risk, not majority — majority
runs the other way. Flipping to *ascending* would mean rewriting ordering inside
`CalibrationOverlay`, the onboarding flow every user meets first and the most recently
redesigned screen in the app. Flipping to *descending* touches `LibraryDrawer` and `Quiz`,
both of which are rewritten anyway when they adopt `StanceChooser`, leaving `ComparePanel` as
a single-line change. Cheaper and safer despite being the minority.

`ComparePanel` **must** flip with them: it and `LibraryDrawer` render on the same page
(`CombinedPage:2084`, `:2355`), so flipping one alone would show the same topic's stances in
opposite orders on one screen. Its comment at `:123-124` claims it matches "the stance order
LibraryDrawer/CalibrationOverlay show" — impossible, since those two disagree. Correct it.

Stored answers are unaffected; this is display order only.

## The write-in clearing question — investigated, no backend work

The concern: switching from a write-in to a pre-written stance might leave the old text on
the server to reappear after a reload. **Probed live against the throwaway smoke account on
2026-11-20:**

| POST body | Result |
|---|---|
| `{topic_id, value: 2.5, write_in_text: "..."}` | stored, text present |
| `{topic_id, value: 3}` (no `write_in_text`) | **`write_in_text` → `null`** |
| `{topic_id, value: 3, write_in_text: ""}` | 200, stored as `""` |
| `{topic_id, value: 3, write_in_text: null}` | **422, rejected** |

A value-only POST already clears the text, and a value-only POST is exactly what the client
sends on a stance pick. **The server is correct; no EV-Accounts change is needed.** Omitting
the field is the way to clear it — never send `null`.

The remaining hazard is client-side and narrow: `Layout.jsx:116` re-posts `write_in_text`
whenever local `writeIns[shortTitle]` is truthy, **with no check that the value is a
half-step**. Stale local state can therefore resurrect text the server already cleared.
`CalibrationOverlay:1381-1387` and `CombinedPage:1037-1041` close this by deleting from
`writeIns` on a stance pick; `FullCalibration` has no `setWriteIns` at all, so adding
write-ins there without the clear would open the leak.

Two fixes, both in scope: `StanceChooser` guarantees the clear (below), and `Layout.jsx:116`
is hardened to require a half-step value before attaching `write_in_text`.

## The component

`src/components/StanceChooser.jsx`, with the shared math in `src/lib/writeIn.js`.

**`src/lib/writeIn.js`** — pure, unit-testable, the single home for the formula:

- `orderStances(stances, isInverted)` — **sorts by `stance.value`**, not by served array
  order. `FullCalibration` must sort because the categories API returns stance-less topic
  objects (`:454-462`), and all 60 live topics are already ascending, so sorting is safe and
  makes the rule independent of payload order.
- `valueFromPlacement(writeInIndex, stanceCount, isInverted)` — placement → stored value.
- `placementFromValue(value, stanceCount, isInverted)` — stored value → list index.
- `isWriteIn(value)` — `value != null && !Number.isInteger(value)`. Replaces **10** inline
  checks that are not equivalent today: overlay and Quiz test truthiness, the drawer tests
  `!= null`.

`valueFromPlacement` and `placementFromValue` must round-trip across every placement, both
inversion states, including the `0.5` and `5.5` edges. That is the primary unit test.

**`StanceChooser`** owns, and only owns: the stance button list in the shared order; the
"Write your own..." affordance; the drag-to-place list, write-in card and text field;
restoring an existing write-in to its position; cancelling a write-in.

Props: `topic`, `stances`, `currentAnswer` (stored), `pendingValue` (transient, parent-owned),
`writeInText`, `isInverted`, `disabled`, and callbacks `onSelectStance(topic, value)`,
`onSelectWriteIn(topic, value, text)`, `onCancelWriteIn(topic)`,
`onWriteInModeChange(isOpen)`, `onOpenWriteIn()`.

It holds no persistence and no navigation. It emits `data-testid="stance-option"` on every
stance button.

## Decisions taken by me (flagged for your check)

- **The component guarantees the write-in clear.** On a pre-written stance pick it calls
  `onCancelWriteIn(topic)` before `onSelectStance(topic, value)`. Leaving this to four
  parents is how the drift this work exists to end would return.
- **`onWriteInModeChange(isOpen)`** tells a parent write-in mode is open, so
  `FullCalibration` can suspend auto-advance. Without it the promise could not be kept.
- **The parent keeps the transient selection.** `FullCalibration` distinguishes "just
  clicked" (drives `scale(1.01)` and 0.4 dimming, `:1078-1080`) from "stored answer", which
  one `currentAnswer` cannot express — hence the separate `pendingValue`. Its
  `selectedValue !== null` guard (`:358`) must also clear when write-in mode opens, or
  `handleAnswer` early-returns on that topic forever.
- **Changing inversion re-derives the card position** (the overlay's behaviour,
  `CalibrationOverlay:1188`, not the drawer's `[topic?.id]`-only effect at `:192`). Values
  are stored canonically, so the card should mirror with the list. This covers
  `FullCalibration`'s Flip button (`:1006-1016`) and the overlay's Stance Max/Min
  (`:1568-1604`), both of which sit beside the list.
- **`eventForAnswer` gains a `surface` parameter** defaulting to `"overlay"`, so the existing
  test pinning `surface: "overlay"` (`calibrationEvents.test.js:110`) keeps passing.
  `FullCalibration`'s answered event routes through it with `surface: 'full'`. Its other
  three hand-rolled `track()` calls (`:334-338`, `:411-415`, `:426-431`) are left alone —
  out of scope, noted here.
- **`FullCalibration` extends its local token objects; it does not adopt `calibrationTheme`
  wholesale.** Wholesale adoption would blank seven values it renders with (`sidebar`,
  `sidebarBdr`, `stanceBdr`, `stanceShadow`, `activeItem`, `checkColor`, `flipBtn`) and
  silently change light-mode `textMuted` from `#9CA3AF` to `#6d7a9a` page-wide.
- **`StanceChooser` calls `useTheme()` itself** rather than taking `isDark`. `LibraryDrawer`
  has no theme prop and `CombinedPage:2355-2370` passes none; threading one through would be
  churn for nothing.
- **The two "hints" are separated.** The drag hint (`showHint`) derives from state the
  component owns, so it stays internal. The first-question onboarding copy
  (`CalibrationOverlay:2823-2827`) and the `onboarding_writeInHint` localStorage flag stay in
  the overlay, written from the new `onOpenWriteIn()` callback.
- **The drawer's `showRemoveConfirm` reset stays in the drawer.** Its restore effect
  (`LibraryDrawer:161-170`) does more than restore, and that part is not the component's.

## Per-surface changes

**`LibraryDrawer`** — delete local `SortableStanceLabel`, `SortableWriteInCard`,
`handleDragEnd`, `handleWriteInTextChange` and the restore half of its effect; render
`StanceChooser`. Restyled onto shared tokens. Stance list flips to descending. Parent
callbacks in `CombinedPage` unchanged.

**`CalibrationOverlay`** — same deletions in the `answer` step. Order unchanged.

**`Quiz`** — same deletions (`:32`, `:55`, `:297-312`, `:428-481`). Order flips to
descending. The mirrored-restore bug dies with the duplicated code.

**`ComparePanel`** — one-line order flip; correct the inaccurate comment at `:123-124`. It
pins its write-in card to the bottom unconditionally (`:258-267`) so it never shows
placement; out of scope, noted.

**`FullCalibration`** — destructure `writeIns` and `setWriteIns` from `useCompass` (absent
today), replace the hand-rolled button list with `StanceChooser`. Auto-advance suspends in
write-in mode; picking a pre-written stance keeps the existing 420 ms advance unchanged. An
existing write-in renders as the user's own text, falling back to `(Custom stance)` per
`ComparePanel`'s convention.

**`lens_intro`** — remove `DndContext`/`SortableContext` and `reorderLensTopics`; topics
render as a static list that can still be removed and restored. **The copy at `:2314-2317`
must be rewritten** — "This is your running order. Drag a topic to move it... We'll ask them
exactly like this" becomes untrue once drag is gone. Question order falls back to the lens's
shipped order. `lensEdited` (`:1035-1051`, `:2179`) still has removal to track, so it stays,
but its reorder trigger goes.

**`Layout`** — `:116` requires a half-step value before attaching `write_in_text`.

## Verification

- Unit: `valueFromPlacement` / `placementFromValue` round-trip, both inversion states, `0.5`
  and `5.5` edges, parameterised over `stanceCount`.
- Unit: `orderStances` for both inversion states.
- The smoke suite must stay green. **`data-testid="stance-option"` is its only stance
  selector** (`smoke/run.mjs:104-107`, ~10 scenarios) and today exists on exactly two
  surfaces. Adding it to `LibraryDrawer` puts `stance-option` elements on `/results` whenever
  the drawer is open — any scenario that *counts* them needs re-checking.
- By hand, both themes, all four surfaces: write a stance, place it, reload, confirm it
  returns at the same position with the same text; switch to a pre-written stance, reload,
  confirm the write-in is gone.
- The reported bug specifically: a write-in created in onboarding appears, correctly placed
  and showing its text, when the same topic is opened in `/calibrate`.
- Inversion: confirm a mix of top-poles across topics on one screen, and that the *same*
  topic shows the *same* order on all four surfaces.

## Left to the builder

- Visual treatment of the write-in card in `FullCalibration`'s centered-card layout.
- Test file placement, following the repo's `src/lib/*.test.js` colocation convention.
- The replacement copy for `lens_intro`.
- Whether the hint accent (hardcoded `#E85D26` in the overlay, `text-ev-coral` in the drawer)
  becomes a `calibrationTheme` token or stays literal.
- `SMOOTH_TRANSITION` and the dnd sensor config are byte-identical across all three copies;
  lift them verbatim into the component.
