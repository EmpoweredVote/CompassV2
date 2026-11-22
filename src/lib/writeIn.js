// Single home for write-in placement math. A write-in sits between (or beyond)
// the pre-written stances and is stored as a half-step value (x.5); 0.5 and
// 5.5 (for five stances) are legitimate edge values.
//
// "Placement" is a slot index 0..stanceCount in the displayed list: 0 is above
// the first displayed stance, stanceCount is below the last. Display order is
// relative to isInverted (display-only; stored values never change).

export function orderStances(stances, isInverted) {
  if (!Array.isArray(stances) || stances.length === 0) return [];
  const sorted = [...stances].sort((a, b) => a.value - b.value);
  return isInverted ? sorted : sorted.reverse();
}

export function valueFromPlacement(writeInIndex, stanceCount, isInverted) {
  return isInverted ? writeInIndex + 0.5 : stanceCount - writeInIndex + 0.5;
}

export function placementFromValue(value, stanceCount, isInverted) {
  const raw = isInverted ? value - 0.5 : stanceCount + 0.5 - value;
  // A stored value can outrun the current range — a 5.5 kept from before a
  // revision trimmed the topic to four stances. Unclamped, that yields -1, and
  // `items.splice(-1, 0, WRITE_IN_ID)` counts from the END, dropping the card
  // next to last instead of at the top. Clamp to the slots that exist.
  return Math.min(Math.max(Math.round(raw), 0), stanceCount);
}

export function isWriteIn(value) {
  return value != null && !Number.isInteger(value);
}

/**
 * Should a reported cancel also clear the SERVER's copy of the answer?
 *
 * StanceChooser reports a cancel for three gestures (see its `reason` note).
 * Two of them mean the user is left with no answer — the card's × and an
 * emptied textarea — and the stored row has to go, or the next hydration hands
 * the abandoned write-in straight back.
 *
 * 🔴 "replaced" MUST NOT DELETE. It means a pre-written stance is being picked,
 * and its POST goes out in the same tick. The two requests are independent and
 * unordered, so a DELETE on that path can land after the POST and soft-delete
 * the answer the user just gave — lost server-side, surfacing only on a reload.
 * The stance POST already drops the row's write_in_text on its own, so there is
 * nothing for that path to clean up.
 *
 * ⚠ UNKNOWN REASONS DO NOT DELETE, DELIBERATELY. Written as `reason !==
 * 'replaced'`, a future gesture that forgets to say why would silently start
 * deleting — the same bug through the back door. The costs are not symmetric:
 * failing to clear leaves a stale row the user can clear again, while clearing
 * wrongly destroys an answer they gave. So this allows, rather than excludes.
 *
 * It lives here rather than in each parent because three surfaces own write-in
 * state (FullCalibration, CalibrationOverlay, CombinedPage's drawer) and a rule
 * copied three times is a rule that drifts twice.
 */
export function clearsServerCopy(reason) {
  return reason === 'abandoned' || reason === 'emptied';
}
