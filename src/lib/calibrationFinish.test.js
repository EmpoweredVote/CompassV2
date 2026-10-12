// src/lib/calibrationFinish.test.js — pure-logic only, no jsdom/React import.

import { describe, it, expect } from 'vitest';
import {
  isRecalibrationRun,
  nextCompassSelection,
  MAX_COMPASS_TOPICS,
} from './calibrationFinish';

describe('isRecalibrationRun', () => {
  it('is true only for an explicit, non-empty list of questions to revisit', () => {
    expect(isRecalibrationRun(['a', 'b'])).toBe(true);
    expect(isRecalibrationRun([])).toBe(false);
    expect(isRecalibrationRun(null)).toBe(false);
    expect(isRecalibrationRun(undefined)).toBe(false);
  });
});

describe('nextCompassSelection — a re-ask run', () => {
  it('🔴 leaves the compass untouched', () => {
    // The bug: reviewing the questions a season had revised replaced the user's
    // compass with every question they reviewed. The prompt promises "your
    // answers still stand" — it is about answers, not about which topics are on
    // the compass, and some reviewed questions are not on it at all.
    expect(
      nextCompassSelection({ answeredIds: ['x', 'y'], isRecalibration: true })
    ).toBe(null);
  });

  it('leaves it untouched even when many questions were reviewed', () => {
    const seventeen = Array.from({ length: 17 }, (_, i) => `t${i}`);
    expect(
      nextCompassSelection({ answeredIds: seventeen, isRecalibration: true })
    ).toBe(null);
  });
});

describe('nextCompassSelection — a normal run', () => {
  it('replaces the selection with what was answered', () => {
    expect(nextCompassSelection({ answeredIds: ['a', 'b', 'c'] })).toEqual(['a', 'b', 'c']);
  });

  it('caps at the compass maximum', () => {
    // Nothing downstream enforces the cap, and an over-long selection renders
    // a chart with more spokes than it can label.
    const twelve = Array.from({ length: 12 }, (_, i) => `t${i}`);
    const out = nextCompassSelection({ answeredIds: twelve });
    expect(out).toHaveLength(MAX_COMPASS_TOPICS);
    expect(out[0]).toBe('t0');
    expect(out[MAX_COMPASS_TOPICS - 1]).toBe(`t${MAX_COMPASS_TOPICS - 1}`);
  });

  it('keeps an exactly-full compass intact', () => {
    const eight = Array.from({ length: 8 }, (_, i) => `t${i}`);
    expect(nextCompassSelection({ answeredIds: eight })).toEqual(eight);
  });

  it('allows an empty result — answering nothing clears the compass', () => {
    expect(nextCompassSelection({ answeredIds: [] })).toEqual([]);
  });

  it('leaves the selection alone rather than clearing it on a bad input', () => {
    // A missing list is a programming error, not an instruction to wipe the
    // user's compass; null means "do not write".
    expect(nextCompassSelection({ answeredIds: undefined })).toBe(null);
    expect(nextCompassSelection({})).toBe(null);
    expect(nextCompassSelection()).toBe(null);
  });
});
