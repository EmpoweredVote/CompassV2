import { describe, it, expect } from "vitest";
import { answerReveal, indexStats, MIN_STATS_SAMPLE } from "./topicStats";

const stats = (over = {}) => ({
  topicId: "t1",
  total: 1743,
  byValue: { 1: 120, 2: 300, 3: 80, 4: 1240, 5: 3 },
  ...over,
});

describe("answerReveal — the sentence shown after a voter picks", () => {
  it("names how many officials picked the same option", () => {
    const r = answerReveal({ stats: stats(), value: 4, topicName: "Taxes" });
    expect(r.kind).toBe("share");
    expect(r.agree).toBe(1240);
    expect(r.text).toBe("You're with 1,240 of the 1,743 officials who answered on Taxes.");
  });

  // 🔴 THE CLAIM THIS PROTECTS. byValue is withheld by the server for a topic
  // whose ladder was ever remapped, because the values in those buckets do not
  // all mean the same position. Quietly treating a missing bucket as zero would
  // turn that into "none of them picked this" — a confident false statement
  // about real officials, which is worse than the silence it replaced.
  it("falls back to a bare count when the server withheld byValue", () => {
    const r = answerReveal({ stats: stats({ byValue: undefined }), value: 4, topicName: "Taxes" });
    expect(r.kind).toBe("count");
    expect(r.agree).toBeNull();
    expect(r.text).toBe("1,743 officials have taken a position on Taxes.");
  });

  // "Nobody agrees with you" is a real finding and the one most likely to be
  // mistaken for a bug and dropped on the way through.
  it("keeps a zero as a result and words it as one", () => {
    const r = answerReveal({ stats: stats({ byValue: { 1: 1743 } }), value: 5, topicName: "Taxes" });
    expect(r.kind).toBe("share");
    expect(r.agree).toBe(0);
    expect(r.text).toBe("Of the 1,743 officials who answered on Taxes, none picked this one.");
  });

  it("says nothing at all below the sample floor", () => {
    expect(answerReveal({ stats: stats({ total: MIN_STATS_SAMPLE - 1 }), value: 4 })).toBeNull();
    expect(answerReveal({ stats: stats({ total: 0 }), value: 4 })).toBeNull();
    expect(answerReveal({ stats: null, value: 4 })).toBeNull();
  });

  it("shows a topic with exactly the floor", () => {
    const r = answerReveal({ stats: stats({ total: MIN_STATS_SAMPLE, byValue: { 4: 5 } }), value: 4 });
    expect(r.kind).toBe("share");
  });

  // A write-in sits BETWEEN rungs, so there is no bucket it belongs to. Rounding
  // it onto the nearest one would credit the voter with company they do not have.
  it("will not place a write-in or half rung in a bucket", () => {
    const r = answerReveal({ stats: stats(), value: 4.5, topicName: "Taxes" });
    expect(r.kind).toBe("count");
    const out = answerReveal({ stats: stats(), value: 7 });
    expect(out.kind).toBe("count");
  });

  it("reads correctly with no topic name to hand", () => {
    expect(answerReveal({ stats: stats(), value: 4 }).text)
      .toBe("You're with 1,240 of the 1,743 officials who answered.");
  });

  it("carries a percentage for the caller that wants a bar", () => {
    expect(answerReveal({ stats: stats({ total: 100, byValue: { 2: 25 } }), value: 2 }).pct).toBe(25);
  });
});

describe("indexStats", () => {
  it("keys the payload by topic id and survives junk", () => {
    const m = indexStats([{ topicId: "a", total: 1 }, null, {}, { total: 9 }]);
    expect(m.size).toBe(1);
    expect(m.get("a").total).toBe(1);
    expect(indexStats(undefined).size).toBe(0);
  });
});
