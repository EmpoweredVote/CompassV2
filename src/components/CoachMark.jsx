// CoachMark.jsx
// Reusable spotlight overlay system for guided tours and contextual hints.
// Renders via createPortal above all content at z-index 60+.
import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

/**
 * useCoachMark — persists dismiss state to localStorage.
 *
 * @param {string} storageKey - Unique key for this hint
 * @returns {{ show: boolean, dismiss: () => void }}
 */
export function useCoachMark(storageKey) {
  const [dismissed, setDismissed] = useState(
    () => !!localStorage.getItem(storageKey)
  );
  const dismiss = useCallback(() => {
    localStorage.setItem(storageKey, "1");
    setDismissed(true);
  }, [storageKey]);
  return { show: !dismissed, dismiss };
}

// Padding around the spotlight cutout (px)
const SPOTLIGHT_PADDING = 8;
// Border radius of the cutout (px)
const CUTOUT_RADIUS = 8;
// Tooltip width (px) for positioning calculation
const TOOLTIP_WIDTH = 280;
// Tooltip approximate height (px) for positioning calculation
// Keep this generous — the below/above fallback logic depends on it being
// at least as tall as the tallest tooltip (long messages, links, buttons).
const TOOLTIP_HEIGHT = 180;
// Minimum gap between tooltip and viewport edge (px)
const VIEWPORT_MARGIN = 12;

const PLACEMENT_ORDER = ["below", "above", "right", "left"];

/**
 * Calculate the best tooltip position relative to the spotlight rect.
 * Tries below, above, right, then left, taking the first that fits on screen.
 * `prefer` moves one placement to the front — use it when a side matters (a
 * tall panel whose controls the card must not cover), with the rest of the
 * order kept as the fallback if it doesn't fit.
 */
function calcTooltipPosition(rect, vpWidth, vpHeight, tipH = TOOLTIP_HEIGHT, prefer = null) {
  const cutoutTop = rect.top - SPOTLIGHT_PADDING;
  const cutoutBottom = rect.bottom + SPOTLIGHT_PADDING;
  const cutoutLeft = rect.left - SPOTLIGHT_PADDING;
  const cutoutRight = rect.right + SPOTLIGHT_PADDING;
  const cutoutCenterX = (cutoutLeft + cutoutRight) / 2;

  const centeredLeft = Math.min(
    Math.max(cutoutCenterX - TOOLTIP_WIDTH / 2, VIEWPORT_MARGIN),
    vpWidth - TOOLTIP_WIDTH - VIEWPORT_MARGIN
  );
  const sideTop = Math.min(
    Math.max(rect.top, VIEWPORT_MARGIN),
    vpHeight - tipH - VIEWPORT_MARGIN
  );

  const fit = {
    below: () => {
      const top = cutoutBottom + 12;
      return top + tipH < vpHeight - VIEWPORT_MARGIN
        ? { top, left: centeredLeft, placement: "below" }
        : null;
    },
    above: () => {
      const top = cutoutTop - tipH - 12;
      return top > VIEWPORT_MARGIN
        ? { top, left: centeredLeft, placement: "above" }
        : null;
    },
    right: () => {
      const left = cutoutRight + 12;
      return left + TOOLTIP_WIDTH < vpWidth - VIEWPORT_MARGIN
        ? { top: sideTop, left, placement: "right" }
        : null;
    },
    left: () => {
      const left = cutoutLeft - TOOLTIP_WIDTH - 12;
      return left > VIEWPORT_MARGIN
        ? { top: sideTop, left, placement: "left" }
        : null;
    },
  };

  const order = prefer
    ? [prefer, ...PLACEMENT_ORDER.filter((k) => k !== prefer)]
    : PLACEMENT_ORDER;
  for (const key of order) {
    const hit = fit[key]?.();
    if (hit) return hit;
  }

  // Nothing fits cleanly — clamp inside the left edge rather than run off it.
  return { top: sideTop, left: VIEWPORT_MARGIN, placement: "left" };
}

/**
 * Build an SVG mask definition string for the overlay.
 * The mask covers the full viewport with a transparent rectangle cut out around the target.
 */
function buildClipPath(rect, vpWidth, vpHeight) {
  const top = Math.max(0, rect.top - SPOTLIGHT_PADDING);
  const left = Math.max(0, rect.left - SPOTLIGHT_PADDING);
  const right = Math.min(vpWidth, rect.right + SPOTLIGHT_PADDING);
  const bottom = Math.min(vpHeight, rect.bottom + SPOTLIGHT_PADDING);
  return { top, left, right, bottom };
}

