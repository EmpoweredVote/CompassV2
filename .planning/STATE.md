# Project State

## Current Status
- **Active Phase:** 01 — Combined Compass+Library Page
- **Milestone:** EV-Compass V2 Feature Development
- **Phase:** 01 of 1 (Combined Compass+Library Page)
- **Plan:** 01-01 complete (1 of 2 plans in phase)
- **Status:** In progress
- **Last activity:** 2026-05-14 — Completed 01-01-PLAN.md (create-combined-page)

**Progress:** █░ (1/2 plans complete in phase 01)

## Decisions Made
- Go backend retired; all backend work in EV-Accounts (master branch)
- Frontend: React + Vite + Tailwind, routing via React Router v7
- UI library: @empoweredvote/ev-ui (published to npm)
- State management: CompassContext (React Context)
- Auth: SSO cookie + JWT hash token, guest mode with localStorage fallback
- Lenses: LOCAL_LENS and JUDICIAL_LENS defined in src/lib/lenses.js
- Dark/light mode via ThemeProvider
- **[01-01/D1]** doStartLocalLens/doStartJudicialLens use direct state setters — no sessionStorage, no navigate
- **[01-01/D2]** handleCalibrateClick opens LibraryDrawer directly (setDrawerTopic), no navigate('/results')
- **[01-01/D3]** onSkip handler removes navigate('/library') — library is on same page now
- **[01-01/D4]** Tour step 3 message: "Scroll down to add or change topics from the library below"

## Technology Stack
- React 18, Vite, Tailwind CSS
- React Router v7
- @dnd-kit (drag and drop)
- @empoweredvote/ev-ui (radar chart, header, TopicTierBadge)
- react-spring (chart animations, inside ev-ui)

## Key Files
- src/pages/CombinedPage.jsx — NEW unified page (1,816 lines)
- src/pages/Compass.jsx — legacy compass page (to be replaced by App.jsx routing in 01-02)
- src/pages/Library.jsx — legacy library page (to be replaced by App.jsx routing in 01-02)
- src/lib/lenses.js — LOCAL_LENS and JUDICIAL_LENS definitions
- src/components/CompassContext.jsx — global state
- src/components/CalibrationOverlay.jsx — calibration flow
- src/components/ComparePanel.jsx — politician comparison
- src/components/RadarChart.jsx — chart wrapper
- src/App.jsx — routing (next: 01-02 wires / to CombinedPage)

## Session Continuity
- **Last session:** 2026-05-14
- **Stopped at:** Completed 01-01-PLAN.md
- **Resume file:** None
- **Next plan:** 01-02 — Update App.jsx routing to wire / (and /results) to CombinedPage
