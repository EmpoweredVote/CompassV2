// tourPlan.js
// Which steps of a coach-mark tour actually run, and how they are numbered.
//
// The compass tour describes four regions, but not all four exist on every
// viewport: the chart and topic-list steps pointed at desktop-only columns, and
// the compare column moved to the Compare tab on mobile. The tour walked past
// the missing ones without renumbering, so a phone was shown "1 of 4" and then
// "4 of 4" — two cards claiming to be part of a four-step tour that was never
// going to happen.
//
// A plan is the ordered list of step indices that have something on screen to
// point at, captured when the tour starts. Numbering runs against the plan, so
// the count matches what the user will actually be shown.

/** Ordered indices of the steps that have a target. `live[i]` is per step. */
export function buildPlan(live) {
  if (!Array.isArray(live)) return [];
  return live.reduce((acc, isLive, i) => (isLive ? [...acc, i] : acc), []);
}

/** "2 of 3" for `step`, or null when it is not in the plan. */
export function labelFor(plan, step) {
  const pos = plan?.indexOf(step) ?? -1;
  if (pos === -1) return null;
  return `${pos + 1} of ${plan.length}`;
}

/** The step after `step` in the plan, or -1 when it was the last one. */
export function nextInPlan(plan, step) {
  if (!plan || plan.length === 0) return -1;
  const pos = plan.indexOf(step);
  // A step that fell out of the plan (its target vanished mid-tour) still has
  // to lead somewhere, so resume at the first planned step beyond it.
  if (pos === -1) return plan.find((i) => i > step) ?? -1;
  return pos + 1 < plan.length ? plan[pos + 1] : -1;
}

/** True when `step` is the last one the plan will show. */
export function isLastInPlan(plan, step) {
  return nextInPlan(plan, step) === -1;
}
