# Custom lens builder — design

Date: 2026-08-29
Repo: EV-CompassV2 (frontend). Backend shipped separately in EV-Accounts PR #224.
Status: approved in brainstorming, not yet planned.

## 1. What this is

Users build their own named lenses — "my 8 topics" — and switch to them from the
lens row beside the curated Local / Federal / Judicial lenses. A lens whose
questions have since been revised prompts the owner to recalibrate rather than
silently going stale or being thrown away.

The backend is done and live: `inform.compass_user_lenses` (migration 1849,
already applied to prod) and `GET`/`PUT /api/compass/my-lenses`, which returns
each lens with a `needsRecalibration` array. This document covers the Compass
frontend only.

## 2. The defect that must be fixed first

**Lens activation today is inferred from the topic set, not stored.**

```js
// CombinedPage.jsx:1174
const lensIsActive = (lens) =>
  selectedTopics.length > 0 && selectedTopics.every(id => lens.topicIds.includes(id));
```

`isLensTopicSet()` (`src/lib/lenses.js`) is the same test, and it is load-bearing
in two places that decide whether the user's compass gets written down:

- `CompassContext.jsx:205` — the #71 rule. If the current topics look like a
  lens, publish `preLensTopics` as `s` instead, so other apps never receive a
  lens overlay as the user's compass.
- `CombinedPage.jsx:1262`, `:1331` — whether to stash `preLensTopics` at all, and
  (via the sync effect) whether to persist `selected_topic_ids` to the server.

Inference is sound for three curated lenses built from fixed topic IDs the user
did not choose. It is **not** sound for user lenses, because a user lens is made
of the user's own topics:

1. **Identity collision.** A user saves their current compass as a lens — the
   flow this design deliberately chooses. From then on their compass is, by
   definition, a set whose every id belongs to that lens. `lensIsActive` returns
   true while they look at their own compass, so the app treats the real compass
   as an overlay: it refuses to persist it and publishes a stale `preLensTopics`
   as `s`. This is the #68/#71 silent-non-persistence bug, reintroduced
   structurally rather than by accident.
2. **Subset collision.** A 5-topic lens whose topics are all inside an 8-topic
   lens matches both. `activeLens` resolves by first match in a hardcoded
   ternary, so the wrong lens wins.
3. **Empty-lens degenerate case.** The table permits a lens with zero topics
   (named before filled). `every()` over an empty array is vacuously true.

No amount of care in the builder UI avoids this; the representation is wrong.

## 3. Decisions taken

Settled during brainstorming, 2026-08-29:

- **Guests get lenses too**, from the first cut.
- **Guest lenses stay inside Compass.** They live in `localStorage` and do *not*
  enter the shared ev-context payload. This is the change that removes the
  payload-size question (roadmap step 1) from the critical path: nothing about
  this work grows the shared payload. Essentials gains custom lenses later, when
  it reads them for signed-in users from the API.
- **Creation is "save this view as a lens"**, not a separate picker. The user
  arranges 8 topics exactly as they do today (`AddTopicModal`,
  `ReplaceTopicModal`, reordering), then names and saves that arrangement.
- **The recalibration prompt is attached to the question**, not to a banner. The
  topic pill carries an `⚠ Updated` marker; the lens chip carries a count.
- **State model: explicit `activeLensKey`** (approach A of three).

## 4. Architecture

### 4.1 `activeLensKey` replaces inference

`CompassContext` gains one value:

```
activeLensKey: string | null    // 'federal' | 'local' | 'judicial' | 'u_7f3a91' | null
```

`null` means "my compass". It is set when a lens is activated and cleared when
the user returns to their compass. It is **session state**, held in React and
mirrored to `sessionStorage` so a reload inside a lens does not silently reinterpret
the topic set. It is never sent to the server and never published to ev-context.

Everything currently derived from the topic set reads this value instead:

| Today | After |
|---|---|
| `lensIsActive(lens)` | `activeLensKey === lens.key` |
| `activeLens` ternary over three lenses | lookup by key across curated + user lenses |
| `isLensTopicSet(selectedTopics, lenses)` in `CompassContext` | `activeLensKey !== null` |
| `isLensTopicSet(...)` guard before stashing `preLensTopics` | `activeLensKey === null` |

`isLensTopicSet` is then unused and is deleted along with its tests. Deleting it
is part of the work, not a follow-up: leaving a second, wrong definition of "is a
lens active" next to the right one is how this class of bug recurs.

`preLensTopics` keeps its exact current job — the stash of the user's real
compass while an overlay is showing — and remains in `localStorage`.

### 4.2 The invariant, stated once

> While `activeLensKey !== null`, `selectedTopics` is a view. The user's compass
> is `preLensTopics`. Only the compass is persisted to the server or published as
> `s`.

