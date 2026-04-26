import { useEffect } from "react";
import { useLocation } from "react-router";
import Layout from "../components/Layout";

/**
 * HowItWorks — transparency page explaining the Compass's antipartisan design choices.
 * Reached from the persistent help button in Layout, from the final step of the
 * post-calibration tour, and from contextual "?" icons on the Quiz and Compass pages.
 */
export default function HowItWorks() {
  const location = useLocation();

  // When navigated to with a hash (e.g. /how-it-works#compass-positions),
  // scroll the target section into view after the page mounts.
  useEffect(() => {
    if (location.hash) {
      const el = document.querySelector(location.hash);
      if (el) {
        // Delay slightly so layout settles before scrolling
        setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      }
    } else {
      window.scrollTo({ top: 0 });
    }
  }, [location.hash]);

  return (
    <Layout>
      <article className="max-w-[720px] mx-auto px-6 py-10 text-gray-800 leading-relaxed">
        <header className="mb-10">
          <h1 className="text-3xl md:text-4xl font-semibold text-[#00657c] mb-3">
            How the Compass Works
          </h1>
          <p className="text-lg text-gray-600">
            Our approach to helping you think about politics without taking sides.
          </p>
        </header>

        <section id="spectrum-direction" className="mb-10 scroll-mt-24">
          <h2 className="text-2xl font-semibold text-[#00657c] mb-3">
            Why stances don't always run the same direction
          </h2>
          <p className="mb-4">
            Most topics have a natural spectrum of policy positions — often something
            like more-government-intervention on one end and less on the other. We keep
            the stances in their spectrum order (so neighboring positions stay
            neighbors), but we <strong>randomly flip the direction</strong> each time.
            Sometimes the spectrum runs one way, sometimes the other.
          </p>
          <p className="mb-6">
            Why? Because consistently putting one "side" at the top — even if
            unintentional — quietly tells users which answers are the "default" or
            "first" ones. Flipping the direction breaks that signal without scrambling
            the stances into nonsense.
          </p>

          <figure className="my-6 border border-gray-200 rounded-xl p-5 bg-gray-50">
            <svg
              viewBox="0 0 520 180"
              role="img"
              aria-labelledby="spectrum-diagram-title spectrum-diagram-desc"
              className="w-full h-auto"
            >
              <title id="spectrum-diagram-title">
                Same answer, two possible spectrum orientations
              </title>
              <desc id="spectrum-diagram-desc">
                Two horizontal spectrums showing the same five policy positions. In the
                top spectrum the direction runs left to right; in the bottom spectrum it
                runs right to left. The same user pick lands at different positions.
              </desc>

              {/* Top spectrum: left to right */}
              <g transform="translate(20, 30)">
                <line x1="0" y1="20" x2="480" y2="20" stroke="#00657c" strokeWidth="2" />
                {[0, 1, 2, 3, 4].map((i) => (
                  <circle
                    key={`top-${i}`}
                    cx={i * 120}
                    cy="20"
                    r="8"
                    fill={i === 3 ? "#ff5740" : "#ffffff"}
                    stroke="#00657c"
                    strokeWidth="2"
                  />
                ))}
                <text x="0" y="50" fontSize="12" fill="#6b7280">Position 1</text>
                <text x="440" y="50" fontSize="12" fill="#6b7280">Position 5</text>
                <text x="360" y="5" fontSize="11" fill="#ff5740" fontWeight="600">
                  ← your pick
                </text>
              </g>

              {/* Bottom spectrum: right to left (reversed) */}
              <g transform="translate(20, 110)">
                <line x1="0" y1="20" x2="480" y2="20" stroke="#00657c" strokeWidth="2" />
                {[0, 1, 2, 3, 4].map((i) => (
                  <circle
                    key={`bot-${i}`}
                    cx={i * 120}
                    cy="20"
                    r="8"
                    fill={i === 1 ? "#ff5740" : "#ffffff"}
                    stroke="#00657c"
                    strokeWidth="2"
                  />
                ))}
                <text x="0" y="50" fontSize="12" fill="#6b7280">Position 5</text>
                <text x="440" y="50" fontSize="12" fill="#6b7280">Position 1</text>
                <text x="80" y="5" fontSize="11" fill="#ff5740" fontWeight="600">
                  ← your pick
                </text>
              </g>
            </svg>
            <figcaption className="text-sm text-gray-600 mt-3 text-center italic">
              Same answer, two possible orientations. That's why your compass shape isn't
              a partisan score.
            </figcaption>
          </figure>
        </section>

        <section id="compass-positions" className="mb-10 scroll-mt-24">
          <h2 className="text-2xl font-semibold text-[#00657c] mb-3">
            Why your compass positions may look counterintuitive
          </h2>
          <p className="mb-4">
            Because each topic's spectrum direction is randomly flipped, a position
            that's "far from the center" on one topic might be "close to the center" on
            another — even if they represent the same kind of policy view. The same
            liberal-leaning or conservative-leaning answer can land in very different
            spots depending on which way that topic's spectrum happened to be pointing.
          </p>
          <p>
            So if your compass shape looks scattered or lopsided, that's expected. The
            shape is a reflection of your specific answers combined with randomized
            spectrum directions — not a partisan score.
          </p>
        </section>

        <section id="no-parties-no-colors" className="mb-10 scroll-mt-24">
          <h2 className="text-2xl font-semibold text-[#00657c] mb-3">
            We don't show parties or use red and blue
          </h2>
          <p className="mb-4">
            We deliberately hide political party affiliation throughout the compass. We
            don't use red, blue, or any partisan color coding. The goal is to help you
            evaluate policy positions on their merits, not on which team they belong to.
          </p>
          <p>
            This isn't about pretending parties don't exist. It's about asking you to
            decide what you think before you see the label.
          </p>
        </section>

        <section id="topic-selection" className="mb-10 scroll-mt-24">
          <h2 className="text-2xl font-semibold text-[#00657c] mb-3">
            How we pick topics
          </h2>
          <p className="mb-4">
            Topics are chosen for civic importance, not for balance theater. We don't
            artificially pair a "liberal topic" with a "conservative topic" to look
            even-handed. Many important issues don't even fit cleanly on a left–right
            axis.
          </p>
          <p>
            If a topic seems missing or unfairly framed, tell us. The topic list is
            meant to grow.
          </p>
        </section>

        <section id="reading-the-radar" className="mb-10 scroll-mt-24">
          <h2 className="text-2xl font-semibold text-[#00657c] mb-3">
            How to read the radar chart
          </h2>
          <p className="mb-4">
            Each spoke is a topic. Your dot on that spoke shows which policy position
            you picked along that topic's spectrum. Distance from the center tells you
            where your answer sits on <em>that topic's</em> spectrum — but since we flip
            spectrum directions randomly, you can't compare distances across topics and
            read a left/right meaning into the overall shape.
          </p>
          <p className="mb-6">
            Use the compass to compare yourself with politicians topic by topic, not as
            a single "score."
          </p>

          <figure className="my-6 border border-gray-200 rounded-xl p-5 bg-gray-50">
            <svg
              viewBox="0 0 320 280"
              role="img"
              aria-labelledby="radar-diagram-title radar-diagram-desc"
              className="w-full h-auto max-w-[360px] mx-auto block"
            >
              <title id="radar-diagram-title">Annotated radar chart reference</title>
              <desc id="radar-diagram-desc">
                A small radar chart with five spokes labeled as topics. Dots mark example
                picks on each spoke. Callouts indicate that each spoke is a topic and
                each dot is a pick, but that distances cannot be compared across spokes.
              </desc>

              {/* Center point */}
              <g transform="translate(160, 130)">
                {/* Concentric rings */}
                {[30, 60, 90].map((r) => (
                  <circle key={r} cx="0" cy="0" r={r} fill="none" stroke="#e5e7eb" strokeWidth="1" />
                ))}
                {/* 5 spokes */}
                {[0, 1, 2, 3, 4].map((i) => {
                  const angle = (2 * Math.PI * i) / 5 - Math.PI / 2;
                  const x = 90 * Math.cos(angle);
                  const y = 90 * Math.sin(angle);
                  return (
                    <line
                      key={`spoke-${i}`}
                      x1="0"
                      y1="0"
                      x2={x}
                      y2={y}
                      stroke="#9ca3af"
                      strokeWidth="1"
                    />
                  );
                })}
                {/* Sample filled shape */}
                <polygon
                  points={[0.8, 0.4, 0.6, 0.9, 0.3]
                    .map((v, i) => {
                      const angle = (2 * Math.PI * i) / 5 - Math.PI / 2;
                      return `${90 * v * Math.cos(angle)},${90 * v * Math.sin(angle)}`;
                    })
                    .join(" ")}
                  fill="#00657c"
                  fillOpacity="0.15"
                  stroke="#00657c"
                  strokeWidth="2"
                />
                {/* Sample dots */}
                {[0.8, 0.4, 0.6, 0.9, 0.3].map((v, i) => {
                  const angle = (2 * Math.PI * i) / 5 - Math.PI / 2;
                  return (
                    <circle
                      key={`dot-${i}`}
                      cx={90 * v * Math.cos(angle)}
                      cy={90 * v * Math.sin(angle)}
                      r="4"
                      fill="#ff5740"
                    />
                  );
                })}
              </g>

              {/* Callout: each spoke = a topic */}
              <text x="10" y="20" fontSize="11" fill="#374151">
                each spoke = a topic
              </text>
              <line x1="75" y1="23" x2="140" y2="55" stroke="#9ca3af" strokeWidth="1" />

              {/* Callout: dot = your pick */}
              <text x="220" y="20" fontSize="11" fill="#374151">
                dot = your pick
              </text>
              <line x1="240" y1="23" x2="200" y2="80" stroke="#9ca3af" strokeWidth="1" />

              {/* Callout: distance within one spoke is meaningful */}
              <text x="10" y="260" fontSize="11" fill="#374151">
                distances within a spoke = meaningful
              </text>
              <text x="10" y="274" fontSize="11" fill="#374151">
                distances across spokes = not comparable
              </text>
            </svg>
            <figcaption className="text-sm text-gray-600 mt-3 text-center italic">
              Each spoke is a topic. Each dot is your pick. Compare your shape with a
              politician's, topic by topic.
            </figcaption>
          </figure>
        </section>

        <section id="our-commitment" className="mb-10 scroll-mt-24">
          <h2 className="text-2xl font-semibold text-[#00657c] mb-3">
            Our antipartisan commitment
          </h2>
          <p className="mb-4">
            The Empowered Vote Compass exists to help you think, not to tell you what to
            think. We don't boost parties, we don't encode partisan assumptions into the
            visuals, and we try to be transparent about every design choice that could
            tilt the result.
          </p>
          <p>
            We're not perfect — bias creeps in. If something on the compass feels skewed
            or off, we want to hear about it. Transparency is our best defense against
            the biases we haven't noticed yet.
          </p>
        </section>
      </article>
    </Layout>
  );
}
