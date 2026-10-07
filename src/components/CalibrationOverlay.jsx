// CalibrationOverlay.jsx
import { useState, useEffect, useMemo, useRef } from "react";
import { track } from "@empoweredvote/analytics";
import {
  STEPS,
  EXIT_VIA,
  eventsForOpen,
  eventForGetStarted,
  eventForAnswer,
  eventForQuestionSkip,
  eventForComplete,
  eventForAbandon,
} from "../lib/calibrationEvents.js";
import { useTheme } from "../ThemeProvider";
import { useCompass } from "./CompassContext";
import { apiFetch } from "../lib/auth";
import { LOCAL_LENS, JUDICIAL_LENS, FEDERAL_LENS, getLensColor, getLensInk } from "../lib/lenses";
import RadarChart from "./RadarChart";
import { getQuestionText, parseTensionTitle } from "../util/topic";
import { TopicTierBadge } from "@empoweredvote/ev-ui";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { DARK_THEME, LIGHT_THEME } from "../lib/calibrationTheme";
import CoachMark from "./CoachMark";
import { motion, AnimatePresence } from "framer-motion";

const STORAGE_KEY = "calibration_progress";
const MAX_TOPICS = 8;
const MIN_TOPICS = 3;

// Category accent colors — cycles through EV data viz palette
const CATEGORY_COLORS = [
  '#00657C', '#FF5740', '#59B0C4', '#5A9A6E', '#7C6B9E', '#D4940B', '#FED12E',
];

// Spider-graph series colors, shared by the landing hero radar and the
// onboarding illustrations so both screens read as the same chart.
const RADAR_YOU = '#7C6B9E';   // your compass
const RADAR_CAND = '#5A9A6E';  // a candidate's
const RADAR_ALIGN = '#FED12E'; // a topic where both land on the same value


// ────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────

function GhostRadar({ size = "w-64 md:w-80" }) {
  return (
    <div className={`${size} mx-auto`}>
      <svg viewBox="0 0 200 200" className="w-full h-full opacity-10">
        {[1, 2, 3, 4, 5].map((level) => {
          const r = (level / 5) * 80;
          return (
            <circle
              key={level}
              cx="100"
              cy="100"
              r={r}
              fill="none"
              stroke="#9ca3af"
              strokeWidth="1.5"
            />
          );
        })}
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
          const angle = (2 * Math.PI * i) / 8;
          return (
            <line
              key={i}
              x1="100"
              y1="100"
              x2={100 + 80 * Math.sin(angle)}
              y2={100 - 80 * Math.cos(angle)}
              stroke="#9ca3af"
              strokeWidth="1.5"
            />
          );
        })}
      </svg>
    </div>
  );
}

// ────────────────────────────────────────────────
// Onboarding illustrations (theme-aware inline SVG)
// ────────────────────────────────────────────────

function radarPolygon(values, R, cx, cy) {
  const N = values.length;
  return values
    .map((v, i) => {
      const a = (2 * Math.PI * i) / N;
      const x = cx + R * v * Math.sin(a);
      const y = cy - R * v * Math.cos(a);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function LearnRadar({ t, shapes, labels, strokeWidth = 2.5, loop = false, alignColor = null }) {
  const cx = 120, cy = 120, R = 64, N = 8, LR = 86;

  // Topics where every series lands on the same value — the points of
  // agreement. Their vertex dots coincide exactly, so instead of stacking one
  // series' dot on the other's we swap in a single accent marker.
  const alignIdx =
    alignColor && shapes.length > 1
      ? shapes[0].values.reduce((acc, v, i) => {
          const agrees = shapes.every((s) => Math.abs(s.values[i] - v) < 0.001);
          return agrees ? [...acc, i] : acc;
        }, [])
      : [];
  const dotDelay = (idx, i) => 0.9 + idx * 0.45 + i * 0.05;

  return (
    <svg viewBox="0 0 240 240" className="w-full h-full overflow-visible">
      {/* Grid fades in first */}
      <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
        {[0.33, 0.66, 1].map((lvl) => (
          <circle key={lvl} cx={cx} cy={cy} r={R * lvl} fill="none" stroke={t.divider} strokeWidth="1" />
        ))}
        {Array.from({ length: N }).map((_, i) => {
          const a = (2 * Math.PI * i) / N;
          return (
            <line key={i} x1={cx} y1={cy} x2={cx + R * Math.sin(a)} y2={cy - R * Math.cos(a)} stroke={t.divider} strokeWidth="1" />
          );
        })}
      </motion.g>

      {/* Topic labels around the compass */}
      {labels &&
        labels.map((lab, i) => {
          const a = (2 * Math.PI * i) / N;
          const sinv = Math.sin(a);
          const cosv = Math.cos(a);
          const x = cx + LR * sinv;
          const y = cy - LR * cosv;
          const anchor = Math.abs(sinv) < 0.35 ? "middle" : sinv > 0 ? "start" : "end";
          const dy = cosv > 0.35 ? -3 : cosv < -0.35 ? 9 : 3;
          return (
            <motion.text
              key={`lab-${i}`}
              x={x}
              y={y + dy}
              textAnchor={anchor}
              fontSize="8"
              fontWeight="700"
              fill={t.textMuted}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 + i * 0.05 }}
            >
              {lab}
            </motion.text>
          );
        })}

      {/* Each shape draws its outline, then fills. `loop` redraws continuously. */}
      {shapes.map((s, idx) => {
        const delay = 0.3 + idx * 0.45;
        return (
          <motion.polygon
            key={idx}
            points={radarPolygon(s.values, R, cx, cy)}
            fill={s.fill ? `${s.color}33` : "none"}
            stroke={s.color}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{
              pathLength: loop
                ? { duration: 1.1, delay, ease: "easeInOut", repeat: Infinity, repeatDelay: 0.9 }
                : { duration: 0.9, delay, ease: "easeInOut" },
              opacity: { duration: 0.4, delay },
            }}
          />
        );
      })}

      {/* Vertex dots — on the filled shapes, minus the agreement points */}
      {shapes.map((s, idx) =>
        s.fill
          ? s.values.map((v, i) => {
              if (alignIdx.includes(i)) return null;
              const a = (2 * Math.PI * i) / N;
              return (
                <motion.circle
                  key={`${idx}-${i}`}
                  cx={cx + R * v * Math.sin(a)}
                  cy={cy - R * v * Math.cos(a)}
                  r={loop ? 2.5 : 3.4}
                  fill={s.color}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: dotDelay(idx, i), type: "spring", stiffness: 320, damping: 18 }}
                  style={{ transformBox: "fill-box", transformOrigin: "center" }}
                />
              );
            })
          : null
      )}

      {/* Agreement markers — one dot where both compasses land together, with a
          slow halo so the eye is pulled to the match. Stroked in the page bg so
          the yellow stays legible against either fill. */}
      {alignIdx.map((i) => {
        const a = (2 * Math.PI * i) / N;
        const v = shapes[0].values[i];
        const x = cx + R * v * Math.sin(a);
        const y = cy - R * v * Math.cos(a);
        const appear = dotDelay(shapes.length - 1, i);
        return (
          <g key={`align-${i}`}>
            <motion.circle
              cx={x}
              cy={y}
              r={4.6}
              fill="none"
              stroke={alignColor}
              strokeWidth="1.6"
              initial={{ scale: 1, opacity: 0 }}
              animate={{ scale: [1, 2.1], opacity: [0.75, 0] }}
              transition={{ delay: appear, duration: 1.7, ease: "easeOut", repeat: Infinity, repeatDelay: 0.5 }}
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
            />
            <motion.circle
              cx={x}
              cy={y}
              r={4.6}
              fill={alignColor}
              stroke={t.bg}
              strokeWidth="1.6"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: appear, type: "spring", stiffness: 320, damping: 16 }}
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
            />
          </g>
        );
      })}
    </svg>
  );
}

// Landing hero: the same draw-in radar as the onboarding compare step — You vs a candidate.
function LandingRadar({ t }) {
  const TOPICS = ["Housing", "Climate", "Schools", "Safety", "Health", "Jobs", "Justice", "Taxes"];
  const YOU = [0.95, 0.62, 0.85, 0.58, 0.9, 0.72, 0.52, 0.8];
  const CAND = [0.58, 0.88, 0.55, 0.9, 0.62, 0.78, 0.9, 0.5];
  return (
    <LearnRadar
      t={t}
      labels={TOPICS}
      strokeWidth={1.8}
      loop
      shapes={[
        { values: CAND, color: RADAR_CAND, fill: true },
        { values: YOU, color: RADAR_YOU, fill: true },
      ]}
    />
  );
}

// Write-in demo: types a custom stance, then drags the card into a slot on the spectrum.
function WriteInIllo({ t }) {
  const FULL = "Fund transit, not highways";
  const YELLOW = "#FED12E";
  const [n, setN] = useState(0);
  const [docked, setDocked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timers = [];
    const push = (fn, ms) => timers.push(setTimeout(() => { if (!cancelled) fn(); }, ms));
    const run = () => {
      setN(0);
      setDocked(false);
      for (let i = 1; i <= FULL.length; i++) push(() => setN(i), 65 * i);
      const done = 65 * FULL.length;
      push(() => setDocked(true), done + 750); // finished typing -> drag it up
      push(run, done + 750 + 2100);
    };
    run();
    return () => { cancelled = true; timers.forEach(clearTimeout); };
  }, []);

  const Rung = ({ label, cls }) => (
    <div className={`absolute left-0 right-0 ${cls}`}>
      <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl" style={{ border: `1.5px solid ${t.border}` }}>
        <span className="w-4 h-4 rounded-full shrink-0" style={{ border: `2px solid ${t.border}` }} />
        <span className="text-sm font-medium" style={{ color: t.textMuted }}>{label}</span>
      </div>
    </div>
  );

  return (
    <div className="w-full max-w-[16rem]">
      <p className="text-xs font-bold tracking-widest uppercase mb-2 text-center" style={{ color: t.textMuted }}>
        Transit
      </p>
      <div className="relative" style={{ height: "15rem" }}>
        {/* Destination slot at the top */}
        <motion.div
          className="absolute left-0 right-0 rounded-xl border-2 border-dashed h-[3rem]"
          style={{ borderColor: YELLOW, top: 0 }}
          animate={{ opacity: docked ? 0 : 1 }}
          transition={{ duration: 0.3 }}
        />

        {/* Preset stances */}
        <Rung label="More buses and trains" cls="top-[3.75rem]" />
        <Rung label="Keep spending as it is" cls="top-[7.5rem]" />

        {/* Write-in card: sits in line at the bottom while typing, then drags up to the top slot */}
        <motion.div
          className="absolute left-0 right-0 z-10"
          style={{ top: 0 }}
          animate={{ y: docked ? 0 : 180 }}
          transition={{ type: "spring", stiffness: 230, damping: 24 }}
        >
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl" style={{ border: `2px solid ${YELLOW}`, background: t.card }}>
            <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0 mt-0.5" fill={t.textMuted}>
              <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
              <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
              <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
            </svg>
            <span className="text-sm font-semibold text-left leading-snug min-h-[1.25rem]" style={{ color: t.textHead }}>
              {FULL.slice(0, n)}
              {!docked && (
                <motion.span
                  className="inline-block w-0.5 h-4 ml-px align-middle"
                  style={{ background: t.textHead }}
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                />
              )}
            </span>
          </div>
        </motion.div>
      </div>
      <motion.div
        className="flex items-center justify-center gap-1 text-xs font-semibold mt-1"
        style={{ color: "#D4940B" }}
        animate={{ opacity: docked ? 0.45 : 1 }}
      >
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5M5 12l7-7 7 7" />
        </svg>
        {docked ? "Placed on the spectrum" : "Type, then drag up to place"}
      </motion.div>
    </div>
  );
}

