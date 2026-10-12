// src/lib/calibrationQueue.test.js — pure-logic only, no jsdom/React import.

import { describe, it, expect } from 'vitest';
import { nextTopicFrom, isFullyAnswered, needsAnswer } from './calibrationQueue';

const T = (id, slug) => ({ id, short_title: slug });
const TOPICS = [T('1', 'housing'), T('2', 'climate'), T('3', 'schools'), T('4', 'safety')];

const ALL_ANSWERED = { housing: 3, climate: 2, schools: 4, safety: 1 };
const SOME_ANSWERED = { housing: 3, schools: 4 };

describe('isFullyAnswered', () => {
  it('is true only when every topic has a positive answer', () => {
    expect(isFullyAnswered(TOPICS, ALL_ANSWERED)).toBe(true);
    expect(isFullyAnswered(TOPICS, SOME_ANSWERED)).toBe(false);
  });

  it('treats 0 and missing as unanswered', () => {
    // The app stores "no answer" as absent; 0 shows up from older payloads.
    expect(isFullyAnswered(TOPICS, { ...ALL_ANSWERED, safety: 0 })).toBe(false);
    expect(isFullyAnswered(TOPICS, { ...ALL_ANSWERED, safety: undefined })).toBe(false);
  });

  it('is false for an empty topic list rather than vacuously true', () => {
    // Topics load async; a vacuous true would flash the completion screen.
    expect(isFullyAnswered([], ALL_ANSWERED)).toBe(false);
  });
});

describe('nextTopicFrom — filling gaps', () => {
  it('goes to the next unanswered topic after the current one', () => {
    expect(nextTopicFrom(TOPICS, '1', SOME_ANSWERED)?.id).toBe('2');
  });

  it('wraps back to an earlier gap when none follow', () => {
    expect(nextTopicFrom(TOPICS, '3', { housing: 3, climate: 2, schools: 4 })?.id).toBe('4');
    expect(nextTopicFrom(TOPICS, '4', { climate: 2, schools: 4, safety: 1 })?.id).toBe('1');
  });

  it('returns null when the last gap is filled, which ends the session', () => {
    // This is the genuine finish — it must keep working, or answering the final
    // question would no longer show the completion screen.
    expect(nextTopicFrom(TOPICS, '4', ALL_ANSWERED)).toBe(null);
  });
});

describe('nextTopicFrom — reviewing an already-complete compass', () => {
  it('🔴 walks forward in order instead of ending the session', () => {
    // The bug: with no gaps left this returned null, so revising a single
    // answer threw the user onto the "Fully Calibrated" dead end.
    expect(nextTopicFrom(TOPICS, '1', ALL_ANSWERED, true)?.id).toBe('2');
    expect(nextTopicFrom(TOPICS, '2', ALL_ANSWERED, true)?.id).toBe('3');
  });

  it('stays put on the last topic rather than wrapping', () => {
    expect(nextTopicFrom(TOPICS, '4', ALL_ANSWERED, true)).toBe(null);
  });

  it('still prefers a real gap over list order', () => {
    // Review mode must not skip past a topic the user cleared mid-session.
    expect(nextTopicFrom(TOPICS, '1', SOME_ANSWERED, true)?.id).toBe('2');
  });
});

describe('nextTopicFrom — edge cases', () => {
  it('survives an unknown current id', () => {
    expect(() => nextTopicFrom(TOPICS, 'nope', ALL_ANSWERED, true)).not.toThrow();
    expect(nextTopicFrom(TOPICS, 'nope', SOME_ANSWERED)?.id).toBe('2');
  });

  it('survives an empty or missing topic list', () => {
    expect(nextTopicFrom([], '1', ALL_ANSWERED)).toBe(null);
    expect(nextTopicFrom(undefined, '1', ALL_ANSWERED)).toBe(null);
  });

  it('survives a missing answers map', () => {
    expect(nextTopicFrom(TOPICS, '1', undefined)?.id).toBe('2');
  });
});

// ── Re-asking questions a season revised ───────────────────────────────────
// A revised question still carries the user's old answer, so "already answered"
// is the wrong test for whether it needs asking. mustReanswer is the set of
// topics the user arrived to re-answer; they count as needing an answer until
// they are answered again in this session.

describe('needsAnswer', () => {
  it('is true for a topic with no answer', () => {
    expect(needsAnswer(TOPICS[1], SOME_ANSWERED, null)).toBe(true);
  });

  it('is false for an answered topic nobody asked to revisit', () => {
    expect(needsAnswer(TOPICS[0], SOME_ANSWERED, null)).toBe(false);
  });

  it('🔴 is true for an answered topic that must be re-answered', () => {
    // The bug this exists for: a reworded question kept its old answer, so the
    // re-ask flow counted it as done, offered "Finish" immediately, and nothing
    // was ever re-answered or re-stamped.
    expect(needsAnswer(TOPICS[0], ALL_ANSWERED, new Set(['1']))).toBe(true);
  });

  it('falls back to the plain answered test when the set is missing', () => {
    expect(needsAnswer(TOPICS[0], ALL_ANSWERED, undefined)).toBe(false);
    expect(needsAnswer(TOPICS[0], ALL_ANSWERED, new Set())).toBe(false);
  });
});

describe('isFullyAnswered with a re-ask set', () => {
  it('is false while a topic still owes a re-answer', () => {
    expect(isFullyAnswered(TOPICS, ALL_ANSWERED, new Set(['3']))).toBe(false);
  });

  it('is true again once nothing owes one', () => {
    expect(isFullyAnswered(TOPICS, ALL_ANSWERED, new Set())).toBe(true);
  });
});

describe('nextTopicFrom with a re-ask set', () => {
  it('walks the topics owing a re-answer, skipping the settled ones', () => {
    const must = new Set(['2', '4']);
    expect(nextTopicFrom(TOPICS, '1', ALL_ANSWERED, false, must)?.id).toBe('2');
    expect(nextTopicFrom(TOPICS, '2', ALL_ANSWERED, false, must)?.id).toBe('4');
  });

  it('ends the run once the last re-answer is done', () => {
    expect(nextTopicFrom(TOPICS, '4', ALL_ANSWERED, false, new Set(['4']))).toBe(null);
  });

  it('still prefers a genuinely unanswered topic over one owing a re-answer', () => {
    // A gap is a stronger claim than a revision: the compass cannot render a
    // spoke that was never answered at all.
    const must = new Set(['3']);
    expect(nextTopicFrom(TOPICS, '1', SOME_ANSWERED, false, must)?.id).toBe('2');
  });

  it('treats a re-answered topic as settled — it leaves the queue', () => {
    // The set shrinks as the user answers, so the same topic is not offered
    // again on the next advance.
    const must = new Set(['2']);
    expect(nextTopicFrom(TOPICS, '1', ALL_ANSWERED, false, must)?.id).toBe('2');
    must.delete('2');
    expect(nextTopicFrom(TOPICS, '1', ALL_ANSWERED, false, must)).toBe(null);
  });
});
