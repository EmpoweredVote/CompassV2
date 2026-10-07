// src/lib/sourceDate.test.js — pure-logic only, no jsdom/React import.

import { describe, it, expect } from 'vitest';
import { formatSourceDate } from './sourceDate';

describe('formatSourceDate', () => {
  it('formats a day date', () => {
    expect(formatSourceDate('2022-08-05', 'day')).toBe('Aug 5, 2022');
  });

  it('formats a month date as month and year, never a day', () => {
    expect(formatSourceDate('2022-08-01', 'month')).toBe('Aug 2022');
  });

  it('formats a year date as the year only, never Jan 1', () => {
    expect(formatSourceDate('2022-01-01', 'year')).toBe('2022');
  });

  it('does not shift the day with the time zone', () => {
    expect(formatSourceDate('2022-01-01', 'day')).toBe('Jan 1, 2022');
    expect(formatSourceDate('2022-12-31', 'day')).toBe('Dec 31, 2022');
  });

  it('returns an empty string when the date is unknown', () => {
    expect(formatSourceDate(null, null)).toBe('');
    expect(formatSourceDate(undefined, undefined)).toBe('');
    expect(formatSourceDate('', 'day')).toBe('');
  });

  it('returns an empty string for a date with no precision', () => {
    expect(formatSourceDate('2022-08-05', null)).toBe('');
    expect(formatSourceDate('2022-08-05', 'decade')).toBe('');
  });

  it('returns an empty string for malformed input', () => {
    expect(formatSourceDate('August 5', 'day')).toBe('');
    expect(formatSourceDate('2022-13-01', 'month')).toBe('');
    expect(formatSourceDate(20220805, 'day')).toBe('');
  });
});