Every rule in §2 becomes a direct reading of that sentence rather than a
heuristic that approximates it.

## 5. Data model and storage

### 5.1 Wire shape (already built)

```
GET /api/compass/my-lenses     -> 200 [ {
    key, name, topicIds[], visibility, createdAt, updatedAt,
    needsRecalibration: [ { topicId, reason, currentValue, publicNote,
                            answeredVersion, effectiveVersion } ]
} ]                            -> 200 [] for guests, no DB access

PUT /api/compass/my-lenses     body { lenses: [ {key, name, topic_ids[], visibility?} ] }
                               -> 200 (the saved set)
                               -> 422 VALIDATION_ERROR | DUPLICATE_LENS_KEYS | UNKNOWN_TOPIC_IDS
                               -> 409 LENS_KEY_TAKEN  { conflicting_keys: [...] }
```

`PUT` is a whole-set replace. Lenses absent from the body are deleted.

### 5.2 Keys

Client-generated, globally unique, `u_` + 6 lowercase hex (`u_7f3a91`), matching
the server regex `^u_[a-z0-9]{4,32}$`. Generated with `crypto.getRandomValues`.
The `u_` prefix is what stops a user lens from shadowing a curated key in the
same switcher row.

### 5.3 Guest storage

One key, `customLenses`, holding the array in wire shape minus server-owned
fields:

```json
[ { "key": "u_7f3a91", "name": "Farm bill", "topicIds": ["…"], "visibility": "private" } ]
```

Read through the same `safeParse` helper `CompassContext` already uses, so
corrupt storage degrades to "no custom lenses" rather than a crash.

Guests get no `needsRecalibration`: computing it needs the user's stamped
`answered_revision_id`, which only the server has. Guest lenses simply carry no
markers until sign-in. This is a real gap, and it is the right trade — the
alternative is shipping revision metadata into the client.

### 5.4 Sign-in promotion

On the transition from guest to signed-in, if `customLenses` is non-empty:

