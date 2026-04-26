# CompassV2 Integration Guide

Canonical integration guide for CompassV2 frontend against the Empowered Accounts API.

## Local Development

The production frontend talks to `https://api.empowered.vote` directly, but that origin's CORS policy only allows the production domain. To unblock local development against real prod data, the Vite dev server proxies `/api/*` requests through itself to the production API:

- **`vite.config.js`** declares `server.proxy["/api"]` with `target: "https://api.empowered.vote"` and `changeOrigin: true`.
- **`src/lib/auth.js`** uses `import.meta.env.DEV` to switch `API_BASE` between `/api` (dev, routed by the proxy) and `https://api.empowered.vote/api` (prod builds, direct).

**To run locally:**

```bash
cd CompassV2
npm install
npm run dev
# open http://localhost:5173
```

No backend setup required — you're hitting real production data through the proxy. Bearer-token auth works as normal because the `Authorization` header passes through the proxy. Cookie-based flows (e.g. logout's `credentials: "include"` call) won't set cookies in dev because the upstream `Set-Cookie` headers carry `Domain=api.empowered.vote`, which the browser won't accept on `localhost` — Bearer tokens stored in `localStorage` continue to work normally.

If you ever need to point dev at a different backend (e.g. a local `ev-accounts` instance), edit the `target` in `vite.config.js`. There is currently no env-var override.

---

## 1. Quick Reference

**Base URL:**
```
Production: https://accounts.empowered.vote/api
```

**Auth Hub URL:**
```
https://accounts.empowered.vote/login?redirect={encodeURIComponent(returnUrl)}
```

### Endpoint Table

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/compass/topics | Optional | All live topics with stances |
| GET | /api/compass/categories | Optional | Categories with nested topics |
| GET | /api/compass/answers | Optional | User's own answers ([] if unauth) |
| POST | /api/compass/answers | Optional | Upsert single answer (null if unauth — not persisted) |
| POST | /api/compass/answers/batch | Optional | Batch fetch answers by topic IDs ([] if unauth) |
| GET | /api/compass/selected-topics | Optional | User's saved topic IDs ({ topic_ids: [] } if unauth) |
| PUT | /api/compass/selected-topics | Optional* | Save selected topics (not persisted if unauth; 403 NOT_CONNECTED if auth but not Connected) |
| DELETE | /api/compass/answers/me | Required | Delete all user's compass answers |
| GET | /api/compass/progress | Required | User's compass completion progress |
| GET | /api/compass/politicians | Optional | List all politicians |
| GET | /api/compass/politicians/:id/answers | Optional | Politician's stances on topics |
| GET | /api/compass/politicians/:id/:topicId/context | Optional | Politician reasoning + sources for a topic |
| GET | /api/account/me | Required | Full user profile with tier, jurisdiction, gems, XP |
| PATCH | /api/account/me | Required (Connected+) | Update profile fields |
| POST | /api/auth/complete-onboarding | Required (Connected) | Mark onboarding complete |
| POST | /api/auth/logout | Required | Invalidate session |

### Tier Summary

- **Inform (anonymous/unauthenticated):** Read all compass data. Answers POST returns null (not persisted). No progress, no deletion, no jurisdiction.
- **Connected:** Full persistence. Access to progress, answer deletion, selected-topics save, jurisdiction from /account/me.
- **Empowered:** Same as Connected for all compass features.

---

## 2. Empowered Vote Platform Overview

Empowered Vote is a civic engagement platform built on a three-tier account architecture: Inform, Connected, Empowered. Every product decision about what a user can see or do flows from which tier they occupy.

### The Three Tiers

**Inform** — unauthenticated or pre-signup.
- Can browse all public content: compass topics, stances, categories, politician data.
- Compass answers are local-only. When an Inform user POSTs an answer, the server returns `null` (acknowledged but not persisted). GET endpoints return empty arrays.
- No progress tracking, no answer deletion, no jurisdiction, no XP, no gems.

