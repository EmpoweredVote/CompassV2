import { describe, it, expect, beforeEach } from "vitest";
import {
  generateLensKey,
  readGuestLenses,
  writeGuestLenses,
  clearGuestLenses,
  mergeLensSets,
  toPutPayload,
  GUEST_LENS_STORAGE_KEY,
} from "./userLenses.js";

beforeEach(() => localStorage.clear());

describe("generateLensKey", () => {
  it("matches the server's key regex", () => {
    // Server: /^u_[a-z0-9]{4,32}$/. Uppercase or a missing prefix is a 422.
    for (let i = 0; i < 50; i++) {
      expect(generateLensKey()).toMatch(/^u_[a-z0-9]{6}$/);
    }
  });

  it("does not collide across many draws", () => {
    const keys = new Set();
    for (let i = 0; i < 500; i++) keys.add(generateLensKey());
    expect(keys.size).toBe(500);
  });
});

describe("guest storage", () => {
  it("round-trips a lens set", () => {
    const lenses = [{ key: "u_7f3a91", name: "Farm bill", topicIds: ["t1"], visibility: "private" }];
    writeGuestLenses(lenses);
    expect(readGuestLenses()).toEqual(lenses);
  });

  it("returns [] when nothing is stored", () => {
    expect(readGuestLenses()).toEqual([]);
  });

  it("returns [] rather than throwing on corrupt storage", () => {
    // Corrupt localStorage must degrade to "no custom lenses", never crash the
    // compass — the same rule safeParse applies everywhere else in this app.
    localStorage.setItem(GUEST_LENS_STORAGE_KEY, "{not json");
    expect(readGuestLenses()).toEqual([]);
  });

  it("returns [] when the stored value is not an array", () => {
    localStorage.setItem(GUEST_LENS_STORAGE_KEY, '{"key":"u_7f3a91"}');
    expect(readGuestLenses()).toEqual([]);
  });

  it("clears", () => {
    writeGuestLenses([{ key: "u_7f3a91", name: "x", topicIds: [], visibility: "private" }]);
    clearGuestLenses();
    expect(readGuestLenses()).toEqual([]);
  });
});

describe("mergeLensSets", () => {
  const server = [{ key: "u_aaaaaa", name: "Server copy", topicIds: ["t1"], visibility: "private" }];
  const local = [
    { key: "u_aaaaaa", name: "Local copy", topicIds: ["t2"], visibility: "private" },
    { key: "u_bbbbbb", name: "Local only", topicIds: ["t3"], visibility: "private" },
  ];

  it("lets the server win on a shared key", () => {
    // The account's own copy is canonical; a stale guest copy must not clobber it.
    const merged = mergeLensSets(server, local);
    expect(merged.find((l) => l.key === "u_aaaaaa").name).toBe("Server copy");
  });

  it("appends local-only lenses", () => {
    const merged = mergeLensSets(server, local);
    expect(merged.map((l) => l.key)).toEqual(["u_aaaaaa", "u_bbbbbb"]);
  });

  it("handles either side being empty", () => {
    expect(mergeLensSets([], local)).toHaveLength(2);
    expect(mergeLensSets(server, [])).toHaveLength(1);
    expect(mergeLensSets([], [])).toEqual([]);
  });
});

describe("toPutPayload", () => {
  it("renames topicIds to the wire's topic_ids", () => {
    const payload = toPutPayload([
      { key: "u_7f3a91", name: "Farm bill", topicIds: ["t1", "t2"], visibility: "private" },
    ]);
    expect(payload).toEqual({
      lenses: [{ key: "u_7f3a91", name: "Farm bill", topic_ids: ["t1", "t2"], visibility: "private" }],
    });
  });

  it("defaults visibility to private", () => {
    const payload = toPutPayload([{ key: "u_7f3a91", name: "x", topicIds: [] }]);
    expect(payload.lenses[0].visibility).toBe("private");
  });

  it("drops needsRecalibration and timestamps, which are server-owned", () => {
    const payload = toPutPayload([
      {
        key: "u_7f3a91", name: "x", topicIds: [], visibility: "private",
        needsRecalibration: [{ topicId: "t1" }], createdAt: "now", updatedAt: "now",
      },
    ]);
    expect(Object.keys(payload.lenses[0]).sort()).toEqual(["key", "name", "topic_ids", "visibility"]);
  });
});
