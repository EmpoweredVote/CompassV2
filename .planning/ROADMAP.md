# EV-Compass V2 Roadmap

## Phase 01: Combined Compass+Library Page

**Goal:** Merge the Library page (/library) and Compass page (/results) into a single unified page that renders the full radar chart with compare panel at top, and the full topic library below.

**Plans:** 2 plans

**Success criteria:**
- Large radar chart + compare panel rendered at top of page
- Stance Min/Max buttons in top-right corner of compass area
- Colored Lens icon badges (Local=green house, Judicial=orange gavel) in top-left corner with tooltips
- Clicking a lens clears current topics and loads lens preset via CalibrationOverlay
- Draggable topic pill strip below compass
- Search bar + category grid of topic cards below pill strip
- Topics toggle on/off compass with purple uncalibrated badge (matching Library page style)
- /library route redirects to /results
- Full dark/light mode support
- Same header as existing pages (via Layout component)
- CalibrationOverlay wiring preserved (all sessionStorage flags still work)

**Key constraints:**
- Do NOT break CalibrationOverlay flow
- Do NOT break ComparePanel or politician comparison
- Preserve existing data fetching (answeredTopicIDs from /compass/answers)
- Keep draggable pill strip with @dnd-kit
- Lens icon click flow: set sessionStorage flag → open CalibrationOverlay on same page (no navigate)

Plans:
- [ ] 01-01-PLAN.md — Create CombinedPage.jsx (state + logic + full JSX)
- [ ] 01-02-PLAN.md — Wire App.jsx routing + human verify
