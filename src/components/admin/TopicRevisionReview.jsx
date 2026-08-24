/**
 * TopicRevisionReview — the review surface (ADR 0004 §7).
 *
 * WHAT A REVIEWER SEES, AND WHAT THEY NEVER SEE
 * Four people hold the Compass Stance Editor role and they are mostly
 * non-technical. So this renders PROSE: the current wording and the proposed
 * wording, with the differences marked. No YAML, no SQL, no JSON blobs, no ids.
 *
 * Migration 061 shipped a review screen that was never used once. Its fatal flaw
 * was asking the reviewer to type a title, a question and a stances JSONB blob
 * into a form. There is no authoring form here at all — drafts arrive from the
 * author's own tooling. This screen only reads, and approves.
 *
 * HIGHLIGHT, NOT BOLD
 * On a dark ground extra font weight reads mostly as extra brightness, so the
 * gap between regular and bold nearly disappears. Changes get a background
 * highlight instead, which does not depend on weight.
 *
 * AND NEVER HIGHLIGHT ALONE
 * Colour by itself fails for colourblind and low-vision readers and vanishes
 * completely for a screen reader. So changes are real <ins> and <del> elements —
 * which announce themselves as "insertion" and "deletion" — with the highlight
 * and the strike-through as the visible layer on top. Removing the colour would
 * degrade this, not break it.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchReviewQueue,
  fetchRevision,
  approveRevision,
  rejectRevision,
  publishRevision,
} from '../../lib/revisionApi';
import { diffWords, hasChanged } from '../../util/wordDiff';

// ---------------------------------------------------------------------------
// Diff rendering
// ---------------------------------------------------------------------------

const INS_CLASS =
  'bg-amber-200/80 text-zinc-900 underline decoration-amber-700 decoration-1 ' +
  'underline-offset-2 rounded-sm px-0.5 dark:bg-amber-500/30 dark:text-amber-50 ' +
  'dark:decoration-amber-400';

const DEL_CLASS =
  'line-through decoration-1 text-zinc-500 dark:text-zinc-400 px-0.5';

/** Inline word-level diff. Used only for rungs the server marked as reworded. */
function InlineDiff({ prev, next }) {
  const parts = useMemo(() => diffWords(prev, next), [prev, next]);
  return (
    <span>
      {parts.map((p, i) => {
        if (p.type === 'ins') return <ins key={i} className={INS_CLASS}>{p.text}</ins>;
        if (p.type === 'del') return <del key={i} className={DEL_CLASS}>{p.text}</del>;
        return <span key={i}>{p.text}</span>;
      })}
    </span>
  );
}

/**
 * Old and new as whole blocks. Used when the server says the rung was REPLACED —
 * marking word by word would be noise when nothing survived.
 */
function BlockReplace({ prev, next }) {
  return (
    <span className="flex flex-col gap-1">
      {prev ? (
        <del className={`${DEL_CLASS} block`}>{prev}</del>
      ) : (
        <span className="text-sm italic text-zinc-500 dark:text-zinc-400">
          (nothing here before)
        </span>
      )}
      {next ? (
        <ins className={`${INS_CLASS} block`}>{next}</ins>
      ) : (
        <span className="text-sm italic text-zinc-500 dark:text-zinc-400">
          (this option is being removed)
        </span>
      )}
    </span>
  );
}

