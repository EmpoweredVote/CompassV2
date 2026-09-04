import { describe, it, expect } from "vitest";
import { copyFor, flagWeight, mergeFlags, isSuppressed, offCompassSuppressed } from "./recalibration";

/**
 * The server decides WHAT is flagged (CC_0061, via /compass/recalibration-flags
 * and /compass/my-lenses). This module decides only how it READS, and these
 * tests pin the two distinctions that were easy to get wrong:
 *
 *   1. `moved` and `reworded` share reason `question_revised`, but only `moved`
 *      blanked the spoke. Copy keyed on `reason` tells six users their answer
 *      "was given against the earlier wording" while it is missing from the
 *      chart entirely.
 *   2. There are 89 reworded answers against 7 suppressed. Giving both the same
 *      amber warning puts a warning on half of an affected compass, which is
 *      how a warning stops being read.
 */

const flag = (over = {}) => ({
  topicId: "t1",
  reason: "question_revised",
  disposition: "reworded",
  currentValue: 3,
  publicNote: "",
  answeredVersion: 1,
  effectiveVersion: 2,
  ...over,
});

describe("isSuppressed — which answers left the chart", () => {
  it("is true for the two dispositions that withhold a value", () => {
    expect(isSuppressed("moved")).toBe(true);
    expect(isSuppressed("invalidated")).toBe(true);
  });

  it("is false for the ones that keep it", () => {
    expect(isSuppressed("reworded")).toBe(false);
    expect(isSuppressed("fresh")).toBe(false);
  });

  it("does not guess at a disposition it has never heard of", () => {
    // Fail open: an unknown word must not blank somebody's answer.
    expect(isSuppressed(undefined)).toBe(false);
    expect(isSuppressed("something_new")).toBe(false);
  });
});

describe("copyFor — it never claims the wrong thing happened", () => {
  it("tells a reworded answer it still stands", () => {
    const c = copyFor(flag({ disposition: "reworded" }));
    expect(c.title).toBe("This question was updated");
    expect(c.body).toContain("still stands");
    expect(c.action).toBe("Review");
  });

  it("tells a moved answer it was set aside, and does not say the option is gone", () => {
    const c = copyFor(flag({ disposition: "moved" }));
    expect(c.body).toContain("set your answer aside");
    expect(c.body).not.toContain("no longer exists");
    expect(c.action).toBe("Recalibrate");
  });

  it("tells an invalidated answer its option is gone", () => {
    const c = copyFor(flag({ disposition: "invalidated", reason: "answer_invalidated" }));
    expect(c.title).toContain("no longer exists");
    expect(c.body).toContain("set aside");
    expect(c.action).toBe("Recalibrate");
  });

  // 🔴 The regression the whole split exists to prevent. `moved` and `reworded`
  // arrive with the SAME reason, so copy keyed on reason gives them the same
  // words — one of which is false.
  it("gives moved and reworded different words despite one reason", () => {
    const moved = copyFor(flag({ disposition: "moved" }));
    const reworded = copyFor(flag({ disposition: "reworded" }));

    expect(moved.reason).toBe(reworded.reason ?? moved.reason);
    expect(moved.title).not.toBe(reworded.title);
    expect(moved.body).not.toBe(reworded.body);
  });

  it("offers no action for a topic the season simply is not asking", () => {
    const c = copyFor(flag({ reason: "not_asked_this_season", disposition: "fresh" }));
    expect(c.body).toContain("kept");
    expect(c.action).toBeNull();
  });

  // not_asked_this_season is decided from the effective revision, not the
  // disposition, and carries 'fresh'. Reason has to win for that one case.
  it("lets not_asked_this_season win over its fresh disposition", () => {
    const c = copyFor(flag({ reason: "not_asked_this_season", disposition: "fresh" }));
    expect(c.title).toContain("current season");
  });

  it("falls back to the revised copy rather than rendering nothing", () => {
    const c = copyFor(flag({ disposition: "who_knows", reason: "who_knows" }));
    expect(c.title).toBeTruthy();
    expect(c.body).toBeTruthy();
  });
});

describe("flagWeight — loud for what vanished, quiet for what did not", () => {
  it("is loud when the answer was withheld", () => {
    expect(flagWeight(flag({ disposition: "moved" }))).toBe("loud");
    expect(flagWeight(flag({ disposition: "invalidated" }))).toBe("loud");
  });

  it("is quiet when the answer is still on the chart", () => {
    expect(flagWeight(flag({ disposition: "reworded" }))).toBe("quiet");
  });

  it("is quiet for a topic the season is not asking", () => {
    expect(flagWeight(flag({ reason: "not_asked_this_season", disposition: "fresh" }))).toBe("quiet");
  });
});

