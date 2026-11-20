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
  return Math.round(raw);
}

export function isWriteIn(value) {
  return value != null && !Number.isInteger(value);
}