**Connected** — signed up via invite code, email verified.
- Full read/write access to all compass endpoints.
- Has a `connected_profile` row in the database. This row's presence is what makes a user Connected — there is no "tier" status flag.
- Has XP, gems (yellow/blue/red), verification rating.
- Access to jurisdiction if location consent was granted during account setup.
- Can access compass progress, delete their answers, and save selected topics.

**Empowered** — promoted from Connected. Has legal name on file, has a candidate page on the platform.
- For compass purposes, identical to Connected. All compass endpoints behave the same.
- Has an `empowered_profiles` row in addition to `connected_profiles`.
- `tier` field in /account/me returns `'empowered'`.

### Tier Detection Rule

Tier is determined by child record presence in the database:
- `connected_profiles` row exists → Connected
- `empowered_profiles` row exists → Empowered
- Neither exists → Inform

The `tier` field in the /account/me response reflects this. Use it directly — do not recompute from profile presence.

### Auth Technology

Authentication is via Supabase (PostgreSQL + JWT). Tokens are Supabase JWTs signed by the accounts service. Tokens expire in approximately 1 hour. There is no refresh token mechanism exposed to external apps — when a token expires, re-authenticate via the Auth Hub redirect.

---

## 3. Authenticate a User

CompassV2 does not handle login or signup directly. Users authenticate at `accounts.empowered.vote` (the Auth Hub) and return to CompassV2 with a token. This design centralizes auth for all Empowered Vote apps — CompassV2 is one of many consumers of the accounts service.

### Step 1 — Redirect to Auth Hub

When a user needs to authenticate, redirect them to:

```
https://accounts.empowered.vote/login?redirect={encodeURIComponent(window.location.href)}
```

Example:
```
https://accounts.empowered.vote/login?redirect=https%3A%2F%2Fcompassv2.empowered.vote%2Fdashboard
```

**Domain restriction:** Only `*.empowered.vote` domains are accepted as redirect targets. Any other domain in the `redirect` parameter is silently discarded and the user is not redirected back.

### Step 2 — User Authenticates at Auth Hub

The Auth Hub handles:
- Login (existing accounts)
- Signup (new accounts with invite code)
- Email verification

On success, the Auth Hub redirects back to the `redirect` URL with the token delivered as a URL **hash fragment**:

```
https://compassv2.empowered.vote/dashboard#access_token=eyJhbGciOiJI...
```

**Why hash fragment, not query parameter:** Query parameters are logged by servers, reverse proxies, CDNs, and appear in browser history. Hash fragments are client-side only — they never leave the browser and are never transmitted to a server. This prevents token leakage in logs and network traffic.

### Step 3 — Extract Token on Return

Call this function on app initialization and on every route change (the user may land anywhere after the redirect):

```typescript
function handleAuthReturn(): string | null {
  const hash = window.location.hash;
  if (!hash.includes('access_token=')) return null;

  const params = new URLSearchParams(hash.substring(1));
  const token = params.get('access_token');
  if (!token) return null;

  // Clean URL immediately — token should not persist in address bar
  window.history.replaceState(null, '', window.location.pathname + window.location.search);

  // Store token
  localStorage.setItem('ev_token', token);
  return token;
}
```

Call this on app load before rendering authenticated state:

```typescript
// On app initialization
const token = handleAuthReturn() ?? localStorage.getItem('ev_token');
if (token) {
  // Fetch /account/me to confirm token validity and load user state
}
```

### Step 4 — Use Token for API Calls

Send the token as a Bearer header on every authenticated request:

```typescript
const API_BASE = 'https://accounts.empowered.vote/api';

async function apiFetch(path: string, options: RequestInit = {}, token?: string) {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!response.ok) {
    const error = await response.json();
    throw { status: response.status, code: error.code, message: error.message };
  }
  return response.json();
}
```

### Token Lifecycle

