---
phase: "01"
plan: "01-01"
name: "create-combined-page"
subsystem: "pages"
tags: ["react", "compass", "library", "dnd-kit", "calibration", "lenses"]

dependency-graph:
  requires: []
  provides: ["src/pages/CombinedPage.jsx"]
  affects: ["01-02 (App.jsx routing update)"]

tech-stack:
  added: []
  patterns:
    - "Unified page component merging two route-level components"
    - "Direct state-setter lens triggers (no sessionStorage/navigate)"
    - "Single answeredTopicIDs fetch effect for library grid checkmarks"

key-files:
  created:
    - src/pages/CombinedPage.jsx
  modified: []

decisions:
  - id: "D1"
    description: "doStartLocalLens and doStartJudicialLens call state setters directly instead of writing sessionStorage + navigating. This works because we are already on the combined page."
  - id: "D2"
    description: "handleCalibrateClick opens LibraryDrawer directly (setDrawerTopic) instead of navigate('/results'). Topic is added to selectedTopics if room."
  - id: "D3"
    description: "onSkip handler removes the navigate('/library') line from Compass.jsx — not needed since library is rendered below on the same page."
  - id: "D4"
    description: "Tour step 3 message changed to 'Scroll down to add or change topics from the library below' since there is no separate library page to navigate to."
  - id: "D5"
    description: "Lens icon badges added to mobile Graph tab in addition to desktop — both render when showChart is true so both viewports get the lens shortcuts."

metrics:
  duration: "~35 minutes"
  completed: "2026-05-14"
  tasks-completed: 2
  tasks-total: 2
---

# Phase 01 Plan 01: Create Combined Page Summary

**One-liner:** CombinedPage.jsx merges Compass.jsx + Library.jsx into a single unified route with radar chart, compare panel, and full topic library — lens triggers use direct React state setters instead of sessionStorage+navigate.

## What Was Built

`src/pages/CombinedPage.jsx` — a 1,816-line React component that:

1. **Compass section (top):** Full radar chart, compare panel, legend, mobile tab bar, Min/Max stance buttons, lens icon badges (green house = Local Lens, orange gavel = Judicial Lens) in the chart's top-left corner.

2. **Library section (below compass):** Draggable pill strip (always visible, no `showCompass` condition), search bar, topic cards grid with calibrate buttons that open the drawer directly, green checkmarks for answered topics.

3. **CalibrationOverlay:** Shown when `showCalibration === true`. The `onSkip` handler no longer navigates anywhere — the library is right below.

4. **Single LibraryDrawer** instance with full `onRemoveFromCompass` handler.

5. **Tour system:** Post-calibration 5-step tour, compare deep-dive tour, library coach mark tour — all intact. Tour step 3 message updated to reference scrolling down.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | State and logic layer — all state, effects, handlers, derived state | 9f05b80 |
| 2 | JSX return — compass section, lens badges, library section | 9f05b80 |

Note: Both tasks were implemented in a single commit since Task 2 (JSX) was a direct continuation of Task 1 (logic) with no natural split point.

## Verification Results

1. `npm run build` — success, no errors from CombinedPage.jsx (only pre-existing chunk size warning)
2. `setCalibrationActive(true)` appears in both `doStartLocalLens` and `doStartJudicialLens`
3. `setAnsweredTopicIDs` appears in `handleDrawerSelect` body (updates answeredTopicIDs on answer)
4. `drawerTopic` declared exactly once (line 676)
5. No `navigate("/library")` or `navigate("/results")` calls in CombinedPage.jsx
6. No `sessionStorage.setItem("start_local_lens")` or `sessionStorage.setItem("start_judicial_lens")`

## Deviations from Plan

### Auto-added

**[Rule 2 - Missing] Lens badges on mobile Graph tab**

- **Found during:** Task 2 (JSX — mobile tab 1 section)
- **Issue:** Plan specified lens badges for desktop chart only; mobile Graph tab shows the chart but had no lens shortcuts
- **Fix:** Added identical lens badge buttons inside the mobile tab 1 chart wrapper, guarded by `{showChart &&`
- **Files modified:** src/pages/CombinedPage.jsx

All other work executed exactly as specified in the plan.

## Next Phase Readiness

- **01-02 (App.jsx routing):** Ready. CombinedPage.jsx exports default `CombinedPage` and is at `src/pages/CombinedPage.jsx`. App.jsx currently routes `/` to Library and `/results` to Compass — 01-02 will wire `/` (and optionally `/results`) to `<CombinedPage />`.
- **No blockers or concerns.**
