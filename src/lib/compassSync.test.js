import { describe, it, expect } from "vitest";
import { shouldSyncCompass, compassToPublish } from "./compassSync.js";

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