/** One field (title, short title, question) rendered as prose with changes marked. */
function FieldDiff({ label, prev, next }) {
  const changed = hasChanged(prev, next);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {label}
        </span>
        {!changed && (
          <span className="text-xs text-zinc-400 dark:text-zinc-500">unchanged</span>
        )}
      </div>
      <p className="leading-relaxed">
        {changed ? <InlineDiff prev={prev} next={next} /> : <span>{next || prev || '—'}</span>}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rung table
// ---------------------------------------------------------------------------

const DISPOSITION_LABEL = {
  unchanged: 'unchanged',
  reworded: 'reworded',
  moved: 'moved',
  replaced: 'replaced',
};

function RungRow({ rung }) {
  const { value, currentText, proposedText, disposition, movesTo } = rung;

  let body;
  if (disposition === 'unchanged') {
    body = <span className="text-zinc-600 dark:text-zinc-300">{currentText}</span>;
  } else if (disposition === 'reworded' || disposition === 'moved') {
    body = <InlineDiff prev={currentText} next={proposedText} />;
  } else {
    body = <BlockReplace prev={currentText} next={proposedText} />;
  }

  return (
    <div
      className={`grid grid-cols-[2rem_1fr_auto] items-baseline gap-x-3 px-3 py-3 border-b
                  border-zinc-200 dark:border-zinc-700 last:border-b-0
                  ${disposition === 'unchanged' ? 'opacity-70' : ''}`}
    >
      <span className="font-mono text-xs font-semibold text-zinc-500 dark:text-zinc-400 tabular-nums">
        {value}
      </span>
      <div className="min-w-0 leading-relaxed">{body}</div>
      <span className="whitespace-nowrap font-mono text-[0.62rem] font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
        {DISPOSITION_LABEL[disposition]}
        {disposition === 'moved' && movesTo != null && (
          <span className="ml-1 text-amber-700 dark:text-amber-400">→ {movesTo}</span>
        )}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Queue
// ---------------------------------------------------------------------------

const STATUS_PILL = {
  draft:
    'border-zinc-400 text-zinc-600 dark:border-zinc-500 dark:text-zinc-300',
  approved:
    'border-teal-600 text-teal-700 bg-teal-50 dark:border-teal-400 dark:text-teal-300 dark:bg-teal-900/30',
};

function QueueItem({ item, active, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      className={`w-full text-left px-3 py-3 border-b border-zinc-200 dark:border-zinc-700
                  hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer
                  ${active ? 'bg-zinc-100 dark:bg-zinc-800' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold truncate">{item.topicKey}</span>
        <span
          className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[0.6rem]
                      font-semibold uppercase tracking-wider ${STATUS_PILL[item.status] ?? ''}`}
        >
          {item.status}
        </span>
      </div>
      <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-300 line-clamp-2">
        {item.publicNote}
      </div>
      <div className="mt-1 font-mono text-[0.65rem] text-zinc-500 dark:text-zinc-400">
        v{item.version} · rev {item.revision} · {item.changeClass}
        {item.ladderChanged && ' · ladder changed'}
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function TopicRevisionReview() {
  const [queue, setQueue] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchReviewQueue();
      setQueue(rows);
      // Keep the current selection if it is still open; otherwise fall back to
      // the first item, so approving the last proposal does not leave a blank pane.
      setSelectedId((prev) => (rows.some((r) => r.id === prev) ? prev : rows[0]?.id ?? null));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetail(null);
    setRejecting(false);
    setReason('');
    fetchRevision(selectedId)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const act = async (fn, successMessage) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const out = await fn();
      setNotice(typeof successMessage === 'function' ? successMessage(out) : successMessage);
      await loadQueue();
      if (selectedId) {
        // Re-read: status moved, and publish also supersedes the outgoing revision.
        try {
          setDetail(await fetchRevision(selectedId));
        } catch {
          setDetail(null);
        }
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const ladderChanges = detail
    ? detail.rungs.filter((r) => r.disposition !== 'unchanged').length
    : 0;

  return (
    <div className="mt-6">
      {error && (
        <div
          role="alert"
          className="mb-4 rounded border border-amber-600 bg-amber-50 px-3 py-2 text-sm
                     text-amber-900 dark:border-amber-500 dark:bg-amber-950/50 dark:text-amber-100"
        >
          {error}
        </div>
      )}
      {notice && (
        <div
          role="status"
          className="mb-4 rounded border border-teal-600 bg-teal-50 px-3 py-2 text-sm
                     text-teal-900 dark:border-teal-400 dark:bg-teal-950/50 dark:text-teal-100"
        >
          {notice}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        {/* Queue */}
        <aside className="rounded border border-zinc-200 dark:border-zinc-700 overflow-hidden self-start">
          <header className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-zinc-700">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
              Awaiting review
            </h2>
            <button
              type="button"
              onClick={loadQueue}
              disabled={loading}
              className="cursor-pointer font-mono text-[0.65rem] uppercase tracking-wider
                         text-zinc-500 hover:text-zinc-900 disabled:opacity-50
                         dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              refresh
            </button>
          </header>

          {loading && <p className="px-3 py-4 text-sm text-zinc-500">Loading…</p>}

          {!loading && queue.length === 0 && (
            <div className="px-3 py-6 text-sm text-zinc-600 dark:text-zinc-300">
              <p className="font-semibold">Nothing to review.</p>
              <p className="mt-2 text-zinc-500 dark:text-zinc-400">
                Proposed changes appear here once someone writes one. They are created
                by the research tooling, not on this page.
              </p>
            </div>
          )}

          {queue.map((item) => (
            <QueueItem
              key={item.id}
              item={item}
              active={item.id === selectedId}
              onSelect={setSelectedId}
            />
          ))}
        </aside>

        {/* Detail */}
        <section>
          {!detail && selectedId && <p className="text-sm text-zinc-500">Loading proposal…</p>}
          {!selectedId && !loading && (
            <p className="text-sm text-zinc-500">Select a proposal to review it.</p>
          )}

          {detail && (
            <article className="flex flex-col gap-6">
              <header className="flex flex-col gap-2">
                <div className="font-mono text-xs uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                  {detail.topicKey} · proposed by {detail.proposedByName ?? 'unknown'}
                </div>
                <h2 className="text-xl font-bold">
                  {detail.changeClass === 'substantive'
                    ? `Version ${detail.currentVersion} → ${detail.version}`
                    : `Version ${detail.version} (unchanged — ${detail.changeClass})`}
                </h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-300">
                  {ladderChanges === 0
                    ? 'Wording only. The five options are untouched.'
                    : `${ladderChanges} of 5 options change.`}
                </p>
              </header>

              {/* Why */}
              <div className="flex flex-col gap-3 rounded border border-zinc-200 p-3 dark:border-zinc-700">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    What readers will be told
                  </h3>
                  <p className="mt-1 leading-relaxed">{detail.publicNote}</p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Internal reasoning (never published)
                  </h3>
                  <p className="mt-1 leading-relaxed text-zinc-700 dark:text-zinc-300">
                    {detail.rationale}
                  </p>
                </div>
                {detail.reviewRef && (
                  <div className="font-mono text-xs text-zinc-500 dark:text-zinc-400 break-all">
                    Discussion: {detail.reviewRef}
                  </div>
                )}
              </div>

              {/* Framing */}
              <div className="flex flex-col gap-4 rounded border border-zinc-200 p-3 dark:border-zinc-700">
                <FieldDiff label="Title" prev={detail.currentTitle} next={detail.title} />
                <FieldDiff
                  label="Short title"
                  prev={detail.currentShortTitle}
                  next={detail.shortTitle}
                />
                <FieldDiff
                  label="Question"
                  prev={detail.currentQuestionText}
                  next={detail.questionText}
                />
              </div>

              {/* Ladder */}
              <div className="rounded border border-zinc-200 dark:border-zinc-700">
                <header className="border-b border-zinc-200 px-3 py-2 dark:border-zinc-700">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    The five options
                  </h3>
                </header>
                {detail.rungs.map((r) => (
                  <RungRow key={r.value} rung={r} />
                ))}
              </div>

              {detail.publishBlockedReason && (
                <div
                  role="alert"
                  className="rounded border-l-2 border-amber-600 bg-amber-50 px-3 py-2 text-sm
                             text-amber-900 dark:border-amber-500 dark:bg-amber-950/50
                             dark:text-amber-100"
                >
                  <strong className="block font-semibold">Cannot be published yet</strong>
                  {detail.publishBlockedReason}
                </div>
              )}

              {/* Actions */}
              <footer className="flex flex-wrap items-center gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-700">
                {detail.status === 'draft' && (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => act(() => approveRevision(detail.id), 'Approved.')}
                      className="cursor-pointer rounded border border-teal-700 bg-teal-700 px-4 py-2
                                 font-semibold text-white hover:bg-teal-800 disabled:opacity-50
                                 dark:border-teal-500 dark:bg-teal-600 dark:hover:bg-teal-500"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setRejecting((v) => !v)}
                      className="cursor-pointer rounded border border-zinc-400 px-4 py-2
                                 font-semibold hover:bg-zinc-100 disabled:opacity-50
                                 dark:border-zinc-500 dark:hover:bg-zinc-800"
                    >
                      Request changes
                    </button>
                  </>
                )}

                {detail.status === 'approved' && (
                  <button
                    type="button"
                    disabled={busy || Boolean(detail.publishBlockedReason)}
                    onClick={() =>
                      act(
                        () => publishRevision(detail.id),
                        (out) =>
                          `Published as version ${out.published_version}. Version ${out.superseded_revision} is now part of the record.`
                      )
                    }
                    className="cursor-pointer rounded border border-amber-700 bg-amber-600 px-4 py-2
                               font-semibold text-zinc-900 hover:bg-amber-500 disabled:opacity-50
                               dark:border-amber-500 dark:bg-amber-500 dark:hover:bg-amber-400"
                  >
                    Publish
                  </button>
                )}

                {(detail.status === 'published' || detail.status === 'rejected') && (
                  <p className="text-sm text-zinc-600 dark:text-zinc-300">
                    This proposal is {detail.status}. Nothing further to do.
                  </p>
                )}

                <span className="ml-auto font-mono text-[0.65rem] uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                  {detail.status}
                  {detail.approvedByName && ` · approved by ${detail.approvedByName}`}
                </span>
              </footer>

              {rejecting && (
                <div className="flex flex-col gap-2 rounded border border-zinc-300 p-3 dark:border-zinc-600">
                  <label htmlFor="reject-reason" className="text-sm font-semibold">
                    What needs changing?
                  </label>
                  <textarea
                    id="reject-reason"
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="rounded border border-zinc-300 bg-white p-2 dark:border-zinc-600
                               dark:bg-zinc-900"
                    placeholder="This is recorded with the proposal, so say enough for the author to act on it."
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy || reason.trim() === ''}
                      onClick={() =>
                        act(() => rejectRevision(detail.id, reason.trim()), 'Changes requested.')
                      }
                      className="cursor-pointer rounded border border-zinc-500 px-3 py-1.5 font-semibold
                                 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-400
                                 dark:hover:bg-zinc-800"
                    >
                      Send
                    </button>
                    <button
                      type="button"
                      onClick={() => setRejecting(false)}
                      className="cursor-pointer px-3 py-1.5 text-zinc-600 hover:underline dark:text-zinc-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </article>
          )}
        </section>
      </div>
    </div>
  );
}

export default TopicRevisionReview;
