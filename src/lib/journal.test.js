import { describe, it, expect } from "vitest";
import { indexJournal, showsThread, markAffected, paragraphs, entryDate } from "./journal";

describe("indexJournal", () => {
  it("keys the rows by topic", () => {
    const idx = indexJournal([
      { topicId: "t1", entryCount: 2, latestPublishedAt: "2026-10-13T00:00:00.000Z" },
      { topicId: "t2", entryCount: 1, latestPublishedAt: "2026-09-01T00:00:00.000Z" },
    ]);
    expect(idx.get("t1").entryCount).toBe(2);
    expect(idx.get("t2").entryCount).toBe(1);
  });

  it("survives a failed fetch without throwing", () => {
    expect(indexJournal(null).size).toBe(0);
    expect(indexJournal(undefined).size).toBe(0);
    expect(indexJournal({ code: "INTERNAL_ERROR" }).size).toBe(0);
  });

  it("ignores a row with no topic id", () => {
    expect(indexJournal([{ entryCount: 3 }]).size).toBe(0);
  });
});

describe("showsThread — the initial-build exclusion", () => {
  const idx = indexJournal([{ topicId: "t1", entryCount: 1 }]);

  it("shows a thread on a topic the reader has answered", () => {
    expect(showsThread({ index: idx, topicId: "t1", answered: true })).toBe(true);
  });

  // 🔴 THE RULE THE WHOLE FEATURE IS GATED ON. A first-time voter building
  // their compass must not meet the change history of a question they have not
  // answered yet.
  it("hides it from a reader who has not answered that question", () => {
    expect(showsThread({ index: idx, topicId: "t1", answered: false })).toBe(false);
  });

  it("hides it where there is nothing to open", () => {
    expect(showsThread({ index: idx, topicId: "t2", answered: true })).toBe(false);
  });

  // A topic row can exist with a zero count only if the server ever changes
  // shape, but `entryCount > 0` is the gate and a string "0" is truthy.
  it("treats a zero count as nothing to open", () => {
    const zero = indexJournal([{ topicId: "t1", entryCount: 0 }]);
    expect(showsThread({ index: zero, topicId: "t1", answered: true })).toBe(false);
  });

  it("is false rather than throwing before the index has loaded", () => {
    expect(showsThread({ index: null, topicId: "t1", answered: true })).toBe(false);
  });
});

describe("markAffected", () => {
  const entries = [
    { id: "j2", kind: "changed", revisionId: "rev-v2" },
    { id: "j1", kind: "watching", revisionId: null },
  ];

  it("marks the entry whose revision caused the reader's flag", () => {
    const out = markAffected(entries, { effectiveRevisionId: "rev-v2" });
    expect(out.find((e) => e.id === "j2").affectsYou).toBe(true);
    expect(out.find((e) => e.id === "j1").affectsYou).toBe(false);
  });

  it("marks nothing when the reader holds no flag", () => {
    expect(markAffected(entries, null).every((e) => e.affectsYou === false)).toBe(true);
  });

  // 🔴 NULL MATCHES NULL IN JAVASCRIPT AND MUST NOT HERE. Every `watching`
  // entry has a null revisionId by definition, and a topic the season does not
  // ask has a null effectiveRevisionId — so a loose match would tell that
  // reader every prediction ever written is the change that moved their answer.
  it("never matches a null revision against a null flag", () => {
    const out = markAffected(entries, { effectiveRevisionId: null });
    expect(out.every((e) => e.affectsYou === false)).toBe(true);
  });

  it("leaves the entries in the order the server sent them", () => {
    expect(markAffected(entries, { effectiveRevisionId: "rev-v2" }).map((e) => e.id))
      .toEqual(["j2", "j1"]);
  });

  it("returns an empty array for nothing", () => {
    expect(markAffected(null, null)).toEqual([]);
  });
});

describe("paragraphs", () => {
  it("splits a body on blank lines", () => {
    expect(paragraphs("One.\n\nTwo.")).toEqual(["One.", "Two."]);
  });

  it("keeps a single newline inside its paragraph", () => {
    expect(paragraphs("One.\nStill one.")).toEqual(["One.\nStill one."]);
  });

  it("drops trailing whitespace rather than rendering an empty block", () => {
    expect(paragraphs("One.\n\n\n\n")).toEqual(["One."]);
  });

  it("is an empty list for nothing", () => {
    expect(paragraphs("")).toEqual([]);
    expect(paragraphs(null)).toEqual([]);
  });
});

describe("entryDate", () => {
  it("renders a published timestamp as a plain day", () => {
    // Built in local time so the assertion holds in any timezone.
    const iso = new Date(2026, 9, 13, 12, 0, 0).toISOString();
    expect(entryDate(iso)).toBe("Oct 13, 2026");
  });

  it("shows nothing for an unparseable date rather than 'Invalid Date'", () => {
    expect(entryDate("not a date")).toBe("");
    expect(entryDate(null)).toBe("");
  });
});
