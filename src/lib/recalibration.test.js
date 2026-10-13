import { describe, it, expect } from "vitest";
import { copyFor, flagWeight, mergeFlags, isSuppressed, offCompassFlags, optionChange } from "./recalibration";

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

describe("offCompassFlags — the flags with no spoke to hang on", () => {
  // 🔴 WHY THIS EXISTS. The flags endpoint covers every answered topic, not just
  // the selected ones, because scoping to the selection reached only 12 of the
  // 96 non-fresh answers — `invalidated` 0 of 1, `moved` 2 of 6. Most answers
  // are not on the user's spokes, so most flags have no pill to hang on.
  //
  // ⚠ TWO GROUPS, NOT ONE COUNT. `setAside` lost a value; `updated` did not.
  // Adding them into a single number would say "84 answers need attention" when
  // 79 of them are intact, which is the distinction the copy and the two-weight
  // marker both exist to preserve.
  const map = (...flags) => new Map(flags.map((f) => [f.topicId, f]));

  it("puts a suppressed off-compass answer in setAside", () => {
    const out = offCompassFlags(map(flag({ topicId: "x", disposition: "moved" })), []);
    expect(out.setAside.map((f) => f.topicId)).toEqual(["x"]);
    expect(out.updated).toEqual([]);
  });

  it("puts a reworded off-compass answer in updated, not setAside", () => {
    const out = offCompassFlags(map(flag({ topicId: "y", disposition: "reworded" })), []);
    expect(out.updated.map((f) => f.topicId)).toEqual(["y"]);
    expect(out.setAside).toEqual([]);
  });

  it("ignores anything that already has a spoke", () => {
    // It has a pill there. Saying it twice is nagging.
    const out = offCompassFlags(
      map(
        flag({ topicId: "x", disposition: "moved" }),
        flag({ topicId: "y", disposition: "reworded" })
      ),
      ["x", "y"]
    );
    expect(out.setAside).toEqual([]);
    expect(out.updated).toEqual([]);
  });

  it("ignores a topic the season is not asking", () => {
    // No value was withheld and no recalibration is possible — the question is
    // not on the board to answer.
    const out = offCompassFlags(
      map(flag({ topicId: "z", reason: "not_asked_this_season", disposition: "fresh" })),
      []
    );
    expect(out.setAside).toEqual([]);
    expect(out.updated).toEqual([]);
  });

  it("counts invalidated as set aside, alongside moved", () => {
    const out = offCompassFlags(
      map(
        flag({ topicId: "a", disposition: "moved" }),
        flag({ topicId: "b", disposition: "invalidated" })
      ),
      []
    );
    expect(out.setAside.map((f) => f.topicId).sort()).toEqual(["a", "b"]);
  });

  it("keeps the two groups disjoint", () => {
    const out = offCompassFlags(
      map(
        flag({ topicId: "a", disposition: "moved" }),
        flag({ topicId: "b", disposition: "reworded" }),
        flag({ topicId: "c", disposition: "invalidated" })
      ),
      []
    );
    const ids = [...out.setAside, ...out.updated].map((f) => f.topicId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(3);
  });

  it("copes with no selection and no flags", () => {
    expect(offCompassFlags(new Map(), undefined)).toEqual({ setAside: [], updated: [] });
    expect(offCompassFlags(undefined, [])).toEqual({ setAside: [], updated: [] });
  });
});

describe("optionChange — the words, not the option number", () => {
  // The whole point: editorial's note says "reworded option 4", so the reader
  // has to count options to find which one moved and is never told what the old
  // one said. These two fields answer both at once.
  const flag = (over = {}) => ({
    topicId: "t1",
    reason: "question_revised",
    disposition: "reworded",
    ...over,
  });

  it("pairs the old wording with the new one", () => {
    const got = optionChange(flag({
      answeredText: "Keep current gun laws, adding no new restrictions.",
      effectiveText: "Add no new restrictions, and at most loosen rules on carrying.",
    }));
    expect(got.kind).toBe("changed");
    expect(got.before).toBe("Keep current gun laws, adding no new restrictions.");
    expect(got.after).toBe("Add no new restrictions, and at most loosen rules on carrying.");
  });

  it("says 'unchanged' when their own option is identical", () => {
    // 16 of the 68 reworded flags in production. The revision rewrote some
    // OTHER option; this person's answer did not move a character.
    const same = "Establishing publicly funded universal childcare.";
    const got = optionChange(flag({ answeredText: same, effectiveText: same }));
    expect(got.kind).toBe("unchanged");
    expect(got.before).toBe(same);
    expect(got.after).toBe("");
  });

  it("ignores whitespace-only differences", () => {
    const got = optionChange(flag({ answeredText: " Same text ", effectiveText: "Same text" }));
    expect(got.kind).toBe("unchanged");
  });

  it("never claims a replacement for a suppressed answer", () => {
    // 🔴 The regression this guards. For `moved` the user's rung is exactly what
    // did not survive, so the text at that value now is a DIFFERENT position.
    // Rendering it as "it now reads" asserts the equivalence the disposition
    // exists to deny.
    for (const disposition of ["moved", "invalidated"]) {
      const got = optionChange(flag({
        disposition,
        answeredText: "What they picked.",
        effectiveText: "Something else entirely, at the same number.",
      }));
      expect(got.kind).toBe("gone");
      expect(got.before).toBe("What they picked.");
      expect(got.after).toBe("");
    }
  });

  it("claims no replacement for a question this season does not ask", () => {
    const got = optionChange(flag({
      reason: "not_asked_this_season",
      disposition: "fresh",
      answeredText: "What they picked.",
      effectiveText: null,
    }));
    expect(got.kind).toBe("gone");
    expect(got.before).toBe("What they picked.");
  });

  it("shows nothing when the server sends nothing", () => {
    // An older server has no such fields, and a write-in sits between rungs so
    // it matches no option on either side. Both must render as silence, not as
    // an empty quote box.
    expect(optionChange(flag()).kind).toBe("none");
    expect(optionChange(flag({ answeredText: null, effectiveText: null })).kind).toBe("none");
    expect(optionChange(flag({ answeredText: "   " })).kind).toBe("none");
    expect(optionChange(undefined).kind).toBe("none");
  });
});

describe("copyFor — a rewrite that missed their option", () => {
  it("stops telling them their answer was given against earlier wording", () => {
    // The plain reworded copy says exactly that, and it is false when the
    // option they picked is byte-identical.
    const same = "Publicly funded universal childcare.";
    const copy = copyFor({
      topicId: "t1",
      reason: "question_revised",
      disposition: "reworded",
      answeredText: same,
      effectiveText: same,
    });
    expect(copy.title).toBe("A different option on this question changed");
    expect(copy.body).not.toContain("earlier wording");
    expect(copy.action).toBe("Review");
  });

  it("still gives the plain reworded copy when their option did move", () => {
    const copy = copyFor({
      topicId: "t1",
      reason: "question_revised",
      disposition: "reworded",
      answeredText: "Old.",
      effectiveText: "New.",
    });
    expect(copy.title).toBe("This question was updated");
  });

  it("is unchanged against a server that sends no wording at all", () => {
    // The fields ship separately from this client; the old copy is the floor.
    const copy = copyFor({ topicId: "t1", reason: "question_revised", disposition: "reworded" });
    expect(copy.title).toBe("This question was updated");
  });
});
