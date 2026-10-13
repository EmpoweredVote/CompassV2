// Smoke suite: drives the real app in a real browser and asserts that the
// critical guest paths still work.
//
// Why this exists: `npm run build` only proves the app compiles. The bug in #65
// compiled fine, passed CI, and silently deleted every answer given on
// /calibrate. It was invisible on a fresh browser profile and only appeared once
// the user arrived with a compass already built — which is every real user, and
// every demo. These scenarios reproduce that state on purpose.
//
// Run: npm run smoke        (add --headful to watch, --only=<name> to filter)

import { launch } from "./cdp.mjs";
import { startDevServer } from "./server.mjs";
import {
  loadCredentials, login, resetServerAnswers, putServerAnswer,
  getServerAnswers, setServerSelectedTopics,
  getServerLenses, clearServerLenses,
} from "./auth.mjs";

/** Thrown by a scenario that cannot run here; reported as SKIP, not failure. */
class Skip extends Error {}

const API = "/api/compass";
const BROKER_ORIGIN = "https://ev-context.empowered.vote";
// Absolute API base, for calls that must bypass the dev-server proxy.
const AUTH_API = "https://accounts-api.empowered.vote/api";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// ---------------------------------------------------------------- page helpers

/** Click the first <button> whose trimmed text starts with `text`. */
const clickButton = async (b, text) => {
  const result = await b.evaluate(`(() => {
    const el = [...document.querySelectorAll('button')]
      .find(x => (x.textContent || '').trim().startsWith(${JSON.stringify(text)}));
    if (!el) return 'NOT_FOUND';
    el.click();
    return 'OK';
  })()`);
  assert(result === "OK", `no button starting with ${JSON.stringify(text)}`);
  await b.sleep(900);
};

/** Click the first <button> starting with `text` if one is present. */
const clickButtonIfPresent = async (b, text) => {
  const result = await b.evaluate(`(() => {
    const el = [...document.querySelectorAll('button')]
      .find(x => (x.textContent || '').trim().startsWith(${JSON.stringify(text)}));
    if (!el) return 'NOT_FOUND';
    el.click();
    return 'OK';
  })()`);
  if (result === "OK") await b.sleep(900);
  return result === "OK";
};

// Stance buttons carry data-testid="stance-option" in both the calibration
// overlay and /calibrate, so the suite survives restyling. Do not swap these for
// class-based selectors — a brittle suite gets disabled, which is how #65 shipped.
const STANCE_BUTTONS = `[...document.querySelectorAll('[data-testid="stance-option"]')]`;

// The welcome screen's primary CTA. Named once because guest-onboarding both
// waits on it and clicks it — the onboarding redesign relabelled this from
// "Start with Local Lens" and the two uses must not drift apart again.
const WELCOME_LENS_CTA = "Start with the Local Lens";

// Shown twice on the Local Lens path: once on the lens intro, then again on the
// last slide of the learn carousel.
const LENS_START_CTA = "Start finding my stances";

const answeredCount = (b) =>
  b.evaluate(`Object.keys(JSON.parse(localStorage.getItem('answers') || '{}')).length`);

/** The "N / M" counter in the /calibrate header. M is the open season's size. */
const progress = (b) =>
  b.evaluate(`(document.querySelector('[data-testid="calibration-progress"]') || {}).textContent || null`);

/**
 * Put the browser in the state of a returning guest who already built a compass:
 * `count` topics answered and selected, calibration marked complete.
 */
const seedBuiltCompass = async (b, count = 8) =>
  b.evaluate(`(async () => {
    const topics = await (await fetch('${API}/topics')).json();
    const chosen = topics.slice(0, ${count});
    const answers = {};
    chosen.forEach((t, i) => { answers[t.short_title] = (i % 5) + 1; });
    localStorage.setItem('answers', JSON.stringify(answers));
    localStorage.setItem('selectedTopics', JSON.stringify(chosen.map(t => t.id)));
    localStorage.setItem('calibration_completed', 'true');
    return Object.keys(answers).length;
  })()`);

/**
 * Skip unless the custom-lens API is live.
 *
 * /compass/my-lenses ships in EV-Accounts #224. Until that deploys, the path does
 * not match compassRouter and falls through to the admin router, which answers
 * 403 "Admin access required" — a confusing failure that has nothing to do with
 * the frontend under test. Skip loudly instead, so the reason is in the output
 * rather than inferred from a stack trace.
 */
async function requireMyLensesApi(token) {
  const res = await fetch(`${AUTH_API}/compass/my-lenses`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Skip(`/compass/my-lenses not deployed yet (HTTP ${res.status}) — EV-Accounts #224`);
  }
}

// ------------------------------------------------------------------ scenarios

