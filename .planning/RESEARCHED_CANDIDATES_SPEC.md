# Backend Spec: Researched Candidate Stances in Compass Compare

**Feature:** Allow candidates whose positions have been researched by the EV team to appear
in the compass compare picker — without requiring those candidates to have an Empowered account.

**Status:** Revised — original spec routed through `staging.stances` (unnecessary).
Actual pipeline writes directly to `inform.politician_answers`, same as incumbents.

---

## How candidate stances actually reach the DB

The EV research team produces approved CSVs that are imported via `apply-*.ts` scripts in
`backend/scripts/`. These scripts write directly to `inform.politician_answers` — the same
table used for incumbent stances. No `staging.stances` approval gate is needed because the
research is already verified before the script is written.

Example scripts (all unrun as of 2026-05-15, all targeting `politician_answers`):
- `apply-malik-stances.ts` — Faizah Malik, LA City Council D11
- `apply-cd1-challengers-stances.ts` — 3 CD1 challengers
- ~24 additional scripts covering the full LA council candidate slate (May 7–8)

---

## Required backend changes

### 1. Run the ingest scripts

All pending `apply-*.ts` scripts in `backend/scripts/` need to be executed to populate
`inform.politician_answers` for the researched candidates.

---

### 2. Extend `getCandidates()` — second path via `politician_answers`

Today `getCandidates()` only counts answers via the Empowered account chain:

```
Path A (self-reported):
  race_candidates → empower.empowered_profiles → inform.compass_responses
```

Add a second path:

```
Path B (researched):
  race_candidates → inform.politician_answers
    WHERE politician_id = race_candidates.politician_id
      AND status = 'approved'
```

A candidate appears in the list if they have answers via **either** path. Use Path A if
`empowered_profiles` exists; fall back to Path B if it doesn't.

Updated filter for `GET /compass/politicians?include_candidates=true`:

```sql
AND (
  -- Path A: Empowered account with answers
  EXISTS (
    SELECT 1 FROM empower.empowered_profiles ep
    JOIN inform.compass_responses cr ON cr.user_id = ep.user_id
    WHERE ep.politician_id = rc.politician_id
      AND cr.deleted_at IS NULL AND cr.value != 0
  )
  OR
  -- Path B: Approved researched stances in politician_answers
  EXISTS (
    SELECT 1 FROM inform.politician_answers pa
    WHERE pa.politician_id = rc.politician_id
      AND pa.status = 'approved'
  )
)
```

Add `stance_source: 'empowered' | 'researched'` to each candidate record so the frontend
can badge researched candidates appropriately (optional but useful).

**Deduplication against incumbents:** exclude a candidate record when the same politician
already appears as a qualifying incumbent (active + has answers). The correct guard uses
`essentials.politicians` (not `inform.politicians`) and mirrors the full incumbent condition
so a politician with a row but no stances still surfaces as a candidate:

```sql
AND NOT EXISTS (
  SELECT 1 FROM essentials.politicians p
  WHERE p.id = rc.politician_id
    AND p.status = 'active'
    AND EXISTS (
      SELECT 1 FROM inform.politician_answers pa2
      WHERE pa2.politician_id = p.id AND pa2.status = 'approved'
    )
)
```

Shipped in accounts commit 4c36c81.

---

### 3. Extend `getCandidateAnswers()` — same fallback

`GET /compass/candidates/:candidateId/answers` currently:
1. Looks up `politician_id` from `race_candidates`
2. Finds `user_id` via `empowered_profiles`
3. Returns from `compass_responses`

Extend to fall back to `politician_answers` when no `empowered_profiles` row exists:

```
1. SELECT politician_id FROM race_candidates WHERE id = :candidateId
2. Try Path A: SELECT user_id FROM empowered_profiles WHERE politician_id = ?
   → If found: return from compass_responses (existing behavior)
3. Try Path B: SELECT topic_id, value FROM politician_answers
               WHERE politician_id = ? AND status = 'approved'
   → If found: return those rows
4. Neither path → 404
```

Response shape is identical for both paths:
```ts
Array<{ topic_id: string, value: number }>
```

---

## What the frontend already does (no changes needed)

- `GET /compass/politicians?include_candidates=true` — fetches candidate list including
  `is_candidate: true` records
- Candidates with `is_candidate: true` get a "Candidate" badge in the picker
- Answer fetch routes to `/compass/candidates/:id/answers` for candidates
- Context endpoint 404s are silently ignored (candidates have no curated reasoning yet)

---

## What needs to happen before Faizah appears

| # | Task | Who |
|---|------|-----|
| 1 | Run all pending `apply-*.ts` scripts in `backend/scripts/` | Accounts |
| 2 | Extend `getCandidates()` to check `politician_answers` as Path B | Accounts |
| 3 | Extend `getCandidateAnswers()` with the same fallback | Accounts |

Once steps 1–3 are done, researched candidates appear in the picker with a "Candidate" badge
and their answers are returned by the updated answers endpoint.

---

## Note on `staging.stances`

The original spec proposed routing through `staging.stances` as a fallback. That table exists
for raw/unverified research that needs an approval workflow. It is **not** the right path here —
the `apply-*.ts` scripts represent already-approved research going straight to `politician_answers`.
No changes to the CompassV2 frontend are needed for the `staging.stances` path.