/**
 * Caret arrow SVG pointing toward the spotlight.
 * placement: "below" → caret points up (above tooltip)
 *            "above" → caret points down
 *            "right" → caret points left
 *            "left"  → caret points right
 */
function Caret({ placement, fill }) {
  // Themed callers pass an explicit fill; untouched callers keep the original
  // white / zinc tooltip color via Tailwind.
  const commonCls = fill
    ? "absolute w-4 h-4 drop-shadow-sm"
    : "absolute w-4 h-4 fill-white dark:fill-zinc-800 drop-shadow-sm";
  const fillStyle = fill ? { fill } : undefined;
  if (placement === "below") {
    // caret at top-center of tooltip pointing up
    return (
      <svg
        className={commonCls}
        style={{ ...fillStyle, top: -12, left: "50%", transform: "translateX(-50%)" }}
        viewBox="0 0 16 8"
      >
        <polygon points="8,0 16,8 0,8" />
      </svg>
    );
  }
  if (placement === "above") {
    // caret at bottom-center of tooltip pointing down
    return (
      <svg
        className={commonCls}
        style={{ ...fillStyle, bottom: -12, left: "50%", transform: "translateX(-50%)" }}
        viewBox="0 0 16 8"
      >
        <polygon points="0,0 16,0 8,8" />
      </svg>
    );
  }
  if (placement === "right") {
    // caret on left side of tooltip pointing left
    return (
      <svg
        className={commonCls}
        style={{ ...fillStyle, left: -12, top: "50%", transform: "translateY(-50%)" }}
        viewBox="0 0 8 16"
      >
        <polygon points="8,0 8,16 0,8" />
      </svg>
    );
  }
  // "left" → caret on right side of tooltip pointing right
  return (
    <svg
      className={commonCls}
      style={{ ...fillStyle, right: -12, top: "50%", transform: "translateY(-50%)" }}
      viewBox="0 0 8 16"
    >
      <polygon points="0,0 0,16 8,8" />
    </svg>
  );
}


/**
 * CoachMark — Figma/Notion-style immersive spotlight overlay.
 *
 * @param {Object} props
 * @param {React.RefObject} props.targetRef - Ref to the element to spotlight
 * @param {React.ReactNode|string} [props.message] - Tooltip content (also accepts children)
 * @param {React.ReactNode} [props.children] - Alias for message
 * @param {Function} [props.onDismiss] - Called on "Got it" (single hint mode)
 * @param {Function} [props.onNext] - Called on "Next" (tour mode; presence enables tour UI)
 * @param {Function} [props.onSkipAll] - Called on "Skip All" (tour mode)
 * @param {string} [props.stepLabel] - e.g. "1 of 4" shown in tour mode
 * @param {string} [props.headline] - Bold title above the body copy
 * @param {string} [props.primaryLabel] - Overrides the primary button's text
 * @param {boolean} [props.showSkipAll] - Hide the skip affordance on a final step
 * @param {"center"|"start"} [props.scrollAlign] - How to bring the target into
 *   view. "center" suits a control; "start" suits a region taller than the
 *   viewport, where centering would scroll past the part being framed.
 * @param {boolean} [props.show] - Controls visibility
 */