const scenarios = [
  {
    name: "preflight",
    // Establishes that the dependencies the other scenarios rely on are actually
    // live. Without this, a broker outage would make `full-calibration-persists`
    // pass vacuously — it can only catch the #65 regression if the broker is
    // really echoing writes back to the tab.
    async run(b, baseUrl) {
      await b.navigate(`${baseUrl}/calibrate`, { settleMs: 6000 });

      const topics = await b.evaluate(`(async () => {
        const t = await (await fetch('${API}/topics')).json();
        return {
          count: Array.isArray(t) ? t.length : -1,
          withStances: t.filter(x => Array.isArray(x.stances) && x.stances.length > 0).length,
        };
      })()`);
      assert(topics.count > 0, `topics API returned no topics (got ${topics.count})`);
      assert(
        topics.withStances === topics.count,
        `${topics.count - topics.withStances} topics have no stances — /calibrate would render unanswerable questions`
      );

      const categories = await b.evaluate(
        `(async () => (await (await fetch('${API}/categories')).json()).length)()`
      );
      assert(categories > 0, "categories API returned nothing");

      const brokerReachable = await b.evaluate(`(async () => {
        try {
          await fetch('${BROKER_ORIGIN}/', { mode: 'no-cors', cache: 'no-store' });
          return true;
        } catch { return false; }
      })()`);
      assert(brokerReachable, `ev-context broker unreachable at ${BROKER_ORIGIN}`);

      const brokerMounted = await b.waitFor(
        `!!document.querySelector('iframe[src*="ev-context"]')`,
        { label: "ev-context broker iframe mounted" }
      );
      assert(brokerMounted, "app never mounted the ev-context broker iframe");

      return `${topics.count} topics (all with stances), ${categories} categories, broker live`;
    },
  },

  {
    name: "guest-onboarding",
    // The first-run path: a brand new visitor should be able to get all the way
    // to a rendered compass without touching anything but the overlay.
    async run(b, baseUrl) {
      await b.navigate(`${baseUrl}/results`, { settleMs: 9000 });

      // Keyed to the CTA rather than the headline copy. The welcome screen is
      // marketing surface and its prose gets rewritten; the button the test
      // clicks next is the functional affordance. Keeping the gate and the
      // click on the same string means a relabel fails here, pointing at the
      // cause, instead of timing out on a headline that simply got reworded.
      const sawWelcome = await b.waitFor(
        `[...document.querySelectorAll('button')]
           .some(el => (el.textContent || '').trim().startsWith(${JSON.stringify(WELCOME_LENS_CTA)}))`,
        { label: "calibration welcome screen" }
      );
      assert(sawWelcome, "fresh guest never saw the calibration welcome screen");

      await clickButton(b, WELCOME_LENS_CTA);

      // welcome → lens intro → learn carousel → answer. The carousel sits
      // between the lens intro and the first question, and its last slide
      // repeats the lens intro's label, so this walks the "Next →" slides
      // rather than assuming how many there are, then presses through.
      await clickButton(b, LENS_START_CTA);
      for (let i = 0; i < 10; i++) {
        if (!(await clickButtonIfPresent(b, "Next →"))) break;
      }
      await clickButton(b, LENS_START_CTA);

      await b.waitFor(`${STANCE_BUTTONS}.length > 0`, { label: "stance buttons" });

      // Answer all 8 lens topics, advancing with Next each time.
      for (let i = 0; i < 8; i++) {
        const picked = await b.evaluate(`(() => {
          const btns = ${STANCE_BUTTONS};
          if (!btns.length) return false;
          btns[${i} % btns.length].click();
          return true;
        })()`);
        assert(picked, `no stance buttons on lens question ${i + 1}`);
        await b.sleep(500);
        if (i < 7) await clickButton(b, "Next");
      }

      const answers = await answeredCount(b);
      assert(answers >= 8, `expected >= 8 answers after the lens, got ${answers}`);

      // Leaving the overlay should land on a rendered compass, not an empty state.
      await b.navigate(`${baseUrl}/results`, { settleMs: 8000 });
      const chart = await b.waitFor(`document.querySelectorAll('svg').length > 5`, {
        label: "compass chart",
      });
      assert(chart, "compass chart did not render after onboarding");

      return `${answers} answers recorded, compass renders`;
    },
  },

  {
    name: "full-calibration-persists",
    // Regression for #65. A returning guest with a built compass answers topics
    // on /calibrate that are NOT among their 8 selected ones. Before the fix the
    // ev-context echo overwrote each answer ~25ms after it was given, so the
    // counter never moved off its starting value.
    async run(b, baseUrl) {
      await b.navigate(`${baseUrl}/calibrate`, { settleMs: 5000 });
      const seeded = await seedBuiltCompass(b, 8);
      assert(seeded === 8, `seeding failed, got ${seeded} answers`);

      await b.navigate(`${baseUrl}/calibrate`, { settleMs: 8000 });
      await b.waitFor(`${STANCE_BUTTONS}.length > 0`, { label: "stance buttons" });

      // ⚠ THE DENOMINATOR IS THE OPEN SEASON'S QUESTION COUNT, so it must not be
      // hardcoded — it changed from 44 to 60 the moment Season 2 opened and failed
      // this scenario for a reason that had nothing to do with what it tests.
      // What it tests is that the counter ADVANCES with each answer.
      const before = await progress(b);
      const parsed = /^\s*(\d+)\s*\/\s*(\d+)\s*$/.exec(String(before ?? ""));
      assert(parsed, `expected an "N / M" progress counter, got ${JSON.stringify(before)}`);
      const total = parsed[2];
      assert(
        parsed[1] === "8",
        `expected to start at 8 answered, got ${JSON.stringify(before)}`
      );

      for (let i = 0; i < 6; i++) {
        await b.evaluate(`(() => { const btns = ${STANCE_BUTTONS}; btns[${i} % btns.length].click(); })()`);
        await b.sleep(1100);

        const count = await answeredCount(b);
        assert(
          count === 8 + i + 1,
          `answer ${i + 1} did not stick: expected ${8 + i + 1} answers, got ${count}. ` +
            `This is the #65 failure mode — an answer is written then overwritten by the ` +
            `ev-context echo. Check the publishedRef guard in CompassContext.`
        );
      }

      const after = await progress(b);
      assert(
        after === `14 / ${total}`,
        `expected "14 / ${total}" after 6 answers, got ${JSON.stringify(after)}`
      );

      return `8 / ${total} -> ${after}, all 6 answers persisted`;
    },
  },

  {
    name: "answers-survive-navigation",
    // The other half of #65: a full calibration used to be truncated back to the
    // 8 selected topics on the next compass page load.
    async run(b, baseUrl) {
      await b.navigate(`${baseUrl}/results`, { settleMs: 5000 });
      await seedBuiltCompass(b, 8);

      // Add answers beyond the selected 8 — the state that triggered the bug.
      await b.evaluate(`(async () => {
        const topics = await (await fetch('${API}/topics')).json();
        const answers = JSON.parse(localStorage.getItem('answers'));
        topics.slice(8, 20).forEach((t, i) => { answers[t.short_title] = (i % 5) + 1; });
        localStorage.setItem('answers', JSON.stringify(answers));
      })()`);

      const before = await answeredCount(b);
      assert(before === 20, `seeding failed, expected 20 answers, got ${before}`);

      await b.navigate(`${baseUrl}/results`, { settleMs: 9000 });
      // Give the broker round trip room to land before checking.
      await b.sleep(2500);

      const after = await answeredCount(b);
      assert(
        after === 20,
        `answers were truncated on load: had 20, now ${after}. The ev-context payload ` +
          `only carries the <=8 selected topics; it must merge, not replace.`
      );

      const chart = await b.evaluate(`document.querySelectorAll('svg').length > 5`);
      assert(chart, "compass chart did not render for a returning user");

      return `20 answers preserved across navigation, compass renders`;
    },
  },
  {
    name: "remote-update-persists",
    // A remote write from another tab or subdomain must survive a reload. The
    // subscribe callback writes React state; every slice needs a persistence
    // path behind it. invertedSpokes had none — it was persisted inside the
    // setter wrappers, which the subscribe path bypasses, so a spoke
    // orientation arriving from elsewhere silently reverted on next load.
    async run(b, baseUrl) {
      await b.navigate(`${baseUrl}/results`, { settleMs: 5000 });
      await seedBuiltCompass(b, 8);
      await b.evaluate(
        `localStorage.setItem('invertedSpokes', JSON.stringify({ __seed__: true }))`
      );
      await b.navigate(`${baseUrl}/results`, { settleMs: 9000 });

      // Post straight to the broker iframe, exactly as evContext.set() does, so
      // the app sees a genuine remote change rather than its own echo.
      const posted = await b.evaluate(`(async () => {
        const topics = await (await fetch('${API}/topics')).json();
        const eight = topics.slice(0, 8);
        const answers = {};
        eight.forEach((t, i) => { answers[t.short_title] = ((i + 2) % 5) + 1; });
        const inverted = { [eight[1].short_title]: true, [eight[2].short_title]: true };
        const frame = document.querySelector('iframe[src*="ev-context"]');
        if (!frame) return null;
        frame.contentWindow.postMessage(
          { type: 'ev-context:set',
            value: { compass: { a: answers, s: eight.map(t => t.id), i: inverted, w: {} } } },
          '${BROKER_ORIGIN}'
        );
        return JSON.stringify(inverted);
      })()`);
      assert(posted, "ev-context broker iframe not present — cannot test remote updates");

      await b.sleep(4000);
      const stored = await b.evaluate(`localStorage.getItem('invertedSpokes')`);
      assert(
        stored !== JSON.stringify({ __seed__: true }),
        "a remote spoke-inversion update never reached localStorage, so it reverts on reload. " +
          "Every slice the subscribe callback writes needs a persistence effect behind it."
      );
      assert(
        stored === posted,
        `persisted inversions do not match the remote write: ${stored} vs ${posted}`
      );

      return "remote inversion update persisted";
    },
  },

  {
    name: "lens-overlay-not-published-as-compass",
    // A lens is a local view. While one is active `selectedTopics` holds the
    // lens's topics, and publishing those as `s` tells Essentials the lens IS
    // the user's compass — so it draws the lens in its "custom" mode, which is
    // supposed to mean "my compass". Compass already refuses to persist a lens
    // as selected_topic_ids server-side; this asserts the same rule on the wire.
    async run(b, baseUrl) {
      const topics = await (await fetch(`${baseUrl}${API}/topics`)).json();
      const lenses = await (await fetch(`${baseUrl}${API}/lenses`)).json();
      // ⚠ The lens's topics must exist IN THE OPEN SEASON, not merely be listed
      // on the lens. /compass/lenses returns every active lens, including ones
      // built entirely from a future season's topics — the Education Lens is all
      // Season-2 topics, and it sorts first by key. Picking it made this scenario
      // pass against a degenerate case: a "lens" of 8 ids the app cannot render,
      // and an "own compass" of every topic there is.
      const lens = (Array.isArray(lenses) ? lenses : []).find(
        (l) =>
          Array.isArray(l.topicIds) &&
          l.topicIds.filter((id) => topics.some((t) => t.id === id)).length >= 3
      );
      assert(lens, "no lens with topics in the open season returned by /compass/lenses");
      // The user's own compass: topics deliberately not in the lens.
      const own = topics.filter((t) => !lens.topicIds.includes(t.id)).slice(0, 8);
      assert(own.length === 8, "could not find 8 non-lens topics");

      await b.navigate(`${baseUrl}/results`, { settleMs: 5000 });
      await b.evaluate(`(() => {
        const own = ${JSON.stringify(own.map((t) => t.id))};
        const lensIds = ${JSON.stringify(lens.topicIds)};
        const answers = {};
        ${JSON.stringify(own.map((t) => t.short_title))}.forEach((s, i) => { answers[s] = (i % 5) + 1; });
        localStorage.setItem('answers', JSON.stringify(answers));
        // A lens overlay is active; preLensTopics holds the real compass.
        //
        // activeLensKey is what MAKES a lens active — it is the explicit record
        // of what the user chose to view, and it lives in sessionStorage because
        // a lens is a per-tab choice. It used to be inferred from the topic set,
        // which cannot survive user-authored lenses (lib/compassSync.js).
        sessionStorage.setItem('activeLensKey', ${JSON.stringify(lens.key)});
        localStorage.setItem('selectedTopics', JSON.stringify(lensIds));
        localStorage.setItem('preLensTopics', JSON.stringify(own));
        localStorage.setItem('calibration_completed', 'true');
      })()`);

      // Installed before the document loads: the app publishes on mount, so a
      // listener added after navigation misses the very write under test.
      await b.send('Page.addScriptToEvaluateOnNewDocument', {
        source: `
          window.__published = [];
          window.addEventListener('message', (e) => {
            if (e.data && e.data.type === 'ev-context:update') {
              const c = e.data.value && e.data.value.compass;
              if (c && Array.isArray(c.s)) window.__published.push(c.s);
            }
          });
        `,
      });
      await b.navigate(`${baseUrl}/results`, { settleMs: 10000 });

      const published = await b.evaluate(`window.__published`);
      assert(published.length > 0, "compass never published to the broker");
      const latest = published[published.length - 1];
      const isLens = latest.every((id) => lens.topicIds.includes(id));
      assert(
        !isLens,
        `published the "${lens.key}" lens as the user's compass. A lens is a view ` +
          `overlay — Essentials reads s as "my compass" and would draw the lens instead.`
      );
      const isOwn = latest.every((id) => own.map((t) => t.id).includes(id));
      assert(isOwn, `expected the user's own compass on the wire, got ${JSON.stringify(latest)}`);

      return `lens "${lens.key}" active, published the underlying compass`;
    },
  },

  {
    name: "remote-clear-propagates",
    // Reset Compass in one tab must clear the others, and — the harder half —
    // a tab that simply has not hydrated yet must NOT be able to wipe a
    // populated one. The payload cannot distinguish those two on content alone
    // (`a` only ever carries the <=8 compass topics), so an explicit clearedAt
    // timestamp does it: only a real reset sets one.
    async run(b, baseUrl) {
      await b.navigate(`${baseUrl}/results`, { settleMs: 5000 });
      await seedBuiltCompass(b, 8);
      await b.navigate(`${baseUrl}/results`, { settleMs: 9000 });
      assert(await answeredCount(b) === 8, "seeding failed");

      const post = (payload) => b.evaluate(`(() => {
        const f = document.querySelector('iframe[src*="ev-context"]');
        if (!f) return false;
        f.contentWindow.postMessage(
          { type: 'ev-context:set', value: { compass: ${payload} } },
          '${BROKER_ORIGIN}'
        );
        return true;
      })()`);

      // 1. An unhydrated tab publishes empty content and no clearedAt. It must
      //    not be mistaken for a reset.
      assert(await post(`{ a: {}, s: [], i: {}, w: {} }`), "broker iframe missing");
      await b.sleep(3500);
      assert(
        await answeredCount(b) === 8,
        "an empty payload with no clearedAt wiped the compass — a tab that has " +
          "not hydrated yet must never be able to clear a populated one"
      );

      // 2. A real reset carries a timestamp and must take effect.
      assert(await post(`{ a: {}, s: [], i: {}, w: {}, clearedAt: ` + Date.now() + ` }`), "broker iframe missing");
      await b.sleep(3500);
      const after = await answeredCount(b);
      assert(after === 0, `an explicit remote reset did not clear this tab (${after} answers remain)`);

      return "empty payload ignored, explicit reset applied";
    },
  },

  {
    name: "authed-hydrates-server-answers",
    // Every other scenario runs as a guest, but signed-in users take a wholly
    // different path: the server, not localStorage, is their source of truth.
    //
    // Deliberately on /calibrate, not /results. CombinedPage runs its own
    // /compass/answers fetch, which masks a hydration failure on the results
    // page; /calibrate does not mount CombinedPage, so CompassContext's
    // hydration is the only path and a regression there is visible.
    //
    // The guard used to skip the fetch entirely whenever localStorage held ANY
    // answer, so a signed-in user who arrived with one stray local answer saw
    // "1 / 44" instead of "12 / 44" and was re-asked everything.
    async run(b, baseUrl) {
      const creds = loadCredentials();
      if (!creds) throw new Skip("no SMOKE_EMAIL / SMOKE_PASSWORD available");
      const token = await login(creds);

      // Fetched through the dev server's /api proxy, same as the browser.
      const topics = await (await fetch(`${baseUrl}${API}/topics`)).json();
      const server = topics.slice(0, 12);
      const strayTopic = topics[30]; // deliberately outside the server set

      await resetServerAnswers(token);
      for (const [i, t] of server.entries()) await putServerAnswer(token, t.id, (i % 5) + 1);
      await setServerSelectedTopics(token, server.slice(0, 8).map((t) => t.id));

      // A signed-in user who answered one question, then landed on /calibrate.
      await b.navigate(`${baseUrl}/calibrate`, { settleMs: 4000 });
      await b.evaluate(`(() => {
        localStorage.clear();
        localStorage.setItem('ev_token', ${JSON.stringify(token)});
        localStorage.setItem('answers', JSON.stringify({ ${JSON.stringify(strayTopic.short_title)}: 4 }));
      })()`);
      await b.navigate(`${baseUrl}/calibrate`, { settleMs: 12000 });

      const local = await b.evaluate(`JSON.parse(localStorage.getItem('answers') || '{}')`);
      const count = Object.keys(local).length;
      assert(
        count >= server.length,
        `signed in with 1 local answer and ${server.length} on the server, but ended up with ` +
          `${count}. Server answers must fill the gaps, not be skipped because local was non-empty ` +
          `— the user gets re-asked everything they already answered.`
      );
      assert(
        local[strayTopic.short_title] === 4,
        "the answer given before signing in was lost; hydration must not clobber local values"
      );
      return `${count} answers after sign-in (${server.length} server + 1 local, none lost)`;
    },
  },

  {
    name: "authed-answer-reaches-server",
    // The other half of the authed contract: an answer given while logged in
    // must actually persist server-side, or it is lost on the next device.
    async run(b, baseUrl) {
      const creds = loadCredentials();
      if (!creds) throw new Skip("no SMOKE_EMAIL / SMOKE_PASSWORD available");
      const token = await login(creds);
      await resetServerAnswers(token);

      await b.navigate(`${baseUrl}/calibrate`, { settleMs: 4000 });
      await b.evaluate(`(() => {
        localStorage.clear();
        localStorage.setItem('ev_token', ${JSON.stringify(token)});
      })()`);
      await b.navigate(`${baseUrl}/calibrate`, { settleMs: 10000 });
      await b.waitFor(`${STANCE_BUTTONS}.length > 0`, { label: "stance buttons" });

      for (let i = 0; i < 3; i++) {
        await b.evaluate(`(() => { const s = ${STANCE_BUTTONS}; s[${i} % s.length].click(); })()`);
        await b.sleep(1200);
      }
      await b.sleep(2500); // let the fire-and-forget POSTs land

      const rows = await getServerAnswers(token);
      assert(
        Array.isArray(rows) && rows.length >= 3,
        `answered 3 questions while signed in but the server has ${Array.isArray(rows) ? rows.length : "?"}. ` +
          `Authed answers are POSTed fire-and-forget, so a failure here is silent.`
      );
      return `${rows.length} answers persisted server-side`;
    },
  },

  {
    name: "lens-round-trip-restores-the-compass",
    // Drives the real chips, because the transitions are what changed: doStartLens
    // records activeLensKey and exitLensMode clears it, replacing an inference over
    // the topic set. Every other lens scenario seeds storage directly and would not
    // notice if the buttons stopped being wired up at all.
    //
    // Clicks by data-testid, not by button text. Text matching finds the "Federal
    // Lens" OFFER card that CombinedPage renders elsewhere on the page, which opens
    // calibration instead of switching lens — measured, not guessed.
    async run(b, baseUrl) {
      const lenses = await (await fetch(`${baseUrl}${API}/lenses`)).json();
      const federal = (Array.isArray(lenses) ? lenses : []).find((l) => l.key === "federal");
      const local = (Array.isArray(lenses) ? lenses : []).find((l) => l.key === "local");
      assert(federal && local, "federal or local lens missing from /compass/lenses");

      const topics = await (await fetch(`${baseUrl}${API}/topics`)).json();
      const lensIds = new Set([...federal.topicIds, ...local.topicIds]);
      const own = topics.filter((t) => !lensIds.has(t.id)).slice(0, 8);
      assert(own.length === 8, "could not find 8 topics outside both lenses");
      const ownIds = own.map((t) => t.id);
      // Answer the lens questions too: switching to a lens with unanswered
      // questions auto-routes to the calibration overlay, which replaces the page.
      const answered = [...own, ...topics.filter((t) => lensIds.has(t.id))];

      await b.navigate(`${baseUrl}/results`, { settleMs: 4000 });
      await b.evaluate(`(() => {
        localStorage.clear();
        sessionStorage.clear();
        const answers = {};
        ${JSON.stringify(answered.map((t) => t.short_title))}.forEach((s, i) => { answers[s] = (i % 5) + 1; });
        localStorage.setItem('answers', JSON.stringify(answers));
        localStorage.setItem('selectedTopics', ${JSON.stringify(JSON.stringify(ownIds))});
        localStorage.setItem('calibration_completed', 'true');
      })()`);
      await b.navigate(`${baseUrl}/results`, { settleMs: 8000 });

      const clickChip = async (key) => {
        const r = await b.evaluate(`(() => {
          const el = document.querySelector('[data-testid="lens-chip-${key}"]');
          if (!el) return 'NOT_FOUND';
          el.click();
          return 'OK';
        })()`);
        assert(r === "OK", `lens chip ${key} not found`);
        await b.sleep(1000);
      };

      await clickChip("federal");
      const inLens = await b.evaluate(`sessionStorage.getItem('activeLensKey')`);
      assert(inLens === "federal", `after clicking Federal, activeLensKey is ${JSON.stringify(inLens)}`);
      const stash = await b.evaluate(`JSON.parse(localStorage.getItem('preLensTopics') || 'null')`);
      assert(
        Array.isArray(stash) && stash.length === 8,
        `entering a lens must stash the real compass; got ${JSON.stringify(stash)}`
      );

      // Lens to lens must NOT re-stash, or the real compass is buried behind two
      // overlays and can never be restored.
      await clickChip("local");
      const stash2 = await b.evaluate(`JSON.parse(localStorage.getItem('preLensTopics') || 'null')`);
      assert(
        JSON.stringify(stash2) === JSON.stringify(stash),
        `lens-to-lens overwrote the stashed compass: ${JSON.stringify(stash2)}`
      );

      await clickChip("my-compass");
      const afterKey = await b.evaluate(`sessionStorage.getItem('activeLensKey')`);
      assert(afterKey === null, `activeLensKey was not cleared on exit (got ${JSON.stringify(afterKey)})`);
      const restored = await b.evaluate(`JSON.parse(localStorage.getItem('selectedTopics') || '[]')`);
      assert(
        restored.length === ownIds.length && restored.every((id) => ownIds.includes(id)),
        `compass was not restored; got ${JSON.stringify(restored)}`
      );
      return "entered a lens, switched lens, and came back to the same compass";
    },
  },

  {
    name: "guest-can-save-a-lens",
    // A guest's lenses live in localStorage and must NOT reach the shared
    // ev-context payload — that is what keeps the broker payload-size question
    // off this feature's critical path, so it is asserted, not assumed.
    async run(b, baseUrl) {
      await b.navigate(`${baseUrl}/results`, { settleMs: 4000 });
      await b.evaluate(`(() => { localStorage.clear(); sessionStorage.clear(); })()`);
      await seedBuiltCompass(b, 8);
      await b.navigate(`${baseUrl}/results`, { settleMs: 8000 });

      const opened = await b.evaluate(`(() => {
        const el = document.querySelector('[data-testid="save-view-as-lens"]');
        if (!el) return 'NOT_FOUND';
        el.click();
        return 'OK';
      })()`);
      assert(opened === "OK", "no '+ Save this view' affordance on the compass");
      await b.sleep(700);

      // A guest lens is stored per-origin in localStorage, and Essentials reads
      // custom lenses only from the authed /compass/my-lenses — so without this
      // note a guest names a lens, sees it confirmed, and then cannot find it in
      // the app it was built for. Asserted here because it is the only automated
      // coverage this repo can give a component: there is no testing-library.
      const guestNote = await b.evaluate(`(() => {
        const el = document.querySelector('[data-testid="lens-guest-note"]');
        return el ? (el.textContent || '').trim() : 'MISSING';
      })()`);
      assert(
        guestNote.includes("Register a free account"),
        `guest lens note missing or reworded: ${JSON.stringify(guestNote)}`
      );

      // React tracks the input's value on the DOM node, so setting .value
      // directly is invisible to it — go through the native setter and fire the
      // event React actually listens for.
      await b.evaluate(`(() => {
        const input = document.querySelector('[data-testid="lens-name-input"]');
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, 'Smoke lens');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      })()`);
      await b.sleep(300);
      await b.evaluate(`document.querySelector('[data-testid="lens-save-confirm"]').click()`);
      await b.sleep(1500);

      const stored = await b.evaluate(`JSON.parse(localStorage.getItem('customLenses') || '[]')`);
      assert(stored.length === 1, `expected 1 saved lens, got ${stored.length}`);
      assert(/^u_[a-z0-9]{6}$/.test(stored[0].key), `bad lens key ${stored[0].key}`);
      assert(stored[0].name === "Smoke lens", `lens name is ${JSON.stringify(stored[0].name)}`);
      assert(
        stored[0].topicIds.length === 8,
        `lens captured ${stored[0].topicIds.length} topics, expected the compass's 8`
      );

      // Saving a lens must not activate it: the user is still looking at their
      // own compass, which merely happens to match the lens they just saved.
      const activeKey = await b.evaluate(`sessionStorage.getItem('activeLensKey')`);
      assert(activeKey === null, `saving a lens activated it (activeLensKey=${activeKey})`);

      // And the chip is now in the row.
      const chip = await b.evaluate(
        `!!document.querySelector('[data-testid="lens-chip-' + ${JSON.stringify("")} + JSON.parse(localStorage.getItem('customLenses'))[0].key + '"]')`
      );
      assert(chip, "the new lens did not appear in the switcher row");

      return `saved "${stored[0].name}" as ${stored[0].key}`;
    },
  },

  {
    name: "guest-lenses-promote-on-sign-in",
    // The whole point of letting guests build lenses: the work has to survive
    // signing in. Promotion is one whole-set PUT, and local storage is cleared
    // only after the server confirms — clearing state that was not confirmed
    // written is how you lose a user's work to one bad response.
    async run(b, baseUrl) {
      const creds = loadCredentials();
      if (!creds) throw new Skip("no SMOKE_EMAIL / SMOKE_PASSWORD available");
      const token = await login(creds);
      await requireMyLensesApi(token);
      await clearServerLenses(token);

      const topics = await (await fetch(`${baseUrl}${API}/topics`)).json();
      const chosen = topics.slice(0, 8).map((t) => t.id);

      await b.navigate(`${baseUrl}/results`, { settleMs: 4000 });
      await b.evaluate(`(() => {
        localStorage.clear();
        sessionStorage.clear();
        localStorage.setItem('selectedTopics', ${JSON.stringify(JSON.stringify(chosen))});
        localStorage.setItem('calibration_completed', 'true');
        localStorage.setItem('customLenses', JSON.stringify([{
          key: 'u_smoke1', name: 'Promoted lens',
          topicIds: ${JSON.stringify(JSON.stringify(chosen))} && JSON.parse(${JSON.stringify(JSON.stringify(chosen))}),
          visibility: 'private',
        }]));
      })()`);

      // Sign in the way every other authed scenario does.
      await b.evaluate(`localStorage.setItem('ev_token', ${JSON.stringify(token)})`);
      await b.navigate(`${baseUrl}/results`, { settleMs: 14000 });

      const server = await getServerLenses(token);
      assert(
        server.some((l) => l.name === "Promoted lens"),
        `promoted lens missing from the server; got ${JSON.stringify(server.map((l) => l.name))}`
      );

      const local = await b.evaluate(`localStorage.getItem('customLenses')`);
      assert(local === null, `guest lenses were not cleared after promotion (still ${local})`);

      await clearServerLenses(token);
      return `promoted 1 lens for ${creds.email}`;
    },
  },

  {
    name: "guest-can-edit-and-delete-a-lens",
    // Editing is "activate, rearrange, Update" — there is no separate editor. The
    // thing worth pinning is that browsing a lens does NOT rewrite it: leaving
    // with unsaved spoke changes must discard them, or every visit silently
    // redefines the lens the user made.
    async run(b, baseUrl) {
      const topics = await (await fetch(`${baseUrl}${API}/topics`)).json();
      const eight = topics.slice(0, 8).map((t) => t.id);
      const seven = eight.slice(0, 7);

      await b.navigate(`${baseUrl}/results`, { settleMs: 4000 });
      await b.evaluate(`(() => {
        localStorage.clear();
        sessionStorage.clear();
        const answers = {};
        ${JSON.stringify(topics.slice(0, 8).map((t) => t.short_title))}
          .forEach((s, i) => { answers[s] = (i % 5) + 1; });
        localStorage.setItem('answers', JSON.stringify(answers));
        localStorage.setItem('selectedTopics', ${JSON.stringify(JSON.stringify(eight))});
        localStorage.setItem('calibration_completed', 'true');
        localStorage.setItem('customLenses', JSON.stringify([{
          key: 'u_edit01', name: 'Editable', visibility: 'private',
          topicIds: JSON.parse(${JSON.stringify(JSON.stringify(eight))}),
        }]));
      })()`);
      await b.navigate(`${baseUrl}/results`, { settleMs: 8000 });

      // Activate it, then shrink the on-screen spokes WITHOUT pressing Update.
      await b.evaluate(`document.querySelector('[data-testid="lens-chip-u_edit01"]').click()`);
      await b.sleep(1000);
      await b.evaluate(`localStorage.setItem('selectedTopics', ${JSON.stringify(JSON.stringify(seven))})`);
      await b.evaluate(`document.querySelector('[data-testid="lens-chip-my-compass"]').click()`);
      await b.sleep(1000);

      const untouched = await b.evaluate(`JSON.parse(localStorage.getItem('customLenses'))[0]`);
      assert(
        untouched.topicIds.length === 8,
        `browsing a lens rewrote it: now holds ${untouched.topicIds.length} topics, expected 8`
      );

      // Delete it. window.confirm has to be answered before the click.
      await b.evaluate(`window.confirm = () => true`);
      await b.evaluate(`document.querySelector('[data-testid="lens-chip-u_edit01"]').click()`);
      await b.sleep(900);
      const del = await b.evaluate(`(() => {
        const el = document.querySelector('[data-testid="lens-delete"]');
        if (!el) return 'NOT_FOUND';
        el.click();
        return 'OK';
      })()`);
      assert(del === "OK", "no Delete action on the active user lens chip");
      await b.sleep(1200);

      const after = await b.evaluate(`JSON.parse(localStorage.getItem('customLenses') || '[]')`);
      assert(after.length === 0, `lens survived deletion: ${JSON.stringify(after)}`);
      const key = await b.evaluate(`sessionStorage.getItem('activeLensKey')`);
      assert(key === null, `deleting the active lens left activeLensKey=${key}`);

      return "unsaved edits discarded, lens deleted, compass restored";
    },
  },

  {
    name: "recalibration-prompt-renders",
    // No topic in the OPEN season is stale today — every answer resolves to the
    // version its season serves, so the API correctly returns no flags. Rather
    // than wait for a season rollover to find out whether this renders, seed a
    // lens that already carries needsRecalibration. The client does not compute
    // staleness; it renders what the server decided, so a seeded flag exercises
    // exactly the code that will run.
    async run(b, baseUrl) {
      const topics = await (await fetch(`${baseUrl}${API}/topics`)).json();
      const eight = topics.slice(0, 8);
      const flagged = eight[2];
      const NOTE = "Rewrote the five options in plainer language.";

      await b.navigate(`${baseUrl}/results`, { settleMs: 4000 });
      await b.evaluate(`(() => {
        localStorage.clear();
        sessionStorage.clear();
        const answers = {};
        ${JSON.stringify(eight.map((t) => t.short_title))}.forEach((s, i) => { answers[s] = (i % 5) + 1; });
        localStorage.setItem('answers', JSON.stringify(answers));
        localStorage.setItem('selectedTopics', ${JSON.stringify(JSON.stringify(eight.map((t) => t.id)))});
        localStorage.setItem('calibration_completed', 'true');
        localStorage.setItem('customLenses', JSON.stringify([{
          key: 'u_flag01', name: 'Flagged', visibility: 'private',
          topicIds: JSON.parse(${JSON.stringify(JSON.stringify(eight.map((t) => t.id)))}),
          needsRecalibration: [{
            topicId: ${JSON.stringify(flagged.id)},
            reason: 'question_revised',
            currentValue: 3,
            publicNote: ${JSON.stringify(NOTE)},
            answeredVersion: 1,
            effectiveVersion: 2,
          }],
        }]));
      })()`);
      await b.navigate(`${baseUrl}/results`, { settleMs: 8000 });

      // The count badge rides on the chip even before the lens is opened.
      const badge = await b.evaluate(
        `(document.querySelector('[data-testid="lens-flags-u_flag01"]') || {}).textContent || null`
      );
      assert(badge === "1", `expected a "1" flag badge on the chip, got ${JSON.stringify(badge)}`);

      await b.evaluate(`document.querySelector('[data-testid="lens-chip-u_flag01"]').click()`);
      await b.sleep(1200);

      const marker = await b.evaluate(`(() => {
        const el = document.querySelector('[data-testid="recalibrate-marker-${flagged.id}"]');
        if (!el) return 'NOT_FOUND';
        el.click();
        return 'OK';
      })()`);
      assert(marker === "OK", `no recalibration marker on the flagged topic "${flagged.short_title}"`);
      await b.sleep(700);

      const text = await b.evaluate(
        `(document.querySelector('[data-testid="recalibration-popover"]') || {}).textContent || ''`
      );
      assert(text.includes("This question was updated"), `popover copy wrong: ${JSON.stringify(text.slice(0, 120))}`);
      assert(
        text.includes(NOTE),
        "publicNote must be rendered verbatim — it is editorial's own wording"
      );

      // Later dismisses for the session, and only for the session.
      await b.evaluate(`document.querySelector('[data-testid="recalibrate-later"]').click()`);
      await b.sleep(600);
      const gone = await b.evaluate(`!document.querySelector('[data-testid="recalibration-popover"]')`);
      assert(gone, "popover did not close on Later");
      const markerGone = await b.evaluate(
        `!document.querySelector('[data-testid="recalibrate-marker-${flagged.id}"]')`
      );
      assert(markerGone, "marker should be dismissed for this session after Later");

      return `flag rendered and dismissed for "${flagged.short_title}"`;
    },
  },

  {
    name: "reviewing-updated-questions-keeps-the-compass",
    // Reviewing questions a season revised must not change WHICH topics are on
    // the compass. The prompt promises "your answers still stand"; the flagged
    // questions here are deliberately ones the user has NOT put on their
    // compass, which is exactly what the off-compass "Review" button offers.
    //
    // The bug: finishing that run replaced selectedTopics with every question
    // reviewed, uncapped. After a season published a batch of revisions, an
    // 8-topic compass came back as all the reviewed questions — the user's own
    // compass silently discarded and the chart rendered unreadably wide.
    //
    // ⚠ READ BEFORE TRUSTING THIS AS A REGRESSION GUARD. It passes against the
    // broken code too. A guest can only be given flags through an active custom
    // lens (mergeFlags takes lensFlags from activeUserLens), and an active lens
    // re-applies its own topicIds to the selection on the next render, which
    // puts the compass back before anything can observe the damage.
    //
    // The unmasked path is a signed-in user, whose flags come from the server
    // (compassFlags) and need no lens — nothing restores the selection there.
    // Reproducing that needs an account with genuinely stale answers, which
    // cannot be seeded from the client. So this scenario pins the invariant and
    // covers the lens path; it is not proof the unlensed path is fixed.
    async run(b, baseUrl) {
      const topics = await (await fetch(`${baseUrl}${API}/topics`)).json();
      if (topics.length < 14) throw new Skip("needs at least 14 topics");
      const mine = topics.slice(0, 8);          // the compass
      const offCompass = topics.slice(8, 14);   // revised, NOT on the compass
      const myIds = mine.map((t) => t.id);

      await b.navigate(`${baseUrl}/results`, { settleMs: 4000 });
      await b.evaluate(`(() => {
        localStorage.clear();
        sessionStorage.clear();
        const answers = {};
        ${JSON.stringify([...mine, ...offCompass].map((t) => t.short_title))}
          .forEach((s, i) => { answers[s] = (i % 5) + 1; });
        localStorage.setItem('answers', JSON.stringify(answers));
        localStorage.setItem('selectedTopics', ${JSON.stringify(JSON.stringify(myIds))});
        localStorage.setItem('calibration_completed', 'true');
        localStorage.setItem('customLenses', JSON.stringify([{
          key: 'u_offc01', name: 'Off compass', visibility: 'private',
          topicIds: JSON.parse(${JSON.stringify(JSON.stringify(myIds))}),
          needsRecalibration: ${JSON.stringify(
            offCompass.map((t) => ({
              topicId: t.id,
              reason: "question_revised",
              // offCompassFlags sorts on disposition: "reworded" is the
              // "updated, your answer still stands" group behind the Review
              // button. Without it the flag exists but no prompt offers it.
              disposition: "reworded",
              currentValue: 3,
              publicNote: "Wording updated for the new season.",
              answeredVersion: 1,
              effectiveVersion: 2,
            }))
          )},
        }]));
      })()`);
      await b.navigate(`${baseUrl}/results`, { settleMs: 9000 });

      // Lens flags only count while that lens is open (activeUserLens), and a
      // guest has no server flags, so the lens has to be active for the
      // off-compass prompt to exist at all. Its topicIds are the compass, so
      // opening it does not change which topics are selected.
      const chip = await b.evaluate(`(() => {
        const el = document.querySelector('[data-testid="lens-chip-u_offc01"]');
        if (!el) return 'NOT_FOUND';
        el.click();
        return 'OK';
      })()`);
      if (chip !== "OK") throw new Skip("custom lens chip did not render");
      await b.sleep(1500);

      const before = await b.evaluate(
        `JSON.parse(localStorage.getItem('selectedTopics') || '[]')`
      );
      assert(before.length === 8, `setup: expected 8 topics on the compass, got ${before.length}`);

      // The off-compass prompt's own button. Skip rather than fail if this
      // build renders no off-compass group — the flags are server-driven.
      const opened = await clickButtonIfPresent(b, "Review");
      if (!opened) throw new Skip("no off-compass Review prompt rendered");

      await b.waitFor(`${STANCE_BUTTONS}.length > 0`, { label: "recalibration stances" });

      // Answer every revised question, pressing through to the end.
      for (let i = 0; i < offCompass.length; i++) {
        const picked = await b.evaluate(`(() => {
          const btns = ${STANCE_BUTTONS};
          if (!btns.length) return false;
          btns[${i} % btns.length].click();
          return true;
        })()`);
        if (!picked) break;
        await b.sleep(500);
        if (!(await clickButtonIfPresent(b, "Next"))) {
          await clickButtonIfPresent(b, "Finish");
          break;
        }
      }
      await b.sleep(1500);

      const after = await b.evaluate(
        `JSON.parse(localStorage.getItem('selectedTopics') || '[]')`
      );
      const offIds = offCompass.map((t) => t.id);
      assert(
        after.length <= 8,
        `compass grew past the 8-topic cap: ${after.length} topics`
      );
      assert(
        !after.some((id) => offIds.includes(id)),
        "a reviewed off-compass question was added to the compass"
      );
      assert(
        after.length === 8 && myIds.every((id) => after.includes(id)),
        `the compass was replaced by the reviewed questions: ${after.length} topics, ` +
        `${myIds.filter((id) => !after.includes(id)).length} of the original 8 lost`
      );

      return `${offCompass.length} revised questions reviewed, all 8 compass topics intact`;
    },
  },

  {
    name: "review-routes-to-full-calibration-and-asks",
    // Review used to open the overlay over just the flagged questions. Because
    // a reworded question keeps the answer given against the OLD wording, the
    // overlay counted every one as already answered, offered "Finish" on its
    // first screen, and re-answered nothing — so the prompt came back on the
    // next reload and could never be satisfied by using it.
    //
    // Now it hands off to the full calibration page, where the flagged
    // questions are highlighted and actually asked.
    async run(b, baseUrl) {
      const topics = await (await fetch(`${baseUrl}${API}/topics`)).json();
      if (topics.length < 14) throw new Skip("needs at least 14 topics");
      const mine = topics.slice(0, 8);
      const flagged = topics.slice(8, 11);
      const myIds = mine.map((t) => t.id);

      await b.navigate(`${baseUrl}/results`, { settleMs: 4000 });
      await b.evaluate(`(() => {
        localStorage.clear();
        sessionStorage.clear();
        const answers = {};
        // Every one of them already answered — that is the whole point.
        ${JSON.stringify([...mine, ...flagged].map((t) => t.short_title))}
          .forEach((s, i) => { answers[s] = (i % 5) + 1; });
        localStorage.setItem('answers', JSON.stringify(answers));
        localStorage.setItem('selectedTopics', ${JSON.stringify(JSON.stringify(myIds))});
        localStorage.setItem('calibration_completed', 'true');
        localStorage.setItem('customLenses', JSON.stringify([{
          key: 'u_route01', name: 'Routing', visibility: 'private',
          topicIds: JSON.parse(${JSON.stringify(JSON.stringify(myIds))}),
          needsRecalibration: ${JSON.stringify(
            flagged.map((t) => ({
              topicId: t.id,
              reason: "question_revised",
              disposition: "reworded",
              currentValue: 3,
              publicNote: "Wording updated for the new season.",
              answeredVersion: 1,
              effectiveVersion: 2,
            }))
          )},
        }]));
      })()`);
      await b.navigate(`${baseUrl}/results`, { settleMs: 9000 });

      const chip = await b.evaluate(`(() => {
        const el = document.querySelector('[data-testid="lens-chip-u_route01"]');
        if (!el) return 'NOT_FOUND';
        el.click();
        return 'OK';
      })()`);
      if (chip !== "OK") throw new Skip("custom lens chip did not render");
      await b.sleep(1500);

      const clicked = await b.evaluate(`(() => {
        const el = document.querySelector('[data-testid="off-compass-updated-action"]');
        if (!el) return 'NOT_FOUND';
        el.click();
        return 'OK';
      })()`);
      if (clicked !== "OK") throw new Skip("no off-compass Review prompt rendered");
      await b.sleep(3000);

      const url = await b.evaluate(`window.location.pathname`);
      assert(url === "/calibrate", `Review should land on /calibrate, got ${url}`);

      // The flagged questions are marked as still owing an answer...
      const pending = await b.evaluate(
        `document.querySelectorAll('[data-testid^="recalibrate-pending-"]').length`
      );
      assert(
        pending === flagged.length,
        `expected ${flagged.length} highlighted questions, got ${pending}`
      );

      // ...and the page is ASKING, not sitting on a completion screen.
      await b.waitFor(`${STANCE_BUTTONS}.length > 0`, { label: "stance options" });
      const fullyCalibrated = await b.evaluate(
        `(document.body.innerText || '').includes('Fully Calibrated')`
      );
      assert(!fullyCalibrated, "landed on the completion screen instead of a question");

      // Answering one retires it from the highlighted set.
      await b.evaluate(`${STANCE_BUTTONS}[0].click()`);
      await b.sleep(1600);
      const after = await b.evaluate(
        `document.querySelectorAll('[data-testid^="recalibrate-pending-"]').length`
      );
      assert(
        after === pending - 1,
        `answering should retire one flag: ${pending} -> ${after}`
      );

      return `Review routed to /calibrate, ${pending} questions highlighted, 1 retired on answer`;
    },
  },

  {
    name: "calibration-page-pins-a-lens-and-explains-changes",
    // Two things the full calibration page gained so it can be the place you
    // re-answer: a lens picker that pins that lens's questions above the
    // library, and an "i" on any question editorial revised, carrying their
    // own note verbatim.
    //
    // The lens here is a saved custom one, because that is the only flag source
    // a guest has — the server stamps answers, and a guest's never were.
    async run(b, baseUrl) {
      const topics = await (await fetch(`${baseUrl}${API}/topics`)).json();
      if (topics.length < 6) throw new Skip("needs at least 6 topics");
      const lensTopics = topics.slice(0, 4);
      const changed = lensTopics[1];
      const NOTE = "We split this into two questions after reader feedback.";

      await b.navigate(`${baseUrl}/results`, { settleMs: 4000 });
      await b.evaluate(`(() => {
        localStorage.clear();
        sessionStorage.clear();
        const answers = {};
        ${JSON.stringify(lensTopics.map((t) => t.short_title))}
          .forEach((s, i) => { answers[s] = (i % 5) + 1; });
        localStorage.setItem('answers', JSON.stringify(answers));
        localStorage.setItem('selectedTopics', ${JSON.stringify(JSON.stringify(lensTopics.map((t) => t.id)))});
        localStorage.setItem('calibration_completed', 'true');
        localStorage.setItem('customLenses', JSON.stringify([{
          key: 'u_pin01', name: 'Pinned Lens', visibility: 'private',
          topicIds: JSON.parse(${JSON.stringify(JSON.stringify(lensTopics.map((t) => t.id)))}),
          needsRecalibration: [{
            topicId: ${JSON.stringify(changed.id)},
            reason: 'question_revised',
            disposition: 'reworded',
            currentValue: 3,
            publicNote: ${JSON.stringify(NOTE)},
            answeredVersion: 1,
            effectiveVersion: 2,
          }],
        }]));
      })()`);

      await b.navigate(`${baseUrl}/calibrate`, { settleMs: 9000 });

      const picker = await b.evaluate(
        `!!document.querySelector('[data-testid="calibration-lens-picker"]')`
      );
      assert(picker, "no lens picker on the calibration page");

      const groupsBefore = await b.evaluate(`(() => {
        const h = [...document.querySelectorAll('aside [data-testid="sidebar-group-title"]')]
          .map(x => (x.textContent || '').trim()).filter(Boolean);
        return h[0] || null;
      })()`);
      assert(
        groupsBefore !== "Pinned Lens",
        "the lens group should only appear once a lens is picked"
      );

      const picked = await b.evaluate(`(() => {
        const el = document.querySelector('[data-testid="calibration-lens-u_pin01"]');
        if (!el) return 'NOT_FOUND';
        el.click();
        return 'OK';
      })()`);
      assert(picked === "OK", "the saved custom lens is missing from the picker");
      await b.sleep(1400);

      const groupsAfter = await b.evaluate(`(() => {
        const h = [...document.querySelectorAll('aside [data-testid="sidebar-group-title"]')]
          .map(x => (x.textContent || '').trim()).filter(Boolean);
        return JSON.stringify(h.slice(0, 3));
      })()`);
      const headers = JSON.parse(groupsAfter);
      assert(headers[0] === "Pinned Lens", `lens group not pinned first: ${groupsAfter}`);
      assert(
        headers.length > 1,
        "the library should still be below the pinned group, not replaced by it"
      );

      // The change note, and editorial's wording rendered verbatim.
      const noteBtn = await b.evaluate(`(() => {
        const el = document.querySelector('[data-testid="change-note-${changed.id}"]');
        if (!el) return 'NOT_FOUND';
        el.click();
        return 'OK';
      })()`);
      assert(noteBtn === "OK", `no change note on the revised question`);
      await b.sleep(800);

      const text = await b.evaluate(
        `(document.querySelector('[data-testid="recalibration-popover"]') || {}).textContent || ''`
      );
      assert(
        text.includes(NOTE),
        `publicNote must render verbatim, got ${JSON.stringify(text.slice(0, 140))}`
      );

      // The chip wears the lens the way the compass switcher does: its own
      // mark, and its own colour filled in when pinned. A custom lens takes the
      // shared custom teal, #00657C -> rgb(0, 101, 124).
      const chip = await b.evaluate(`(() => {
        const el = document.querySelector('[data-testid="calibration-lens-u_pin01"]');
        if (!el) return JSON.stringify({ missing: true });
        const cs = getComputedStyle(el);
        return JSON.stringify({ icon: !!el.querySelector('svg'), bg: cs.backgroundColor });
      })()`);
      const chipStyle = JSON.parse(chip);
      assert(chipStyle.icon, "the lens chip has no icon");
      assert(
        chipStyle.bg === "rgb(0, 101, 124)",
        `pinned chip should be filled in the lens colour, got ${chipStyle.bg}`
      );

      // Picking a lens must never be mistaken for changing the compass.
      const stillMine = await b.evaluate(
        `JSON.parse(localStorage.getItem('selectedTopics') || '[]').length`
      );
      assert(stillMine === 4, `pinning a lens changed the compass: ${stillMine} topics`);

      return `lens pinned above ${headers.length - 1}+ categories, change note verbatim, compass untouched`;
    },
  },

  {
    name: "finishing-calibration-stays-on-the-page",
    // Answering the last question used to replace the whole page with a "Fully
    // Calibrated" screen whose only exits were the Library and the compass — so
    // the moment you completed the set, the tool you were using to refine it
    // was taken away. The completion is now a banner over the same page.
    //
    // Drives the real last answer rather than asserting on state: the takeover
    // was a render branch, and only a real click proves the branch is gone.
    async run(b, baseUrl) {
      // The sidebar is built from the CATEGORIES, so seeding from /topics alone
      // can leave a second gap behind and the run never reaches its last answer.
      const topics = await (await fetch(`${baseUrl}${API}/topics`)).json();
      const categories = await (await fetch(`${baseUrl}${API}/categories`)).json();
      const everything = [
        ...topics,
        ...(Array.isArray(categories) ? categories : []).flatMap((c) => c.topics || []),
      ].filter((t) => t && t.short_title);
      if (everything.length < 3) throw new Skip("needs at least 3 topics");

      const last = topics[topics.length - 1];
      const preAnswered = everything.filter((t) => t.short_title !== last.short_title);

      await b.navigate(`${baseUrl}/results`, { settleMs: 4000 });
      await b.evaluate(`(() => {
        localStorage.clear();
        sessionStorage.clear();
        const answers = {};
        ${JSON.stringify(preAnswered.map((t) => t.short_title))}
          .forEach((s, i) => { answers[s] = (i % 5) + 1; });
        localStorage.setItem('answers', JSON.stringify(answers));
        localStorage.setItem('selectedTopics', ${JSON.stringify(JSON.stringify(topics.slice(0, 8).map((t) => t.id)))});
      })()`);

      // Every question but one answered, so the page opens on the gap.
      await b.navigate(`${baseUrl}/calibrate`, { settleMs: 9000 });
      const opensOnGap = await b.evaluate(
        `(document.body.innerText || '').includes(${JSON.stringify(last.short_title)})`
      );
      await b.waitFor(`${STANCE_BUTTONS}.length > 0`, { label: "stance options" });

      await b.evaluate(`${STANCE_BUTTONS}[0].click()`);
      await b.sleep(1800);

      const after = await b.evaluate(`JSON.stringify({
        path: location.pathname,
        banner: !!document.querySelector('[data-testid="calibration-complete-banner"]'),
        stances: document.querySelectorAll('[data-testid="stance-option"]').length,
        sidebar: document.querySelectorAll('aside [data-testid="sidebar-group-title"]').length,
        takeover: (document.body.innerText || '').includes('Fully Calibrated'),
        completed: localStorage.getItem('calibration_completed'),
      })`);
      const s = JSON.parse(after);

      assert(s.path === "/calibrate", `finishing navigated away to ${s.path}`);
      assert(!s.takeover, "the full-page completion screen is back");
      assert(s.banner, "no completion banner after the last answer");
      assert(s.stances > 0, "the question panel went away on completion");
      assert(s.sidebar > 0, "the sidebar went away on completion");
      // The banner is presentation; the flag downstream screens read is not.
      assert(s.completed === "true", "calibration_completed was not written");

      return `completed in place: banner up, ${s.stances} stances and ${s.sidebar} groups still on screen${opensOnGap ? "" : " (opened off-gap)"}`;
    },
  },

  {
    name: "calibrate-param-opens-the-named-lens",
    // Essentials has linked here as /?calibrate=<key>&return=<url> since the
    // Federal Lens shipped, and this app never read the param — App.jsx parsed
    // only `return`, so the "Calibrate this lens" CTA landed on a generic
    // Compass with nothing selected.
    //
    // Two things can silently break this and neither shows up in a unit test:
    //   1. HelpGuard sends an uncalibrated visitor from / to /results with a
    //      <Navigate>, which DROPS the query string — and an uncalibrated
    //      visitor is exactly who this link is usually for.
    //   2. CalibrationOverlay computes its opening step ONCE on mount. If the
    //      generic auto-route fires first, the lens topics are ignored and the
    //      user gets the welcome screen instead of the lens's questions.
    // Both are asserted below by driving a real fresh arrival.
    async run(b, baseUrl) {
      const lenses = await (await fetch(`${baseUrl}${API}/lenses`)).json();
      const federal = (Array.isArray(lenses) ? lenses : []).find((l) => l.key === "federal");
      assert(federal, "federal lens missing from /compass/lenses");

      const topics = await (await fetch(`${baseUrl}${API}/topics`)).json();
      const federalTitles = topics
        .filter((t) => federal.topicIds.includes(t.id))
        .map((t) => t.short_title);
      assert(federalTitles.length > 0, "no federal lens topics resolved against /topics");

      const RETURN = "https://essentials.empowered.vote/me";

      // A brand new visitor: nothing calibrated, so HelpGuard WILL redirect.
      await b.navigate(`${baseUrl}/results`, { settleMs: 3000 });
      await b.evaluate(`(() => { localStorage.clear(); sessionStorage.clear(); })()`);

      await b.navigate(
        `${baseUrl}/?calibrate=federal&return=${encodeURIComponent(RETURN)}`,
        { settleMs: 9000 }
      );

      // The param is consumed out of the URL so a refresh does not replay it...
      const search = await b.evaluate(`window.location.search`);
      assert(!search.includes("calibrate="), `?calibrate= was not stripped: ${JSON.stringify(search)}`);

      // ...while `return` still reached ReturnBanner. Rewriting the whole query
      // would consume it before that component mounts and silently kill the way
      // back to Essentials — the one thing this link must not break.
      const storedReturn = await b.evaluate(`sessionStorage.getItem('essentials_return_url')`);
      assert(storedReturn === RETURN, `return url lost: ${JSON.stringify(storedReturn)}`);

      // The named lens is applied, not just calibrated.
      const key = await b.evaluate(`sessionStorage.getItem('activeLensKey')`);
      assert(key === "federal", `activeLensKey after a ?calibrate= arrival is ${JSON.stringify(key)}`);

      // Straight to questions. A fresh guest normally lands on the welcome
      // screen ("calibrate your compass" / "Start with Local Lens") — seeing it
      // here means the generic auto-route won the race and the lens was lost.
      const welcome = await b.evaluate(
        `document.body.innerText.includes('calibrate your compass')`
      );
      assert(!welcome, "generic calibration welcome screen won the race; the lens was ignored");

      const sawStances = await b.waitFor(`${STANCE_BUTTONS}.length > 0`, { label: "stance buttons" });
      assert(sawStances, "?calibrate= arrival never reached a question");

      // And the questions it is asking belong to the lens.
      const picked = await b.evaluate(`(() => {
        const btns = ${STANCE_BUTTONS};
        if (!btns.length) return false;
        btns[0].click();
        return true;
      })()`);
      assert(picked, "no stance buttons to answer");
      await b.sleep(900);

      const answers = await b.evaluate(`JSON.parse(localStorage.getItem('answers') || '{}')`);
      const answered = Object.keys(answers);
      assert(answered.length > 0, "answering the first question recorded nothing");
      const strays = answered.filter((t) => !federalTitles.includes(t));
      assert(
        strays.length === 0,
        `calibration asked questions outside the lens: ${strays.join(", ")}`
      );

      return `federal lens applied and calibrating, return url preserved`;
    },
  },
];

