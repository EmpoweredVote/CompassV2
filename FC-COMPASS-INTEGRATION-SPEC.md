# Compass Integration Spec

**Version:** 1.2
**Date:** 2026-04-17
**Owner:** Focused Communities team
**Status:** Mapping expanded to all 26 live Compass topics

---

## 1. Overview

Focused Communities (FC) provides a deliberation hub for each Compass topic. This spec defines how the Compass client surfaces a link to the corresponding FC hub for topics that have one.

**Key design decisions from spec review:**

- FC links surface inside the **LibraryDrawer** (not on spoke tap) to avoid conflicting with existing spoke-tap behaviors (calibration overlay for unanswered spokes, LibraryDrawer open for answered spokes)
- The UUID-to-slug bridge lives on the **Compass backend** (`fc_community_slug` added to the topic response) — the client never handles raw UUIDs
- Topics with no FC community: FC link is simply **absent** — no fallback needed on the client
- FC links open in a **new tab** — Compass is a stateful SPA and navigation away would lose calibration/comparison state

---

## 2. Hub URL Pattern

Every FC community hub is accessible at:

```
https://fc.empowered.vote/communities/{slug}
```

**Slug properties:**

- Stable — slugs are assigned at community creation and never change
- URL-safe, lowercase, hyphenated (e.g., `immigration-and-treatment`)
- No query parameters needed — the slug alone is sufficient

---

## 3. Topic-to-Slug Mapping (Server-Side)

FC communities map to all 26 live Compass topics. This mapping is maintained by the FC team and communicated via this spec when new communities are added.

**The mapping lives on the Compass backend** — stored at seed/deploy time, not fetched at runtime from FC. The Compass API enriches its `GET /api/compass/topics` response with a `fc_community_slug` field (see Section 4).

| Community Name | FC Slug | FC Hub URL | FC Topic UUID |
|----------------|---------|-----------|---------------|
| Affordable Housing | `affordable-housing` | https://fc.empowered.vote/communities/affordable-housing | `669cac97-66a6-4087-b036-936fbe62efb3` |
| Artificial Intelligence Oversight | `ai-oversight` | https://fc.empowered.vote/communities/ai-oversight | `666bf03d-81fc-4138-ab15-69ae734c9023` |
| Campaign Finance Reform | `campaign-finance-reform` | https://fc.empowered.vote/communities/campaign-finance-reform | `92730f69-ae57-401c-8ad1-2d07834a895d` |
| Childcare Affordability & Access | `childcare-affordability` | https://fc.empowered.vote/communities/childcare-affordability | `c1ac1330-47f7-44ec-baf3-c913d926b97c` |
| Civil Rights and Social Justice | `civil-rights` | https://fc.empowered.vote/communities/civil-rights | `0bc588c6-39e1-4084-b5de-cac909b8b762` |
| Climate Change and Environmental Protection | `climate-change` | https://fc.empowered.vote/communities/climate-change | `f1e44d66-5d27-4b51-b54f-b7ace86f6a3c` |
| Criminalization of Homelessness | `criminalization-of-homelessness` | https://fc.empowered.vote/communities/criminalization-of-homelessness | `4938766b-b45a-46e3-93bd-b8b30651271a` |
| Data Center Development & Energy Costs | `data-center-development` | https://fc.empowered.vote/communities/data-center-development | `4559b513-0fd8-4ed1-babd-f3b554162f40` |
| Deportation Priorities | `deportation-priorities` | https://fc.empowered.vote/communities/deportation-priorities | `44905f3b-e105-4f6c-afc7-5d223813dbac` |
| Fossil Fuel Policy | `fossil-fuel-policy` | https://fc.empowered.vote/communities/fossil-fuel-policy | `a22215c3-6693-4bc2-b248-01aebba14570` |
| Healthcare Access | `healthcare-access` | https://fc.empowered.vote/communities/healthcare-access | `e8dad4a8-eb93-4931-91f5-d8fb5d7dd529` |
| Immigration & Treatment of Immigrants | `immigration-and-treatment` | https://fc.empowered.vote/communities/immigration-and-treatment | `4e2c69ce-591e-4197-9cd5-7aceff79d390` |
| Jail Capacity and Incarceration Alternatives | `jail-capacity` | https://fc.empowered.vote/communities/jail-capacity | `c267e137-0ff9-4e7d-9d13-e3cea1756cd0` |
| Medicare / Medicaid | `medicare-medicaid` | https://fc.empowered.vote/communities/medicare-medicaid | `cab61e8a-64fe-4bbd-bc08-fe9914d0091b` |
| Misinformation and the Role of Algorithms in Democracy | `misinformation-algorithms` | https://fc.empowered.vote/communities/misinformation-algorithms | `ddd65d64-9dc7-4208-a30f-59f4b9c0653d` |
| Religious Freedom | `religious-freedom` | https://fc.empowered.vote/communities/religious-freedom | `6b9ba6d9-1001-43f5-b073-4d37130696fd` |
| Reproductive Rights and Abortion Access | `reproductive-rights` | https://fc.empowered.vote/communities/reproductive-rights | `af2fdfd6-02c4-49df-b09c-cf8536f4773f` |
| Same-Sex Marriage | `same-sex-marriage` | https://fc.empowered.vote/communities/same-sex-marriage | `c5ab4eab-702f-49b8-9277-8ea53f3835c6` |
| School Vouchers & Public Education Funding | `school-vouchers-education` | https://fc.empowered.vote/communities/school-vouchers-education | `00b95a6a-75db-4521-b523-3326bba938de` |
| Social Security | `social-security` | https://fc.empowered.vote/communities/social-security | `87d20824-a6e9-407b-983c-65440084a0ab` |
| State Redistricting and Gerrymandering | `redistricting` | https://fc.empowered.vote/communities/redistricting | `48cc9585-ec22-4f53-8d42-6839828dd36f` |
| Taxation and Public Spending | `taxation-and-spending` | https://fc.empowered.vote/communities/taxation-and-spending | `f7e5678d-dadd-4556-a2fc-446e24642ceb` |
| Transgender Athletes | `transgender-athletes` | https://fc.empowered.vote/communities/transgender-athletes | `d1618b9c-0b9e-45af-b986-bb33d270b8e4` |
| Ukraine - Russia Conflict | `ukraine-russia` | https://fc.empowered.vote/communities/ukraine-russia | `24e9212c-b011-422a-865c-093e35050901` |
| United States Tariff Policy | `tariff-policy` | https://fc.empowered.vote/communities/tariff-policy | `683c8084-2281-4920-a07c-18439b2dd413` |
| Voting Rights and Electoral Integrity | `voting-rights` | https://fc.empowered.vote/communities/voting-rights | `d1792200-1d3b-4955-a0b7-0e6980d7a7b2` |

