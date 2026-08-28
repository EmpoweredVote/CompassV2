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
    results.push({ name: scenario.name, ok: false, err });
    console.log(`FAIL  ${scenario.name} — ${err.message}`);
    if (browser.pageErrors.length) {
      console.log(`      page errors: ${browser.pageErrors.slice(0, 3).join(" | ")}`);
    }
  } finally {
    await browser.close();
  }
}

await server.stop();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} scenarios passed`);
process.exit(failed.length ? 1 : 0);