- Supabase JWTs expire in approximately 1 hour.
- When any API call returns HTTP 401 with `code: "AUTH_ERROR"`, the token is expired or invalid.
- On AUTH_ERROR: clear the stored token (`localStorage.removeItem('ev_token')`) and redirect to the Auth Hub.
- There is no refresh token flow exposed to CompassV2. Re-authentication via redirect is the only path.

> **Anti-pattern:** Do not call POST /auth/login directly from CompassV2. The redirect flow is the only supported auth mechanism for external apps. Direct login is for the accounts app itself.

### Full Auth Flow Diagram

```
CompassV2                     Auth Hub (accounts.empowered.vote)
    |                               |
    |-- redirect to /login -------->|
    |   ?redirect=encodeURI(url)    |
    |                               |-- user logs in / signs up
    |                               |-- email verified
    |<-- redirect to returnUrl -----|
    |   #access_token=eyJ...        |
    |                               |
    |-- handleAuthReturn()          |
    |-- store token                 |
    |-- GET /api/account/me ------->|  accounts API
    |<-- user profile + tier -------|
    |                               |
    |-- compass requests with token>|
```

---

## 4. Fetch Compass Data

All compass read endpoints are public (Optional auth). Unauthenticated requests return the same data as authenticated requests for read-only endpoints.

### GET /api/compass/topics

Returns all live compass topics with their stances.

- **Auth:** Optional
- **Response:** Array of `Topic` objects

```typescript
interface Topic {
  id: number;
  title: string;
  short_title: string;
  question_text: string;
  level: string[];      // e.g. ["local", "state", "federal"]
  is_live: boolean;
  created_at: string;
  stances: Stance[];
}

interface Stance {
  id: number;
  topic_id: number;
  value: number;        // 0.5 to 5.5, step 0.5
  text: string;
}
```

Example request:
```
GET /api/compass/topics
```

No authentication header required. Include it if the user is authenticated — makes no difference to response shape for this endpoint.

### GET /api/compass/categories

Returns all categories with their nested topic objects.

- **Auth:** Optional
- **Response:** Array of category objects with nested topics

```typescript
interface Category {
  id: number;
  title: string;
  topics: Topic[];
}
```

### GET /api/compass/politicians

Returns all politicians in the system.

- **Auth:** Optional
- **Response:** Array of `Politician` objects

```typescript
interface Politician {
  id: number;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  full_name: string;
  office_title: string;
  photo_origin_url: string | null;
}
```

### GET /api/compass/politicians/:id/answers

Returns a politician's recorded stances on compass topics.

- **Auth:** Optional
- **Path params:** `id` — politician ID
- **Response:** Array of `{ politician_id: number, topic_id: number, value: number }`

```
GET /api/compass/politicians/42/answers
```

### GET /api/compass/politicians/:id/:topicId/context

Returns a politician's reasoning and sources for a specific topic.

- **Auth:** Optional
- **Path params:** `id` — politician ID, `topicId` — topic ID
- **Response:**

```typescript
interface PoliticianContext {
  reasoning: string;
  sources: string[];
}
```

Example request:
```
GET /api/compass/politicians/42/7/context
```

---

## 5. Read and Write User Answers

These endpoints handle an individual user's compass responses. Most are Optional auth — unauthenticated calls succeed but return empty/null rather than persisted data.

### GET /api/compass/answers

Returns the authenticated user's answers across all topics.

- **Auth:** Optional
- **Unauthenticated response:** `[]` (empty array)
- **Authenticated response:** Array of `UserAnswer` objects

```typescript
interface UserAnswer {
  topic_id: number;
  value: number;            // 0.5 to 5.5, step 0.5 — always a float
  write_in_text: string | null;
  visibility: string;
  inverted: boolean;
  updated_at: string;
}
```

### POST /api/compass/answers

Upserts a single answer for the authenticated user.

- **Auth:** Optional
- **Request body:**

```typescript
{
  topic_id: number;
  value: number;         // must satisfy: 0.5 <= value <= 5.5, multiple of 0.5
  write_in_text?: string;
}
```

