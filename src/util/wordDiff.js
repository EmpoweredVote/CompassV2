/**
 * Word-level diff for compass revision review (ADR 0004 §9).
 *
 * WHY THIS IS COMPUTED IN THE BROWSER
 * Revisions are stored as full snapshots, so a diff is a pure function of two
 * strings. Nothing about it needs to be persisted, and computing it here keeps
 * the API free of presentation decisions.
 *
 * WHY WORD-LEVEL AND NOT CHARACTER-LEVEL
 * A character diff on prose produces confetti — it marks the shared letters
 * inside two different words. Reviewers are reading sentences, so the unit is a
 * word.
 *
 * WHAT THIS DELIBERATELY DOES NOT DECIDE
 * Whether a rung was *reworded* or *replaced* is a semantic question a text
 * differ cannot answer: if every word changed, the two are identical to it. That
 * comes from `rung_map` on the server. This function is only asked to diff pairs
 * the caller has already decided are rewordings.
 */

/** Split into words and whitespace runs, so joining the tokens restores the input exactly. */
export function tokenize(s) {
  return (s ?? '').match(/\s+|\S+/g) ?? [];
}

/**
 * Longest-common-subsequence diff over word tokens.
 * Returns [{ type: 'same' | 'ins' | 'del', text }], with adjacent runs merged.
 *
 * `ins` = present in `next` only. `del` = present in `prev` only.
 */
export function diffWords(prev, next) {
  const A = tokenize(prev);
  const B = tokenize(next);
  const n = A.length;
  const m = B.length;

  if (n === 0 && m === 0) return [];

  // A stance rung is a sentence, so the DP table is tiny. Guard anyway: a
  // pathological input should degrade to a block-level replace rather than
  // allocating hundreds of megabytes and freezing the reviewer's tab.
  if (n * m > 400000) {
    const out = [];
    if (prev) out.push({ type: 'del', text: prev });
    if (next) out.push({ type: 'ins', text: next });
    return out;
  }

  // dp[i][j] = LCS length of A[i..] and B[j..]
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const out = [];
  const push = (type, text) => {
    const last = out[out.length - 1];
    if (last && last.type === type) last.text += text;
    else out.push({ type, text });
  };

  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) {
      push('same', A[i]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      push('del', A[i]);
      i++;
    } else {
      push('ins', B[j]);
      j++;
    }
  }
  while (i < n) push('del', A[i++]);
  while (j < m) push('ins', B[j++]);

  return out;
}

/** True when the two strings differ once whitespace runs are normalised. */
export function hasChanged(prev, next) {
  const norm = (s) => (s ?? '').replace(/\s+/g, ' ').trim();
  return norm(prev) !== norm(next);
}
