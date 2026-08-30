import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  CALIBRATE_SESSION_KEY,
  isCalibrateKeyShape,
  stashCalibrateKey,
  takeCalibrateKey,
  clearCalibrateKey,
  resolveCalibrateLens,
} from "./calibrateParam.js";

/**
 * Essentials links people here to calibrate ONE named lens:
 *   compass.empowered.vote/?calibrate=<key>&return=<url>
 *
 * It has sent that param since the Federal Lens shipped and this app has never
 * read it — `App.jsx` parsed only `return` — so the CTA has always landed on a
 * generic Compass with nothing selected, for the curated lenses too.
 *
 * The lifecycle mirrors ReturnBanner's handling of `return`, and for the same
 * reason: HelpGuard sends an uncalibrated visitor from `/` to `/results` with a
 * <Navigate>, which drops the query string. A param read only from the URL dies
 * in that redirect — exactly the arrivals (never-calibrated users) the link is
 * most often for. So: read from the URL once, stash, strip, then read the stash.
 */

function setUrl(search) {
  window.history.replaceState(null, "", `/${search}`);
}

beforeEach(() => {
  sessionStorage.clear();
  setUrl("");
});

describe("isCalibrateKeyShape", () => {
  it("accepts the curated keys", () => {
    expect(isCalibrateKeyShape("local")).toBe(true);
    expect(isCalibrateKeyShape("federal")).toBe(true);
    expect(isCalibrateKeyShape("judicial")).toBe(true);
  });

  it("accepts a user lens key in the server's shape", () => {
    expect(isCalibrateKeyShape("u_7f3a91")).toBe(true);
  });

  it("rejects anything else", () => {
    // Not a security boundary — the value only ever reaches a .find() lookup.
    // It stops a junk value taking up residence in sessionStorage, where it
    // would be retried on every navigation for the rest of the session.
    expect(isCalibrateKeyShape("")).toBe(false);
    expect(isCalibrateKeyShape(null)).toBe(false);
    expect(isCalibrateKeyShape("U_7F3A91")).toBe(false);
    expect(isCalibrateKeyShape("u_")).toBe(false);
    expect(isCalibrateKeyShape("u_" + "a".repeat(33))).toBe(false);
    expect(isCalibrateKeyShape("../etc")).toBe(false);
    expect(isCalibrateKeyShape("education")).toBe(false);
  });
});

describe("stashCalibrateKey", () => {
  it("🔴 makes the key survive the HelpGuard redirect", () => {
    // HelpGuard's <Navigate to="/results"> unmounts the route BEFORE
    // CombinedPage renders, so nothing downstream ever gets to read the URL.
    // Regression: the first cut of this feature relied on CombinedPage reading
    // the URL and the lens was silently dropped for every uncalibrated
    // visitor — which is most of the people this link is sent to. Caught by
    // the smoke suite, not by a unit test, so it is pinned here too.
    stashCalibrateKey("?calibrate=federal&return=https%3A%2F%2Fx.example");
    setUrl(""); // the redirect drops the query string
    expect(takeCalibrateKey()).toBe("federal");
  });

  it("leaves the URL untouched — the redirect discards it anyway", () => {
    setUrl("?calibrate=federal");
    stashCalibrateKey(window.location.search);
    expect(window.location.search).toBe("?calibrate=federal");
  });

  it("ignores a malformed key and anything with no calibrate param", () => {
    expect(stashCalibrateKey("?calibrate=%3Cscript%3E")).toBe("");
    expect(stashCalibrateKey("?return=https%3A%2F%2Fx.example")).toBe("");
    expect(stashCalibrateKey("")).toBe("");
    expect(stashCalibrateKey(null)).toBe("");
    expect(sessionStorage.getItem(CALIBRATE_SESSION_KEY)).toBe(null);
  });
});

describe("takeCalibrateKey", () => {
  it("reads the key from the URL", () => {
    setUrl("?calibrate=federal");
    expect(takeCalibrateKey()).toBe("federal");
  });

  it("🔴 strips the param but leaves the rest of the URL alone", () => {
    // `return` belongs to ReturnBanner, which does its own read-and-strip. If
    // this helper rewrote the whole query it would consume `return` before that
    // component mounted and silently kill the way back to Essentials.
    setUrl("?calibrate=federal&return=https%3A%2F%2Fessentials.example%2Fme");
    takeCalibrateKey();
    const params = new URLSearchParams(window.location.search);
    expect(params.get("calibrate")).toBe(null);
    expect(params.get("return")).toBe("https://essentials.example/me");
  });

  it("survives a later read once the URL no longer carries it — the HelpGuard case", () => {
    setUrl("?calibrate=u_7f3a91");
    expect(takeCalibrateKey()).toBe("u_7f3a91");

    // HelpGuard's <Navigate to="/results"> drops the query string entirely.
    setUrl("");
    expect(takeCalibrateKey()).toBe("u_7f3a91");
  });

  it("returns '' when there is nothing to take", () => {
    expect(takeCalibrateKey()).toBe("");
  });

  it("ignores a malformed key without storing it", () => {
    setUrl("?calibrate=%3Cscript%3E");
    expect(takeCalibrateKey()).toBe("");
    expect(sessionStorage.getItem(CALIBRATE_SESSION_KEY)).toBe(null);
  });

  it("never throws when sessionStorage is unavailable", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceeded");
    });
    setUrl("?calibrate=federal");
    // Storage is a convenience for surviving the redirect, not the mechanism.
    // A private-mode browser must still get the lens on a direct arrival.
    expect(() => takeCalibrateKey()).not.toThrow();
    spy.mockRestore();
  });
});

describe("clearCalibrateKey", () => {
  it("makes the key unavailable to a later read", () => {
    setUrl("?calibrate=federal");
    takeCalibrateKey();
    setUrl("");
    clearCalibrateKey();
    expect(takeCalibrateKey()).toBe("");
  });
});

describe("resolveCalibrateLens", () => {
  const lenses = [
    { key: "federal", topicIds: ["t1", "t2"] },
    { key: "u_7f3a91", topicIds: ["t2", "t3"] },
  ];
  const topics = [{ id: "t1" }, { id: "t2" }];

  it("resolves a curated key to its lens and the topics that exist", () => {
    expect(resolveCalibrateLens("federal", lenses, topics)).toEqual({
      lens: lenses[0],
      topicIds: ["t1", "t2"],
    });
  });

  it("resolves a user lens key the same way", () => {
    // t3 is not in the loaded topic set — a topic this season does not serve.
    // Seeding the answer queue with it would render an unanswerable question.
    expect(resolveCalibrateLens("u_7f3a91", lenses, topics)).toEqual({
      lens: lenses[1],
      topicIds: ["t2"],
    });
  });

  it("returns null for a key no lens claims", () => {
    // Someone else's lens, or one deleted since Essentials linked to it.
    // Falling through to a normal arrival beats telling them their lens is gone.
    expect(resolveCalibrateLens("u_deadbe", lenses, topics)).toBe(null);
  });

  it("returns null when every one of the lens's topics is gone", () => {
    // The lens resolves but has nothing answerable left. Opening the overlay on
    // an empty queue would strand the user on a calibration with no questions.
    expect(resolveCalibrateLens("u_7f3a91", lenses, [{ id: "t9" }])).toBe(null);
  });

  it("returns null for an empty key or an unloaded lens list", () => {
    expect(resolveCalibrateLens("", lenses, topics)).toBe(null);
    expect(resolveCalibrateLens("federal", [], topics)).toBe(null);
    expect(resolveCalibrateLens("federal", null, topics)).toBe(null);
  });
});
