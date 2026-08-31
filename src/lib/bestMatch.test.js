import { describe, it, expect } from "vitest";
import { bestMatchSpokes, MAX_SPOKES, MIN_SPOKES } from "./bestMatch.js";

// Display order matters for tie-breaking, so these are ordered deliberately.
const topics = [
  { id: "t1", short_title: "Housing" },
  { id: "t2", short_title: "Homelessness" },
  { id: "t3", short_title: "Civil Rights" },
  { id: "t4", short_title: "Taxes" },
  { id: "t5", short_title: "Climate Change" },
  { id: "t6", short_title: "Immigration" },
  { id: "t7", short_title: "Healthcare" },
  { id: "t8", short_title: "Abortion" },
  { id: "t9", short_title: "Tariffs" },
  { id: "t10", short_title: "Fossil Fuels" },
];

const base = { topics, maxSpokes: MAX_SPOKES };

describe("bestMatchSpokes — what counts as a candidate", () => {
  it("only includes topics BOTH sides answered", () => {
    const { displayTopicIds } = bestMatchSpokes({
      ...base,
      selectedTopics: ["t1", "t2", "t3"],
      userValues: { t1: 3, t2: 4, t3: 2 },
      polValues: { t1: 5, t3: 1 }, // no t2
    });
    expect(displayTopicIds).toEqual(["t1", "t3"]);
  });

  it("treats 0 and null as unanswered on either side", () => {
    const { displayTopicIds } = bestMatchSpokes({
      ...base,
      selectedTopics: ["t1", "t2", "t3", "t4"],
      userValues: { t1: 3, t2: 0, t3: null, t4: 2 },
      polValues: { t1: 1, t2: 4, t3: 3, t4: 0 },
    });
    expect(displayTopicIds).toEqual(["t1"]);
  });
});

describe("bestMatchSpokes — the user's own compass comes first", () => {
  it("puts selected topics first, in selectedTopics order", () => {
    const { displayTopicIds } = bestMatchSpokes({
      ...base,
      selectedTopics: ["t3", "t1"],
      userValues: { t1: 3, t3: 3, t5: 3 },
      polValues: { t1: 1, t3: 1, t5: 1 },
    });
    expect(displayTopicIds.slice(0, 2)).toEqual(["t3", "t1"]);
  });
});

describe("bestMatchSpokes — the fill pass", () => {
  it("fills remaining slots with the biggest disagreements first", () => {
    // t5 differs by 4, t6 by 1, t7 by 3 → expect t5, t7, t6.
    const { displayTopicIds } = bestMatchSpokes({
      ...base,
      selectedTopics: ["t1"],
      maxSpokes: 4,
      userValues: { t1: 3, t5: 5, t6: 3, t7: 4 },
      polValues: { t1: 3, t5: 1, t6: 2, t7: 1 },
    });
    expect(displayTopicIds).toEqual(["t1", "t5", "t7", "t6"]);
  });

  it("breaks ties by display order, not by chance", () => {
    // t5, t6, t7 all differ by exactly 2 → display order decides.
    const { displayTopicIds } = bestMatchSpokes({
      ...base,
      selectedTopics: [],
      maxSpokes: 3,
      userValues: { t7: 4, t6: 4, t5: 4 },
      polValues: { t7: 2, t6: 2, t5: 2 },
    });
    expect(displayTopicIds).toEqual(["t5", "t6", "t7"]);
  });

  it("never repeats a topic already taken from the compass", () => {
    const { displayTopicIds } = bestMatchSpokes({
      ...base,
      selectedTopics: ["t5"],
      userValues: { t5: 5, t6: 3 },
      polValues: { t5: 1, t6: 1 },
    });
    expect(displayTopicIds).toEqual(["t5", "t6"]);
    expect(new Set(displayTopicIds).size).toBe(displayTopicIds.length);
  });

  it("caps at maxSpokes", () => {
    const userValues = {};
    const polValues = {};
    for (const t of topics) { userValues[t.id] = 5; polValues[t.id] = 1; }
    const { displayTopicIds } = bestMatchSpokes({ ...base, selectedTopics: [], userValues, polValues });
    expect(displayTopicIds).toHaveLength(MAX_SPOKES);
  });
});

describe("bestMatchSpokes — too little overlap", () => {
  it("🔴 reports not-enough below three, so the caller draws nothing", () => {
    // Chris's call: "with fewer than 3, we don't visualize the 1/2 we do have."
    // A two-axis radar is not a shape — it is a line pretending to be a compass.
    const two = bestMatchSpokes({
      ...base,
      selectedTopics: ["t1", "t2"],
      userValues: { t1: 3, t2: 3 },
      polValues: { t1: 1, t2: 1 },
    });
    expect(two.displayTopicIds).toHaveLength(2);
    expect(two.hasEnoughSpokes).toBe(false);
  });

  it("is satisfied at exactly three", () => {
    const three = bestMatchSpokes({
      ...base,
      selectedTopics: ["t1", "t2", "t3"],
      userValues: { t1: 3, t2: 3, t3: 3 },
      polValues: { t1: 1, t2: 1, t3: 1 },
    });
    expect(three.displayTopicIds).toHaveLength(MIN_SPOKES);
    expect(three.hasEnoughSpokes).toBe(true);
  });

  it("reports not-enough, not an error, when nothing overlaps", () => {
    const none = bestMatchSpokes({
      ...base,
      selectedTopics: ["t1"],
      userValues: { t1: 3 },
      polValues: {},
    });
    expect(none.displayTopicIds).toEqual([]);
    expect(none.hasEnoughSpokes).toBe(false);
  });
});

describe("bestMatchSpokes — hostile inputs", () => {
  it("does not throw on missing arguments", () => {
    expect(() => bestMatchSpokes({})).not.toThrow();
    expect(bestMatchSpokes({}).displayTopicIds).toEqual([]);
    expect(bestMatchSpokes({}).hasEnoughSpokes).toBe(false);
  });

  it("ignores selected ids that are not in the topic list", () => {
    // A retired topic can linger in a stored compass.
    const { displayTopicIds } = bestMatchSpokes({
      ...base,
      selectedTopics: ["ghost", "t1"],
      userValues: { ghost: 3, t1: 3 },
      polValues: { ghost: 1, t1: 1 },
    });
    expect(displayTopicIds).toEqual(["t1"]);
  });
});