- **Value constraint:** `value` must be a multiple of 0.5 between 0.5 and 5.5 inclusive. Always parse as float, never integer. Valid values: 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5.
- **Unauthenticated response:** `null` — server acknowledged the request but could not persist without an account.
- **Authenticated response:** The saved `UserAnswer` object.

> **Anti-pattern:** Do not treat a `null` response from POST /compass/answers as an error. For Inform (unauthenticated) users, `null` IS the success response — it means the server acknowledged the request but cannot persist without an account. Display the answer locally using the submitted value.

> **Anti-pattern:** Do not parse answer values as integers. The `value` field is NUMERIC and may be a float like 3.5. Always use `parseFloat`, never `parseInt`. Storing as integer will silently corrupt answers like 0.5 → 0.

### POST /api/compass/answers/batch

Fetches a user's saved answers for a specific set of topic IDs. Used for efficiently loading answers on a subset of topics without fetching all.

- **Auth:** Optional
- **Request body:** `{ ids: number[] }` — array of topic IDs
- **Unauthenticated response:** `[]`
- **Authenticated response:** Array of `{ topic_id: number, value: number, write_in_text?: string }` for the requested IDs (only IDs with saved answers are returned)

Example:
```typescript
const response = await apiFetch('/compass/answers/batch', {
  method: 'POST',
  body: JSON.stringify({ ids: [1, 2, 3, 7, 12] }),
}, token);
// Returns answers for whichever of those IDs the user has answered
```

### GET /api/compass/selected-topics

Returns the user's saved selection of compass topics (typically 3–8 topics for their personalized compass view).

- **Auth:** Optional
- **Unauthenticated response:** `{ topic_ids: [] }`
- **Authenticated response:** `{ topic_ids: number[] }`

> **Anti-pattern:** Do not expect GET /compass/selected-topics to return 403 for anonymous users. It returns an empty array. The 403 NOT_CONNECTED only fires on PUT when an authenticated-but-not-Connected user tries to save.

### PUT /api/compass/selected-topics

Saves the user's topic selection.

- **Auth:** Optional* (behavior varies by auth state)
- **Request body:** `{ topic_ids: number[] }`
- **Unauthenticated response:** `{ topic_ids: [] }` — not persisted, no error
- **Authenticated but NOT Connected (Inform with token):** HTTP 403 with `code: "NOT_CONNECTED"`
- **Authenticated + Connected:** `{ topic_ids: number[] }` — saved and returned

### DELETE /api/compass/answers/me

Deletes all of the authenticated user's compass answers.

- **Auth:** Required (401 if not authenticated)
- **Response:** Success confirmation object
- **Use case:** "Reset my compass" — allows user to start fresh

### GET /api/compass/progress

Returns the authenticated user's compass completion progress.

- **Auth:** Required (401 if not authenticated)
- **Response:** Progress object showing how many topics the user has answered

---

## 6. Read User Profile and Detect Tier

### GET /api/account/me

Returns the full authenticated user profile including tier, jurisdiction, XP, gems, and onboarding state.

- **Auth:** Required (401 if not authenticated)
- **Primary use:** Determine user tier, load jurisdiction for personalization, check onboarding completion

**Full response shape:**

```typescript
interface AccountMe {
  id: string;                              // UUID — user's Supabase auth ID
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  tier: 'inform' | 'connected' | 'empowered';
  is_admin: boolean;
  completed_onboarding: boolean;
  location_consent: boolean;
  verification_rating: number;
  vq_hold_active: boolean;
  red_gem_quests_unlocked: boolean;
  account_standing: 'active' | 'suspended';
  jurisdiction: Jurisdiction | null;       // see Section 7
  created_at: string;
  updated_at: string;
  empowerment_status?: 'empowered' | 'demoted';
  connected_profile?: {
    display_name: string | null;
    verification_status: string;
    xp: {
      total: number;
      level: number;
      xp_in_level: number;
      xp_to_next_level: number;
    };
    gems: { yellow: number; blue: number; red: number; };
    completed_onboarding: boolean;
    verification_rating: number;
    vq_hold_active: boolean;
    vq_hold_until: string | null;
    created_at: string;
  };
  empowered_profile?: {
    legal_name: string;
    is_active: boolean;
    candidate_page_slug: string | null;
    empowered_at: string;
    demoted_at: string | null;
  };
  gems?: { yellow: number; blue: number; red: number; };
}
```