1. `GET /my-lenses` for what the account already has.
2. Merge by key: server wins on conflict (the account's own copy is canonical);
   local-only lenses are appended.
3. One `PUT` with the merged set.
4. On success, clear `customLenses`. On failure, keep it and retry next load —
   never clear local state that has not been confirmed written.

A `409 LENS_KEY_TAKEN` means a key collided with another account's. Regenerate
the key for the affected local lens and retry once; if it fails again, surface it
rather than looping.

## 6. Components

New:

- **`src/lib/userLenses.js`** — key generation, `localStorage` read/write, the
  merge/promotion logic, and normalisation to the shape `lenses.js` already
  produces. Pure functions, unit-testable without React.
- **`SaveLensModal.jsx`** — the name prompt. Name field, the count of topics
  being saved, Cancel / Save. Also serves rename.
- **`RecalibrationPopover.jsx`** — the `⚠ Updated` explanation: `publicNote`,
  the "your answer was given against the earlier wording" line, `Later` /
  `Recalibrate`.

Changed:

- **`CompassContext.jsx`** — owns `activeLensKey`, `userLenses`, and the fetch /
  promotion effects; exposes them plus a `refreshUserLenses()`. The #71 publisher
  rule switches to reading `activeLensKey`.
- **`CombinedPage.jsx`** — switcher row renders user chips and `+ Save this
  view`; `doStartLens` / `exitLensMode` / `activeLens` read `activeLensKey`;
  topic pills render the `⚠ Updated` marker.
- **`src/lib/lenses.js`** — `isLensTopicSet` deleted.

`CombinedPage.jsx` is 2,125 lines before this change. The switcher row and the
lens chips are self-contained enough to lift into a `LensSwitcher.jsx` as part of
this work, and doing so keeps the file from growing further. That extraction is
in scope; broader decomposition of the page is not.

## 7. Data flow

**Create.** User arranges topics → `+ Save this view` → `SaveLensModal` → key
generated → appended to the lens set → guest: write `localStorage`; signed-in:
`PUT` the whole set → chip appears.

🔴 **Creating a lens does NOT activate it.** `activeLensKey` stays `null` and the
user stays on their compass, which is what they are in fact looking at. Setting
the key here would be the intuitive move and it is wrong: by §4.2 it would
reclassify the compass they just saved as a view, so it would stop being
persisted to the server and a `preLensTopics` that was never stashed would be
published as `s`. The lens is saved; the chip is there; activating it is a
separate, explicit click.

**Activate.** Chip click → if `activeLensKey === null`, stash `selectedTopics` to
`preLensTopics` → set `activeLensKey` → set `selectedTopics` to the lens's topics
(restoring that lens's saved spoke order from `lensTopicsOrder:<key>`, which
already works per-key and needs no change).

**Switch lens to lens.** Never re-stash: `preLensTopics` is only written when
leaving the compass, which the explicit key now makes trivially correct.

**Exit.** `My compass` → save spoke order → restore `preLensTopics` → clear
`activeLensKey`.

**Edit.** With a lens active, changing topics marks it dirty; the chip's action
becomes `Update`. Saving writes the current `selectedTopics` as the lens's
`topicIds`. Leaving with unsaved changes discards them — the lens is not
implicitly rewritten by browsing.

**Delete.** From the chip's menu, with confirmation. If the deleted lens is
active, exit to compass first.

## 8. Recalibration

`GET /my-lenses` supplies `needsRecalibration` per lens. The frontend does not
compute staleness; it renders what the server decided.

- Lens chip: a count badge when the active or listed lens has flags.
- Topic pill, while that lens is active: `⚠ Updated`.
- Click: `RecalibrationPopover` showing `publicNote` verbatim — editorial's own
  words, never paraphrased by the client — and the two actions.
- `Recalibrate` opens the existing calibration flow scoped to that one topic.
  Answering it re-stamps `answered_revision_id` server-side, so the flag clears
  on the next `GET`.
- `Later` dismisses for the session only. It is not persisted: a question whose
  wording changed is a standing fact, and a permanently dismissible prompt is a
  prompt that never gets acted on.

`reason` distinguishes three cases and the copy differs:

| `reason` | Copy |
|---|---|
| `question_revised` | "This question was updated" + `publicNote` |
| `answer_invalidated` | "The option you chose no longer exists" |
| `not_asked_this_season` | "This question isn't part of the current season" — informational, no Recalibrate action |

## 9. Error handling

- `GET /my-lenses` fails → render curated lenses only, log, do not block the
  page. Custom lenses are additive; their absence must never break the compass.
- `PUT` fails → keep the local state, surface a non-blocking error, retry on next
  change. Never drop a lens the user just made because a request failed.
- `409 LENS_KEY_TAKEN` → regenerate and retry once (§5.4).
- `422 UNKNOWN_TOPIC_IDS` → should be unreachable, since topics come from the
  loaded set. Log loudly; it means the client is holding an id the server has
  never heard of.
- Corrupt `localStorage` → `safeParse` to empty, as elsewhere in this file.

## 10. Testing

**Unit (vitest).** `src/lib/userLenses.js`: key format and uniqueness, merge
precedence on sign-in, corrupt-storage fallback, the whole-set replace shape.

**Smoke (`npm run smoke`).** This is the fast and reliable way to check anything
in this layer — the #65/#68/#69/#70/#71 bugs were all timing and echo behaviour
that only appeared in a real browser. Scenarios to add:

1. **The regression this design exists to prevent.** Signed in: save the current
   compass as a lens, so compass and lens hold identical topics. Reload. Assert
   the compass still persists to the server and `s` is the compass, not the lens.
   Under today's inference this fails; it is the proof the model changed.
2. Create a lens, switch to it, switch back — `preLensTopics` restores the
   compass unchanged.
3. Lens-to-lens switching does not overwrite `preLensTopics`.
4. Guest creates a lens, signs in, lens promotes and survives reload.
5. A lens with a `needsRecalibration` entry renders the marker and the note.

## 11. Out of scope

- Auto-apply-by-office for user lenses. Curated lenses keep `autoDistrictTypes`;
  user lenses are never auto-applied.
- Sharing. `visibility` accepts `unlisted` server-side and nothing reads it yet.
- Essentials consuming custom lenses.
- Guest lenses in the ev-context payload (§3), and therefore roadmap step 1.
- Retiring the hardcoded topic-ID constants in `lenses.js`. They duplicate the
  `/compass/lenses` API as a declared offline fallback. A second source of truth
  sitting exactly where this work happens is worth noting, but replacing it is
  its own change.

## 12. Risks

- **This is surgery on the sync layer**, which produced five consecutive
  bug-fix PRs (#65, #68, #69, #70, #71). The change is a simplification —
  replacing a heuristic with the fact it approximated — but it touches
  `CompassContext` and `CombinedPage` rather than adding beside them. Smoke
  scenario 1 is the gate.
- **`sessionStorage` for `activeLensKey`** means two tabs can show different
  lenses. That is correct (a lens is a per-view choice) but differs from
  `preLensTopics`, which is shared in `localStorage`. A tab that exits a lens
  while another tab is inside one restores from a `preLensTopics` the second tab
  still expects. Worth an explicit test; if it proves messy, the fallback is to
  scope `preLensTopics` per tab as well.
- **Editorial classification.** Every revision in prod is `substantive` with an
  identity `rung_map`; `editorial` and `clarifying` have never been used. When a
  new season opens, users will be prompted about every topic whose wording moved
  at all. That is a process problem upstream of this UI, but this UI is where it
  will be felt.
