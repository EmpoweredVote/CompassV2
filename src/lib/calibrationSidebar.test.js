// src/lib/calibrationSidebar.test.js — pure-logic only, no jsdom/React import.

import { describe, it, expect } from 'vitest';
import { buildSidebarGroups, PINNED_GROUP_ID } from './calibrationSidebar';

const T = (id, slug) => ({ id, short_title: slug });
const CATS = [
  { id: 'c1', title: 'Housing', topics: [T('1', 'rent'), T('2', 'zoning')] },
  { id: 'c2', title: 'Courts', topics: [T('3', 'access'), T('4', 'interp')] },
  { id: 'c3', title: 'Energy', topics: [T('5', 'clean')] },
];

describe('buildSidebarGroups — no lens', () => {
  it('returns the categories unchanged', () => {
    const groups = buildSidebarGroups({ categories: CATS, lens: null });
    expect(groups).toHaveLength(3);
    expect(groups.map((g) => g.id)).toEqual(['c1', 'c2', 'c3']);
    expect(groups.every((g) => !g.pinned)).toBe(true);
  });

  it('survives missing input rather than blanking the sidebar', () => {
    expect(buildSidebarGroups({ categories: [], lens: null })).toEqual([]);
    expect(buildSidebarGroups({ categories: undefined, lens: null })).toEqual([]);
    expect(buildSidebarGroups({})).toEqual([]);
  });
});

describe('buildSidebarGroups — a lens is selected', () => {
  const lens = { key: 'federal', name: 'Federal Lens', topicIds: ['4', '1'] };

  it('pins the lens group above the categories', () => {
    const groups = buildSidebarGroups({ categories: CATS, lens });
    expect(groups[0].id).toBe(PINNED_GROUP_ID);
    expect(groups[0].pinned).toBe(true);
    expect(groups[0].title).toBe('Federal Lens');
  });

  it('keeps the lens’s own order, not the category order', () => {
    // A lens is an editorial sequence; showing it alphabetically or by category
    // would misrepresent what the lens is.
    const groups = buildSidebarGroups({ categories: CATS, lens });
    expect(groups[0].topics.map((t) => t.id)).toEqual(['4', '1']);
  });

  it('leaves the full library below, unchanged', () => {
    // The point of pinning rather than filtering: everything stays reachable.
    const groups = buildSidebarGroups({ categories: CATS, lens });
    expect(groups.slice(1).map((g) => g.id)).toEqual(['c1', 'c2', 'c3']);
    expect(groups.slice(1).flatMap((g) => g.topics.map((t) => t.id)))
      .toEqual(['1', '2', '3', '4', '5']);
  });

  it('ignores lens topics the season does not serve', () => {
    // A lens can name a question that is not in the current season; seeding it
    // would render a row that cannot be answered.
    const stale = { key: 'x', name: 'Stale', topicIds: ['4', 'nope', '9'] };
    const groups = buildSidebarGroups({ categories: CATS, lens: stale });
    expect(groups[0].topics.map((t) => t.id)).toEqual(['4']);
  });

  it('omits the pinned group entirely when nothing resolves', () => {
    const empty = { key: 'x', name: 'Empty', topicIds: ['nope'] };
    const groups = buildSidebarGroups({ categories: CATS, lens: empty });
    expect(groups.map((g) => g.id)).toEqual(['c1', 'c2', 'c3']);
  });

  it('tolerates a lens with no topicIds', () => {
    const groups = buildSidebarGroups({ categories: CATS, lens: { key: 'x', name: 'X' } });
    expect(groups.map((g) => g.id)).toEqual(['c1', 'c2', 'c3']);
  });
});