**Tier detection from the response:**

```typescript
// Read tier directly — do not recompute from profile presence
const isConnected = me.tier === 'connected' || me.tier === 'empowered';
const isEmpowered = me.tier === 'empowered';
const isInform = me.tier === 'inform';
```

**Onboarding state:**

```typescript
// Check if user has completed the compass onboarding flow
if (!me.completed_onboarding) {
  // Show onboarding UI before presenting the full compass
}
```

### PATCH /api/account/me

Updates profile fields for the authenticated user. Requires Connected or Empowered tier.

- **Auth:** Required (Connected+)
- **Request body:** Partial profile update (e.g., `{ display_name: "New Name" }`)
- **Response:** Updated profile object

### POST /api/auth/complete-onboarding

Marks the onboarding flow as complete on the user's connected_profile.

- **Auth:** Required (Connected)
- **Request body:** None
- **Response:** Success confirmation
- **When to call:** After the user finishes the compass onboarding sequence in CompassV2.

### POST /api/auth/logout

Invalidates the current session server-side.

- **Auth:** Required
- **Request body:** None
- **Response:** Success confirmation
- **After calling:** Clear `ev_token` from localStorage and redirect to logged-out state.

> **Anti-pattern:** Do not store tier status client-side across sessions. Always re-read /api/account/me at session start. Tier can change (e.g., user gets promoted to Empowered, or account gets suspended) between sessions.

---

## 7. Jurisdiction and Location Personalization

### The "Never Ask for Address" Principle

If a user has granted location consent and their jurisdiction is resolved, CompassV2 **must** use it to personalize content — filter politicians by district, highlight relevant local topics — **without ever prompting the user for their address**.

The user's address was collected once, during account setup at accounts.empowered.vote. Asking for it again in CompassV2 is a product violation. It signals the platform doesn't trust its own data. It fragments the user's trust. It creates a second collection point for sensitive location data. Do not do it.

### How Jurisdiction Works

1. During account setup, the user grants location consent.
2. Accounts resolves their address to legislative districts via the US Census geocoder.
3. The `jurisdiction` object appears in `GET /api/account/me` when `location_consent === true` AND the user is Connected or Empowered.

### Jurisdiction Object Shape

```typescript
interface Jurisdiction {
  congressional_district: string | null;
  congressional_district_name: string | null;
  state_senate_district: string | null;
  state_senate_district_name: string | null;
  state_house_district: string | null;
  state_house_district_name: string | null;
  county: string | null;
  county_name: string | null;
  school_district: string | null;
  school_district_name: string | null;
}
```

### Using Jurisdiction in CompassV2

```typescript
// On load: fetch user profile
const me = await apiFetch('/account/me', {}, token);

// Personalize politician list by district
if (me.jurisdiction) {
  const myCongressionalDistrict = me.jurisdiction.congressional_district;
  const myStateSenatDistrict = me.jurisdiction.state_senate_district;

  // Filter or highlight politicians in user's districts
  const localPoliticians = politicians.filter(p =>
    p.congressional_district === myCongressionalDistrict
  );

  // Show district name in UI
  const districtLabel = me.jurisdiction.congressional_district_name;
  // e.g. "Indiana's 7th Congressional District"
}
```

### When Jurisdiction is Null

`jurisdiction` is `null` in three cases:

