// Mirrors the compass_lenses + compass_lens_topics tables in inform schema.
// Until a /compass/lenses API endpoint exists, these constants are the source of truth.
export const LOCAL_LENS = {
  key: 'local',
  name: 'Local Lens',
  description: '8 questions most local candidates have already answered',
  color: '#00657C',
  // The deep teal goes muddy against the dark background, so on dark surfaces
  // the lens picks up the same light blue the calibration flow uses there.
  darkColor: '#59B0C4',
  topicIds: [
    '669cac97-66a6-4087-b036-936fbe62efb3', // Housing
    '4938766b-b45a-46e3-93bd-b8b30651271a', // Homelessness
    'd4f18138-a2e0-4110-b925-7387d9d0d16d', // Residential Zoning
    '0bc588c6-39e1-4084-b5de-cac909b8b762', // Civil Rights
    'e9ebefcd-c496-45e8-b816-a79f8442ba85', // Public Safety Approach
    'b9ccee94-ad96-4f10-b655-889d8e5abe92', // Local Immigration Enforcement
    'eb3d1247-0de1-4b7f-baec-7259861efd53', // Economic Development Incentives
    'ba59337e-30e2-4aba-a39a-426b3366eb27', // Transportation Priorities
  ],
};

export const JUDICIAL_LENS = {
  key: 'judicial',
  name: 'Judicial Lens',
  description: '8 questions for judicial and DA candidates',
  color: '#C2440A',
  topicIds: [
    '1fab5edf-6151-4da0-9704-a7f2113ba54c', // Bail & Pretrial
    '9d45acaf-1ba4-4cb8-95e1-5ed985223b91', // Court Access
    '9db07b16-1076-4b7d-ad89-ebe7b51f4336', // Criminal Justice
    'e5e48f0e-8f3a-40e1-8080-889fea389603', // Government Deference
    '448b1c9a-b6f3-42b8-8f39-d3bbb5bfa9ee', // Interpretation
    'c267e137-0ff9-4e7d-9d13-e3cea1756cd0', // Jail Capacity
    '6674d87e-999d-433a-aab7-3f626f59fd5f', // Legal Transparency
    'abb99d95-cbb1-4617-8f8b-f220ef6028ca', // Prosecution
  ],
};

// The 8 issues most U.S. House & Senate members and candidates have answered,
// ranked by how many of the ~1,258 answering federal politicians have a stance
// (measured 2026-07-12 against inform.politician_answers).
export const FEDERAL_LENS = {
  key: 'federal',
  name: 'Federal Lens',
  description: '8 issues most U.S. House & Senate members and candidates have answered',
  color: '#1E3A5F',
  topicIds: [
    'e8dad4a8-eb93-4931-91f5-d8fb5d7dd529', // Healthcare
    'f7e5678d-dadd-4556-a2fc-446e24642ceb', // Taxes
    '4e2c69ce-591e-4197-9cd5-7aceff79d390', // Immigration
    'af2fdfd6-02c4-49df-b09c-cf8536f4773f', // Abortion
    'f1e44d66-5d27-4b51-b54f-b7ace86f6a3c', // Climate Change
    '44905f3b-e105-4f6c-afc7-5d223813dbac', // Deportation
    'cab61e8a-64fe-4bbd-bc08-fe9914d0091b', // Medicare/aid
    'a22215c3-6693-4bc2-b248-01aebba14570', // Fossil Fuels
  ],
};