describe("mergeFlags — the compass and the lens both get to speak", () => {
  it("includes flags for selected topics with no lens in play", () => {
    const map = mergeFlags({ compassFlags: [flag({ topicId: "a" })], lensFlags: [] });
    expect(map.get("a")).toBeTruthy();
  });

  it("still includes the active lens's flags", () => {
    const map = mergeFlags({ compassFlags: [], lensFlags: [flag({ topicId: "b" })] });
    expect(map.get("b")).toBeTruthy();
  });

  it("does not double-count a topic in both", () => {
    const map = mergeFlags({
      compassFlags: [flag({ topicId: "c" })],
      lensFlags: [flag({ topicId: "c" })],
    });
    expect(map.size).toBe(1);
  });

  it("drops the ones dismissed this session", () => {
    const map = mergeFlags({
      compassFlags: [flag({ topicId: "d" }), flag({ topicId: "e" })],
      lensFlags: [],
      dismissed: new Set(["d"]),
    });
    expect(map.has("d")).toBe(false);
    expect(map.has("e")).toBe(true);
  });

  // A dismissal must not resurrect via the other source.
  it("honours a dismissal against both sources", () => {
    const map = mergeFlags({
      compassFlags: [flag({ topicId: "f" })],
      lensFlags: [flag({ topicId: "f" })],
      dismissed: new Set(["f"]),
    });
    expect(map.has("f")).toBe(false);
  });

  it("copes with either source being absent", () => {
    expect(mergeFlags({}).size).toBe(0);
    expect(mergeFlags({ compassFlags: null, lensFlags: undefined }).size).toBe(0);
  });

  // A suppressed answer is the one that must never be lost to a merge order
  // accident: it is the only kind whose spoke is already blank.
  it("prefers the suppressed record when the two sources disagree", () => {
    const map = mergeFlags({
      compassFlags: [flag({ topicId: "g", disposition: "moved" })],
      lensFlags: [flag({ topicId: "g", disposition: "reworded" })],
    });
    expect(map.get("g").disposition).toBe("moved");
  });
});

describe("offCompassSuppressed — the answers set aside where nobody can see them", () => {
  // 🔴 WHY THIS EXISTS. The flags endpoint covers every answered topic, not just
  // the selected ones, because scoping to the selection reached only 12 of the
  // 96 non-fresh answers — `invalidated` 0 of 1, `moved` 2 of 6. But most
  // answers are not on the user's spokes, so those flags have no pill to hang
  // on. This is the set that needs saying out loud somewhere else.
  const map = (...flags) => new Map(flags.map((f) => [f.topicId, f]));

  it("finds a suppressed answer on a topic not currently shown", () => {
    const out = offCompassSuppressed(map(flag({ topicId: "x", disposition: "moved" })), []);
    expect(out.map((f) => f.topicId)).toEqual(["x"]);
  });

  it("ignores a suppressed answer that already has a spoke", () => {
    // It has a pill there. Saying it twice is nagging.
    const out = offCompassSuppressed(map(flag({ topicId: "x", disposition: "moved" })), ["x"]);
    expect(out).toEqual([]);
  });

  // ⚠ THE 79 THAT MUST STAY QUIET. Reworded answers kept their value, so nothing
  // vanished and there is nothing to report. Surfacing them here would be the
  // same noise the two-weight marker exists to avoid, at four times the volume.
  it("ignores a reworded answer off the compass", () => {
    const out = offCompassSuppressed(map(flag({ topicId: "y", disposition: "reworded" })), []);
    expect(out).toEqual([]);
  });

  it("ignores a topic the season is not asking", () => {
    // No value was withheld and no recalibration is possible — the question is
    // not on the board to answer.
    const out = offCompassSuppressed(
      map(flag({ topicId: "z", reason: "not_asked_this_season", disposition: "fresh" })),
      []
    );
    expect(out).toEqual([]);
  });

  it("reports invalidated as well as moved", () => {
    const out = offCompassSuppressed(
      map(
        flag({ topicId: "a", disposition: "moved" }),
        flag({ topicId: "b", disposition: "invalidated" })
      ),
      []
    );
    expect(out.map((f) => f.topicId).sort()).toEqual(["a", "b"]);
  });

  it("copes with no selection and no flags", () => {
    expect(offCompassSuppressed(new Map(), undefined)).toEqual([]);
    expect(offCompassSuppressed(undefined, [])).toEqual([]);
  });
});
