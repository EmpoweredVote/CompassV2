import { useEffect, useState } from 'react';
import { topicRewriteApi } from '../../lib/topicRewriteApi';

export default function TopicRewriteWorkflow() {
  const [rewrites, setRewrites] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [err, setErr] = useState(null);

  async function refreshList() {
    try {
      const data = await topicRewriteApi.list();
      setRewrites(data?.rewrites ?? []);
    } catch (e) {
      setErr(e.message);
    }
  }

  async function refreshDetail(id) {
    try {
      setDetail(await topicRewriteApi.detail(id));
    } catch (e) {
      setErr(e.message);
    }
  }

  useEffect(() => {
    refreshList();
  }, []);
  useEffect(() => {
    if (selectedId) refreshDetail(selectedId);
  }, [selectedId]);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Topic Rewrite Workflow</h2>
      {err && (
        <div className="bg-red-100 text-red-800 p-3 mb-4 rounded">{err}</div>
      )}

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1 border-r pr-4">
          <button
            className="mb-4 px-3 py-1 bg-ev-muted-blue text-white rounded"
            onClick={() => {
              setShowCreate(true);
              setSelectedId(null);
              setDetail(null);
            }}
          >
            + New rewrite
          </button>
          <ul className="space-y-2">
            {rewrites.map((r) => (
              <li
                key={r.id}
                className={`p-2 border rounded cursor-pointer ${
                  selectedId === r.id ? 'bg-yellow-50' : ''
                }`}
                onClick={() => {
                  setShowCreate(false);
                  setSelectedId(r.id);
                }}
              >
                <div className="font-semibold">{r.topic_key}</div>
                <div className="text-xs text-gray-600">
                  v{r.old_version} → v{r.new_version} · {r.state}
                </div>
              </li>
            ))}
            {rewrites.length === 0 && (
              <li className="text-gray-500">No rewrites yet.</li>
            )}
          </ul>
        </div>

        <div className="col-span-2">
          {showCreate && (
            <CreateRewriteForm
              onDone={async (id) => {
                setShowCreate(false);
                await refreshList();
                if (id) setSelectedId(id);
              }}
            />
          )}
          {!showCreate && detail && (
            <RewriteDetail
              detail={detail}
              refreshDetail={() => refreshDetail(selectedId)}
              refreshList={refreshList}
            />
          )}
          {!showCreate && !detail && !selectedId && (
            <div className="text-gray-500">
              Select a rewrite or create a new one.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateRewriteForm({ onDone }) {
  const [form, setForm] = useState({
    topic_key: '',
    new_title: '',
    new_short_title: '',
    new_question_text: '',
    new_stances: [1, 2, 3, 4, 5].map((value) => ({ value, text: '' })),
    notes: '',
  });
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setErr(null);
    setBusy(true);
    try {
      const res = await topicRewriteApi.create(form);
      onDone(res?.rewrite_id);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="text-xl font-bold">New topic rewrite</h3>
      {err && <div className="bg-red-100 text-red-800 p-2 rounded">{err}</div>}
      <label className="block">
        <span className="text-sm font-semibold">
          topic_key (must match the current live topic)
        </span>
        <input
          className="w-full border rounded p-2"
          value={form.topic_key}
          onChange={(e) => setForm({ ...form, topic_key: e.target.value })}
        />
      </label>
      <label className="block">
        <span className="text-sm font-semibold">New title</span>
        <input
          className="w-full border rounded p-2"
          value={form.new_title}
          onChange={(e) => setForm({ ...form, new_title: e.target.value })}
        />
      </label>
      <label className="block">
        <span className="text-sm font-semibold">New short title</span>
        <input
          className="w-full border rounded p-2"
          value={form.new_short_title}
          onChange={(e) =>
            setForm({ ...form, new_short_title: e.target.value })
          }
        />
      </label>
      <label className="block">
        <span className="text-sm font-semibold">New question text</span>
        <textarea
          className="w-full border rounded p-2"
          rows={3}
          value={form.new_question_text}
          onChange={(e) =>
            setForm({ ...form, new_question_text: e.target.value })
          }
        />
      </label>
      <div>
        <span className="text-sm font-semibold">New stance scale (1–5)</span>
        {form.new_stances.map((s, i) => (
          <input
            key={s.value}
            className="w-full border rounded p-2 mt-1"
            placeholder={`Stance ${s.value}`}
            value={s.text}
            onChange={(e) => {
              const next = [...form.new_stances];
              next[i] = { ...s, text: e.target.value };
              setForm({ ...form, new_stances: next });
            }}
          />
        ))}
      </div>
      <label className="block">
        <span className="text-sm font-semibold">Notes (optional)</span>
        <textarea
          className="w-full border rounded p-2"
          rows={2}
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
      </label>
      <button
        disabled={busy}
        className="px-4 py-2 bg-ev-coral text-white rounded disabled:opacity-50"
        onClick={submit}
      >
        {busy ? 'Creating…' : 'Create draft'}
      </button>
    </div>
  );
}

function RewriteDetail({ detail, refreshDetail, refreshList }) {
  const [err, setErr] = useState(null);

  async function act(fn) {
    setErr(null);
    try {
      await fn();
      await refreshDetail();
      await refreshList();
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold">
        {detail.topic_key} ·{' '}
        <span className="text-sm text-gray-600">{detail.state}</span>
      </h3>
      {err && <div className="bg-red-100 text-red-800 p-2 rounded">{err}</div>}

      <section className="grid grid-cols-2 gap-4 border p-3 rounded">
        <div>
          <div className="text-xs font-bold text-gray-500">
            OLD (v{detail.old_version})
          </div>
          <div className="font-semibold">{detail.old_title}</div>
          <div className="text-sm">{detail.old_question_text}</div>
          <ol className="text-xs mt-2 list-decimal pl-4">
            {detail.old_stances?.map((s) => <li key={s.value}>{s.text}</li>)}
          </ol>
        </div>
        <div>
          <div className="text-xs font-bold text-gray-500">
            NEW (v{detail.new_version})
          </div>
          <div className="font-semibold">{detail.new_title}</div>
          <div className="text-sm">{detail.new_question_text}</div>
          <ol className="text-xs mt-2 list-decimal pl-4">
            {detail.new_stances?.map((s) => <li key={s.value}>{s.text}</li>)}
          </ol>
        </div>
      </section>

      <div className="flex gap-2 flex-wrap">
        {detail.state === 'draft' && (
          <button
            className="px-3 py-1 bg-ev-muted-blue text-white rounded"
            onClick={() => act(() => topicRewriteApi.submitFraming(detail.id))}
          >
            Submit for framing review
          </button>
        )}
        {detail.state === 'pending_framing_review' && (
          <button
            className="px-3 py-1 bg-ev-coral text-white rounded"
            onClick={() => act(() => topicRewriteApi.approveFraming(detail.id))}
          >
            Approve framing → seed proposals
          </button>
        )}
        {detail.state === 're_evaluation_queue' && (
          <button
            className="px-3 py-1 bg-ev-muted-blue text-white rounded"
            onClick={() =>
              act(() => topicRewriteApi.markPublishReady(detail.id))
            }
          >
            Mark publish-ready
          </button>
        )}
        {detail.state === 'publish_ready' && (
          <button
            className="px-3 py-1 bg-ev-yellow text-black rounded font-bold"
            onClick={() => {
              if (
                window.confirm(
                  'Publish this rewrite? This flips is_live on the new topic.',
                )
              ) {
                act(() => topicRewriteApi.publish(detail.id));
              }
            }}
          >
            PUBLISH
          </button>
        )}
      </div>

      {detail.proposals?.length > 0 && (
        <section>
          <h4 className="font-bold mb-2">Stance re-evaluation queue</h4>
          <div className="space-y-3">
            {detail.proposals.map((p) => (
              <ProposalCard
                key={p.politician_id}
                rewriteId={detail.id}
                proposal={p}
                onChange={refreshDetail}
                setErr={setErr}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ProposalCard({ rewriteId, proposal, onChange, setErr }) {
  const [draft, setDraft] = useState({
    proposed_value: proposal.proposed_value ?? '',
    proposed_reasoning: proposal.proposed_reasoning ?? '',
    proposed_sources: (proposal.proposed_sources ?? []).join('\n'),
  });

  async function save() {
    try {
      await topicRewriteApi.upsertProposal(rewriteId, proposal.politician_id, {
        proposed_value:
          draft.proposed_value === '' ? null : Number(draft.proposed_value),
        proposed_reasoning: draft.proposed_reasoning || null,
        proposed_sources: draft.proposed_sources
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
      });
      await onChange();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function approve() {
    try {
      await topicRewriteApi.approveProposal(
        rewriteId,
        proposal.politician_id,
        null,
      );
      await onChange();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function reject() {
    const notes = window.prompt('Rejection notes (optional)') || null;
    try {
      await topicRewriteApi.rejectProposal(
        rewriteId,
        proposal.politician_id,
        notes,
      );
      await onChange();
    } catch (e) {
      setErr(e.message);
    }
  }

  const locked = proposal.status !== 'pending';

  return (
    <div
      className={`border p-3 rounded ${
        proposal.status === 'approved'
          ? 'bg-green-50'
          : proposal.status === 'rejected'
          ? 'bg-gray-100'
          : ''
      }`}
    >
      <div className="font-semibold">
        {proposal.politician_name}{' '}
        <span className="text-xs text-gray-500">({proposal.status})</span>
      </div>
      <div className="grid grid-cols-2 gap-3 mt-2">
        <div className="text-xs">
          <div className="font-bold text-gray-500">OLD</div>
          <div>value: {proposal.old_value}</div>
          <div className="italic">{proposal.old_reasoning}</div>
        </div>
        <div className="text-xs space-y-1">
          <div className="font-bold text-gray-500">NEW (proposed)</div>
          <input
            type="number"
            min="1"
            max="5"
            step="0.1"
            className="border rounded p-1 w-24"
            disabled={locked}
            value={draft.proposed_value}
            onChange={(e) =>
              setDraft({ ...draft, proposed_value: e.target.value })
            }
          />
          <textarea
            className="border rounded p-1 w-full"
            rows={3}
            disabled={locked}
            placeholder="Reasoning"
            value={draft.proposed_reasoning}
            onChange={(e) =>
              setDraft({ ...draft, proposed_reasoning: e.target.value })
            }
          />
          <textarea
            className="border rounded p-1 w-full"
            rows={2}
            disabled={locked}
            placeholder="Sources (one per line)"
            value={draft.proposed_sources}
            onChange={(e) =>
              setDraft({ ...draft, proposed_sources: e.target.value })
            }
          />
        </div>
      </div>
      {!locked && (
        <div className="flex gap-2 mt-2">
          <button
            className="px-2 py-1 bg-ev-muted-blue text-white rounded text-xs"
            onClick={save}
          >
            Save draft
          </button>
          <button
            className="px-2 py-1 bg-green-600 text-white rounded text-xs"
            onClick={approve}
          >
            Approve
          </button>
          <button
            className="px-2 py-1 bg-red-600 text-white rounded text-xs"
            onClick={reject}
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );
}