// The 6 school-board questions, in the order inform.compass_lens_topics stores
// them. Auto-applies on SCHOOL and STATE_BOARD_EDUCATION. Student Gender Identity
// and School Budget left the lens in ev-accounts CA_0313 (2026-10-16): a topic is
// in a level's lens only if people at that level can be seated on it, and a lens
// may run below 8 topics.
//
// ⚠ THESE TOPICS ARE SEASON-2-ONLY. Until Season 2 opens they are not in the
// promoted set, so every consumer that filters lens topics against the loaded
// topics — resolveCalibrateLens, getInitialState, the switcher — resolves this
// lens to ZERO topics and hides it. That is the intended behaviour and it needs
// no flag: the lens appears by itself the moment the season opens.
export const EDUCATION_LENS = {
  key: 'education',
  name: 'Education Lens',
  description: '6 questions for school board and state board of education candidates',
  color: '#C2185B',
  topicIds: [
    '6c43fdec-d084-415d-a15d-d78f48d4fb34', // Curriculum Content
    '1fcff1e8-c913-4d97-91da-1145952d7c65', // School Library Books
    '66b389c7-86fc-45e9-bf34-964bb747f27b', // School Equity Programs
    '15d7e730-119b-43a2-a351-1efb7352b86b', // Police in Schools
    'c8807d3d-4264-47ce-b8c4-08c6c9c33ce3', // Charter Schools
    '61269f44-9c7f-4b27-818a-3508009f6ae2', // AI in Schools
  ],
};

// All lenses, for generic iteration (badges, calibration offers, order storage).
// These constants are the OFFLINE FALLBACK. The live source of truth is the
// GET /compass/lenses API (inform.compass_lenses); CompassContext fetches it on
// mount and passes the result down. Keep these in sync as a safety net.
export const LENSES = [LOCAL_LENS, JUDICIAL_LENS, FEDERAL_LENS, EDUCATION_LENS];

// Presentation order for the switcher row — THE FALLBACK, not the source.
//
// The source is `sortOrder` on each lens, from inform.compass_lenses.sort_order
// (CC_0043). This list is what orders lenses that do not carry one:
//
//   1. the bundled constants above, which have no sortOrder by design — this
//      list IS their order, and duplicating the numbers would just be two
//      places to edit;
//   2. rows from a server that has not deployed the sortOrder field yet.
//
// Both render the same order as the DB, so the switcher looks identical whether
// the API has landed, is stale, or never answers at all.
//
// 🔴 THIS LIST GATES ORDER, NOT EXISTENCE. A lens whose key is missing here is
// still shown; it sorts after the known ones, in API order. That is the whole
// point — the next lens added to the DB appears with no frontend change, which
// is exactly what did NOT happen for Education.
export const LENS_DISPLAY_ORDER = ['federal', 'local', 'judicial', 'education'];

/**
 * Curated lenses in switcher order.
 *
 * Prefers the server's `sortOrder` and falls back to LENS_DISPLAY_ORDER when no
 * lens carries one. The two are never mixed: `lenses` in CompassContext is
 * either the bundled constants or an API response, replaced wholesale, so the
 * list is uniform. Choosing per-list rather than per-lens keeps the comparator
 * from interleaving two number spaces that mean different things.
 *
 * Ties break on the original position, which for an API response is the order
 * the server sent — already `ORDER BY l.sort_order, l.key`.
 */
export function orderLenses(lenses) {
  const list = [...(Array.isArray(lenses) ? lenses : [])];
  const useServerOrder = list.some((l) => Number.isFinite(l?.sortOrder));

  const rank = useServerOrder
    ? (l) => (Number.isFinite(l?.sortOrder) ? l.sortOrder : Number.MAX_SAFE_INTEGER)
    : (l) => {
        const i = LENS_DISPLAY_ORDER.indexOf(l?.key);
        return i === -1 ? LENS_DISPLAY_ORDER.length : i;
      };

  return list
    .map((l, i) => ({ l, i }))
    .sort((a, b) => rank(a.l) - rank(b.l) || a.i - b.i)
    .map(({ l }) => l);
}

/**
 * The chip label: the lens name without its trailing "Lens".
 *
 * The switcher had "Federal"/"Local"/"Judicial" hardcoded beside each constant.
 * Deriving it instead is what lets an unknown lens render a sane chip, and it
 * reproduces all three existing labels exactly ("Federal Lens" -> "Federal").
 */
