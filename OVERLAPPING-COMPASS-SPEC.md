# Overlapping Compass Comparison — Design & Integration Spec

How to implement the two-polygon "compare your compass with a politician" view in any EV surface (Essentials, Civic Spaces, etc.). Covers the visual contract, the spoke-selection algorithm, the data API, and the reusable hook.

---

## 1. What it looks like

Two filled polygons share the same radar chart. One polygon represents the user; one represents the candidate. Where they overlap, `mix-blend-mode: multiply` darkens the intersection so alignment is visible at a glance without a third overlay color.

| Element | Color | Hex |
|---|---|---|
| User polygon fill | Purple, 40% opacity | `rgba(124, 107, 158, 0.4)` |
| User polygon stroke | Solid purple | `#7C6B9E` |
| Candidate polygon fill | Green, 45% opacity | `rgba(90, 154, 110, 0.45)` |
| Candidate polygon stroke | Solid green | `#5A9A6E` |
| Overlap region | Blend darkens both | `mix-blend-mode: multiply` on candidate polygon |
| Match dot (same stance) | Yellow | `#fed12e` |
| User dot (no match) | Purple | `#7C6B9E` |
| Candidate dot (no match) | Green | `#5A9A6E` |

Legend must use these same colors — not coral/red and teal/blue.

---

## 2. Spoke selection algorithm

The radar chart only renders spokes where **both the user and the candidate have answered**. Showing a half-answered comparison compass is not useful — a missing spoke looks like disagreement rather than absence of data.

### Rules (in priority order)

1. **Start with the user's selected topics** (their compass defaults, ordered as chosen during calibration).
2. **For each topic the candidate has not answered:**
   - Find a replacement topic that **both** the user and the candidate have answered, that is not already in the display set.
   - Replacements are drawn from the user's answered-but-not-currently-displayed topics in the order the topic list returns them.
   - If a replacement exists: substitute it in. Mark the spoke as a **replacement** (see §4 — typography).
   - If no replacement exists: **drop the spoke entirely**.
3. **If the resulting spoke count is fewer than 3:** do not show the comparison compass at all. Show a plain text message: *"Not enough shared topics to display a comparison compass."*

### Why this order

The user's default topics are the ones they care about most. Keeping them when possible preserves personal relevance. Replacements are surfaced only when needed, and are visually distinguished so the user understands the chart may not reflect exactly their chosen agenda.

---

## 3. Data

### User's compass

Fetched from the API as `{ topic_id, value, inverted }[]`. Keyed locally by `short_title` (a stable display string like `"Housing"`) for chart rendering.

```
GET /compass/answers
Authorization: Bearer {token}
→ [{ topic_id, value, inverted, write_in_text? }]
```

Guest users: read from `localStorage.answers` (set by CompassV2 and synced via the ev-context broker — see §5).

User's selected topics: `GET /compass/selected-topics` → `string[]` of topic UUIDs. The order matters — it is the spoke order on the chart.

All topics (needed to map IDs → short_titles and to find replacement candidates):
```
GET /compass/topics
→ [{ id, short_title, stances: [{ text }] }]
```

### Candidate's answers

```
GET /compass/politicians/{politicianId}/answers
→ [{ topic_id, value }]
```

This returns all topics the politician has answered. Value `0` means unanswered; skip it.

### Building the display

```js
// pseudocode — see useCompareSpokes hook below for the real implementation
const polAnsweredSet = new Set(allAnswers.filter(a => a.value > 0).map(a => a.topic_id));
const selectedTopicSet = new Set(selectedTopics);

const replacementPool = allTopics.filter(t =>
  !selectedTopicSet.has(t.id) &&
  userAnswers[t.short_title] > 0 &&   // user has answered it
  polAnsweredSet.has(t.id)             // candidate has answered it
);

const displayTopics = [];
const replacedSpokes = {};    // short_title → true for substitutes
const compareAnswersMap = {}; // short_title → candidate's value

for (const id of selectedTopics) {
  if (polAnsweredSet.has(id)) {
    displayTopics.push(id);
    compareAnswersMap[topic.short_title] = polAnswer.value;
  } else if (replacementPool.length > 0) {
    const sub = replacementPool.shift();
    displayTopics.push(sub.id);
    replacedSpokes[sub.short_title] = true;
    compareAnswersMap[sub.short_title] = polAnswer.value;
  }
  // else: spoke dropped
}

const hasEnough = displayTopics.length >= 3;
```

---

## 4. Typography — bolding

When a comparison is active:

