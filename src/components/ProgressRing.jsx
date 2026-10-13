/**
 * A tiny donut for "how far through this lens are you".
 *
 * Sized to sit inside an 11px chip beside the lens icon, so it is drawn with a
 * stroke rather than text: at this size a fraction would be unreadable and a
 * percentage would be two more characters on a row that already wraps. The
 * number still reaches everyone — the chip carries it in its `title`, and the
 * ring is `aria-hidden` so a screen reader gets that sentence instead of a
 * shape it cannot describe.
 */
export default function ProgressRing({ pct, color, trackColor, complete, size = 12 }) {
  const r = (size - 2) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, Number(pct) || 0));

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="flex-none"
      aria-hidden="true"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={trackColor ?? color}
        strokeOpacity={trackColor ? 1 : 0.28}
        strokeWidth="2"
      />
      {clamped > 0 && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={`${(c * clamped) / 100} ${c}`}
          // Start the arc at twelve o'clock. Without this it starts at three,
          // which reads as a partly-eaten ring rather than a filling one.
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      )}
      {complete && (
        <path
          d={`M${size * 0.3} ${size * 0.52} l${size * 0.14} ${size * 0.14} l${size * 0.26} -${size * 0.28}`}
          fill="none"
          stroke={color}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
