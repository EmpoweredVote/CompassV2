# Phase 01: Combined Compass+Library Page - Research

**Researched:** 2026-05-14
**Domain:** React component merge — Compass.jsx + Library.jsx into single unified page
**Confidence:** HIGH (all findings from direct source code reading)

## Summary

This phase merges two existing pages — `Compass.jsx` (~1,292 lines) and `Library.jsx` (~999 lines) — into a single page that lives at `/results`. The resulting page renders the full radar chart with compare panel at top, then the library (pill strip, search, topic cards) below. `/library` becomes a redirect to `/results`.

Both pages already share the same `CompassContext` for global state (`topics`, `selectedTopics`, `answers`, `setAnswers`, `writeIns`, `setWriteIns`, `invertedSpokes`, `isLoggedIn`). The primary merge challenge is that Library has its own local state (`answeredTopicIDs`, `answeredLoaded`) that powers the green checkmark on topic cards and the "calibrated" badge logic — this state is derived from a full `/compass/answers` API call that Compass.jsx does NOT make. Compass.jsx fetches answers on a per-topic-id batch basis only. The merge must preserve the full-answer-fetch that Library needs.

The calibration trigger is the most delicate part. Today, Library navigates to `/results` and sets `sessionStorage` flags which Compass reads on mount. Since the merged page IS `/results`, we can call calibration state setters directly without any navigation or sessionStorage. The new lens icon badges (Local = green house, Judicial = orange gavel) that live in the compass top-left corner will call `setSelectedTopics([])` + `setStartWithLocalLens(true)` / `setStartWithJudicialLens(true)` + `setCalibrationActive(true)` directly, bypassing sessionStorage entirely.

**Primary recommendation:** Create a new `CombinedPage.jsx` by transplanting Library's full component body into Compass's component body below the radar chart section, unifying the two `useEffect` answer-fetch patterns, and replacing all `navigate("/results")` calls within the merged file with direct state setter calls.

---

## Standard Stack

No new libraries needed. The merge uses existing dependencies only.

### Core (already installed)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `@dnd-kit/core` | existing | DnD for pill strip | Already in Library.jsx |
| `@dnd-kit/sortable` | existing | `SortableContext`, `arrayMove` | Already in Library.jsx |
| `@dnd-kit/modifiers` | existing | `restrictToHorizontalAxis` | Already in Library.jsx |
| `@dnd-kit/utilities` | existing | `CSS.Translate` | Already in Library.jsx |
| `react-router` | existing | `useNavigate`, `useLocation` | Already in both |
| `@empoweredvote/ev-ui` | existing | `TopicTierBadge`, `useEvContextPromotion` | Both pages use |

**Installation:** None required.

---

## Architecture Patterns

### Recommended File Structure

The merge should produce a **single new file** rather than modifying one page to absorb the other. This reduces merge conflict risk and makes the diff reviewable.

```
src/pages/
├── CombinedPage.jsx     ← NEW: merged Compass + Library
├── Compass.jsx          ← keep untouched until redirect confirmed working
├── Library.jsx          ← keep untouched until redirect confirmed working
└── ...

src/App.jsx
├── / → CombinedPage (or keep Library until fully replaced)
├── /library → Navigate to /results
├── /results → CombinedPage (replaces Compass key={compassVersion})
```

### Pattern 1: Direct Calibration Trigger (no sessionStorage)

**What:** Lens icon badges call calibration state setters directly rather than setting sessionStorage and navigating.

**Current Library flow (to be replaced):**
```jsx
// Library.jsx lines 409-420 — OLD, uses navigate
const doStartLocalLens = () => {
  setSelectedTopics([]);
  localStorage.removeItem("comparePolitician");
  sessionStorage.setItem("start_local_lens", "1");
  navigate("/results");  // ← triggers Compass mount which reads sessionStorage
};
```

**New flow in CombinedPage (direct state setters):**
```jsx
// CombinedPage.jsx — NEW, direct call
const doStartLocalLens = () => {
  setSelectedTopics([]);
  localStorage.removeItem("comparePolitician");
  setComparePol(null);
  setCompareAnswers({});
  setStartWithLocalLens(true);
  setCalibrationActive(true);
};

const doStartJudicialLens = () => {
  setSelectedTopics([]);
  localStorage.removeItem("comparePolitician");
  setComparePol(null);
  setCompareAnswers({});
  setStartWithJudicialLens(true);
  setCalibrationActive(true);
};
```