**All 26 live Compass topics have an FC community.** The `fc_community_slug` field should be non-null for every topic in the Compass backend's topic list.

**Mapping updates:** FC will notify the Compass team when new communities are added. Slugs of existing communities will not change.

---

## 4. Integration Instructions

### 4.1 Compass backend change (required)

Add `fc_community_slug` to the `GET /api/compass/topics` response:

```json
{
  "id": 42,
  "name": "Immigration & Treatment of Immigrants",
  "fc_community_slug": "immigration-and-treatment"
}
```

For topics with no FC community, return `null`:

```json
{
  "id": 99,
  "name": "Some Other Topic",
  "fc_community_slug": null
}
```

The Compass backend should store the `topic_id → slug` mapping from Section 3 at seed/deploy time. The client reads `topic.fc_community_slug` and never handles UUIDs.

### 4.2 Where the FC link surfaces

**Placement: inside the LibraryDrawer** — already implemented on the Compass client.

The FC link renders at the top of the stances list inside the LibraryDrawer, shown when `topic.fc_community_slug` is non-null. Spoke-tap behaviors are unchanged:
- Unanswered spoke → opens calibration overlay
- Answered spoke → opens LibraryDrawer

### 4.3 Navigation behavior

**Open FC in a new tab.** Compass is a stateful SPA — navigating away in the same tab would lose calibration and comparison state.

```javascript
// Compass client pseudocode
function renderFCLink(topic) {
  if (!topic.fc_community_slug) return null;

  return (
    <a
      href={`https://fc.empowered.vote/communities/${topic.fc_community_slug}`}
      target="_blank"
      rel="noopener noreferrer"
    >
      Discuss on Focused Communities →
    </a>
  );
}
```

No query parameters needed. FC handles auth independently — unauthenticated users can read all content; auth is only required for posting.

---

## 5. Behavior for Unmapped Topics

When `topic.fc_community_slug` is `null`, **do not render an FC link**. There is nothing to link to.

No fallback URL, no disabled state, no placeholder — simply omit the element.

---

## 6. Fallback for Stale Slugs

If a slug is ever invalid (e.g., a mapping was recorded incorrectly), FC returns a client-side 404 page with a link back to the FC directory. This should not occur in practice — slugs are stable and the Compass backend controls when they're written.

---

## 7. Contact

For mapping updates or questions, contact the Focused Communities team. FC will proactively notify the Compass team when new communities are added so the backend mapping can be updated.
