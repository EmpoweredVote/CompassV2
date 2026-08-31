import { describe, it, expect } from "vitest";
import { shouldSyncCompass, compassToPublish, buildSharedAnswers } from "./compassSync.js";

// The state of a signed-in user, loaded, looking at their own compass — the one
// combination in which their compass may be written to the server.
const READY = { serverLoaded: true, isLoggedIn: true, activeLensKey: null };

describe("shouldSyncCompass", () => {
  it("syncs when signed in, loaded, and on the user's own compass", () => {
    expect(shouldSyncCompass(READY)).toBe(true);
  });

  it("does not sync before the server has been read", () => {
    // Syncing first would push whatever localStorage held over the account's
    // real compass.
    expect(shouldSyncCompass({ ...READY, serverLoaded: false })).toBe(false);
  });

  it("does not sync for guests", () => {
    expect(shouldSyncCompass({ ...READY, isLoggedIn: false })).toBe(false);
  });

  it("does not sync while a lens is being viewed", () => {
    // A lens is a view. Persisting it as selected_topic_ids overwrites the
    // user's real compass and leaves consumers unable to tell the two apart.
    expect(shouldSyncCompass({ ...READY, activeLensKey: "federal" })).toBe(false);
    expect(shouldSyncCompass({ ...READY, activeLensKey: "u_7f3a91" })).toBe(false);
  });

  it("🔴 syncs a compass that happens to be identical to a lens", () => {
    // THE REGRESSION THIS PREDICATE EXISTS FOR. The old guard asked "do these
    // topics all belong to some lens?" and refused to sync when they did. That
    // is true by construction the moment a user saves their own compass as a
    // lens — so their compass silently stopped being saved, for good.
    //
    // Whether the topic set matches a lens is not an input here, and that is
    // the entire point: only activeLensKey can distinguish "I am viewing a
    // lens" from "my compass happens to look like one".
    expect(shouldSyncCompass(READY)).toBe(true);
    expect(Object.keys(READY)).not.toContain("selectedTopics");
  });

  it("treats an empty-string lens key as no lens", () => {
    // sessionStorage.getItem returns "" for a key written as empty; it must not
    // read as an active lens.
    expect(shouldSyncCompass({ ...READY, activeLensKey: "" })).toBe(true);
  });
});

describe("compassToPublish", () => {
  const own = ["a", "b", "c"];
  const lens = ["x", "y"];

  it("publishes the selected topics when no lens is active", () => {
    expect(compassToPublish({ activeLensKey: null, selectedTopics: own, preLensTopics: null }))
      .toEqual(own);
  });

  it("publishes the stashed compass while a lens is active", () => {
    expect(compassToPublish({ activeLensKey: "federal", selectedTopics: lens, preLensTopics: own }))
      .toEqual(own);
  });

  it("falls back to the selected topics when a lens is active but nothing was stashed", () => {
    // Forgiving on purpose: publishing nothing would tell every other app the
    // user has no compass at all, which is worse than publishing the lens.
    expect(compassToPublish({ activeLensKey: "federal", selectedTopics: lens, preLensTopics: null }))
      .toEqual(lens);
    expect(compassToPublish({ activeLensKey: "federal", selectedTopics: lens, preLensTopics: [] }))
      .toEqual(lens);
  });

  it("ignores a stash when no lens is active", () => {
    // A leftover stash must never displace the compass the user is looking at.
    expect(compassToPublish({ activeLensKey: null, selectedTopics: own, preLensTopics: ["stale"] }))
      .toEqual(own);
  });
});

/**
 * buildSharedAnswers() — the capped projection published to shared context.
 *
 * `n` exists so a consumer can tell a payload that is merely SCOPED (normal —
 * we publish the compass plus any active lens, not every answer the user has
 * ever given) from one the cap actually TRUNCATED. Without it, "fewer answers
 * than the user has" is true almost always and therefore says nothing.
 */
describe("buildSharedAnswers", () => {
  const topics = [
    { id: 1, short_title: "econ" },
    { id: 2, short_title: "educ" },
    { id: 3, short_title: "envi" },
    { id: 4, short_title: "heal" },
    { id: 5, short_title: "immi" },
  ];
  const answers = { econ: 1, educ: 2, envi: 3, heal: 4, immi: 5 };

  it("caps the published answers and reports the full in-scope count", () => {
    const { a, n } = buildSharedAnswers({
      answerScope: [1, 2, 3, 4, 5], topics, answers, cap: 3,
    });
    expect(Object.keys(a)).toHaveLength(3);
    expect(n).toBe(5);
  });

  it("reports no drop when the scope fits under the cap", () => {
    const { a, n } = buildSharedAnswers({
      answerScope: [1, 2], topics, answers, cap: 8,
    });
    expect(Object.keys(a)).toHaveLength(2);
    expect(n).toBe(2);
  });

  it("counts only scoped topics that actually have an answer", () => {
    // A scoped topic with no answer was never going to be sent, so counting it
    // would report a drop that never happened.
    const { a, n } = buildSharedAnswers({
      answerScope: [1, 2, 3, 4], topics, answers: { econ: 1, envi: 3 }, cap: 8,
    });
    expect(Object.keys(a).sort()).toEqual(["econ", "envi"]);
    expect(n).toBe(2);
  });

  it("counts a repeated topic once", () => {
    const { a, n } = buildSharedAnswers({
      answerScope: [1, 1, 2], topics, answers, cap: 8,
    });
    expect(Object.keys(a)).toHaveLength(2);
    expect(n).toBe(2);
  });

  it("publishes the complete answer set when nothing is in scope", () => {
    const { a, n } = buildSharedAnswers({
      answerScope: [], topics, answers, cap: 8,
    });
    expect(a).toEqual(answers);
    expect(n).toBe(5);
  });

  it("publishes the complete answer set before topics have loaded", () => {
    // Without topics there is no id -> short_title map, so scoping is impossible.
    const { a, n } = buildSharedAnswers({
      answerScope: [1, 2], topics: [], answers, cap: 8,
    });
    expect(a).toEqual(answers);
    expect(n).toBe(5);
  });

  it("never reports a drop it did not make", () => {
    // The consumer's whole contract is `n > count(a)` means data is missing.
    for (const cap of [1, 3, 5, 16]) {
      const { a, n } = buildSharedAnswers({ answerScope: [1, 2, 3], topics, answers, cap });
      expect(n).toBeGreaterThanOrEqual(Object.keys(a).length);
    }
  });
});