**Why this works:** `showCalibration = calibrationActive` (Compass.jsx line 413). Setting `calibrationActive = true` immediately renders `<CalibrationOverlay>`. `startWithLocalLens` / `startWithJudicialLens` are already props on CalibrationOverlay.

**Critical:** `calibrationSkipped` and `calibrationCompleted` guards are bypassed when `setCalibrationActive(true)` is called directly (see Compass.jsx line 354-357: `calibrationActive` initial state only checks sessionStorage flags and localStorage progress). The existing `handleStartCalibration()` helper at line 424 does the right full-reset pattern — lens triggers should do the same but also set the lens flag.

### Pattern 2: answeredTopicIDs Unification

**What:** Library maintains a local `answeredTopicIDs` state (array of topic IDs with ANY answer, not just compass topics). This is used for the green checkmark on topic cards. Compass.jsx does NOT have this — it only knows about answers for `selectedTopics`.

**Resolution:** Keep `answeredTopicIDs` as local state in CombinedPage. The full `/compass/answers` API fetch (Library.jsx lines 121-161) MUST be preserved in the merged component. This fetch:
1. Sets `answeredTopicIDs` (for tile checkmarks)
2. Populates `answers` in CompassContext (so the compass preview was accurate in Library)
3. Populates `writeIns` in CompassContext

The Compass's existing batch fetch (`/compass/answers/batch`) at lines 750-795 is redundant for topics already loaded by the full fetch, but the `setAnswers` call in both uses `if (next[key] == null) next[key] = val` (no-overwrite pattern), so running both is safe.

**Merged fetch strategy:** Run the full `/compass/answers` fetch on mount (from Library), which populates both `answeredTopicIDs` AND pre-populates `answers` for compass rendering. The batch fetch on selectedTopics change still runs but mostly hits the cache.

### Pattern 3: handleCalibrateClick in the Merged Page

**What:** Library's `handleCalibrateClick` (lines 303-310) currently navigates to `/results`. In the merged page, it must open CalibrationOverlay directly.

**Current:**
```jsx
const handleCalibrateClick = (e, topic) => {
  e.stopPropagation();
  if (!selectedTopics.includes(topic.id) && selectedTopics.length < MAX_TOPICS) {
    setSelectedTopics(prev => [...prev, topic.id]);
  }
  sessionStorage.setItem("start_resume_calibration", "1");
  navigate("/results");  // ← must change
};
```

**New (in CombinedPage):**
```jsx
const handleCalibrateClick = (e, topic) => {
  e.stopPropagation();
  if (!selectedTopics.includes(topic.id) && selectedTopics.length < MAX_TOPICS) {
    setSelectedTopics(prev => [...prev, topic.id]);
  }
  // No navigate — open overlay directly
  setStartResumeCalibration(true);
  setCalibrationActive(true);
};
```

### Pattern 4: Lens Icon Badges on Compass (New UI)

**What:** Two small icon badges sit in the top-left corner of the compass container (overlaid on the radar chart div). They are purely new UI — not a migration of existing elements.

**Placement:** Inside the `relative` div that wraps RadarChart (the same div that already has the `?` info button top-right and the Min/Max buttons top-right). Add to top-left:

```jsx
{/* Lens icon badges — top-left of compass area */}
<div className="absolute top-2 left-2 z-10 flex gap-1.5">
  <button
    onClick={doStartLocalLens}
    title="Local Lens — housing, safety, local gov"
    className="w-7 h-7 rounded-full flex items-center justify-center text-white transition-opacity hover:opacity-80"
    style={{ background: LOCAL_LENS.color }}  // #5A9A6E
  >
    {/* house SVG icon */}
  </button>
  <button
    onClick={doStartJudicialLens}
    title="Judicial Lens — courts, bail, prosecution"
    className="w-7 h-7 rounded-full flex items-center justify-center text-white transition-opacity hover:opacity-80"
    style={{ background: JUDICIAL_LENS.color }}  // #C2440A
  >
    {/* gavel SVG icon */}
  </button>
</div>
```

**Note:** Tooltip behavior is handled by the `title` attribute. If richer tooltips are needed, the existing `CoachMark` component is available but probably overkill for hover labels.

### Pattern 5: Page Layout Structure (Merged)

