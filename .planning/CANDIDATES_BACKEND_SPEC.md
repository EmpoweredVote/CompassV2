# Backend Spec: Candidates in Compass Compare Picker

**Feature:** Add an "Include candidates" checkbox to the compass politician picker so users can
compare their compass positions against people running for office (not just sitting incumbents).

**Example use case:** Marissa Roy is running for LA County Attorney but holds no current seat.
She would not appear in the compass picker today. With the checkbox checked, she should appear.

**Status:** Reviewed by accounts Claude — corrections applied 2026-05-14.

---

## Context: How the compare picker works today

1. `GET /compass/politicians` — returns a flat list of active officeholders from `inform.politicians`
2. Frontend picker filters by level (Federal/State/Local) and state, then searches by name
3. When a user selects someone, `GET /compass/politicians/:id/answers` is called to fetch all of
   their positions as `[{ topic_id: uuid, value: number }]`
4. The frontend builds a side-by-side comparison using that answer array
5. Optionally, `GET /compass/politicians/:id/:topicId/context` is called for reasoning + sources
   on a specific topic

Candidates need to slot into this same flow. The frontend is built to consume the same shape;
it just needs the data to exist on the backend.

---

## What "candidate" means here

A candidate is someone running for elected office in an **active** election cycle who:
- Has a row in `essentials.race_candidates` with `candidate_status = 'active'`
- Has a non-null `politician_id` linking them to `empower.empowered_profiles`
  (pure challengers with `politician_id IS NULL` have no path to compass answers — exclude them)
- Has at least one compass answer in `inform.compass_responses` via the lookup chain below

**Note:** `is_candidate` is a **computed boolean** added to the API response. It does not exist
as a column in any table — the backend sets it to `true` for all records returned via this path.

---

## Data model (corrected from initial spec)

### Source table for candidate list

```
essentials.race_candidates      ← anchor; race_candidates.id is the stable candidate UUID
  JOIN essentials.races         ← provides the seat being contested (races.position_name → office_title)
  JOIN essentials.elections     ← filter: elections.election_date >= now()
  LEFT JOIN essentials.offices  ← races.office_id is a nullable FK; must be LEFT JOIN
  LEFT JOIN essentials.districts
```

**Implementation note:** The response field `office_title` maps to `races.position_name`
(e.g. `"City Council District 3"`). Alias it in SQL: `races.position_name AS office_title`.

`race_candidates` has: `id`, `is_incumbent`, `candidate_status`, `full_name`, `first_name`,
`last_name`, `photo_url`, `focal_point`, `politician_id` (nullable).

### Lookup chain for compass answers

```
essentials.race_candidates WHERE id = :candidateId
  → JOIN empower.empowered_profiles ON empowered_profiles.politician_id = race_candidates.politician_id
  → inform.compass_responses WHERE user_id = empowered_profiles.user_id AND deleted_at IS NULL AND value != 0
```

If the `empowered_profiles` join returns nothing (candidate hasn't onboarded), return **404**.

---

## Required backend changes

### 1. Extend `GET /compass/politicians` to optionally include candidates

Add an optional query parameter:

```
GET /compass/politicians?include_candidates=true
```

When `include_candidates=true`, the response array also includes active election candidates from
`essentials.race_candidates`. Filter criteria:

- `race_candidates.candidate_status = 'active'`
- `elections.election_date >= now()`
- `race_candidates.politician_id IS NOT NULL` (must have a linkable empowered profile)
- Candidate has at least one compass answer (`answer_count > 0`)

Each candidate record uses the **same shape** as an incumbent entry, plus two new fields:

```ts
{
  // Existing politician fields (populated from race_candidates + races + offices/districts):
  id: string,                    // race_candidates.id (stable UUID — use this, not empowered_profiles.id)
  first_name: string,
  last_name: string,
  preferred_name: string | null,
  full_name: string | null,
  photo_origin_url: string | null,  // race_candidates.photo_url
  photo_custom_url: string | null,
  office_title: string,          // races.position_name aliased — e.g. "City Council District 3"
  representing_state: string,    // USPS 2-letter code from district info
  representing_city: string | null,
  district_label: string | null, // From essentials.districts
  district_type: string,         // From essentials.offices/districts: LOCAL, STATE_UPPER, JUDICIAL, etc.
  answer_count: number,          // COUNT of compass_responses rows for this candidate's user_id
  answered_topic_ids: string[],  // array_agg(topic_id) FROM compass_responses WHERE user_id = ? AND deleted_at IS NULL AND value != 0

  // New fields (computed, not DB columns):
  is_candidate: boolean,         // always true for these records
  is_incumbent: boolean,         // race_candidates.is_incumbent
}
```

Incumbents in the same response do **not** need `is_candidate`/`is_incumbent` added, but adding
them as `false`/`true` respectively would make the shape fully consistent.

### 2. New endpoint: `GET /compass/candidates/:candidateId/answers`

Lookup chain:

1. `SELECT * FROM essentials.race_candidates WHERE id = :candidateId`
2. `SELECT user_id FROM empower.empowered_profiles WHERE politician_id = race_candidates.politician_id`
3. If step 2 returns no row → **404** (candidate hasn't onboarded to Empowered)
4. `SELECT topic_id, value FROM inform.compass_responses WHERE user_id = <user_id> AND deleted_at IS NULL AND value != 0`

Response shape (same as `/compass/politicians/:id/answers`):

```ts
Array<{
  topic_id: string,   // UUID
  value: number,      // NUMERIC(3,1), range 0.5–5.5 (migration 030 constraint)
}>
```

**Auth:** Public — no PII exposed, only topic_id + numeric stance value.

### 3. Context endpoint — not required for launch

`GET /compass/politicians/:id/:topicId/context` does not need a candidate equivalent now.
The frontend already renders nothing gracefully when this returns 404. Candidates won't have
curated reasoning at launch.

---

## What the frontend will do with this (no action needed from accounts team)

Once these two endpoints exist:

1. **Checkbox in picker** — when checked, fetches `?include_candidates=true`; candidate rows
   get a small "Candidate" badge in the list and count toward Federal/State/Local filter pills
   based on their `district_type`

2. **Answer routing** — when the selected comparison person has `is_candidate: true`, the
   compare-answers effect calls `GET /compass/candidates/:id/answers` instead of
   `GET /compass/politicians/:id/answers`

3. **Context fetch** — skipped for candidates (404 silently ignored, already handled)

4. **`localStorage` persistence** — `comparePolitician` is stored by `id`; since
   `race_candidates.id` is stable, returning users will restore to the same selection

---

## Summary of endpoints

| Endpoint | Change | Priority |
|---|---|---|
| `GET /compass/politicians?include_candidates=true` | New query param; merges in active non-withdrawn candidates with `politician_id IS NOT NULL` | Required |
| `GET /compass/candidates/:candidateId/answers` | New endpoint; lookup chain race_candidates → empowered_profiles → compass_responses | Required |
| `GET /compass/politicians/:id/:topicId/context` | No change needed | N/A |