export function lensShortLabel(lens) {
  const name = (lens && lens.name) || '';
  return name.replace(/\s*lens\s*$/i, '').trim() || name || lens?.key || '';
}

// Normalize an API lens row (GET /compass/lenses) into the constant shape.
// Color is the one field the constants still own: it is a brand/design token
// tuned against the app's palette and dark mode, not editorial content, so the
// local value wins and the API color is only a fallback for unknown keys.
export function normalizeApiLens(l) {
  const local = LENSES.find(x => x.key === l.key);
  return {
    key: l.key,
    name: l.name,
    description: l.description,
    color: local?.color ?? l.color,
    darkColor: local?.darkColor,
    icon: l.icon,
    topicIds: Array.isArray(l.topicIds) ? l.topicIds : [],
    autoDistrictTypes: Array.isArray(l.autoDistrictTypes) ? l.autoDistrictTypes : [],
    // ⚠ This whitelists fields, so anything not named here is DROPPED. Carried
    // through only when it is a real number: writing a default would make every
    // lens look server-ordered and permanently disable the LENS_DISPLAY_ORDER
    // fallback that covers a server which has not deployed the field yet.
    ...(Number.isFinite(l.sortOrder) ? { sortOrder: l.sortOrder } : {}),
  };
}

// The lens color for the surface it is drawn on. Lenses that read the same on
// either background declare only `color`.
export function getLensColor(lens, isDark) {
  if (!lens) return null;
  return (isDark && lens.darkColor) || lens.color;
}

// Ink for text and icons sitting on a filled lens chip. The light dark-mode
// colors need dark ink; the deep ones keep white.
export function getLensInk(lens, isDark) {
  return isDark && lens?.darkColor ? '#131416' : '#FFFFFF';
}

// Returns the subset of a topics array that belongs to this lens, in lens order.
export function getTopicsForLens(lens, allTopics) {
  return lens.topicIds
    .map(id => allTopics.find(t => t.id === id))
    .filter(Boolean);
}

// A user lens has no colour of its own: /compass/my-lenses does not store one.
// The same hex Essentials gives them, and deliberately NOT the uncalibrated
// violet — that violet already means "this needs calibrating" on the topic pills
// and the Calibrate button sitting right beside the lens row, so a custom lens
// wearing it read as a warning. Same collision Essentials removed.
export const CUSTOM_LENS_COLOR = '#00657C';

/**
 * The lens row, ready to draw: curated lenses then the user's own.
 *
 * Shared by the compass switcher and the calibration sidebar so the two cannot
 * drift. The calibration page previously rendered `lenses` and `userLenses`
 * raw, which is why a custom lens there had no colour to wear and a curated one
 * showed its full "Federal Lens" name where the compass shows "Federal".
 *
 * ⚠ A curated lens whose topics the open season does not serve is DROPPED, not
 * shown empty. Every consumer already filters lens topics against the loaded
 * set, so an unfiltered chip opens a calibration — or pins a sidebar group —
 * with nothing in it. This is what keeps the Education Lens hidden until
 * Season 2 opens, with no feature flag to remember to flip.
 *
 * User lenses are NOT filtered that way: they are built from the user's own
 * topics, and one whose questions have all aged out should still be visible to
 * be renamed or deleted rather than vanishing without explanation.
 */
export function displayLenses({ lenses, userLenses, topics } = {}) {
  const served = Array.isArray(topics) ? topics : [];
  const curated = orderLenses(lenses)
    .filter((l) => (l?.topicIds || []).some((id) => served.some((t) => t?.id === id)))
    .map((l) => ({ ...l, shortLabel: lensShortLabel(l) }));

  const mine = (Array.isArray(userLenses) ? userLenses : []).map((l) => ({
    ...l,
    color: CUSTOM_LENS_COLOR,
    flagCount: (l?.needsRecalibration || []).length,
  }));

  return [...curated, ...mine];
}