1. **User is Inform (not authenticated)** — no account, no jurisdiction. Show all content with no personalization.
2. **User is Connected but has not granted location consent** — this was their choice. Show all content. Do NOT prompt for address.
3. **User granted consent but geocoding has not resolved yet** — rare edge case. Show all content. Jurisdiction will appear on the next call to /account/me.

In all three cases, the behavior is the same: show the full unfiltered compass experience. Jurisdiction is an enhancement, not a gate.

> **Anti-pattern:** Do not prompt the user for their address, zip code, or location if `jurisdiction` is null. The null means either they haven't consented (their choice) or resolution is pending. In both cases, show the full unfiltered experience. Location collection is exclusively handled by the accounts app.

---

## 8. Migrate Guest State on Signup

When an unauthenticated user has been answering compass questions locally (receiving `null` from POST /compass/answers), their state should be migrated to the server when they sign up.

### How It Works

POST /auth/signup (called at the Auth Hub, not directly from CompassV2) accepts an optional `guest_state` field. CompassV2 passes this state to the Auth Hub before redirecting so it can be included in the signup request.

```typescript
// Guest state shape passed during signup
interface GuestState {
  answers: Array<{
    topic_id: number;
    value: number;
    write_in_text?: string;
  }>;
  selected_topics: number[];
}
```

### Implementation Pattern

Since CompassV2 does not call /auth/signup directly, pass guest state as a URL parameter to the Auth Hub redirect:

```typescript
// Before redirecting to Auth Hub for signup
const guestState: GuestState = {
  answers: localAnswers,      // answers collected during Inform session
  selected_topics: [],        // see note below
};

const returnUrl = window.location.href;
const redirectUrl = new URL('https://accounts.empowered.vote/login');
redirectUrl.searchParams.set('redirect', returnUrl);
redirectUrl.searchParams.set('guest_state', JSON.stringify(guestState));

window.location.href = redirectUrl.toString();
```

**Note on `selected_topics`:** Saving selected topics requires a Connected profile. Since signup creates a Connected profile atomically, pass `selected_topics` as a separate PUT /api/compass/selected-topics call after enrollment completes (i.e., after you receive a token and confirm the user is Connected via /account/me).

### Post-Signup Topic Selection

```typescript
// After signup, once token is received and user confirmed as Connected
const me = await apiFetch('/account/me', {}, token);
if (me.tier === 'connected' || me.tier === 'empowered') {
  // Save previously-local selected topics
  if (localSelectedTopics.length > 0) {
    await apiFetch('/compass/selected-topics', {
      method: 'PUT',
      body: JSON.stringify({ topic_ids: localSelectedTopics }),
    }, token);
  }
}
```

---

## 9. Error Handling

### Error Response Shape

All API errors return a consistent JSON body:

```json
{ "code": "ERROR_CODE", "message": "Human-readable description" }
```

**Always parse `code`, never `message`.** The `message` field is for human debugging — its text may change between deploys. The `code` field is the stable contract.

```typescript
try {
  const data = await apiFetch('/compass/answers', { method: 'POST', body: ... }, token);
} catch (error) {
  if (error.code === 'AUTH_ERROR') {
    // Token expired — clear and redirect
    localStorage.removeItem('ev_token');
    redirectToAuthHub();
  } else if (error.code === 'NOT_CONNECTED') {
    // Show "sign up to save" prompt
  } else if (error.code === 'VALIDATION_ERROR') {
    // Check request body
  }
}
```

### Error Code Reference