export default function CoachMark({
  targetRef,
  message,
  children,
  onDismiss,
  onNext,
  onSkipAll,
  stepLabel,
  headline,
  primaryLabel,
  showSkipAll = true,
  scrollAlign = "center",
  show = true,
  allowSpotlightInteraction = false,
  preferPlacement = null,
  theme = null,
  accent = null,
}) {
  const [rect, setRect] = useState(null);
  const [vpSize, setVpSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  const observerRef = useRef(null);

  const measureTarget = useCallback(() => {
    if (!targetRef?.current) return;
    const r = targetRef.current.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, right: r.right, bottom: r.bottom });
    setVpSize({ w: window.innerWidth, h: window.innerHeight });
  }, [targetRef]);

  // Scroll target into view if off-screen, then measure
  useEffect(() => {
    if (!show || !targetRef?.current) return;

    const el = targetRef.current;
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const isOffScreen =
      r.bottom < 0 || r.top > vh ||
      r.right < 0 || r.left > window.innerWidth;

    // A region taller than the viewport is never fully off-screen once its
    // lower half scrolls in, so the test above can't see that the user is
    // looking at the wrong end of it. For "start" targets the top edge is what
    // matters — that's where the spotlight begins — so bring it into view
    // whenever it has scrolled out of the upper half.
    const topOutOfView =
      scrollAlign === "start" && (r.top < 0 || r.top > vh * 0.5);

    if (isOffScreen || topOutOfView) {
      el.scrollIntoView({ behavior: "smooth", block: scrollAlign });
    }
  }, [show, targetRef, stepLabel, scrollAlign]);

  // Measure on mount and whenever the target element resizes
  useEffect(() => {
    if (!show) return;

    // Small delay to let any scrollIntoView settle before first measurement
    const measureDelay = setTimeout(measureTarget, 80);

    // ResizeObserver on the target element
    if (targetRef?.current && typeof ResizeObserver !== "undefined") {
      observerRef.current = new ResizeObserver(measureTarget);
      observerRef.current.observe(targetRef.current);
    }

    // Also update on scroll / window resize
    window.addEventListener("resize", measureTarget, { passive: true });
    window.addEventListener("scroll", measureTarget, { passive: true, capture: true });

    return () => {
      clearTimeout(measureDelay);
      observerRef.current?.disconnect();
      window.removeEventListener("resize", measureTarget);
      window.removeEventListener("scroll", measureTarget, { capture: true });
    };
  }, [show, measureTarget, targetRef, stepLabel]);

  // Escape key dismisses the coachmark
  useEffect(() => {
    if (!show) return;
    const handler = (e) => {
      if (e.key === "Escape") {
        if (onNext && onSkipAll) onSkipAll();
        else if (onDismiss) onDismiss();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [show, onNext, onSkipAll, onDismiss]);

  const isTourMode = typeof onNext === "function";
  const content = children ?? message;
  const { w: vpW, h: vpH } = vpSize;

  // Derive spotlight and tooltip positions from the measured rect
  let cutout = null;
  let tooltipPos = null;
  let placement = "below";
  if (rect) {
    cutout = buildClipPath(rect, vpW, vpH);
    const pos = calcTooltipPosition(rect, vpW, vpH, TOOLTIP_HEIGHT, preferPlacement);
    // Hard-clamp so the tooltip never overflows the viewport bottom,
    // even if TOOLTIP_HEIGHT underestimates the actual rendered height.
    tooltipPos = {
      ...pos,
      top: Math.min(pos.top, vpH - TOOLTIP_HEIGHT - VIEWPORT_MARGIN),
    };
    placement = pos.placement;
  }

  // When allowSpotlightInteraction is true we render 4 separate dim
  // rectangles around the cutout so the spotlight area has NO overlay
  // and real pointer events pass through to the page elements.
  // When false we use the original single-div + SVG-mask approach.
  const renderBackdrop = () => {
    if (!cutout) {
      // No rect yet — dim whole screen
      return (
        <motion.div
          key="coach-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0"
          style={{ zIndex: 60 }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="absolute inset-0 bg-black/60" />
        </motion.div>
      );
    }

    if (allowSpotlightInteraction) {
      // 4-rect approach: top, bottom, left, right strips around the cutout.
      // The spotlight area is completely uncovered — real clicks pass through.
      const dimStyle = "bg-black/60";
      return (
        <motion.div
          key="coach-backdrop-interactive"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {/* Top strip: full width, from viewport top to cutout top */}
          <div
            className={`fixed ${dimStyle}`}
            style={{ zIndex: 60, top: 0, left: 0, right: 0, height: cutout.top }}
            onPointerDown={(e) => e.stopPropagation()}
          />
          {/* Bottom strip: full width, from cutout bottom to viewport bottom */}
          <div
            className={`fixed ${dimStyle}`}
            style={{ zIndex: 60, top: cutout.bottom, left: 0, right: 0, bottom: 0 }}
            onPointerDown={(e) => e.stopPropagation()}
          />
          {/* Left strip: between top and bottom strips, from left edge to cutout left */}
          <div
            className={`fixed ${dimStyle}`}
            style={{ zIndex: 60, top: cutout.top, left: 0, width: cutout.left, height: cutout.bottom - cutout.top }}
            onPointerDown={(e) => e.stopPropagation()}
          />
          {/* Right strip: between top and bottom strips, from cutout right to right edge */}
          <div
            className={`fixed ${dimStyle}`}
            style={{ zIndex: 60, top: cutout.top, left: cutout.right, right: 0, height: cutout.bottom - cutout.top }}
            onPointerDown={(e) => e.stopPropagation()}
          />
        </motion.div>
      );
    }

    // Default: single overlay with SVG mask cutout (blocks all clicks)
    return (
      <motion.div
        key="coach-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0"
        style={{ zIndex: 60 }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <svg
          width={vpW}
          height={vpH}
          style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
        >
          <defs>
            <mask id="coach-spotlight-mask">
              <rect width={vpW} height={vpH} fill="white" />
              <rect
                x={cutout.left}
                y={cutout.top}
                width={cutout.right - cutout.left}
                height={cutout.bottom - cutout.top}
                rx={CUTOUT_RADIUS}
                ry={CUTOUT_RADIUS}
                fill="black"
              />
            </mask>
          </defs>
          <rect
            width={vpW}
            height={vpH}
            fill="rgba(0,0,0,0.6)"
            mask="url(#coach-spotlight-mask)"
          />
        </svg>
      </motion.div>
    );
  };

  // Accent used for the eyebrow and primary action in themed mode. Falls back
  // to the theme's own accent when the caller doesn't pin one to a slide color.
  const tint = accent || theme?.textAccent;
  const primaryCls = theme
    ? "px-5 py-2 text-sm font-bold rounded-full transition-all hover:opacity-90 active:scale-95 cursor-pointer shadow-md"
    : "px-5 py-2 bg-black text-white text-sm font-semibold rounded-full hover:opacity-80 transition-opacity cursor-pointer";
  const primaryStyle = theme ? { background: tint, color: "#FFFFFF" } : undefined;

  const overlay = (
    <AnimatePresence>
      {show && (
        <>
          {renderBackdrop()}

          {tooltipPos && (
            <motion.div
              key="coach-tooltip"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              style={{
                position: "fixed",
                top: tooltipPos.top,
                left: tooltipPos.left,
                width: TOOLTIP_WIDTH,
                zIndex: 61,
                ...(theme
                  ? {
                      background: theme.card,
                      border: `1px solid ${theme.border}`,
                    }
                  : {}),
              }}
              className={
                theme
                  ? "rounded-3xl shadow-xl px-5 py-4"
                  : "bg-white dark:bg-zinc-800 rounded-2xl shadow-xl px-5 py-4"
              }
            >
              <Caret placement={placement} fill={theme?.card} />

              {stepLabel && (
                theme ? (
                  <p
                    className="text-xs font-bold tracking-widest uppercase mb-2 select-none"
                    style={{ color: tint }}
                  >
                    {stepLabel}
                  </p>
                ) : (
                  <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-1 select-none">
                    {stepLabel}
                  </p>
                )
              )}

              {headline && (
                <p
                  className={
                    theme
                      ? "text-base font-bold leading-snug mb-1.5"
                      : "text-gray-900 dark:text-white text-base font-bold leading-snug mb-1.5"
                  }
                  style={theme ? { color: theme.textHead } : undefined}
                >
                  {headline}
                </p>
              )}

              <div
                className={
                  theme
                    ? "text-sm leading-relaxed mb-4"
                    : "text-gray-800 dark:text-gray-200 text-sm leading-snug mb-4"
                }
                style={theme ? { color: theme.textBody } : undefined}
              >
                {content}
              </div>

              <div className="flex items-center justify-between gap-3">
                {isTourMode && showSkipAll ? (
                  <button
                    onClick={onSkipAll}
                    className={
                      theme
                        ? "text-sm font-semibold px-1 transition-opacity hover:opacity-70 cursor-pointer"
                        : "text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer"
                    }
                    style={theme ? { color: theme.textMuted } : undefined}
                  >
                    Skip all
                  </button>
                ) : (
                  <span />
                )}

                <button
                  onClick={() => (onNext || onDismiss)?.()}
                  className={primaryCls}
                  style={primaryStyle}
                >
                  {primaryLabel ?? (isTourMode ? "Next →" : "Got it")}
                </button>
              </div>
            </motion.div>
          )}
        </>
      )}
    </AnimatePresence>
  );

  return createPortal(overlay, document.body);
}