function LearnIllustration({ kind, t }) {
  // Index 5 ("Jobs") is deliberately identical in both series — LearnRadar
  // detects the match and marks it as a point of agreement.
  const YOU = [0.9, 0.55, 0.95, 0.5, 0.78, 0.8, 0.92, 0.6];
  const CAND = [0.6, 0.82, 0.55, 0.72, 0.5, 0.8, 0.5, 0.8];
  const TEAL = "#59B0C4"; // topic chips + stance selection accents (not the radar)
  const TOPICS = ["Housing", "Climate", "Schools", "Safety", "Health", "Jobs", "Justice", "Taxes"];

  if (kind === "what") {
    return (
      <div className="w-full max-w-[16rem] aspect-square">
        <LearnRadar t={t} labels={TOPICS} shapes={[{ values: YOU, color: RADAR_YOU, fill: true }]} />
      </div>
    );
  }

  if (kind === "choose") {
    const CHIPS = [
      { label: "Housing", on: true },
      { label: "Climate", on: true },
      { label: "Schools", on: false },
      { label: "Public safety", on: true },
      { label: "Healthcare", on: false },
      { label: "Jobs", on: true },
    ];
    return (
      <div className="w-full max-w-[16rem] flex flex-wrap gap-2 justify-center">
        {CHIPS.map((c, i) => (
          <motion.span
            key={c.label}
            initial={{ opacity: 0, scale: 0.8, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.09, type: "spring", stiffness: 300, damping: 20 }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-semibold"
            style={
              c.on
                ? { background: `${TEAL}22`, color: TEAL, border: `1.5px solid ${TEAL}` }
                : { background: "transparent", color: t.textMuted, border: `1.5px solid ${t.border}` }
            }
          >
            {c.on && (
              <motion.svg
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-3.5 h-3.5"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3 + i * 0.09, type: "spring", stiffness: 420, damping: 16 }}
              >
                <path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0l-3.5-3.5a1 1 0 011.4-1.4l2.8 2.8 6.8-6.8a1 1 0 011.4 0z" clipRule="evenodd" />
              </motion.svg>
            )}
            {c.label}
          </motion.span>
        ))}
      </div>
    );
  }

  if (kind === "stance") {
    const OPTIONS = [
      "Build housing everywhere, fast",
      "Add more homes near transit",
      "Grow slowly and carefully",
      "Keep neighborhoods as they are",
    ];
    const sel = 1;
    return (
      <div className="w-full max-w-[16rem] flex flex-col gap-2.5">
        <p className="text-xs font-bold tracking-widest uppercase mb-1 text-center" style={{ color: t.textMuted }}>
          Housing
        </p>
        {OPTIONS.map((o, i) => {
          const active = i === sel;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.12, type: "spring", stiffness: 260, damping: 22 }}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl"
              style={
                active
                  ? { background: `${TEAL}22`, border: `1.5px solid ${TEAL}` }
                  : { background: "transparent", border: `1.5px solid ${t.border}` }
              }
            >
              <span
                className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center"
                style={{ border: `2px solid ${active ? TEAL : t.border}`, background: active ? TEAL : "transparent" }}
              >
                {active && <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#fff" }} />}
              </span>
              <span className="text-sm font-medium text-left" style={{ color: active ? TEAL : t.textBody }}>
                {o}
              </span>
            </motion.div>
          );
        })}
      </div>
    );
  }

  if (kind === "writein") {
    return <WriteInIllo t={t} />;
  }

  if (kind === "compare") {
    return (
      <div className="w-full flex flex-col items-center gap-4">
        <div className="w-full max-w-[16rem] aspect-square">
          <LearnRadar
            t={t}
            labels={TOPICS}
            alignColor={RADAR_ALIGN}
            shapes={[
              { values: CAND, color: RADAR_CAND, fill: true },
              { values: YOU, color: RADAR_YOU, fill: true },
            ]}
          />
        </div>
        <motion.div
          className="flex items-center gap-5"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
        >
          <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: t.textBody }}>
            <span className="w-3 h-3 rounded-full" style={{ background: RADAR_YOU }} /> You
          </span>
          <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: t.textBody }}>
            <span className="w-3 h-3 rounded-full" style={{ background: RADAR_CAND }} /> A candidate
          </span>
        </motion.div>
      </div>
    );
  }

  if (kind === "candidate") {
    const PURPLE = "#7C6B9E";
    const GREEN = "#5A9A6E";
    const Chevron = () => (
      <svg viewBox="0 0 20 20" fill="none" stroke={t.textMuted} strokeWidth="1.6" className="w-4 h-4 shrink-0">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 8l4 4 4-4" />
      </svg>
    );
    return (
      <div
        className="w-full max-w-[19rem] rounded-2xl p-4 text-left"
        style={{ background: t.card, border: `1px solid ${t.border}` }}
      >
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-1.5">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
            style={{ background: "#00657C", color: "#fff" }}
          >
            DC
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold leading-tight" style={{ color: t.textHead }}>David Chiu</p>
            <p className="text-xs" style={{ color: t.textMuted }}>City Attorney</p>
          </div>
          <Chevron />
        </div>
        <p className="text-xs font-semibold mb-3" style={{ color: t.textAccent }}>View full profile ↗</p>

        {/* Topic selector */}
        <div
          className="flex items-center justify-between px-3 py-2 rounded-lg mb-3"
          style={{ border: `1px solid ${t.border}`, background: t.bg }}
        >
          <span className="text-sm font-semibold" style={{ color: t.textHead }}>Civil Rights</span>
          <Chevron />
        </div>

        {/* Question */}
        <p className="text-sm font-bold leading-snug mb-2" style={{ color: t.textHead }}>
          What role should government play in reducing inequality?
        </p>

        {/* Legend */}
        <div className="flex items-center gap-4 mb-3 text-xs font-semibold">
          <span className="flex items-center gap-1.5" style={{ color: t.textBody }}>
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: PURPLE }} />You
          </span>
          <span className="flex items-center gap-1.5" style={{ color: t.textBody }}>
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: GREEN }} />David Chiu
          </span>
        </div>

        {/* Stance options */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-xs leading-snug mb-2"
          style={{ color: t.textMuted }}
        >
          mandate racial equity requirements and provide reparations
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="flex items-start gap-2 px-3 py-2 rounded-lg"
          style={{ border: `1px solid ${t.border}`, background: t.bg }}
        >
          <span className="text-xs leading-snug flex-1" style={{ color: t.textBody }}>
            strengthen civil rights enforcement and address systemic discrimination
          </span>
          <span className="flex items-center gap-1 shrink-0 mt-0.5">
            <motion.span
              className="w-2.5 h-2.5 rounded-full"
              style={{ background: PURPLE }}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.75, type: "spring", stiffness: 420, damping: 15 }}
            />
            <motion.span
              className="w-2.5 h-2.5 rounded-full"
              style={{ background: GREEN }}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.9, type: "spring", stiffness: 420, damping: 15 }}
            />
          </span>
        </motion.div>
      </div>
    );
  }

  return null;
}

// Thin horizontal lines that pulse (fade + stretch) — quiet signal motion
function PulseLines({ accent }) {
  const lines = [
    { cls: "top-[28%] left-0 w-44 h-px", dur: 3.6, delay: 0 },
    { cls: "bottom-[32%] right-0 w-56 h-px", dur: 4.4, delay: 0.9 },
    { cls: "top-[70%] left-[6%] w-28 h-px", dur: 3.1, delay: 1.6 },
  ];
  return lines.map((l, i) => (
    <motion.span
      key={i}
      className={`absolute ${l.cls}`}
      style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
      animate={{ opacity: [0, 0.45, 0], scaleX: [0.5, 1, 0.5] }}
      transition={{ duration: l.dur, delay: l.delay, repeat: Infinity, ease: "easeInOut" }}
    />
  ));
}

const SMOOTH_TRANSITION = {
  duration: 300,
  easing: "cubic-bezier(0.25, 1, 0.5, 1)",
};

function SortableStanceLabel({ id, text, isDark }) {
  const t = isDark ? DARK_THEME : LIGHT_THEME;
  const { setNodeRef, transform, transition } = useSortable({
    id,
    disabled: { draggable: true },
    transition: SMOOTH_TRANSITION,
  });
  const style = { transform: CSS.Translate.toString(transform), transition };
  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        background: t.card,
        color: t.textBody,
        border: `1px solid ${t.border}`,
      }}
      className="px-4 py-2.5 rounded-lg text-sm font-medium"
    >
      {text}
    </div>
  );
}

function SortableTopicPill({ id, label, onRemove, t }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, transition: SMOOTH_TRANSITION });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        transform: CSS.Translate.toString(transform),
        transition: isDragging ? undefined : transition,
        opacity: isDragging ? 0.5 : 1,
        background: t.selBg,
        border: `1.5px solid ${t.borderAccent}`,
        color: t.textAccent,
        touchAction: 'none',
      }}
      className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium cursor-grab active:cursor-grabbing select-none"
    >
      {label}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        onPointerDown={(e) => e.stopPropagation()}
        className="ml-0.5 leading-none cursor-pointer hover:opacity-70 transition-opacity"
        style={{ color: t.textAccent }}
        aria-label={`Remove ${label}`}
      >
        ×
      </button>
    </div>
  );
}