**Desktop layout:**
```
┌──────────────────────────────────────────────────┐
│  [Compass Section — full width max-w-[1400px]]   │
│  ┌─────────────────────────┐  ┌────────────────┐ │
│  │  RadarChart (flex-[3])  │  │ ComparePanel   │ │
│  │  [lens badges top-left] │  │ (flex-[1])     │ │
│  │  [? info top-right]     │  │                │ │
│  │  [Min/Max top-right]    │  │                │ │
│  └─────────────────────────┘  └────────────────┘ │
├──────────────────────────────────────────────────┤
│  [Pill Strip — full width, below compass]        │
├──────────────────────────────────────────────────┤
│  [Search bar — full width]                       │
├──────────────────────────────────────────────────┤
│  [Category grid of topic cards]                  │
└──────────────────────────────────────────────────┘
```

**Mobile layout:** Same vertical stack. Compass section uses the existing mobile tab bar (Compare/Graph tabs) for the chart. Pill strip and topic cards are always visible below.

### Pattern 6: "Back to Library" Button Removal

The current Compass.jsx has a "Back to Library" button (lines 1012-1022) that navigates to `/library`. In the merged page this button is pointless (you're already on the page that IS the library). Remove it. The tour step that referenced `backToLibRef` (tour step 3) should be updated or dropped.

### Anti-Patterns to Avoid

- **Don't merge by copy-pasting one component inside the other's JSX return.** The two components share `topics`, `answers` etc. from context but both do independent API calls and have independent lifecycle effects. Merge the component bodies (hooks + handlers + return).
- **Don't remove the answeredTopicIDs local state.** It is needed for topic card checkmarks even though `answers` in context is available. The `answeredTopicIDs` array represents the full history of ALL answers (not just selected topics), while `answers` in context is only populated for `selectedTopics` batch-fetch.
- **Don't clear answeredTopicIDs when doing a lens switch.** The lens switch clears `selectedTopics` but should not clear `answeredTopicIDs` — users' past answers should still show as green checkmarks on tiles.
- **Don't duplicate the DnD pill strip.** Library currently renders two pill strips conditionally: one in the hero (when `showCompass`) and one in the topic section (when `!showCompass`). In the merged page, the pill strip lives permanently below the compass (one location only).
- **Don't keep the Library hero section.** The entire conditional hero (onboarding/lens explainer/compass preview at Library.jsx lines 452-763) is REPLACED by the actual compass at the top. The onboarding screen for new users is replaced by the `BuildCompassPrompt` from Compass.jsx.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-and-drop pill reorder | Custom drag logic | `@dnd-kit` (already used) | Already in Library.jsx with full touch support |
| Tooltip on lens badges | Custom tooltip component | HTML `title` attribute | Sufficient for icon-only buttons; CoachMark is overkill |
| Sorted topic list | Custom sort | `arrayMove` from `@dnd-kit/sortable` (already used) | Already wired in `handlePillDragEnd` |
| Calibration state machine | New reducer | Existing `calibrationActive`, `startWithLocalLens`, etc. state vars | All the state machinery exists in Compass.jsx — just call the setters |

---

## Common Pitfalls

### Pitfall 1: Calibration Auto-Trigger Fighting Lens Trigger

**What goes wrong:** Compass.jsx has a `useEffect` (lines 406-410) that auto-sets `calibrationActive = true` whenever `!showChart && !calibrationActive && !calibrationSkipped`. If the merged page renders the library section AND the user has no answered topics, this effect fires and opens CalibrationOverlay before the user even touches a lens button.

**Why it happens:** The original Compass.jsx was a dedicated compass page — auto-triggering calibration was correct behavior there. In the merged page, the library section is visible first, so the user should be able to browse before calibrating.

**How to avoid:** The `calibrationSkipped` flag must be trusted here. When the user has no answers and visits `/results`, they will hit this auto-trigger. The existing `calibrationSkipped` localStorage key is the gate. Consider whether the merged page should still auto-trigger calibration on arrival for brand-new users (probably yes, this is intentional UX) or whether the new design uses the library section as the entry point instead.

**Warning signs:** Calibration overlay opening immediately on page load for new users even when the intent is to show the library first.

### Pitfall 2: Two drawerTopic States Colliding

**What goes wrong:** Both Compass.jsx and Library.jsx have separate `const [drawerTopic, setDrawerTopic] = useState(null)` and separate `<LibraryDrawer>` renders. If you blindly merge both, you get two `LibraryDrawer` components and two `drawerTopic` states.

**How to avoid:** Merge into one `drawerTopic` state and one `<LibraryDrawer>` render at the bottom of the JSX. The Compass's `handleSpokeClick` and the Library's tile calibrate button both need to use the same `setDrawerTopic`.

### Pitfall 3: handleDrawerSelect answeredTopicIDs Update

**What goes wrong:** Library's `handleDrawerSelect` (lines 324-342) updates `answeredTopicIDs` local state when an answer is saved. Compass's `handleDrawerSelect` (lines 819-834) does NOT update `answeredTopicIDs` because Compass doesn't have that state. In the merged file, the single `handleDrawerSelect` must include the `answeredTopicIDs` update.

**How to avoid:** Use Library's version of `handleDrawerSelect` as the base (it does both the answer save AND the `answeredTopicIDs` update).

### Pitfall 4: Library chartData vs Compass chartData Cap

**What goes wrong:** Library.jsx has `chartData` capped at 8 topics (`selectedTopics.slice(0, 8)`), while Compass.jsx has no slice cap. This was intentional in Library (preview only), but in the merged page all topics are displayed on the actual compass.

**How to avoid:** Use Compass.jsx's `chartData` pattern (no slice cap, includes all selectedTopics), not Library's sliced version. Delete Library's `chartData` and `unansweredSpokesMap` — keep Compass's versions.

### Pitfall 5: SortableTopicPill onMouseEnter/onMouseLeave

**What goes wrong:** Library's `SortableTopicPill` includes `onMouseEnter` and `onMouseLeave` props (for `hoveredPillShortTitle` which highlights a spoke in the preview chart). In the merged page, the spoke highlight on hover feature connects pill hover to the actual radar chart. This is a GOOD thing to keep — ensure the `highlightedSpoke` prop is passed to `RadarChart` in the merged layout.

**Check:** `RadarChart` already accepts a `highlightedSpoke` prop (Library.jsx line 597 passes it). Confirm `RadarChartCore` in ev-ui supports this prop — it is already used in Library.jsx so it works.

### Pitfall 6: Tour Step 3 References "Back to Library" Button

**What goes wrong:** Compass.jsx's post-calibration tour step 3 (`tourMessages[3]`) says "Add or change topics anytime from the Library" and targets `backToLibRef`. In the merged page, there is no back button. The coach mark will have a null target ref, causing it to render at a fallback position (or crash depending on CoachMark implementation).

**How to avoid:** Update tour step 3 to either: (a) point at the pill strip area, (b) point at the search bar, or (c) remove the step and renumber from 5 to 4 steps. Also update `tourMessages[3]` text.

### Pitfall 7: compassVersion Key on Route

**What goes wrong:** App.jsx renders `<Compass key={compassVersion} />` — the `compassVersion` key from CompassContext forces a full remount on compass resets. In the merged page, this remount would also destroy the library section's local state (search text, answeredTopicIDs). 

**How to avoid:** The `compassVersion` key should be removed or reconsidered. Check CompassContext for when `compassVersion` increments — it may be tied to the restore-stances flow. If the remount must stay, `answeredTopicIDs` and `search` need to survive (either lift to context or use a stable key strategy).

### Pitfall 8: /library Route in GUARD_BYPASS

**What goes wrong:** App.jsx GUARD_BYPASS (line 19) includes both `/results` and `/library`. When `/library` becomes a `<Navigate to="/results" />`, the guard bypass for `/library` becomes irrelevant but harmless. However, if `/library` is removed from GUARD_BYPASS after adding the redirect, requests to `/library` could briefly be intercepted by HelpGuard before the redirect executes.

**How to avoid:** Keep `/library` in GUARD_BYPASS even after converting the route to a redirect. Alternatively, keep the Library route rendering `<Navigate to="/results" replace />` inside the HelpGuard wrapper, which is fine.

---

## Code Examples

### Lens Badge Click Handler (Direct Calibration Trigger)

```jsx
// Source: direct reading of Compass.jsx lines 354-357, 424-431 + Library.jsx lines 409-420
// Pattern: bypass sessionStorage, call state setters directly
const doStartLocalLens = () => {
  // 1. Clear current compass topics (lens is mutually exclusive)
  setSelectedTopics([]);
  // 2. Clear any active comparison (prevents stale compare-spoke replacements)
  localStorage.removeItem("comparePolitician");
  setComparePol(null);
  setCompareAnswers({});
  setCompareDisplayTopics(null);
  setCompareReplacedSpokes({});
  // 3. Reset calibration flags so overlay doesn't think it's a resume
  localStorage.removeItem("calibration_skipped");
  localStorage.removeItem("calibration_completed");
  setCalibrationSkipped(false);
  setCalibrationCompleted(false);
  setStartAtPick(false);
  // 4. Set lens flag and open overlay
  setStartWithLocalLens(true);
  setStartWithJudicialLens(false);
  setCalibrationActive(true);
};
```

### answeredTopicIDs Fetch (Preserve from Library.jsx)

```jsx
// Source: Library.jsx lines 110-161
// This full fetch MUST be preserved in CombinedPage — Compass's batch fetch
// doesn't populate answeredTopicIDs or pre-load non-selected-topic answers.
useEffect(() => {
  if (!isLoggedIn) {
    const cur = answersRef.current;
    const localAnswerIds = topics
      .filter(t => cur[t.short_title] != null && cur[t.short_title] > 0)
      .map(t => t.id);
    setAnsweredTopicIDs(localAnswerIds);
    setAnsweredLoaded(true);
    return;
  }

  apiFetch('/compass/answers')
    .then((res) => { if (!res || !res.ok) throw new Error("Failed"); return res.json(); })
    .then((data) => {
      setAnsweredTopicIDs(data.map(a => a.topic_id));
      // Also pre-populate answers + writeIns in context (so compass renders immediately)
      const answerEntries = data.map(a => {
        const topic = topicsRef.current.find(t => t.id === a.topic_id);
        if (!topic) return null;
        return [topic.short_title, a.value];
      }).filter(Boolean);
      if (answerEntries.length) setAnswers(prev => ({ ...prev, ...Object.fromEntries(answerEntries) }));
      // ... writeIns similarly
      setAnsweredLoaded(true);
    })
    .catch(() => { /* fallback to local state */ setAnsweredLoaded(true); });
}, [isLoggedIn, topics]);
```

### Unified handleDrawerSelect (Library version is correct base)

```jsx
// Source: Library.jsx lines 324-342 — use this version, not Compass's
// Because it updates answeredTopicIDs which Compass's version omits.
const handleDrawerSelect = async (topic, stanceValue) => {
  setAnswers(prev => ({ ...prev, [topic.short_title]: stanceValue }));
  setWriteIns(prev => { const u = { ...prev }; delete u[topic.short_title]; return u; });
  // KEY: update answeredTopicIDs so tile checkmark appears immediately
  if (!answeredTopicIDs.includes(topic.id)) {
    setAnsweredTopicIDs(prev => [...prev, topic.id]);
  }
  if (isLoggedIn) {
    try {
      await apiFetch('/compass/answers', {
        method: "POST",
        body: JSON.stringify({ topic_id: topic.id, value: stanceValue }),
      });
    } catch {}
  }
};
```

### App.jsx Routing Change

```jsx
// Source: App.jsx lines 78-110 — changes needed:
// 1. Add /library → Navigate redirect
// 2. Change /results to use CombinedPage instead of Compass
// 3. / route can stay as Library or also redirect — TBD

// New /library route:
<Route
  path="/library"
  element={<Navigate to="/results" replace />}
/>

// New /results route:
<Route
  path="/results"
  element={
    <HelpGuard>
      <Layout><CombinedPage key={compassVersion} /></Layout>
    </HelpGuard>
  }
/>
```

---

## State Inventory for Merged Component

### From Compass.jsx (keep all)
- `comparePol`, `setComparePol`
- `compareDisplayTopics`, `setCompareDisplayTopics`
- `compareReplacedSpokes`, `setCompareReplacedSpokes`
- `calibrationSkipped`, `setCalibrationSkipped`
- `calibrationCompleted`, `setCalibrationCompleted`
- `startWithLocalLens`, `setStartWithLocalLens`
- `startWithJudicialLens`, `setStartWithJudicialLens`
- `startResumeCalibration`, `setStartResumeCalibration`
- `startAllTopics`, `setStartAllTopics`
- `calibrationActive`, `setCalibrationActive`
- `tourStep`, `setTourStep`
- `compareTourStep`, `setCompareTourStep`
- `drawerTopic`, `setDrawerTopic`
- `compareMode`, `setCompareMode`
- `dropdownValue`, `setDropdownValue`
- `selectedTab`, `setSelectedTab`
- `bgStyle`, `setBgStyle`
- `startAtPick`, `setStartAtPick`

### From Library.jsx (keep all)
- `selectedLens`, `setSelectedLens` — used by lens explainer modal; in new design, lens icon click bypasses selectedLens and directly opens CalibrationOverlay — but `selectedLens` state may still be useful for showing "active lens" UI
- `search`, `setSearch`
- `answeredTopicIDs`, `setAnsweredTopicIDs` — critical for tile checkmarks
- `answeredLoaded`, `setAnsweredLoaded`
- `hoveredPillShortTitle`, `setHoveredPillShortTitle`
- `libTourStep`, `setLibTourStep`

### From Library.jsx (can remove/simplify)
- `drawerTopic` — MERGE with Compass's drawerTopic (one state)
- `selectedLens` as navigation state — new lens icon UX doesn't use explainer modal
- Library's `chartData`, `unansweredSpokesMap` — DELETE; use Compass's versions (no slice cap)
- Library's `handleDrawerSelect`, `handleDrawerWriteIn`, `handleDrawerCancelWriteIn` — MERGE with Compass versions (use Library's as base, add compare-answers logic from Compass's version if needed)

---

## Open Questions

1. **Should the merged page still auto-trigger calibration on arrival for brand-new users?**
   - What we know: Compass.jsx has a `useEffect` that auto-opens CalibrationOverlay when `!showChart && !calibrationActive && !calibrationSkipped` (lines 406-410).
   - What's unclear: In the new combined design, should new users see the library first and choose a lens, or should they still be immediately taken into calibration?
   - Recommendation: Preserve the auto-trigger. The onboarding CTA buttons (doStartLocalLens etc.) are now lens icon clicks in the compass area OR the existing Library onboarding CTAs can be removed in favor of the new lens badges. If auto-trigger is removed, the compass area will show `BuildCompassPrompt` which already has "Start building" CTA.

2. **What happens to Library's lens explainer modal on the merged page?**
   - What we know: Library has a full `selectedLens` state + explainer modal (hero section, lines 455-577). The new design replaces this with icon badges in the compass corner.
   - What's unclear: Should the explainer be kept as a tooltip/popover, or removed entirely since clicking the lens badge directly starts calibration?
   - Recommendation: Remove the explainer modal. The lens icon badge has a `title` attribute tooltip. Users can learn what the lens does from the CalibrationOverlay welcome screen which already shows lens context.

3. **compassVersion key behavior with merged component**
   - What we know: `compassVersion` from CompassContext is used as a key on the Compass route (App.jsx line 107). This forces full remount on "restore stances" flow.
   - What's unclear: How often does compassVersion increment? Is it safe to keep this key on CombinedPage?
   - Recommendation: Check CompassContext for when compassVersion increments. If it's only on explicit restore-stances flow, keep the key. Note that the remount will reset `search` (acceptable) and `answeredTopicIDs` (triggers a re-fetch, acceptable).

4. **Library tour (libTourStep) in merged page**
   - What we know: Library has a 2-step coach mark tour (step 0: first tile, step 1: local lens button ref `localLensRef`). Step 1 targets `localLensRef` which was a lens CTA button in the hero section.
   - What's unclear: Where is `localLensRef` in the merged page? The CTA buttons are replaced by icon badges in the compass corner.
   - Recommendation: Update `localLensRef` to point to the Local Lens icon badge in the compass top-left corner.

---

## Sources

### Primary (HIGH confidence)
- `src/pages/Compass.jsx` — full file read (lines 1-1292), direct source
- `src/pages/Library.jsx` — full file read (lines 1-999), direct source
- `src/lib/lenses.js` — full file read, direct source
- `src/App.jsx` — full file read, direct source
- `src/components/CalibrationOverlay.jsx` — lines 1-80 read for prop interface

---

## Metadata

**Confidence breakdown:**
- Merge strategy: HIGH — derived from reading exact source code
- Calibration trigger pattern: HIGH — exact state variable names and setter calls confirmed
- answeredTopicIDs unification: HIGH — both fetch paths read and compared
- Layout structure: HIGH — existing JSX layout read directly
- Pitfalls: HIGH — each one traced to specific line numbers in source

**Research date:** 2026-05-14
**Valid until:** 2026-06-14 (stable codebase; re-research if major refactor occurs)