| Code | HTTP | Meaning | Action |
|------|------|---------|--------|
| AUTH_ERROR | 401 | Token missing, expired, or invalid | Clear token, redirect to Auth Hub |
| NOT_CONNECTED | 403 | User is authenticated but not Connected tier | Show upgrade/signup prompt |
| VALIDATION_ERROR | 422 | Request body failed validation | Check field constraints, fix and retry |
| INVALID_TOPIC_IDS | 422 | One or more topic IDs in request don't exist | Verify topic IDs against /compass/topics |
| TOPIC_NOT_FOUND | 404 | Single topic ID not found | Check the ID |
| NOT_FOUND | 404 | Resource not found | Check the path/ID |
| INVALID_CREDENTIALS | 401 | Login failed | Not relevant for CompassV2 (direct login only) |
| EMAIL_NOT_VERIFIED | 403 | Email not yet verified | User should check email |
| EMAIL_EXISTS | 409 | Signup with existing email | User should log in instead |
| INVALID_INVITE_CODE | 422 | Bad invite code on signup | Check invite code |
| SELF_INVITE_BLOCKED | 422 | User tried to use their own invite code | User needs someone else's code |
| RATE_LIMIT_EXCEEDED | 429 | Too many requests | Back off and retry with exponential backoff |
| EMAIL_DELIVERY_FAILED | 503 | Email service error | Retry later |
| USER_NOT_FOUND | 404 | User lookup failed | Check user existence |
| INTERNAL_ERROR | 500 | Server error | Retry with backoff; if persistent, contact support |

> **Anti-pattern:** Do not store tokens without handling AUTH_ERROR. When any API call returns 401 with code AUTH_ERROR, immediately clear the stored token and redirect to the Auth Hub. Stale tokens should never accumulate.

> **Anti-pattern:** Do not attempt to read `tolerance_rating` for other users. This is an owner-only field and is never returned for non-owning users. It does not appear in /account/me for any user other than the token owner.

---

## 10. Integration Checklist

Use this checklist to verify full integration compliance. Each item maps to a CDOC requirement.

### Auth (CDOC-01)

- [ ] Auth redirect flow implemented: redirect to `https://accounts.empowered.vote/login?redirect={encodeURIComponent(url)}`
- [ ] Token extracted from URL hash fragment (`#access_token=...`) on app initialization and route changes
- [ ] URL cleaned immediately after token extraction (`window.history.replaceState`)
- [ ] Token stored in `localStorage` under `ev_token`
- [ ] All authenticated requests send `Authorization: Bearer {token}` header
- [ ] 401 AUTH_ERROR handling: clear token, redirect to Auth Hub
- [ ] POST /auth/login is NOT called directly from CompassV2

### Endpoints (CDOC-02)

- [ ] All 16 endpoints called with correct paths and HTTP methods
- [ ] Answer values handled as floats (0.5 to 5.5, step 0.5) — never parseInt
- [ ] POST /compass/answers/batch uses `{ ids: number[] }` request body (not `topic_ids`)
- [ ] PUT /compass/selected-topics uses `{ topic_ids: number[] }` request body
- [ ] Error `code` field parsed (not `message`) for all error handling

### Tier Access (CDOC-03)

- [ ] Inform users see all compass data (topics, politicians, categories)
- [ ] Inform users' answers are local-only: null POST response handled gracefully (displayed locally, not treated as error)
- [ ] Connected users get full persistence, progress endpoint, and answer deletion
- [ ] Tier detected from `me.tier` field (not recomputed from profile presence)

### Jurisdiction (CDOC-04)

- [ ] Jurisdiction read from `me.jurisdiction` in /account/me response
- [ ] When `jurisdiction` is non-null, used to personalize content (filter/highlight by district)
- [ ] When `jurisdiction` is null, full unfiltered experience shown — no address/location prompt
- [ ] No address, zip code, or location input anywhere in CompassV2

### Platform Understanding (CDOC-05)

- [ ] Three-tier model understood: Inform / Connected / Empowered
- [ ] Tier determined by child record presence (not status flag)
- [ ] Token expiry handled: re-auth via redirect, not refresh token

### Canonical Reference (CDOC-06)

- [ ] This document (`docs/COMPASSV2-INTEGRATION.md`) is the sole integration reference — `docs/COMPASS_CONTRACT.md` has been deleted

---

*Empowered Accounts API — CompassV2 Integration Guide*
*Last updated: 2026-03-19*