// One editable row in the lens intro's topic list. The order of these rows is
// the order calibration walks, so the grip and the × are how a user shapes the
// flow before it starts rather than sitting through a list someone else chose.
function SortableLensTopicRow({ id, index, label, onRemove, canRemove, accent, t }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, transition: SMOOTH_TRANSITION });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition: isDragging ? undefined : transition,
        background: t.card,
        border: `1px solid ${isDragging ? accent : t.border}`,
        boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.18)' : undefined,
        position: 'relative',
        zIndex: isDragging ? 1 : 0,
        touchAction: 'none',
      }}
      className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium select-none"
    >
      {/* Only the grip starts a drag, so the remove button stays clickable */}
      <span
        {...attributes}
        {...listeners}
        className="shrink-0 cursor-grab active:cursor-grabbing"
        style={{ color: t.textMuted }}
        aria-label={`Reorder ${label}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM11.5 15.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z" />
          <path d="M5 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM5 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM6.5 15.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z" />
        </svg>
      </span>

      <span className="shrink-0 w-4 text-xs font-bold tabular-nums" style={{ color: accent }}>
        {index + 1}
      </span>

      <span className="flex-1 min-w-0 truncate" style={{ color: accent }}>{label}</span>

      <button
        onClick={onRemove}
        onPointerDown={(e) => e.stopPropagation()}
        disabled={!canRemove}
        aria-label={`Remove ${label}`}
        title={canRemove ? `Remove ${label}` : `Keep at least ${MIN_TOPICS} topics`}
        className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-lg leading-none opacity-40 hover:opacity-100 disabled:opacity-15 disabled:cursor-not-allowed transition-opacity cursor-pointer"
        style={{ color: t.textMuted }}
      >
        ×
      </button>
    </div>
  );
}

function SortableStancePill({ id, label, isCurrent, isAnswered, onClick, t }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, transition: SMOOTH_TRANSITION });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onClick}
      style={{
        transform: CSS.Translate.toString(transform),
        transition: isDragging ? undefined : transition,
        opacity: isDragging ? 0.5 : 1,
        touchAction: 'none',
        ...(isCurrent
          ? { border: `2px solid ${t.borderAccent}`, background: t.selBg, color: t.textAccent }
          : isAnswered
          ? { background: t.cardElev, color: t.textMuted, border: '2px solid transparent' }
          : { background: t.card, border: `1px solid ${t.border}`, color: t.textBody }),
      }}
      className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium cursor-grab active:cursor-grabbing select-none"
    >
      {isAnswered && !isCurrent && (
        <span className="mr-1" style={{ color: '#5A9A6E' }}>✓</span>
      )}
      {label}
    </div>
  );
}

function SortableWriteInCard({ id, text, onChange, onCancel, showHint, isDark }) {
  const t = isDark ? DARK_THEME : LIGHT_THEME;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, transition: SMOOTH_TRANSITION });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition: isDragging ? undefined : transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        border: `2px solid ${t.yellow}`,
        background: t.yellowBg,
      }}
      className="flex items-start gap-2 px-3 py-2.5 rounded-lg"
      {...attributes}
    >
      <div
        {...listeners}
        className={`cursor-grab active:cursor-grabbing pt-1.5 shrink-0 rounded p-1 ${
          showHint ? "animate-pulse" : ""
        }`}
        style={{ color: showHint ? '#E85D26' : t.textMuted }}
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
          <circle cx="9" cy="6" r="1.5" />
          <circle cx="15" cy="6" r="1.5" />
          <circle cx="9" cy="12" r="1.5" />
          <circle cx="15" cy="12" r="1.5" />
          <circle cx="9" cy="18" r="1.5" />
          <circle cx="15" cy="18" r="1.5" />
        </svg>
      </div>
      <div className="flex-1 flex flex-col gap-1">
        <textarea
          autoFocus
          value={text}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Write your stance here..."
          rows={2}
          className="text-sm font-medium resize-none bg-transparent focus:outline-none"
          style={{ color: t.textHead }}
        />
        {showHint && (
          <p className="text-xs font-medium" style={{ color: '#E85D26' }}>
            Drag your own view to where it fits among these stances
          </p>
        )}
      </div>
      <button
        onClick={onCancel}
        className="shrink-0 pt-1 cursor-pointer hover:opacity-70 transition-opacity"
        style={{ color: t.textMuted }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
        </svg>
      </button>
    </div>
  );
}

// ────────────────────────────────────────────────
// Icon helpers
// ────────────────────────────────────────────────

function SunIcon({ className = "w-4 h-4" }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path d="M10 2a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 2zM10 15a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15zM10 7a3 3 0 100 6 3 3 0 000-6zM15.657 5.404a.75.75 0 10-1.06-1.06l-1.061 1.06a.75.75 0 001.06 1.06l1.061-1.06zM6.464 14.596a.75.75 0 10-1.06-1.06l-1.061 1.06a.75.75 0 001.06 1.06l1.061-1.06zM18 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 0118 10zM5 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 015 10zM14.596 15.657a.75.75 0 001.06-1.06l-1.06-1.061a.75.75 0 10-1.06 1.06l1.06 1.061zM5.404 6.464a.75.75 0 001.06-1.06l-1.06-1.061a.75.75 0 10-1.06 1.06l1.06 1.061z" />
    </svg>
  );
}

function MoonIcon({ className = "w-4 h-4" }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path fillRule="evenodd" d="M7.455 2.004a.75.75 0 01.26.77 7 7 0 009.958 7.967.75.75 0 011.067.853A8.5 8.5 0 116.647 1.921a.75.75 0 01.808.083z" clipRule="evenodd" />
    </svg>
  );
}

function BackArrow() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
    </svg>
  );
}

// ────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────

export default function CalibrationOverlay({ onComplete, onSkip, resumeMode = false, startAtPick = false, startWithLocalLens = false, startWithJudicialLens = false, startWithFederalLens = false, startWithAllTopics = false, startWithTopicIds = null, entryReason = "unknown" }) {
  const {
    topics,
    categories,
    selectedTopics,
    setSelectedTopics,
    answers,
    setAnswers,
    writeIns,
    setWriteIns,
    invertedSpokes,
    setInvertedSpokes,
    initRandomInversions,
    isLoggedIn,
    lenses,
  } = useCompass();

  // Determine quiz lens type for analytics
  const lensType = startWithLocalLens ? 'local_lens'
    : startWithJudicialLens ? 'judicial_lens'
    : startWithFederalLens ? 'federal_lens'
    : startWithAllTopics ? 'full'
    : startWithTopicIds ? 'recalibrate'
    : resumeMode ? 'resume'
    : 'default';

  // Analytics fire-once guards. Every one of these can be reached twice:
  // StrictMode double-invokes effects in dev, a question can be re-answered
  // before pressing Next, and an exit path can be re-entered after a Back.
  // Double-counting any of them corrupts the very funnel this instruments.
  const startReportedRef = useRef(false);
  const reportedAnswers = useRef(new Set());
  const reportedSkips = useRef(new Set());
  const exitReportedRef = useRef(false);

  const emit = ({ event, props }) => track(event, props);

  // Calibration has begun. Fires either from the init effect (when the overlay
  // opens past the welcome screen) or from the welcome/lens buttons.
  // totalTopics is overridable because the lens buttons report a start in the
  // same tick as setPickedTopics — the state has not landed yet.
  const reportStart = (fromStep, totalTopics) => {
    if (startReportedRef.current) return;
    startReportedRef.current = true;
    emit(eventForGetStarted({
      fromStep,
      totalTopics: totalTopics ?? pickedTopics.length,
      lens: lensType,
    }));
  };

  // Wrap onComplete to fire analytics before handing off
  const handleComplete = () => {
    exitReportedRef.current = true; // a completion is not an abandonment
    emit(eventForComplete({
      answeredCount,
      totalTopics: pickedTopics.length,
      lens: lensType,
    }));
    onComplete();
  };

  // Offset overlay when ReturnBanner is visible (fixed z-[60] above us)
  const hasReturnBanner = !!sessionStorage.getItem("essentials_return_url");
  const overlayTop = hasReturnBanner ? "top-9" : "top-0";

  const { isDark, toggle: toggleDark } = useTheme();
  const t = isDark ? DARK_THEME : LIGHT_THEME;

  // Topic-pick coach mark — points at the first topic card on the pick step.
  const firstTopicRef = useRef(null);
  const [topicPickHintDismissed, setTopicPickHintDismissed] = useState(
    () => !!localStorage.getItem("onboarding_topicPickHint")
  );

  // Load persisted progress on mount, honouring resumeMode and startAtPick
  const getInitialState = () => {
    if (startWithLocalLens) {
      const lensIds = LOCAL_LENS.topicIds.filter(id => topics.some(t => t.id === id));
      return { step: "lens_intro", pickedTopics: lensIds, currentIndex: 0, lensApplied: true, lens: LOCAL_LENS };
    }
    if (startWithJudicialLens) {
      const lensIds = JUDICIAL_LENS.topicIds.filter(id => topics.some(t => t.id === id));
      return { step: "lens_intro", pickedTopics: lensIds, currentIndex: 0, lensApplied: true, lens: JUDICIAL_LENS };
    }
    if (startWithFederalLens) {
      const lensIds = FEDERAL_LENS.topicIds.filter(id => topics.some(t => t.id === id));
      return { step: "lens_intro", pickedTopics: lensIds, currentIndex: 0, lensApplied: true, lens: FEDERAL_LENS };
    }

    // An explicit list of questions to (re)answer — the recalibration path.
    // Straight to "answer": there is nothing to pick and no lens intro to show,
    // because the user already said which question they are fixing.
    //
    // Filtered against `topics` on purpose: a lens may hold a question the
    // current season does not serve, and seeding the queue with an id that has
    // no stances would render an unanswerable question.
    if (Array.isArray(startWithTopicIds) && startWithTopicIds.length > 0) {
      const valid = startWithTopicIds.filter((id) => topics.some((t) => t.id === id));
      if (valid.length > 0) {
        return { step: "answer", pickedTopics: valid, currentIndex: 0 };
      }
    }

    if (startWithAllTopics) {
      return { step: "answer", pickedTopics: topics.map(t => t.id), currentIndex: 0 };
    }

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.step === "pick" || parsed.step === "answer") {
          let pickedTopics = parsed.pickedTopics || [];
          let lens = null;

          // If this was a lens calibration, re-derive pickedTopics from the
          // current lens definition so a topic swap (e.g. Voting Rights →
          // Local Immigration Enforcement) is picked up instead of replaying
          // the stale saved list.
          if (parsed.lensKey) {
            // Keyed lookup against the live lens list, not a ternary over three
            // named constants. The old chain resolved anything else to null, so
            // a refresh part-way through an Education calibration silently
            // dropped the lens and replayed the stale saved topic list instead.
            // `lenses` falls back to the bundled constants before the API lands.
            lens = (lenses || []).find((l) => l.key === parsed.lensKey) || null;
            // Only replay the lens definition when the user left it alone.
            // Once they have reordered or removed topics, the saved list is
            // theirs and re-deriving would silently undo that.
            if (lens && !parsed.lensEdited) {
              pickedTopics = lens.topicIds.filter(id => topics.some(t => t.id === id));
            }
          }

          return {
            step: parsed.step,
            pickedTopics,
            currentIndex: parsed.currentIndex || 0,
            lensApplied: !!lens,
            lens,
          };
        }
      }
    } catch { /* corrupt or unreadable localStorage — fall back to the default */ }

    if (startAtPick) {
      const validSelected = selectedTopics.filter(id => topics.some(t => t.id === id));
      return {
        step: "pick",
        pickedTopics: validSelected,
        currentIndex: 0,
      };
    }

    if (resumeMode) {
      const validSelected = selectedTopics.filter(id => topics.some(t => t.id === id));
      const firstUnanswered = validSelected.findIndex((id) => {
        const topic = topics.find((t) => t.id === id);
        if (!topic) return false;
        const val = answers[topic.short_title];
        return !(val != null && val > 0);
      });
      return {
        step: "answer",
        pickedTopics: validSelected,
        currentIndex: firstUnanswered !== -1 ? firstUnanswered : 0,
      };
    }

    return { step: "welcome", pickedTopics: [], currentIndex: 0 };
  };

  const initializedRef = useRef(false);
  const [step, setStep] = useState("welcome");
  const [pickedTopics, setPickedTopics] = useState([]);
  const [lensApplied, setLensApplied] = useState(false);
  const [activeLens, setActiveLens] = useState(null);
  // Set once the user reorders or drops a topic on the lens intro. Their list
  // is no longer the lens definition, so restoring progress must not re-derive
  // it from the constant and throw their choices away.
  const [lensEdited, setLensEdited] = useState(false);
  // Snapshot of compass topics before a lens was applied — restored when pressing "← Change my topics"
  const [prevPickedTopics, setPrevPickedTopics] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [learnMode, setLearnMode] = useState("full"); // 'full' | 'custom'
  const [learnIndex, setLearnIndex] = useState(0);
  const [learnDir, setLearnDir] = useState(1); // slide direction for carousel transitions
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [showWriteIn, setShowWriteIn] = useState(false);
  const [writeInText, setWriteInText] = useState("");
  const [orderedItems, setOrderedItems] = useState([]);
  const orderedItemsRef = useRef([]);
  orderedItemsRef.current = orderedItems;
  const [hasRepositioned, setHasRepositioned] = useState(false);
  const writeInSaveTimer = useRef(null);
  const wheelLockRef = useRef(false); // debounces trackpad/scroll momentum in the onboarding carousel

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    })
  );

  useEffect(() => {
    if (initializedRef.current) return;
    if (topics.length === 0) return;
    const initial = getInitialState();
    setStep(initial.step);
    setPickedTopics(initial.pickedTopics);
    setCurrentIndex(initial.currentIndex);
    if (initial.lensApplied) setLensApplied(true);
    if (initial.lens) setActiveLens(initial.lens);
    if (initial.lensApplied) setPrevPickedTopics(selectedTopics.slice(0, 8));
    initializedRef.current = true;

    // The overlay is on screen. Reported from HERE, not from a mount effect,
    // for two reasons: the entry step is unknown until topics have loaded, and
    // the entry step is precisely what decides whether the overlay has merely
    // appeared or has genuinely started. initializedRef also makes this
    // fire-once for free, which a bare `[]` effect does not under StrictMode.
    const openEvents = eventsForOpen({
      entryStep: initial.step,
      entryReason,
      lens: lensType,
      resume: resumeMode,
      totalTopics: initial.pickedTopics.length,
    });
    for (const openEvent of openEvents) {
      if (openEvent.event === "compass_calibration_started") startReportedRef.current = true;
      emit(openEvent);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topics, resumeMode, startAtPick, startWithLocalLens, startWithJudicialLens, startWithFederalLens, startWithTopicIds]);

  useEffect(() => {
    // startWithTopicIds joins startWithAllTopics here: a one-question
    // recalibration must not overwrite a half-finished full calibration, which
    // the user should still be able to resume exactly where they left it.
    if (step === "welcome" || step === "learn" || step === "lens_intro" || step === "complete" ||
        startWithAllTopics || startWithTopicIds) return;
    const progress = { step, pickedTopics, currentIndex, resumeMode: resumeMode || false, lensKey: activeLens?.key || null, lensEdited };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }, [step, pickedTopics, currentIndex, resumeMode, lensEdited]);

  useEffect(() => {
    if (step !== "answer") return;
    const topicId = pickedTopics[currentIndex];
    const topic = topics.find((t) => t.id === topicId);
    if (!topic) return;
    const val = answers[topic.short_title];
    setSelectedAnswer(typeof val === "number" && val > 0 ? val : null);

    const isFlippedInEffect = invertedSpokes[topic.short_title];
    const effectStances = topic.stances
      ? isFlippedInEffect ? topic.stances : [...topic.stances].reverse()
      : [];

    const savedWriteIn = writeIns?.[topic.short_title];
    if (savedWriteIn && val != null && !Number.isInteger(val)) {
      setShowWriteIn(true);
      setWriteInText(savedWriteIn);
      setHasRepositioned(true);
      const items = [...effectStances.map((s) => s.id)];
      const displayIndex = isFlippedInEffect
        ? Math.floor(val)
        : Math.floor(effectStances.length + 1 - val);
      items.splice(displayIndex, 0, "write-in");
      setOrderedItems(items);
    } else {
      setShowWriteIn(false);
      setWriteInText("");
      setOrderedItems([]);
      setHasRepositioned(false);
    }
  }, [currentIndex, step, pickedTopics, topics, answers, writeIns, invertedSpokes]);

  const [writeInHintShown, setWriteInHintShown] = useState(
    () => !!localStorage.getItem("onboarding_writeInHint")
  );

  useEffect(() => {
    if (currentIndex > 0 && !writeInHintShown) {
      localStorage.setItem("onboarding_writeInHint", "1");
      setWriteInHintShown(true);
    }
  }, [currentIndex, writeInHintShown]);

  const dedupedCategories = useMemo(() => {
    const seen = new Set();
    return categories
      .map((cat) => ({
        ...cat,
        topics: cat.topics.filter((t) => {
          if (seen.has(t.id)) return false;
          seen.add(t.id);
          return true;
        }),
      }))
      .filter((cat) => cat.topics.length > 0);
  }, [categories]);

  const chartData = useMemo(() => {
    if (!pickedTopics.length) return {};
    return Object.fromEntries(
      pickedTopics
        .map((id) => {
          const topic = topics.find((t) => t.id === id);
          if (!topic) return null;
          const value = answers[topic.short_title] ?? 0;
          return [topic.short_title, value];
        })
        .filter(Boolean)
    );
  }, [pickedTopics, topics, answers]);

  const currentTopic = useMemo(() => {
    if (step !== "answer") return null;
    const id = pickedTopics[currentIndex];
    return topics.find((t) => t.id === id) || null;
  }, [step, pickedTopics, currentIndex, topics]);

  // Extracted so an event fired during setAnswers can count the answer being
  // given: `answers` is still the previous render's map at that moment, so
  // reporting `answeredCount` there would always be one behind.
  const countAnswered = (answersMap) =>
    pickedTopics.filter((id) => {
      const topic = topics.find((t) => t.id === id);
      if (!topic) return false;
      const val = answersMap[topic.short_title];
      return val != null && val > 0;
    }).length;

  const answeredCount = useMemo(
    () => countAnswered(answers),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pickedTopics, topics, answers]
  );

  // --- Handlers ---

  // TODO(onboarding): defined but not yet wired to a button — kept pending review.
  // eslint-disable-next-line no-unused-vars
  const handleGetStarted = () => {
    reportStart(STEPS.WELCOME);
    setStep("pick");
  };

  const handleStartWithLens = () => {
    const lensIds = LOCAL_LENS.topicIds.filter(id => topics.some(t => t.id === id));
    reportStart(STEPS.LENS_INTRO, lensIds.length);
    setPickedTopics(lensIds);
    setLensApplied(true);
    setActiveLens(LOCAL_LENS);
    setStep("lens_intro");
  };

  // From the lens intro, run the onboarding carousel before calibration.
  const handleLensLearn = () => {
    setLearnMode("lens");
    setLearnIndex(0);
    setStep("learn");
  };

  // TODO(onboarding): defined but not yet wired to a button — kept pending review.
  // eslint-disable-next-line no-unused-vars
  const handleBuildFullCompass = () => {
    setLearnMode("full");
    setLearnIndex(0);
    setStep("learn");
  };

  const handleChooseTopics = () => {
    setLearnMode("custom");
    setLearnIndex(0);
    setStep("learn");
  };

  const proceedFromLearn = () => {
    if (learnMode === "lens") {
      // Local Lens path: topics were already set by handleStartWithLens, so
      // onboarding hands straight off to the 8-issue calibration.
      handleContinueToAnswer();
    } else if (learnMode === "full") {
      const allIds = topics.map((tp) => tp.id);
      setPickedTopics(allIds);
      initRandomInversions(topics);
      setCurrentIndex(0);
      setSelectedAnswer(null);
      setLensApplied(false);
      setActiveLens(null);
      setStep("answer");
    } else {
      setLensApplied(false);
      setActiveLens(null);
      setStep("pick");
    }
  };

  /**
   * Leave without a compass. Callers MUST say where from and how: this has
   * three of them — the welcome dismiss, the pick dismiss, and the Back arrow
   * on question one — and they used to be one indistinguishable silent exit.
   */
  const handleSkip = (exitFrom, exitVia) => {
    if (!exitReportedRef.current) {
      exitReportedRef.current = true;
      emit(eventForAbandon({
        exitFrom,
        exitVia,
        answeredCount,
        totalTopics: pickedTopics.length,
      }));
    }
    localStorage.removeItem(STORAGE_KEY);
    onSkip();
  };

  const togglePick = (topicId) => {
    setPickedTopics((prev) => {
      if (prev.includes(topicId)) {
        return prev.filter((id) => id !== topicId);
      }
      if (prev.length >= MAX_TOPICS) return prev;
      return [...prev, topicId];
    });
  };

  const handleContinueToAnswer = () => {
    if (pickedTopics.length < MIN_TOPICS) return;
    if (lensApplied) {
      // Lens flow: replace all selected topics with the lens set, not merge.
      // Merging would push the total past 8 when switching lenses.
      setSelectedTopics(pickedTopics);
    } else {
      setSelectedTopics((prev) => {
        const existing = new Set(prev);
        const newIds = pickedTopics.filter((id) => !existing.has(id));
        return [...prev, ...newIds];
      });
    }
    const pickedTopicObjects = pickedTopics
      .map((id) => topics.find((t) => t.id === id))
      .filter(Boolean);
    initRandomInversions(pickedTopicObjects);
    setCurrentIndex(0);
    setStep("answer");
  };

  /**
   * One question answered. Deduped per topic for the same reason
   * FullCalibration guards on `selectedValue !== null`: a user changing their
   * mind before pressing Next is one answer, not several, and answered_count is
   * only readable as a progress curve if each topic contributes once.
   */
  const reportAnswer = (slug, answersMap, answerType) => {
    if (reportedAnswers.current.has(slug)) return;
    reportedAnswers.current.add(slug);
    emit(eventForAnswer({
      topicSlug: slug,
      answeredCount: countAnswered(answersMap),
      totalTopics: pickedTopics.length,
      answerType,
    }));
  };

  const handleSelectStance = async (value) => {
    if (!currentTopic) return;
    if (writeIns?.[currentTopic?.short_title]) {
      setWriteIns((prev) => {
        const updated = { ...prev };
        delete updated[currentTopic.short_title];
        return updated;
      });
    }
    setSelectedAnswer(value);
    setAnswers((prev) => ({ ...prev, [currentTopic.short_title]: value }));
    reportAnswer(
      currentTopic.short_title,
      { ...answers, [currentTopic.short_title]: value },
      "stance"
    );
    if (isLoggedIn) {
      try {
        await apiFetch('/compass/answers', {
          method: "POST",
          body: JSON.stringify({ topic_id: currentTopic.id, value }),
        });
      } catch { /* best-effort server sync; the answer is already stored locally. A failed save is currently silent. */ }
    }
  };

  const handleNext = () => {
    // The same button reads "Next" or "Skip" depending on whether a stance is
    // selected, so an advance with nothing answered IS the skip. (Unreachable
    // under a lens, where the button is disabled until something is picked.)
    if (
      currentTopic &&
      !(answers[currentTopic.short_title] > 0) &&
      !reportedSkips.current.has(currentTopic.short_title)
    ) {
      reportedSkips.current.add(currentTopic.short_title);
      emit(eventForQuestionSkip({
        topicSlug: currentTopic.short_title,
        answeredCount,
        totalTopics: pickedTopics.length,
      }));
    }
    if (lensApplied) {
      if (currentIndex < pickedTopics.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setSelectedAnswer(null);
      } else {
        handleFinish();
      }
      return;
    }
    const nextUnanswered = pickedTopics.findIndex((id, idx) => {
      if (idx <= currentIndex) return false;
      const topic = topics.find((t) => t.id === id);
      if (!topic) return false;
      const val = answers[topic.short_title];
      return !(val != null && val > 0);
    });
    if (nextUnanswered !== -1) {
      setCurrentIndex(nextUnanswered);
      setSelectedAnswer(null);
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    } else {
      // Backing out of question one leaves the flow entirely. Reported as a
      // navigation reversal, not a decision to skip — the distinction is the
      // point of exit_via.
      handleSkip(STEPS.ANSWER, EXIT_VIA.BACK);
    }
  };

  const handleFinish = () => {
    if (startWithAllTopics) {
      localStorage.removeItem(STORAGE_KEY);
      setStep("complete");
      return;
    }
    const unansweredIds = pickedTopics.filter((id) => {
      const topic = topics.find((t) => t.id === id);
      if (!topic) return true;
      const val = answers[topic.short_title];
      return !(val != null && val > 0);
    });
    const answeredIds = pickedTopics.filter((id) => !unansweredIds.includes(id));
    // Replace selectedTopics entirely — don't merge with prior full-quiz topics
    setSelectedTopics(answeredIds);
    if (unansweredIds.length > 0) {
      setInvertedSpokes((prev) => {
        const updated = { ...prev };
        for (const id of unansweredIds) {
          const topic = topics.find((t) => t.id === id);
          if (topic) delete updated[topic.short_title];
        }
        return updated;
      });
    }
    localStorage.removeItem(STORAGE_KEY);

    if (answeredIds.length < MIN_TOPICS) {
      handleComplete();
      return;
    }

    setStep("complete");
  };

  const handleExitDuringAnswer = () => {
    if (answeredCount < MIN_TOPICS) return;
    const unansweredIds = pickedTopics.filter((id) => {
      const topic = topics.find((t) => t.id === id);
      if (!topic) return true;
      const val = answers[topic.short_title];
      return !(val != null && val > 0);
    });
    if (unansweredIds.length > 0) {
      if (!window.confirm("You have unanswered topics. They'll be removed from your compass. Continue?")) return;
      setInvertedSpokes((prev) => {
        const updated = { ...prev };
        for (const id of unansweredIds) {
          const topic = topics.find((t) => t.id === id);
          if (topic) delete updated[topic.short_title];
        }
        return updated;
      });
    }
    const answeredIds = pickedTopics.filter((id) => !unansweredIds.includes(id));
    // Replace selectedTopics entirely — don't merge with prior full-quiz topics
    setSelectedTopics(answeredIds);
    localStorage.removeItem(STORAGE_KEY);
    setStep("complete");
  };

  const selectWriteInPlacement = (midpointValue) => {
    if (!currentTopic) return;
    setAnswers((prev) => ({ ...prev, [currentTopic.short_title]: midpointValue }));
    setWriteIns((prev) => ({ ...prev, [currentTopic.short_title]: writeInText }));
    setSelectedAnswer(midpointValue);
    // Deduped, which matters more here than for stances: every drag that
    // repositions the write-in card comes back through this function.
    reportAnswer(
      currentTopic.short_title,
      { ...answers, [currentTopic.short_title]: midpointValue },
      "write_in"
    );
    if (isLoggedIn) {
      apiFetch('/compass/answers', {
        method: "POST",
        body: JSON.stringify({
          topic_id: currentTopic.id,
          value: midpointValue,
          write_in_text: writeInText,
        }),
      }).catch(() => {});
    }
  };

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oldIndex = orderedItems.indexOf(active.id);
    const newIndex = orderedItems.indexOf(over.id);
    const reordered = arrayMove(orderedItems, oldIndex, newIndex);
    setOrderedItems(reordered);
    setHasRepositioned(true);
    const writeInIndex = reordered.indexOf("write-in");
    const displayMidpoint = writeInIndex + 0.5;
    const flipped = currentTopic && invertedSpokes[currentTopic.short_title];
    const stanceCount = currentTopic?.stances?.length || 0;
    const midpointValue = flipped ? displayMidpoint : (stanceCount + 1 - displayMidpoint);
    selectWriteInPlacement(midpointValue);
  };

  const handleStanceMax = () => {
    setInvertedSpokes((prev) => {
      const next = { ...prev };
      for (const id of pickedTopics) {
        const topic = topics.find((t) => t.id === id);
        if (!topic) continue;
        const val = answers[topic.short_title];
        if (val == null || val <= 0) continue;
        const isInverted = !!next[topic.short_title];
        const displayVal = isInverted ? 6 - val : val;
        if (displayVal < 3) {
          if (val < 3) next[topic.short_title] = true;
          else delete next[topic.short_title];
        }
      }
      return next;
    });
  };

  const handleStanceMin = () => {
    setInvertedSpokes((prev) => {
      const next = { ...prev };
      for (const id of pickedTopics) {
        const topic = topics.find((t) => t.id === id);
        if (!topic) continue;
        const val = answers[topic.short_title];
        if (val == null || val <= 0) continue;
        const isInverted = !!next[topic.short_title];
        const displayVal = isInverted ? 6 - val : val;
        if (displayVal > 3) {
          if (val > 3) next[topic.short_title] = true;
          else delete next[topic.short_title];
        }
      }
      return next;
    });
  };

  const handlePickDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oldIndex = pickedTopics.indexOf(active.id);
    const newIndex = pickedTopics.indexOf(over.id);
    setPickedTopics(arrayMove(pickedTopics, oldIndex, newIndex));
  };

  const handleStancePillDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oldIndex = pickedTopics.indexOf(active.id);
    const newIndex = pickedTopics.indexOf(over.id);
    const newOrder = arrayMove(pickedTopics, oldIndex, newIndex);
    const currentTopicId = pickedTopics[currentIndex];
    setCurrentIndex(newOrder.indexOf(currentTopicId));
    setPickedTopics(newOrder);
  };

  const handleWriteInTextChange = (newText) => {
    setWriteInText(newText);
    if (selectedAnswer && !Number.isInteger(selectedAnswer)) {
      if (newText.trim()) {
        setWriteIns((prev) => ({ ...prev, [currentTopic.short_title]: newText }));
        // Debounce server sync so typing doesn't flood the API, but ensure the
        // final text is always persisted (drag saves position with empty text).
        if (isLoggedIn && currentTopic) {
          clearTimeout(writeInSaveTimer.current);
          writeInSaveTimer.current = setTimeout(() => {
            apiFetch('/compass/answers', {
              method: "POST",
              body: JSON.stringify({
                topic_id: currentTopic.id,
                value: selectedAnswer,
                write_in_text: newText,
              }),
            }).catch(() => {});
          }, 600);
        }
      } else {
        setSelectedAnswer(null);
        setAnswers((prev) => {
          const updated = { ...prev };
          delete updated[currentTopic.short_title];
          return updated;
        });
        setWriteIns((prev) => {
          const updated = { ...prev };
          delete updated[currentTopic.short_title];
          return updated;
        });
      }
    }
  };

  const handleCancelWriteIn = () => {
    setShowWriteIn(false);
    setWriteInText("");
    setOrderedItems([]);
    if (selectedAnswer && !Number.isInteger(selectedAnswer)) {
      setSelectedAnswer(null);
      setAnswers((prev) => {
        const updated = { ...prev };
        delete updated[currentTopic.short_title];
        return updated;
      });
      setWriteIns((prev) => {
        const updated = { ...prev };
        delete updated[currentTopic.short_title];
        return updated;
      });
    }
  };

  // --- Render helpers ---

  const isFlipped = currentTopic ? invertedSpokes[currentTopic.short_title] : false;
  const orderedStances =
    currentTopic && currentTopic.stances
      ? isFlipped
        ? currentTopic.stances
        : [...currentTopic.stances].reverse()
      : [];

  const allRemainingAnswered = pickedTopics.every((id, idx) => {
    if (idx <= currentIndex) return true;
    const topic = topics.find((t) => t.id === id);
    if (!topic) return false;
    const val = answers[topic.short_title];
    return val != null && val > 0;
  });
  const isLastUnanswered = allRemainingAnswered;

  // Shared dark-mode toggle button rendered inline in each step header
  const DarkToggle = ({ style: extraStyle = {}, sizeClass = "w-8 h-8", iconClass }) => (
    <button
      onClick={toggleDark}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={`${sizeClass} rounded-full flex items-center justify-center cursor-pointer transition-opacity hover:opacity-70 shrink-0`}
      style={{ background: t.cardElev, color: t.textMuted, ...extraStyle }}
    >
      {isDark ? <SunIcon className={iconClass} /> : <MoonIcon className={iconClass} />}
    </button>
  );

  // Shared top bar: EV wordmark (left), Compass logo (center), dark toggle (right)
  const evLogoSrc = isDark ? "/EVLogo-dark.svg" : "/EVLogo.svg";
  const compassLogoSrc = isDark ? "/compass-logo-dark.png" : "/compass-logo-light.svg";
  const LandingTopBar = () => (
    <div className="relative z-10 flex items-center px-4 sm:px-6 lg:px-12 pt-5 sm:pt-6 pb-2 shrink-0">
      <button
        onClick={() => { window.location.href = "https://alpha.empowered.vote"; }}
        className="cursor-pointer transition-opacity hover:opacity-80"
        aria-label="Empowered Vote home"
      >
        <img src={evLogoSrc} alt="Empowered Vote" className="h-7 md:h-10 w-auto" />
      </button>
      <button
        onClick={() => setStep("welcome")}
        className="absolute left-1/2 -translate-x-1/2 cursor-pointer transition-opacity hover:opacity-80"
        aria-label="Empowered Compass — back to start"
      >
        <img src={compassLogoSrc} alt="Empowered Compass" className="h-7 md:h-11 w-auto" />
      </button>
      {/* Scaled up alongside the logos in this bar */}
      <DarkToggle
        sizeClass="w-9 h-9 md:w-11 md:h-11"
        iconClass="w-[1.15rem] h-[1.15rem] md:w-6 md:h-6"
        style={{ marginLeft: "auto" }}
      />
    </div>
  );

  // Phase progress bar used in pick + answer steps
  const PhaseBar = ({ current }) => (
    <div className="flex items-center justify-center gap-1.5 text-xs font-bold tracking-widest uppercase select-none">
      {[
        { n: 1, label: "Choose Topics" },
        { n: 2, label: "Stances" },
        { n: 3, label: "Discover" },
      ].map(({ n, label }, i) => (
        <span key={n} className="flex items-center gap-1.5">
          {i > 0 && (
            <span style={{ color: t.divider, fontWeight: 400, letterSpacing: 0 }}>—</span>
          )}
          <span style={{ color: current === n ? t.textAccent : t.textMuted }}>
            {n === current ? `① `.replace('1', String(n)) : `○ `.replace('○', `${n}.`)}
            {n === current ? `⬤ ` : ''}
            {label}
          </span>
        </span>
      ))}
    </div>
  );

  // Simpler phase indicator — numbered dots + labels
  const PhaseIndicator = ({ current }) => {
    const phases = ["Choose Topics", "Your Stances", "Compare & Discover"];
    return (
      <div className="flex items-center justify-center gap-0 select-none">
        {phases.map((label, i) => {
          const n = i + 1;
          const active = n === current;
          const done = n < current;
          return (
            <div key={n} className="flex items-center">
              {i > 0 && (
                <div
                  className="w-8 h-px"
                  style={{ background: done ? t.textAccent : t.divider }}
                />
              )}
              <div className="flex flex-col items-center gap-0.5">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                  style={{
                    background: active ? t.textAccent : done ? t.textAccent : t.cardElev,
                    color: active || done ? '#FFFFFF' : t.textMuted,
                    boxShadow: active ? `0 0 0 3px ${t.textAccent}30` : 'none',
                  }}
                >
                  {done ? '✓' : n}
                </div>
                <span
                  className="text-xs font-medium whitespace-nowrap hidden sm:block"
                  style={{ color: active ? t.textAccent : t.textMuted }}
                >
                  {label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ============================
  // STEP: WELCOME
  // ============================
  if (step === "welcome") {
    // The three things they'll actually do ("how to build it"), kept short.
    // All three markers share the theme accent — they are one sequence, not
    // three separate things, so they no longer carry a colour each.
    const journeySteps = [
      {
        num: "1",
        title: "Choose your issues",
        desc: "Pick the topics that actually decide your vote.",
      },
      {
        num: "2",
        title: "Set where you stand",
        desc: "Place yourself on each one. No right answers, only yours.",
      },
      {
        num: "3",
        title: "Compare & discover",
        desc: "See which leaders line up with you, issue by issue.",
      },
    ];

    return (
      <div
        className={`fixed ${overlayTop} left-0 right-0 bottom-0 z-50 overflow-y-auto overflow-x-hidden flex flex-col`}
        style={{ background: t.bg }}
      >
        <LandingTopBar />

        <div className="flex flex-col lg:flex-row items-stretch lg:items-center flex-1 min-h-0">

          {/* ── Left: what it is + how it helps + CTAs ── */}
          <div className="w-full lg:w-1/2 flex flex-col justify-center px-6 sm:px-8 py-8 sm:py-10 lg:py-16 lg:pl-16 lg:pr-10">

            <p
              className="text-xs font-bold tracking-widest uppercase mb-4"
              style={{ color: t.textAccent }}
            >
              Your Political Compass
            </p>

            <h1
              className="text-4xl md:text-5xl lg:text-[3.4rem] font-extrabold leading-[1.05] mb-5"
              style={{ color: t.textHead, letterSpacing: '-0.03em' }}
            >
              Find where you stand,<br className="hidden md:block" />{' '}
              <span style={{ color: t.textAccent }}>and who stands with you.</span>
            </h1>

            <p
              className="text-base md:text-lg max-w-md leading-relaxed mb-6"
              style={{ color: t.textBody }}
            >
              Pick the issues that decide your vote and mark where you stand.
              The Compass then shows which candidates and officials actually
              line up with you, one issue at a time.
            </p>

            {/* How you'll build it — horizontal numbered stepper */}
            <div className="mb-8 max-w-md">
              <div className="flex items-start">
                {journeySteps.map((s, i) => (
                  <div key={s.num} className="flex-1 flex flex-col items-center text-center relative">
                    {i > 0 && (
                      <span
                        className="absolute top-4 h-0.5"
                        style={{ left: "calc(-50% + 20px)", right: "calc(50% + 20px)", background: t.border }}
                        aria-hidden="true"
                      />
                    )}
                    <div
                      className="relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                      style={{ background: `${t.textAccent}22`, color: t.textAccent, border: `2px solid ${t.textAccent}` }}
                    >
                      {s.num}
                    </div>
                    <p className="text-sm font-semibold mt-2.5 leading-tight px-1" style={{ color: t.textBody }}>
                      {s.title}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Primary: Local Lens — intro page, then onboarding, then the 8 local issues */}
              <button
                onClick={handleStartWithLens}
                className="flex items-center gap-2.5 px-7 py-3.5 rounded-full font-bold text-base transition-all hover:opacity-90 active:scale-95 cursor-pointer shadow-md"
                style={{ background: t.yellow, color: '#1C1C1C' }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 shrink-0">
                  <path fillRule="evenodd" d="M9.293 2.293a1 1 0 011.414 0l7 7A1 1 0 0117 11h-1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-3a1 1 0 00-1-1H9a1 1 0 00-1 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-6H3a1 1 0 01-.707-1.707l7-7z" clipRule="evenodd" />
                </svg>
                Start with the Local Lens →
              </button>
              {/* Secondary: custom */}
              <button
                onClick={handleChooseTopics}
                className="px-6 py-3.5 rounded-full text-sm font-semibold border-2 transition-all hover:opacity-80 active:scale-95 cursor-pointer"
                style={{ borderColor: t.yellow, color: t.textBody, background: 'transparent' }}
              >
                Choose my own topics →
              </button>
            </div>
          </div>

          {/* ── Right: live compass — you vs a candidate, always moving ── */}
          <div className="w-full lg:w-1/2 flex flex-col items-center justify-center px-6 sm:px-8 pb-10 sm:pb-16 lg:py-16 lg:pr-16 lg:pl-8">
            <div className="w-full max-w-[18rem] sm:max-w-sm lg:max-w-lg aspect-square">
              <LandingRadar t={t} />
            </div>
            <div className="flex items-center gap-5 mt-4">
              <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: t.textBody }}>
                <span className="w-3 h-3 rounded-full" style={{ background: RADAR_YOU }} /> You
              </span>
              <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: t.textBody }}>
                <span className="w-3 h-3 rounded-full" style={{ background: RADAR_CAND }} /> A candidate
              </span>
            </div>
          </div>

        </div>
      </div>
    );
  }

  // ============================
  // STEP: LEARN — educational carousel shown before calibration.
  // Reached from either landing CTA; explains what / how / why, then hands
  // off to the chosen build path (full compass or custom topic pick).
  // ============================
  if (step === "learn") {
    // Eyebrows are numbered in the render from the slide's own position, so the
    // heading always matches the progress dots below — no hand-kept counts.
    const LEARN_SLIDES = [
      {
        title: "Your beliefs, turned into a map.",
        body: "The Compass turns what you believe into a single clear picture. You pick the issues that actually decide your vote and mark where you stand on each one, and it draws them into a shape that is yours alone.",
        illo: "what",
        accent: "#59B0C4",
      },
      {
        title: "Know where you stand, at a glance.",
        body: "Lay your compass over a candidate and the overlap does the explaining. Where you agree lights up, where you split is obvious, and you can read the whole picture in seconds. No party labels, no homework.",
        illo: "compare",
        accent: "#FFD426",
      },
    ];
    const slide = LEARN_SLIDES[learnIndex];
    const stepLabel = `Step ${learnIndex + 1} of ${LEARN_SLIDES.length}`;
    const isLast = learnIndex === LEARN_SLIDES.length - 1;
    const finalLabel = learnMode === "lens"
      ? "Start finding my stances →"
      : learnMode === "full"
        ? "Build my compass →"
        : "Choose my topics →";

    // Vertical swipe: forward -> current rises out the top while the next
    // rises up from below; backward reverses it.
    const slideVariants = {
      enter: (dir) => ({ y: dir > 0 ? "100%" : "-100%" }),
      center: { y: 0 },
      exit: (dir) => ({ y: dir > 0 ? "-100%" : "100%" }),
    };

    const goToSlide = (target) => {
      setLearnDir(target > learnIndex ? 1 : -1);
      setLearnIndex(target);
    };
    const nextSlide = () => (isLast ? proceedFromLearn() : goToSlide(learnIndex + 1));
    // Backing out of the first slide returns to whichever screen sent us here.
    const backSlide = () =>
      learnIndex > 0
        ? goToSlide(learnIndex - 1)
        : setStep(learnMode === "lens" ? "lens_intro" : "welcome");

    // Gesture navigation (wheel / trackpad / drag). Bounded so a stray gesture
    // never accidentally exits onboarding — the buttons own Skip/finish/exit.
    const gestureNext = () => { if (learnIndex < LEARN_SLIDES.length - 1) goToSlide(learnIndex + 1); };
    const gesturePrev = () => { if (learnIndex > 0) goToSlide(learnIndex - 1); };
    const handleWheel = (e) => {
      if (wheelLockRef.current || Math.abs(e.deltaY) < 12) return;
      const forward = e.deltaY > 0;
      if (forward && learnIndex >= LEARN_SLIDES.length - 1) return;
      if (!forward && learnIndex <= 0) return;
      wheelLockRef.current = true;
      (forward ? gestureNext : gesturePrev)();
      setTimeout(() => { wheelLockRef.current = false; }, 700);
    };
    const handleDragEnd = (_e, info) => {
      if (info.offset.y < -60 || info.velocity.y < -400) gestureNext();
      else if (info.offset.y > 60 || info.velocity.y > 400) gesturePrev();
    };

    // Ambient background: drifting blurred blobs whose color tracks the slide accent.
    const accent = slide.accent || t.textAccent;
    const BG_BLOBS = [
      { cls: "w-[44rem] h-[44rem] -top-52 -left-44", dx: [0, 36, 0], dy: [0, 22, 0], dur: 24, op: isDark ? 0.16 : 0.1 },
      { cls: "w-[36rem] h-[36rem] top-1/4 -right-48", dx: [0, -28, 0], dy: [0, 32, 0], dur: 28, op: isDark ? 0.12 : 0.07 },
    ];

    return (
      <div
        className={`fixed ${overlayTop} left-0 right-0 bottom-0 z-50 flex flex-col overflow-hidden`}
        style={{ background: t.bg }}
      >
        {/* Ambient animated background — color shifts with each slide */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
          {BG_BLOBS.map((b, i) => (
            <motion.div
              key={i}
              className={`absolute rounded-full ${b.cls}`}
              style={{ filter: "blur(110px)", opacity: b.op }}
              animate={{ backgroundColor: accent, x: b.dx, y: b.dy }}
              transition={{
                backgroundColor: { duration: 0.9, ease: "easeInOut" },
                x: { duration: b.dur, repeat: Infinity, ease: "easeInOut" },
                y: { duration: b.dur * 1.25, repeat: Infinity, ease: "easeInOut" },
              }}
            />
          ))}
          <PulseLines accent={accent} />
        </div>

        <LandingTopBar />

        {/* Content — visual (left, swaps in place) + copy (right, vertical swipe).
            Scroll wheel / trackpad / drag anywhere moves between slides. */}
        <motion.div
          className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-6 py-4 sm:py-6"
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.12}
          onDragEnd={handleDragEnd}
          onWheel={handleWheel}
        >
          <div className="w-full max-w-4xl flex flex-col md:flex-row items-center gap-5 sm:gap-8 md:gap-12">
            {/* Illustration (left) — swaps in place with a soft fade, no swipe */}
            <div
              className="relative w-full md:w-[46%] shrink-0 rounded-3xl px-4 sm:px-6 py-6 sm:py-8 md:py-10 flex items-center justify-center min-h-[14rem] sm:min-h-[16rem] md:min-h-[17rem] overflow-hidden"
              style={{ background: t.card, border: `1px solid ${t.border}` }}
            >
              {/* Soft pulsing glow */}
              <motion.div
                aria-hidden="true"
                className="pointer-events-none absolute w-64 h-64 rounded-full"
                style={{ background: `radial-gradient(circle, ${t.textAccent}22 0%, transparent 70%)` }}
                animate={{ scale: [1, 1.12, 1], opacity: [0.6, 0.9, 0.6] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.div
                key={learnIndex}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="relative"
              >
                <LearnIllustration kind={slide.illo} t={t} />
              </motion.div>
            </div>

            {/* Copy (right) — only this swipes up/down between slides */}
            <div className="relative flex-1 w-full overflow-hidden min-h-[9rem] sm:min-h-[11rem]">
              <AnimatePresence mode="popLayout" custom={learnDir} initial={false}>
                <motion.div
                  key={learnIndex}
                  custom={learnDir}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1] }}
                  className="flex flex-col justify-center items-center text-center md:items-start md:text-left"
                >
                  <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: t.textAccent }}>
                    {stepLabel}
                  </p>
                  <h2
                    className="text-2xl sm:text-3xl md:text-4xl font-extrabold leading-tight mb-3 sm:mb-4"
                    style={{ color: t.textHead, letterSpacing: "-0.02em" }}
                  >
                    {slide.title}
                  </h2>
                  <p className="text-base leading-relaxed max-w-md" style={{ color: t.textBody }}>
                    {slide.body}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </motion.div>

        {/* Fixed bottom nav bar — Skip · Previous · dots · Next */}
        <div
          className="relative z-10 shrink-0"
          style={{ background: t.stickyBg, borderTop: `1px solid ${t.border}`, backdropFilter: "blur(8px)" }}
        >
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-3 px-4 sm:px-6 py-4">
            {/* Left: Skip + Previous */}
            <div className="flex items-center gap-2">
              <button
                onClick={proceedFromLearn}
                className="px-4 py-2.5 rounded-full text-sm font-semibold transition-opacity hover:opacity-70 cursor-pointer"
                style={{ color: t.textMuted }}
              >
                Skip
              </button>
              <button
                onClick={backSlide}
                className="flex items-center gap-1 px-4 py-2.5 rounded-full text-sm font-semibold border-2 transition-all hover:opacity-80 cursor-pointer"
                style={{ borderColor: t.yellow, color: t.textBody, background: "transparent" }}
              >
                <BackArrow />
                <span className="hidden sm:inline">Previous</span>
              </button>
            </div>

            {/* Center: progress dots */}
            <div className="flex items-center gap-2">
              {LEARN_SLIDES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goToSlide(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  className="h-2 rounded-full transition-all cursor-pointer"
                  style={{
                    width: i === learnIndex ? 24 : 8,
                    background: i === learnIndex ? t.textAccent : t.divider,
                  }}
                />
              ))}
            </div>

            {/* Right: Next */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={nextSlide}
              className="px-6 py-2.5 rounded-full font-bold text-sm md:text-base transition-all hover:opacity-90 cursor-pointer shadow-md whitespace-nowrap"
              style={{ background: t.btnBg, color: t.btnText }}
            >
              {isLast ? finalLabel : "Next →"}
            </motion.button>
          </div>
        </div>
      </div>
    );
  }

  // ============================
  // STEP: LENS INTRO
  // Shown after "Start with Local Lens" — explains why local issues matter
  // and bridges directly to the answer step, skipping the topic picker.
  // ============================
  if (step === "lens_intro") {
    const lensTopics = pickedTopics
      .map(id => topics.find(t => t.id === id))
      .filter(Boolean);
    const lens = activeLens || LOCAL_LENS;
    const lensColor = getLensColor(lens, isDark);
    const lensInk = getLensInk(lens, isDark);
    const isJudicial = lens.key === 'judicial';
    const isFederal = lens.key === 'federal';
    // The lens as shipped, for the "put them back" escape hatch.
    const lensDefaultIds = lens.topicIds.filter(id => topics.some(tp => tp.id === id));
    const canRemoveTopic = lensTopics.length > MIN_TOPICS;

    const removeLensTopic = (id) => {
      if (!canRemoveTopic) return;
      setLensEdited(true);
      setPickedTopics(prev => prev.filter(x => x !== id));
    };

    const reorderLensTopics = ({ active, over }) => {
      if (!over || active.id === over.id) return;
      setLensEdited(true);
      handlePickDragEnd({ active, over });
    };

    return (
      <div
        className={`fixed ${overlayTop} left-0 right-0 bottom-0 z-50 overflow-y-auto flex flex-col`}
        style={{ background: t.bg }}
      >
        <div className="absolute top-4 right-4 z-10"><DarkToggle /></div>

        <div className="flex flex-col lg:flex-row min-h-full">

          {/* ── Left: narrative ── */}
          <div className="flex flex-col justify-center px-8 py-16 lg:py-24 lg:w-1/2 lg:pl-16 lg:pr-10">

            {/* Lens badge */}
            <div className="flex items-center gap-2 mb-6">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                style={{ background: lensColor }}
              >
                {isJudicial ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill={lensInk} className="w-4 h-4">
                    <path fillRule="evenodd" d="M10 1a.75.75 0 01.75.75v1.5h2.75A2.75 2.75 0 0116.25 6v.75H18a.75.75 0 010 1.5h-1.75v5H18a.75.75 0 010 1.5h-1.75V15a2.75 2.75 0 01-2.75 2.75H6.5A2.75 2.75 0 013.75 15v-.25H2a.75.75 0 010-1.5h1.75v-5H2a.75.75 0 010-1.5h1.75V6A2.75 2.75 0 016.5 3.25h2.75v-1.5A.75.75 0 0110 1zm0 4.25H6.5A1.25 1.25 0 005.25 6.5v7A1.25 1.25 0 006.5 14.75h7A1.25 1.25 0 0014.75 13.5v-7A1.25 1.25 0 0013.5 5.25H10z" clipRule="evenodd" />
                  </svg>
                ) : isFederal ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke={lensInk} className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0 0 12 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75Z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill={lensInk} className="w-4 h-4">
                    <path fillRule="evenodd" d="M9.293 2.293a1 1 0 011.414 0l7 7A1 1 0 0117 11h-1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-3a1 1 0 00-1-1H9a1 1 0 00-1 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-6H3a1 1 0 01-.707-1.707l7-7z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <span
                className="text-sm font-bold tracking-widest uppercase"
                style={{ color: lensColor }}
              >
                {lens.name}
              </span>
            </div>

            {isJudicial ? (
              <>
                <h1
                  className="text-4xl md:text-5xl font-extrabold leading-tight mb-6"
                  style={{ color: t.textHead, letterSpacing: '-0.03em' }}
                >
                  Courts. Prosecutors.<br />
                  <span style={{ color: lensColor }}>Your vote decides them.</span>
                </h1>
                <p className="text-base leading-relaxed mb-4" style={{ color: t.textBody }}>
                  Judges and district attorneys shape who gets bail, how laws are interpreted, and
                  whether communities get accountability or incarceration.
                </p>
                <p className="text-base leading-relaxed mb-10" style={{ color: t.textBody }}>
                  These races rarely get the attention they deserve, yet a single DA or judge can
                  affect more lives than most legislators. Calibrate your judicial compass and
                  know exactly who shares your values on the bench.
                </p>
              </>
            ) : isFederal ? (
              <>
                <h1
                  className="text-4xl md:text-5xl font-extrabold leading-tight mb-6"
                  style={{ color: t.textHead, letterSpacing: '-0.03em' }}
                >
                  Congress. Your seat<br />
                  <span style={{ color: lensColor }}>at the table.</span>
                </h1>
                <p className="text-base leading-relaxed mb-4" style={{ color: t.textBody }}>
                  Your U.S. House and Senate members vote on healthcare, taxes, immigration, and the
                  climate: the issues that dominate national debate.
                </p>
                <p className="text-base leading-relaxed mb-10" style={{ color: t.textBody }}>
                  These are the 8 topics the most House and Senate members and candidates have taken a
                  clear position on. Calibrate your Federal compass and see exactly where they line up
                  with you.
                </p>
              </>
            ) : (
              <>
                <h1
                  className="text-4xl md:text-5xl font-extrabold leading-tight mb-6"
                  style={{ color: t.textHead, letterSpacing: '-0.03em' }}
                >
                  Local issues.<br />
                  <span style={{ color: lensColor }}>Your real power.</span>
                </h1>
                <p className="text-base leading-relaxed mb-4" style={{ color: t.textBody }}>
                  Most civic education focuses on federal politics: presidents, Congress, senators. But
                  your vote has the most impact at the local level.
                </p>
                <p className="text-base leading-relaxed mb-10" style={{ color: t.textBody }}>
                  City councils, mayors, and local officials make the decisions that shape your daily
                  life: housing costs, public safety, schools, and development. In local elections,
                  turnout often falls below 20%, which means your vote here matters more than almost
                  anywhere else.
                </p>
              </>
            )}

            <button
              onClick={handleLensLearn}
              className="flex items-center gap-2 px-8 py-3.5 rounded-full font-bold text-base transition-all hover:opacity-90 active:scale-95 cursor-pointer shadow-md self-start mb-3"
              style={{ background: t.yellow, color: '#1C1C1C' }}
            >
              Start finding my stances →
            </button>

            <button
              onClick={() => {
                setPickedTopics(prevPickedTopics);
                setLensApplied(false);
                setActiveLens(null);
                setStep("pick");
              }}
              className="text-sm self-start px-1 transition-opacity hover:opacity-70 cursor-pointer"
              style={{ color: t.textMuted }}
            >
              ← Change my topics
            </button>

          </div>

          {/* ── Right: the topics, as an editable running order ── */}
          <div className="flex flex-col justify-center px-8 pb-16 lg:py-24 lg:w-1/2 lg:pr-16 lg:pl-8">
            <p
              className="text-xs font-bold tracking-widest uppercase mb-1"
              style={{ color: lensColor }}
            >
              {lensTopics.length} {lensTopics.length === 1 ? 'topic' : 'topics'} we&apos;ll ask about
            </p>
            <p className="text-sm mb-4" style={{ color: t.textMuted }}>
              This is your running order. Drag a topic to move it, or drop the ones
              you don&apos;t care about. We&apos;ll ask them exactly like this.
            </p>

            <div className="max-w-md w-full mx-auto lg:mx-0">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                modifiers={[restrictToVerticalAxis]}
                onDragEnd={reorderLensTopics}
              >
                <SortableContext items={pickedTopics} strategy={verticalListSortingStrategy}>
                  <div className="flex flex-col gap-2">
                    {lensTopics.map((topic, i) => (
                      <SortableLensTopicRow
                        key={topic.id}
                        id={topic.id}
                        index={i}
                        label={parseTensionTitle(topic).name || topic.short_title}
                        accent={lensColor}
                        t={t}
                        canRemove={canRemoveTopic}
                        onRemove={() => removeLensTopic(topic.id)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              {lensTopics.length < lensDefaultIds.length && (
                <button
                  onClick={() => { setLensEdited(true); setPickedTopics(lensDefaultIds); }}
                  className="mt-3 text-sm px-1 transition-opacity hover:opacity-70 cursor-pointer"
                  style={{ color: t.textAccent }}
                >
                  Put back all {lensDefaultIds.length}
                </button>
              )}

              {!canRemoveTopic && (
                <p className="mt-3 text-xs" style={{ color: t.textMuted }}>
                  {MIN_TOPICS} is the fewest a compass can be built from.
                </p>
              )}
            </div>
          </div>

        </div>
      </div>
    );
  }

  // ============================
  // STEP: PICK TOPICS
  // ============================
  if (step === "pick") {
    return (
      <div
        className={`fixed ${overlayTop} left-0 right-0 bottom-0 z-50 overflow-y-auto`}
        style={{ background: t.bg }}
      >
        {/* ── Sticky header ── */}
        <div
          className="sticky top-0 z-10 px-4 pt-3 pb-3"
          style={{ background: t.stickyBg, borderBottom: `1px solid ${t.border}` }}
        >
          {/* Phase indicator */}
          <div className="max-w-5xl mx-auto mb-3">
            <PhaseIndicator current={1} />
          </div>

          {/* Title row */}
          <div className="flex items-center gap-3 max-w-5xl mx-auto">
            <button
              onClick={() => handleSkip(STEPS.PICK, EXIT_VIA.DISMISS)}
              className="p-1.5 rounded-full transition-colors cursor-pointer shrink-0 hover:opacity-70"
              style={{ color: t.textMuted }}
              aria-label="Close"
            >
              <BackArrow />
            </button>

            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold leading-tight" style={{ color: t.textHead }}>
                What matters to you?
              </h1>
              <p className="text-xs" style={{ color: t.textMuted }}>
                Pick 3 to 8 topics — you can always change these later
              </p>
            </div>

            <span
              className="shrink-0 text-sm font-bold px-3 py-1 rounded-full transition-all"
              style={{
                background: pickedTopics.length >= MIN_TOPICS ? t.yellow : t.cardElev,
                color: pickedTopics.length >= MIN_TOPICS ? '#1C1C1C' : t.textMuted,
              }}
            >
              {pickedTopics.length}/{MAX_TOPICS}
            </span>

            <DarkToggle />
          </div>

          {/* Draggable topic pill strip */}
          <div className="max-w-5xl mx-auto mt-2">
            {pickedTopics.length > 0 ? (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handlePickDragEnd}>
                <SortableContext items={pickedTopics} strategy={horizontalListSortingStrategy}>
                  <div
                    className="flex gap-1.5 overflow-x-auto pb-1"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                  >
                    {pickedTopics.map((id) => {
                      const topic = topics.find((tp) => tp.id === id);
                      const label = topic ? (parseTensionTitle(topic).name || topic.short_title) : String(id);
                      return (
                        <SortableTopicPill
                          key={id}
                          id={id}
                          label={label}
                          onRemove={() => togglePick(id)}
                          t={t}
                        />
                      );
                    })}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <p className="text-xs" style={{ color: t.textMuted }}>
                ↓ Tap topics below to add them to your compass
              </p>
            )}
          </div>
        </div>

        {/* ── Topic list ── */}
        <div className="px-4 py-4 max-w-5xl mx-auto pb-32">
          {lensApplied && (() => {
            const bannerLens = activeLens || LOCAL_LENS;
            const bannerColor = getLensColor(bannerLens, isDark);
            const hexToRgb = (hex) => {
              const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
              return `rgba(${r},${g},${b},0.12)`;
            };
            return (
              <div
                className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl mb-5"
                style={{ background: hexToRgb(bannerColor), border: `1.5px solid ${bannerColor}` }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill={bannerColor} className="w-4 h-4 shrink-0">
                    <path fillRule="evenodd" d="M9.293 2.293a1 1 0 011.414 0l7 7A1 1 0 0117 11h-1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-3a1 1 0 00-1-1H9a1 1 0 00-1 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-6H3a1 1 0 01-.707-1.707l7-7z" clipRule="evenodd" />
                  </svg>
                  <p className="text-sm font-semibold" style={{ color: bannerColor }}>
                    {bannerLens.name} applied — {pickedTopics.length} topics pre-selected
                  </p>
                  <p className="text-xs hidden sm:block" style={{ color: bannerColor, opacity: 0.8 }}>
                    · Add or remove any topic below
                  </p>
                </div>
                <button
                  onClick={() => { setPickedTopics([]); setLensApplied(false); setActiveLens(null); }}
                  className="text-xs font-medium shrink-0 cursor-pointer hover:opacity-70 transition-opacity"
                  style={{ color: bannerColor }}
                >
                  Clear
                </button>
              </div>
            );
          })()}
          {dedupedCategories.map((category, catIdx) => {
            if (!category.topics || category.topics.length === 0) return null;
            const catColor = CATEGORY_COLORS[catIdx % CATEGORY_COLORS.length];
            return (
              <div key={category.id} className="mb-8">
                {/* Category header */}
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-1 h-5 rounded-full shrink-0"
                    style={{ background: catColor }}
                  />
                  <h3
                    className="text-xs font-bold uppercase tracking-widest"
                    style={{ color: catColor }}
                  >
                    {category.title}
                  </h3>
                </div>

                {/* Topic cards — 1 col mobile, 2 col sm, 3 col lg */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {category.topics.map((topic, topicIdx) => {
                    const fullTopic = topics.find((tp) => tp.id === topic.id) || topic;
                    const isSelected = pickedTopics.includes(topic.id);
                    const atCap = pickedTopics.length >= MAX_TOPICS && !isSelected;
                    const isFirstTopic = catIdx === 0 && topicIdx === 0;
                    return (
                      <button
                        key={topic.id}
                        ref={isFirstTopic ? firstTopicRef : undefined}
                        onClick={() => !atCap && togglePick(topic.id)}
                        disabled={atCap}
                        className="text-left px-4 py-3 rounded-xl transition-all duration-200 cursor-pointer flex items-start justify-between gap-2"
                        style={
                          isSelected
                            ? {
                                background: `${catColor}18`,
                                border: `2px solid ${catColor}`,
                              }
                            : atCap
                            ? {
                                background: t.card,
                                border: `1px solid ${t.border}`,
                                borderLeft: `4px solid ${catColor}`,
                                opacity: 0.3,
                                cursor: 'not-allowed',
                              }
                            : {
                                background: t.card,
                                border: `1px solid ${t.border}`,
                                borderLeft: `4px solid ${catColor}`,
                              }
                        }
                      >
                        <div className="text-left min-w-0">
                          <p
                            className="text-sm font-semibold leading-snug"
                            style={{ color: t.textHead }}
                          >
                            {getQuestionText(fullTopic) || parseTensionTitle(fullTopic).name}
                          </p>
                          {getQuestionText(fullTopic) && (
                            <p
                              className="text-xs font-normal mt-0.5"
                              style={{ color: t.textMuted }}
                            >
                              {parseTensionTitle(fullTopic).name}
                            </p>
                          )}
                          <div className="mt-2">
                            <TopicTierBadge topic={fullTopic} size="xs" variant="muted" />
                          </div>
                        </div>
                        {isSelected && (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            className="w-5 h-5 shrink-0"
                            style={{ color: catColor }}
                          >
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Footer ── */}
        <div
          className="fixed bottom-0 left-0 right-0 px-4 py-4 z-10"
          style={{ background: t.stickyBg, borderTop: `1px solid ${t.border}` }}
        >
          <div className="max-w-5xl mx-auto flex flex-col gap-2">
            {pickedTopics.length < MIN_TOPICS && pickedTopics.length > 0 && (
              <p className="text-center text-sm" style={{ color: t.textMuted }}>
                {MIN_TOPICS - pickedTopics.length} more to go
              </p>
            )}
            {pickedTopics.length === 0 && (
              <p className="text-center text-sm" style={{ color: t.textMuted }}>
                Pick at least 3 topics to continue
              </p>
            )}
            <button
              onClick={handleContinueToAnswer}
              disabled={pickedTopics.length < MIN_TOPICS}
              className="w-full py-3.5 rounded-full font-bold text-base transition-all duration-200 cursor-pointer"
              style={
                pickedTopics.length >= MIN_TOPICS
                  ? { background: t.btnBg, color: t.btnText }
                  : { background: t.cardElev, color: t.textMuted, cursor: 'not-allowed' }
              }
            >
              {pickedTopics.length >= MIN_TOPICS
                ? `Continue to Step 2 — Find Your Stances →`
                : 'Continue'}
            </button>
          </div>
        </div>

        {/* Coach mark */}
        {!topicPickHintDismissed && !startAtPick && (
          <CoachMark
            targetRef={firstTopicRef}
            message="Tap topics you care about most when voting — these shape your personal compass and help you compare with politicians."
            onDismiss={() => {
              localStorage.setItem("onboarding_topicPickHint", "1");
              setTopicPickHintDismissed(true);
            }}
            show={true}
            theme={t}
          />
        )}
      </div>
    );
  }

  // ============================
  // STEP: ANSWER TOPICS
  // ============================
  if (step === "answer" && currentTopic) {
    return (
      <div
        className={`fixed ${overlayTop} left-0 right-0 bottom-0 z-50 overflow-y-auto flex flex-col`}
        style={{ background: t.bg }}
      >
        {/* ── Header ── */}
        <div className="flex flex-col px-4 pt-3 pb-2 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={handleBack}
              className="p-1.5 rounded-full transition-colors cursor-pointer hover:opacity-70"
              style={{ color: t.textMuted }}
              aria-label="Back"
            >
              <BackArrow />
            </button>

            {/* Phase indicator + progress bar — stacked and centered together */}
            <div className="flex flex-col items-center flex-1 max-w-xs gap-1.5">
              <PhaseIndicator current={2} />
              <div
                className="w-full h-1.5 rounded-full overflow-hidden"
                style={{ background: t.progressBg }}
              >
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${(answeredCount / pickedTopics.length) * 100}%`,
                    background: t.yellow,
                  }}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              {answeredCount >= MIN_TOPICS ? (
                <button
                  onClick={handleExitDuringAnswer}
                  className="text-sm font-medium transition-colors cursor-pointer px-2 py-1"
                  style={{ color: t.textAccent }}
                >
                  View Compass
                </button>
              ) : (
                <div className="w-9" aria-hidden="true" />
              )}
              <DarkToggle />
            </div>
          </div>
        </div>

        {/* Topic pill strip — draggable to reorder */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleStancePillDragEnd}>
          <SortableContext items={pickedTopics} strategy={horizontalListSortingStrategy}>
            <div className="flex gap-2 px-4 py-2 md:py-4 overflow-x-auto shrink-0 justify-center">
              {pickedTopics.map((id, idx) => {
                const topic = topics.find((tp) => tp.id === id);
                const isAnswered = topic && answers[topic.short_title] != null && answers[topic.short_title] > 0;
                const isCurrent = idx === currentIndex;
                return (
                  <SortableStancePill
                    key={id}
                    id={id}
                    label={topic ? parseTensionTitle(topic).name : "..."}
                    isCurrent={isCurrent}
                    isAnswered={isAnswered}
                    onClick={() => { setCurrentIndex(idx); setSelectedAnswer(null); }}
                    t={t}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>

        {/* Main content: compass + stances */}
        <div className="flex-1 flex flex-col md:flex-row md:overflow-hidden md:min-h-0">
          {/* Compass — left side, sized to viewport height so it grows big on larger screens */}
          <div className="md:basis-1/2 flex items-center justify-center px-2 md:pt-4">
            <div className="relative w-full max-w-[440px] md:max-w-[min(calc(50vw-2rem),calc(100vh-220px))] mx-auto">
              <RadarChart
                data={chartData}
                invertedSpokes={invertedSpokes}
                activeSpoke={currentTopic?.short_title}
                writeIns={writeIns}
                darkMode={isDark}
                onToggleInversion={(topic) =>
                  setInvertedSpokes((prev) => ({
                    ...prev,
                    [topic]: !prev[topic],
                  }))
                }
              />
              {/* Stance Max / Min — icon-only, top-right corner (past 2:00) */}
              <div className="absolute top-[12%] right-0 flex flex-col gap-1.5">
                <button
                  onClick={handleStanceMax}
                  title="Stance Max — flip any spoke showing 1–2 to its strong side (4–5)"
                  aria-label="Stance Max"
                  className="w-7 h-7 rounded-full flex items-center justify-center transition-opacity cursor-pointer hover:opacity-90 active:scale-95"
                  style={{ background: t.cardElev, border: `1px solid ${t.border}`, color: t.textBody }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                  </svg>
                </button>
                <button
                  onClick={handleStanceMin}
                  title="Stance Min — flip any spoke showing 4–5 to its moderate side (1–2)"
                  aria-label="Stance Min"
                  className="w-7 h-7 rounded-full flex items-center justify-center transition-opacity cursor-pointer hover:opacity-90 active:scale-95"
                  style={{ background: t.cardElev, border: `1px solid ${t.border}`, color: t.textBody }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9 3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5M15 15l5.25 5.25" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Question + Stance buttons — right 50%.
              On md+ the gaps / card padding / font sizes scale fluidly with viewport
              height (clamp + vh), so on shorter desktops everything compresses to fit
              instead of scrolling — the compass scales the same way via its 100vh cap.
              Around ~615px tall the clamps bottom out at their readable minimums; below
              that the panel falls back to safe-centered scroll (justify-center-safe +
              overflow-y-auto), which keeps the question pinned visible at the top rather
              than clipping it off-screen the way plain justify-center did. */}
          <div className="md:basis-1/2 flex flex-col md:justify-center-safe md:overflow-y-auto md:min-h-0 gap-1.5 md:gap-[clamp(0.25rem,0.7vh,0.375rem)] px-3 pb-4 md:pb-0 md:pr-6 max-w-md mx-auto md:mx-0">
            <div className="mb-2 md:mb-[clamp(0.25rem,0.9vh,0.5rem)]">
              <p className="text-base md:text-[clamp(1rem,1.95vh,1.125rem)] font-semibold leading-snug" style={{ color: t.textHead }}>
                {getQuestionText(currentTopic) || parseTensionTitle(currentTopic).name}
              </p>
              {getQuestionText(currentTopic) && (
                <p className="text-sm font-normal mt-0.5" style={{ color: t.textMuted }}>
                  {parseTensionTitle(currentTopic).name}
                </p>
              )}
            </div>

            {!showWriteIn ? (
              <>
                {orderedStances.map((stance) => {
                  const stanceValue = stance.value;
                  const isSelected = selectedAnswer === stanceValue;
                  return (
                    <button
                      key={stance.id}
                      data-testid="stance-option"
                      onClick={() => {
                        setShowWriteIn(false);
                        setWriteInText("");
                        handleSelectStance(stanceValue);
                      }}
                      className="text-left px-3 py-2.5 md:py-[clamp(0.375rem,1.05vh,0.625rem)] rounded-lg transition-all duration-200 text-sm md:text-[clamp(0.8125rem,1.5vh,0.875rem)] leading-snug font-medium cursor-pointer"
                      style={
                        isSelected
                          ? {
                              border: `2px solid ${t.yellow}`,
                              background: t.yellowBg,
                              color: t.textHead,
                            }
                          : {
                              background: t.stanceBg,
                              color: t.stanceText,
                              border: `2px solid ${t.stanceBorder}`,
                            }
                      }
                    >
                      {stance.text}
                    </button>
                  );
                })}
                <button
                  onClick={() => {
                    setShowWriteIn(true);
                    setHasRepositioned(false);
                    setOrderedItems([...orderedStances.map((s) => s.id), "write-in"]);
                    if (!writeInHintShown) {
                      localStorage.setItem("onboarding_writeInHint", "1");
                      setWriteInHintShown(true);
                    }
                  }}
                  className="text-left px-3 py-2.5 md:py-[clamp(0.375rem,1.05vh,0.625rem)] rounded-lg transition-all duration-200 text-sm md:text-[clamp(0.8125rem,1.5vh,0.875rem)] leading-snug font-medium cursor-pointer"
                  style={{ border: `2px dashed ${t.writeOwnColor}`, color: t.writeOwnColor, background: 'transparent' }}
                >
                  Write your own...
                </button>
                {currentIndex === 0 && !writeInHintShown && !showWriteIn && (
                  <p className="text-xs text-center mt-1" style={{ color: t.textMuted }}>
                    You can always write your own stance if none of these fit
                  </p>
                )}
              </>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                modifiers={[restrictToVerticalAxis]}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={orderedItems}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="flex flex-col gap-1.5">
                    {orderedItems.map((itemId) =>
                      itemId === "write-in" ? (
                        <SortableWriteInCard
                          key="write-in"
                          id="write-in"
                          text={writeInText}
                          onChange={handleWriteInTextChange}
                          onCancel={handleCancelWriteIn}
                          showHint={!!writeInText.trim() && !hasRepositioned}
                          isDark={isDark}
                        />
                      ) : (
                        <SortableStanceLabel
                          key={itemId}
                          id={itemId}
                          text={orderedStances.find((s) => s.id === itemId)?.text ?? ""}
                          isDark={isDark}
                        />
                      )
                    )}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>

        {/* Footer nav */}
        <div
          className="sticky bottom-0 px-4 py-3 shrink-0"
          style={{
            background: t.stickyBg,
            borderTop: `1px solid ${t.border}`,
          }}
        >
          <div className="flex justify-between items-center max-w-2xl mx-auto">
            <button
              onClick={handleBack}
              className="px-5 py-2 rounded-full border text-sm font-medium transition-colors cursor-pointer"
              style={{
                borderColor: t.border,
                color: t.textBody,
                background: 'transparent',
              }}
            >
              Back
            </button>
            <button
              onClick={isLastUnanswered ? handleFinish : handleNext}
              disabled={lensApplied && !selectedAnswer}
              className="px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              style={
                selectedAnswer
                  ? { background: t.btnBg, color: t.btnText }
                  : { background: t.cardElev, color: t.textMuted }
              }
            >
              {isLastUnanswered ? "Finish" : selectedAnswer ? "Next" : "Skip"}
            </button>
          </div>
        </div>

      </div>
    );
  }

  // ============================
  // STEP: COMPLETE
  // ============================
  if (step === "complete") {
    return (
      <div
        className={`fixed ${overlayTop} left-0 right-0 bottom-0 z-50 overflow-y-auto flex flex-col`}
        style={{ background: t.bg }}
      >
        {/* Dark toggle */}
        <div className="absolute top-4 right-4 z-10">
          <DarkToggle />
        </div>

        <div className="flex flex-col lg:flex-row min-h-full">

          {/* Left: compass */}
          <div className="flex flex-col items-center justify-center px-4 py-6 lg:py-6 lg:w-1/2 lg:pl-8">
            <div className="w-full max-w-[min(calc(50vw-2rem),calc(100vh-110px))] mx-auto">
              <RadarChart
                data={chartData}
                invertedSpokes={invertedSpokes}
                writeIns={writeIns}
                darkMode={isDark}
                onToggleInversion={(topic) =>
                  setInvertedSpokes((prev) => ({ ...prev, [topic]: !prev[topic] }))
                }
              />
            </div>
          </div>

          {/* Right: copy + CTA */}
          <div className="flex flex-col justify-center px-8 pb-8 lg:py-8 lg:w-1/2 lg:pr-16 lg:pl-8">

            <p
              className="text-xs font-bold tracking-widest uppercase mb-4"
              style={{ color: t.textAccent }}
            >
              Step 3 — Compare &amp; Discover
            </p>

            <h1
              className="text-3xl md:text-4xl lg:text-5xl font-extrabold leading-tight mb-4"
              style={{ color: t.textHead, letterSpacing: '-0.025em' }}
            >
              Your compass is ready.
            </h1>

            <p
              className="text-base md:text-lg leading-relaxed mb-3 max-w-md"
              style={{ color: t.textBody }}
            >
              Now comes the interesting part — see how your priorities actually compare to the politicians asking for your vote.
            </p>

            <p
              className="text-sm leading-relaxed mb-8 max-w-sm"
              style={{ color: t.textMuted }}
            >
              You can refine any stance from the Library at any time. Your compass is always yours to adjust.
            </p>

            <button
              onClick={() => {
                localStorage.removeItem(STORAGE_KEY);
                handleComplete();
              }}
              className="w-full sm:w-auto px-8 py-3.5 rounded-full font-bold text-base transition-all hover:opacity-90 active:scale-95 cursor-pointer shadow-md"
              style={{ background: t.yellow, color: '#1C1C1C' }}
            >
              Compare &amp; Discover →
            </button>
          </div>

        </div>
      </div>
    );
  }

  // Fallback (loading / initializing)
  return (
    <div
      className={`fixed ${overlayTop} left-0 right-0 bottom-0 z-50 flex items-center justify-center`}
      style={{ background: t.bg }}
    >
      <p style={{ color: t.textMuted }}>Loading...</p>
    </div>
  );
}
