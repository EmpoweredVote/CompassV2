# Compass Min / Max Buttons

These two small buttons appear beside the radar chart during the **Answer step** of Compass Construction (top-right corner of the chart, roughly the 2 o'clock position).

---

## Background: stored values vs. display values

Every answered topic has a **stored value** of 1–5, where:

- **1** = center ring (mild/moderate on that topic)
- **5** = outer ring (strong/committed on that topic)

Because the radar chart is a circle, each spoke can point in either direction. The direction a spoke points is called its **inversion state** and is randomly assigned when topics are first picked — it is purely cosmetic. For example, a spoke representing "Gun Policy" might point toward 12 o'clock or toward 6 o'clock; neither direction means "liberal" or "conservative." The label on the chart always makes clear what the two ends represent.

This means the same stored value can **display** at different ring positions depending on whether the spoke is inverted:

| Stored value | Not inverted → displays at | Inverted → displays at |
|---|---|---|
| 1 | Ring 1 (center) | Ring 5 (outer) |
| 2 | Ring 2 | Ring 4 |
| 3 | Ring 3 (middle) | Ring 3 (middle) |
| 4 | Ring 4 | Ring 2 |
| 5 | Ring 5 (outer) | Ring 1 (center) |

The formula is: `display = inverted ? (6 − stored) : stored`

**Stored values never change** when inversion is toggled. Only the visual direction of the spoke changes.

---

## What the buttons do

### Stance Max  ⊞  (expand / outward arrows icon)

**"Push all weak-looking spokes outward."**

Looks at every answered topic on the current compass. For any spoke whose **display value is 1 or 2** (sitting close to the center), it flips that spoke's inversion so the dot moves to the outer side (display value 4 or 5).

Spokes already at display 3, 4, or 5 are left untouched.

**Result:** the shape of the compass expands — spokes that were hugging the center get pushed out to the edge. The chart looks fuller and more spread out.

**Example:**

| Topic | Stored | Before (display) | After (display) |
|---|---|---|---|
| Climate | 2 | 2 → **flipped to 4** | 4 |
| Healthcare | 4 | 4 → unchanged | 4 |
| Gun Policy | 1 | 1 → **flipped to 5** | 5 |
| Immigration | 3 | 3 → unchanged | 3 |

---

### Stance Min  ⊟  (collapse / inward arrows icon)

**"Pull all strong-looking spokes inward."**

The mirror of Stance Max. For any spoke whose **display value is 4 or 5** (sitting near the outer edge), it flips that spoke's inversion so the dot moves inward (display value 1 or 2).

Spokes at display 1, 2, or 3 are left untouched.

**Result:** the compass shape shrinks — spokes that were extending far outward get pulled in. The chart looks tighter and more compact.

**Example:**

| Topic | Stored | Before (display) | After (display) |
|---|---|---|---|
| Climate | 4 | 4 → **flipped to 2** | 2 |
| Healthcare | 2 | 2 → unchanged | 2 |
| Gun Policy | 5 | 5 → **flipped to 1** | 1 |
| Immigration | 3 | 3 → unchanged | 3 |

---

## What these buttons do NOT do

- They do **not** change the user's answers. Stored values (1–5) are never modified.
- They do **not** encode any political direction. A spoke at ring 5 is not "more conservative" or "more progressive" — it just means the user has a strong position on that topic, whatever it is.
- They do **not** affect unanswered topics (topics with no stored value are skipped).
- They are **not** permanent calibration choices. Inversion state can be toggled freely at any time, including per-spoke by clicking a spoke label directly on the chart.

---

## When would a user use these?

**Stance Max** is useful when a user has answered many topics with mid-to-low stored values (1–2) and the compass looks like a small, tight shape near the center. Max lets them quickly reorient all those spokes outward so the chart is easier to read and visually distinguishable.

**Stance Min** is the inverse: if the chart looks busy with every spoke at the outer edge and the user wants a cleaner, more compact view, Min pulls the strong-looking spokes back in.

Both buttons are quality-of-life tools for shaping the compass visualization. They have no effect on how the user's positions compare against politicians, since comparison logic uses stored values, not display values.