// --------------------------------------------------------------------- runner

const args = process.argv.slice(2);
const only = args.find((a) => a.startsWith("--only="))?.split("=")[1];
const selected = only ? scenarios.filter((s) => s.name === only) : scenarios;

if (only && selected.length === 0) {
  console.error(`No scenario named "${only}". Available: ${scenarios.map((s) => s.name).join(", ")}`);
  process.exit(2);
}

console.log("Starting dev server...");
const server = await startDevServer({ port: Number(process.env.SMOKE_PORT) || 5199 });
console.log(`Dev server up at ${server.baseUrl}\n`);

const results = [];
let port = 9400;

for (const scenario of selected) {
  // A fresh browser profile per scenario: the ev-context broker keeps state in
  // its own origin's storage, so sharing a profile lets scenarios bleed together.
  const browser = await launch({ port: port++ });
  const started = Date.now();
  try {
    const detail = await scenario.run(browser, server.baseUrl);
    assert(
      browser.pageErrors.length === 0,
      `uncaught page error: ${browser.pageErrors[0]}`
    );
    const ms = Date.now() - started;
    results.push({ name: scenario.name, ok: true });
    console.log(`PASS  ${scenario.name} (${(ms / 1000).toFixed(1)}s) — ${detail}`);
    if (browser.consoleErrors.length) {
      console.log(`      note: ${browser.consoleErrors.length} console error(s), e.g. ${browser.consoleErrors[0].slice(0, 120)}`);
    }
  } catch (err) {
    if (err instanceof Skip) {
      results.push({ name: scenario.name, skipped: true });
      console.log(`SKIP  ${scenario.name} — ${err.message}`);
    } else {
      results.push({ name: scenario.name, ok: false, err });
      console.log(`FAIL  ${scenario.name} — ${err.message}`);
      if (browser.pageErrors.length) {
        console.log(`      page errors: ${browser.pageErrors.slice(0, 3).join(" | ")}`);
      }
    }
  } finally {
    await browser.close();
  }
}

await server.stop();

const skipped = results.filter((r) => r.skipped);
const failed = results.filter((r) => !r.ok && !r.skipped);
const ran = results.length - skipped.length;
console.log(
  `\n${ran - failed.length}/${ran} scenarios passed` +
    (skipped.length ? ` (${skipped.length} skipped)` : "")
);
process.exit(failed.length ? 1 : 0);
