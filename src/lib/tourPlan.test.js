// src/lib/tourPlan.test.js — pure-logic only, no jsdom/React import.

import { describe, it, expect } from 'vitest';
import { buildPlan, labelFor, nextInPlan, isLastInPlan } from './tourPlan';

// The compass tour's four steps: compare column, chart, topic list, search.
const DESKTOP = [true, true, true, true];
// A phone on the Graph tab: no compare column, but chart, pills and search all
// have mobile targets once they carry refs.
const MOBILE_GRAPH = [false, true, true, true];
// A phone on the Compare tab: the chart lives on the other tab.
const MOBILE_COMPARE = [true, false, true, true];

describe('buildPlan', () => {
  it('keeps every step when they all have targets', () => {
    expect(buildPlan(DESKTOP)).toEqual([0, 1, 2, 3]);
  });

  it('drops the steps with nothing to point at', () => {
    expect(buildPlan(MOBILE_GRAPH)).toEqual([1, 2, 3]);
    expect(buildPlan(MOBILE_COMPARE)).toEqual([0, 2, 3]);
  });

  it('is empty when nothing is on screen, which means do not start', () => {
    expect(buildPlan([false, false, false, false])).toEqual([]);
    expect(buildPlan([])).toEqual([]);
    expect(buildPlan(undefined)).toEqual([]);
  });
});

describe('labelFor', () => {
  it('🔴 numbers against the plan, not the full step list', () => {
    // The bug: a phone saw step 0 as "1 of 4" and then step 3 as "4 of 4",
    // skipping 2 and 3 with no explanation.
    const plan = buildPlan(MOBILE_COMPARE);
    expect(labelFor(plan, 0)).toBe('1 of 3');
    expect(labelFor(plan, 2)).toBe('2 of 3');
    expect(labelFor(plan, 3)).toBe('3 of 3');
  });

  it('numbers a full desktop run normally', () => {
    const plan = buildPlan(DESKTOP);
    expect(labelFor(plan, 0)).toBe('1 of 4');
    expect(labelFor(plan, 3)).toBe('4 of 4');
  });

  it('returns null for a step that is not in the plan', () => {
    expect(labelFor(buildPlan(MOBILE_GRAPH), 0)).toBe(null);
  });
});

describe('nextInPlan', () => {
  it('walks the planned steps in order, skipping the absent ones', () => {
    const plan = buildPlan(MOBILE_GRAPH); // [1, 2, 3]
    expect(nextInPlan(plan, 1)).toBe(2);
    expect(nextInPlan(plan, 2)).toBe(3);
  });

  it('returns -1 at the end, which ends the tour', () => {
    expect(nextInPlan(buildPlan(MOBILE_GRAPH), 3)).toBe(-1);
    expect(nextInPlan(buildPlan(DESKTOP), 3)).toBe(-1);
  });

  it('resumes forward when the current step fell out of the plan', () => {
    // A target can vanish under the user — clearing a comparison unmounts the
    // stance list. The tour still has to go somewhere rather than stall.
    const plan = [0, 2, 3];
    expect(nextInPlan(plan, 1)).toBe(2);
  });

  it('returns -1 for an empty or missing plan', () => {
    expect(nextInPlan([], 0)).toBe(-1);
    expect(nextInPlan(undefined, 0)).toBe(-1);
  });
});

describe('isLastInPlan', () => {
  it('is true only for the final planned step', () => {
    const plan = buildPlan(MOBILE_COMPARE); // [0, 2, 3]
    expect(isLastInPlan(plan, 0)).toBe(false);
    expect(isLastInPlan(plan, 2)).toBe(false);
    expect(isLastInPlan(plan, 3)).toBe(true);
  });

  it('treats the real last step as last even on a trimmed mobile plan', () => {
    // "Done" rather than "Next" has to land on whatever the plan ends with,
    // not on step 3 specifically.
    expect(isLastInPlan(buildPlan([true, true, false, false]), 1)).toBe(true);
  });
});
