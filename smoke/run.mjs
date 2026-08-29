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
} from "./auth.mjs";

/** Thrown by a scenario that cannot run here; reported as SKIP, not failure. */
class Skip extends Error {}

const API = "/api/compass";
const BROKER_ORIGIN = "https://ev-context.empowered.vote";

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

// Stance buttons carry data-testid="stance-option" in both the calibration
// overlay and /calibrate, so the suite survives restyling. Do not swap these for
// class-based selectors — a brittle suite gets disabled, which is how #65 shipped.
const STANCE_BUTTONS = `[...document.querySelectorAll('[data-testid="stance-option"]')]`;

const answeredCount = (b) =>
  b.evaluate(`Object.keys(JSON.parse(localStorage.getItem('answers') || '{}')).length`);

/** The "N / 44" counter in the /calibrate header. */
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

      const sawWelcome = await b.waitFor(
        `document.body.innerText.includes('calibrate your compass')`,
        { label: "calibration welcome screen" }
      );
      assert(sawWelcome, "fresh guest never saw the calibration welcome screen");

      await clickButton(b, "Start with Local Lens");
      await clickButton(b, "Start finding my stances");

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

      const before = await progress(b);
      assert(before === "8 / 44", `expected to start at "8 / 44", got ${JSON.stringify(before)}`);

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
      assert(after === "14 / 44", `expected "14 / 44" after 6 answers, got ${JSON.stringify(after)}`);

      return `8 / 44 -> ${after}, all 6 answers persisted`;
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
      const lens = (Array.isArray(lenses) ? lenses : []).find(
        (l) => Array.isArray(l.topicIds) && l.topicIds.length >= 3
      );
      assert(lens, "no lens with topics returned by /compass/lenses");
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
  }
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
