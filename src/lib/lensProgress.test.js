import { describe, it, expect } from "vitest";
import { lensProgress } from "./lensProgress";

const topics = [
  { id: "t1", short_title: "Taxes" },
  { id: "t2", short_title: "Housing" },
  { id: "t3", short_title: "Abortion" },
];

describe("lensProgress — a lens's own fraction", () => {
  it("counts the lens's served topics that have an answer", () => {
    const p = lensProgress({
      lens: { topicIds: ["t1", "t2", "t3"] },
      topics,
      answers: { Taxes: 4, Housing: 2 },
    });
    expect(p).toEqual({ answered: 2, total: 3, pct: 67, complete: false });
  });

  // 🔴 THE DIVISOR IS THE SERVED SET. A lens may name a topic this season does
  // not ask — curated lenses are filtered on exactly that upstream, and a USER
  // lens is whatever its owner saved, which outlives a season. Dividing by the
  // raw topicIds leaves a lens that can never reach full and a voter with no
  // way to find the question that is missing.
  it("ignores a topic the lens names but the season does not ask", () => {
    const p = lensProgress({
      lens: { topicIds: ["t1", "t2", "retired-topic"] },
      topics,
      answers: { Taxes: 4, Housing: 2 },
    });
    expect(p).toEqual({ answered: 2, total: 2, pct: 100, complete: true });
  });

  it("treats 0 and a missing key alike — neither is an answer", () => {
    const p = lensProgress({
      lens: { topicIds: ["t1", "t2"] },
      topics,
      answers: { Taxes: 0 },
    });
    expect(p.answered).toBe(0);
  });

  // A lens serving nothing has not been finished — it has not been started.
  // Rounding an empty set up would put a tick on a lens the voter has never
  // been asked a question from.
  it("is 0% and incomplete when the lens serves nothing", () => {
    expect(lensProgress({ lens: { topicIds: [] }, topics, answers: {} }))
      .toEqual({ answered: 0, total: 0, pct: 0, complete: false });
    expect(lensProgress({ lens: { topicIds: ["gone"] }, topics, answers: {} }).complete).toBe(false);
  });

  it("survives a malformed lens or missing answers", () => {
    expect(lensProgress({}).total).toBe(0);
    expect(lensProgress().pct).toBe(0);
    expect(lensProgress({ lens: { topicIds: ["t1"] }, topics }).answered).toBe(0);
  });
});
