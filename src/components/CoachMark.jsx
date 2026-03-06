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
const TOOLTIP_HEIGHT = 140;
// Minimum gap between tooltip and viewport edge (px)
const VIEWPORT_MARGIN = 12;

/**
 * Calculate the best tooltip position relative to the spotlight rect.
 * Prefers below, falls back to above, left, right.
 */
function calcTooltipPosition(rect, vpWidth, vpHeight) {
  const cutoutTop = rect.top - SPOTLIGHT_PADDING;
  const cutoutBottom = rect.bottom + SPOTLIGHT_PADDING;
  const cutoutLeft = rect.left - SPOTLIGHT_PADDING;
  const cutoutRight = rect.right + SPOTLIGHT_PADDING;
  const cutoutCenterX = (cutoutLeft + cutoutRight) / 2;

  // Preferred: below
  const belowTop = cutoutBottom + 12;
  const belowLeft = Math.min(
    Math.max(cutoutCenterX - TOOLTIP_WIDTH / 2, VIEWPORT_MARGIN),
    vpWidth - TOOLTIP_WIDTH - VIEWPORT_MARGIN
  );
  if (belowTop + TOOLTIP_HEIGHT < vpHeight - VIEWPORT_MARGIN) {
    return { top: belowTop, left: belowLeft, placement: "below" };
  }

  // Fallback: above
  const aboveTop = cutoutTop - TOOLTIP_HEIGHT - 12;
  if (aboveTop > VIEWPORT_MARGIN) {
    return {
      top: Math.max(aboveTop, VIEWPORT_MARGIN),
      left: belowLeft,
      placement: "above",
    };
  }

  // Fallback: right
  const rightLeft = cutoutRight + 12;
  const sideTop = Math.min(
    Math.max(rect.top, VIEWPORT_MARGIN),
    vpHeight - TOOLTIP_HEIGHT - VIEWPORT_MARGIN
  );
  if (rightLeft + TOOLTIP_WIDTH < vpWidth - VIEWPORT_MARGIN) {
    return { top: sideTop, left: rightLeft, placement: "right" };
  }

  // Fallback: left
  const leftLeft = cutoutLeft - TOOLTIP_WIDTH - 12;
  return {
    top: sideTop,
    left: Math.max(leftLeft, VIEWPORT_MARGIN),
    placement: "left",
  };
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
function Caret({ placement }) {
  const commonCls = "absolute w-4 h-4 fill-white drop-shadow-sm";
  if (placement === "below") {
    // caret at top-center of tooltip pointing up
    return (
      <svg
        className={commonCls}
        style={{ top: -12, left: "50%", transform: "translateX(-50%)" }}
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
        style={{ bottom: -12, left: "50%", transform: "translateX(-50%)" }}
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
        style={{ left: -12, top: "50%", transform: "translateY(-50%)" }}
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
      style={{ right: -12, top: "50%", transform: "translateY(-50%)" }}
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
  show = true,
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

  // Measure on mount and whenever the target element resizes
  useEffect(() => {
    if (!show) return;
    measureTarget();

    // ResizeObserver on the target element
    if (targetRef?.current && typeof ResizeObserver !== "undefined") {
      observerRef.current = new ResizeObserver(measureTarget);
      observerRef.current.observe(targetRef.current);
    }

    // Also update on scroll / window resize
    window.addEventListener("resize", measureTarget, { passive: true });
    window.addEventListener("scroll", measureTarget, { passive: true, capture: true });

    return () => {
      observerRef.current?.disconnect();
      window.removeEventListener("resize", measureTarget);
      window.removeEventListener("scroll", measureTarget, { capture: true });
    };
  }, [show, measureTarget, targetRef]);

  const isTourMode = typeof onNext === "function";
  const content = children ?? message;
  const { w: vpW, h: vpH } = vpSize;

  // Derive spotlight and tooltip positions from the measured rect
  let cutout = null;
  let tooltipPos = null;
  let placement = "below";
  if (rect) {
    cutout = buildClipPath(rect, vpW, vpH);
    const pos = calcTooltipPosition(rect, vpW, vpH);
    tooltipPos = pos;
    placement = pos.placement;
  }

  const overlay = (
    <AnimatePresence>
      {show && (
        <>
          {/* Backdrop — blocks interaction outside spotlight */}
          <motion.div
            key="coach-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0"
            style={{ zIndex: 60 }}
            // Block pointer events on overlay (not on cutout area)
            onPointerDown={(e) => e.stopPropagation()}
          >
            {/* SVG overlay with hole cut out for the spotlight */}
            {cutout ? (
              <svg
                width={vpW}
                height={vpH}
                style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
              >
                <defs>
                  <mask id="coach-spotlight-mask">
                    {/* Full white rectangle = fully masked (dimmed) */}
                    <rect width={vpW} height={vpH} fill="white" />
                    {/* Black rounded rect = transparent cutout (spotlight) */}
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
            ) : (
              /* No rect yet — dim whole screen */
              <div className="absolute inset-0 bg-black/60" />
            )}
          </motion.div>

          {/* Tooltip card */}
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
              }}
              className="bg-white rounded-2xl shadow-xl px-5 py-4"
            >
              {/* Caret arrow pointing toward spotlight */}
              <Caret placement={placement} />

              {/* Step label (tour mode) */}
              {stepLabel && (
                <p className="text-xs font-medium text-gray-400 mb-1 select-none">
                  {stepLabel}
                </p>
              )}

              {/* Content */}
              <div className="text-gray-800 text-sm leading-snug mb-4">
                {content}
              </div>

              {/* Action buttons */}
              {isTourMode ? (
                <div className="flex items-center justify-between gap-3">
                  <button
                    onClick={onSkipAll}
                    className="text-sm text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                  >
                    Skip All
                  </button>
                  <button
                    onClick={onNext}
                    className="px-5 py-2 bg-black text-white text-sm font-semibold rounded-full hover:opacity-80 transition-opacity cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              ) : (
                <div className="flex justify-end">
                  <button
                    onClick={onDismiss}
                    className="px-5 py-2 bg-black text-white text-sm font-semibold rounded-full hover:opacity-80 transition-opacity cursor-pointer"
                  >
                    Got it
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </>
      )}
    </AnimatePresence>
  );

  return createPortal(overlay, document.body);
}