- **Original user spokes** (topics from the user's default compass that made it through): **bold** label text.
- **Replacement spokes** (substituted because the candidate hadn't answered the original): normal weight. The lighter weight signals "this topic was brought in to fill a gap" without needing extra UI.
- **No comparison active**: all labels normal weight.

The `RadarChartCore` component in `@empoweredvote/ev-ui` accepts two props for this:

```jsx
<RadarChartCore
  replacedSpokes={replacedSpokes}      // { [short_title]: true }
  boldOriginalSpokes={!!comparisonActive}
/>
```

When `boldOriginalSpokes` is true, any spoke whose `short_title` is NOT a key in `replacedSpokes` renders bold.

---

## 5. Reading the user's compass in Essentials

CompassV2 shares compass state cross-subdomain via the **ev-context broker** (an iframe postMessage bus from `@empoweredvote/ev-ui`).

### Guest users

The full compass payload is written to the `compass` slice of ev-context on every change:

```js
{
  a: { [short_title]: value },    // answers
  s: string[],                    // selectedTopics (array of topic UUIDs)
  i: { [short_title]: boolean },  // invertedSpokes
  w: { [short_title]: string },   // write-ins
}
```

Read it in Essentials:

```js
import { evContext } from '@empoweredvote/ev-ui';

const shared = await evContext.get();
const compass = shared?.compass;
// compass.a = answers, compass.s = selectedTopics
```

Subscribe to live updates (user calibrates in another tab):

```js
const unsub = evContext.subscribe((shared) => {
  const compass = shared?.compass;
  if (compass) applyCompass(compass);
});
// call unsub() on cleanup
```

### Authenticated users

Compass data is stored in the API (source of truth). The ev-context authed slice is a write-through cache only — do not rely on it as primary data in Essentials for authed users. Fetch directly:

```
GET /compass/answers          → user's answers
GET /compass/selected-topics  → ordered topic UUID array
```

### URL fragment hand-off (guest → Essentials)

When CompassV2 sends a guest back to Essentials, it appends a `#compass=BASE64` fragment to the return URL. The BASE64 is `btoa(JSON.stringify({ a, s, i }))`. Read it on arrival:

```js
const hash = window.location.hash;
if (hash.startsWith('#compass=')) {
  const payload = JSON.parse(atob(hash.slice('#compass='.length)));
  // payload.a = answers, payload.s = selectedTopics
}
```

---

## 6. Reusable hook (extract from CompassV2 when needed)

The spoke algorithm is currently inline in `Compass.jsx`. When a second surface needs it, extract to a standalone hook. The interface:

```js
/**
 * Resolves which spokes to display when comparing with a politician,
 * applying the replacement / drop rules and returning chart-ready data.
 *
 * @param {object|null} politician   - { id } or null (no comparison active)
 * @param {string[]}    selectedTopics - user's ordered topic UUID array
 * @param {object}      allTopics    - full topics list from /compass/topics
 * @param {object}      userAnswers  - { [short_title]: value }
 * @returns {{
 *   displayTopics: string[],        // ordered UUIDs for the compare compass
 *   compareAnswers: object,         // { [short_title]: candidateValue }
 *   replacedSpokes: object,         // { [short_title]: true } for substitutes
 *   hasEnoughSpokes: boolean,       // false → suppress compass, show message
 *   loading: boolean,
 * }}
 */
function useCompareSpokes(politician, selectedTopics, allTopics, userAnswers) {
  const [state, setState] = useState({
    displayTopics: null,
    compareAnswers: {},
    replacedSpokes: {},
    hasEnoughSpokes: true,
    loading: false,
  });

  useEffect(() => {
    if (!politician || !selectedTopics.length) {
      setState({ displayTopics: null, compareAnswers: {}, replacedSpokes: {}, hasEnoughSpokes: true, loading: false });
      return;
    }
    setState(s => ({ ...s, loading: true }));
    apiFetch(`/compass/politicians/${politician.id}/answers`)
      .then(r => r.json())
      .then(allAnswers => {
        const polAnsweredSet = new Set(allAnswers.filter(a => a.value > 0).map(a => a.topic_id));
        const selectedTopicSet = new Set(selectedTopics);
        const replacementPool = allTopics.filter(t =>
          !selectedTopicSet.has(t.id) &&
          userAnswers[t.short_title] > 0 &&
          polAnsweredSet.has(t.id)
        );
        let ri = 0;
        const displayTopics = [], replacedSpokes = {}, compareAnswers = {};
        for (const id of selectedTopics) {
          const t = allTopics.find(tt => tt.id === id);
          if (!t) continue;
          if (polAnsweredSet.has(id)) {
            displayTopics.push(id);
            const a = allAnswers.find(x => x.topic_id === id);
            if (a?.value > 0) compareAnswers[t.short_title] = a.value;
          } else if (ri < replacementPool.length) {
            const sub = replacementPool[ri++];
            displayTopics.push(sub.id);
            replacedSpokes[sub.short_title] = true;
            const a = allAnswers.find(x => x.topic_id === sub.id);
            if (a?.value > 0) compareAnswers[sub.short_title] = a.value;
          }
        }
        setState({ displayTopics, compareAnswers, replacedSpokes, hasEnoughSpokes: displayTopics.length >= 3, loading: false });
      })
      .catch(() => setState({ displayTopics: null, compareAnswers: {}, replacedSpokes: {}, hasEnoughSpokes: true, loading: false }));
  }, [politician, selectedTopics]);

  return state;
}
```

When extracted, move this to `src/hooks/useCompareSpokes.js` in CompassV2 (or into `ev-ui` if Essentials needs it too), then import from there in `Compass.jsx`.

---

## 7. RadarChartCore props reference (compare mode)

Full props relevant to comparison:

| Prop | Type | Description |
|---|---|---|
| `data` | `{ [short_title]: number }` | User's answers for the display topic set |
| `compareData` | `{ [short_title]: number }` | Candidate's answers for the same topics |
| `invertedSpokes` | `{ [short_title]: boolean }` | Which spokes are visually inverted |
| `unansweredSpokes` | `{ [short_title]: boolean }` | User's unanswered spokes (renders gray/dashed) |
| `replacedSpokes` | `{ [short_title]: boolean }` | Substituted spokes (renders label at normal weight) |
| `boldOriginalSpokes` | `boolean` | When true, non-replaced spokes render bold |
| `writeIns` | `{ [short_title]: string }` | User's write-in stance text (used in tooltips) |
| `darkMode` | `boolean` | Switches label/ring colors for dark backgrounds |
| `onToggleInversion` | `fn(shortTitle)` | Called when user clicks a spoke line |
| `onReplaceTopic` | `fn(shortTitle)` | Called when user clicks a spoke label |

The `data` and `compareData` objects must use the same set of `short_title` keys. The chart renders one spoke per key in `data`; `compareData` values are looked up by the same key.
