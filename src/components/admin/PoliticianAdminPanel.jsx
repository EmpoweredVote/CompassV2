import { useState } from "react";
import PoliticianAccordion from "./PoliticianAccordion";

function PoliticianAdminPanel({ politicians, topics }) {
  const [expanded, setExpanded] = useState([]);
  const [contextByPolitician, setContextByPolitician] = useState({});
  const [editedContextFields, setEditedContextFields] = useState({});
  const [answersByPol, setAnswersByPol] = useState({});
  const [editingContext, setEditingContext] = useState(null);
  const [openTopicsByPol, setOpenTopicsByPol] = useState({});

  const fetchContextsForPolitician = async (politician_id) => {
    // Fetch each topic’s context in parallel. Keep 200s; ignore 404s.
    const base = `${
      import.meta.env.VITE_API_URL
    }/compass/politicians/${politician_id}`;
    console.log("[Panel] fetchContextsForPolitician START", {
      politician_id,
      topics: topics.length,
    });

    const jobs = topics.map((t) => {
      const url = `${base}/${t.id}/context`;
      return fetch(url, { credentials: "include" })
        .then(async (res) => {
          if (res.ok) {
            const ctx = await res.json();
            console.log("[Panel] context OK", { topic_id: t.id, ctx });
            return { ok: true, ctx };
          } else if (res.status === 404) {
            console.log("[Panel] context 404", { topic_id: t.id });
            return { ok: false, notFound: true };
          }
          const txt = await res.text();
          console.warn("[Panel] context non-OK", {
            topic_id: t.id,
            status: res.status,
            txt,
          });
          return { ok: false, err: `${res.status} ${txt}` };
        })
        .catch((e) => {
          console.error("[Panel] context fetch error", { topic_id: t.id, e });
          return { ok: false, err: e.message };
        });
    });

    const results = await Promise.all(jobs);
    const contexts = results
      .filter((r) => r.ok && r.ctx && r.ctx.topic_id) // only valid contexts
      .map((r) => r.ctx);

    console.log("[Panel] fetchContextsForPolitician DONE", {
      politician_id,
      found: contexts.length,
    });

    setContextByPolitician((prev) => ({
      ...prev,
      [politician_id]: contexts,
    }));
  };

  const toggleExpanded = async (politician_id) => {
    console.log("[Panel] toggleExpanded", { politician_id });
    if (expanded.includes(politician_id)) {
      setExpanded((prev) => prev.filter((id) => id !== politician_id));
      return;
    }
    try {
      const ansUrl = `${
        import.meta.env.VITE_API_URL
      }/compass/politicians/${politician_id}/answers`;
      console.log("[Panel] fetching answers:", ansUrl);
      const res = await fetch(ansUrl, { credentials: "include" });
      console.log("[Panel] answers status:", res.status);
      if (!res.ok) throw new Error("Failed to fetch answers");
      const answerData = await res.json();
      console.log("[Panel] answers payload:", answerData);
      setAnswersByPol((prev) => ({ ...prev, [politician_id]: answerData }));

      // NOW ALSO FETCH CONTEXTS
      await fetchContextsForPolitician(politician_id);

      setExpanded((prev) => [...prev, politician_id]);
    } catch (err) {
      console.error("[Panel] toggleExpanded error:", err);
    }
  };

  // Keep the 3-arg implementation internally; bind politician in prop.
  const saveContextEdit = async (politician_id, topic_id, draft) => {
    console.log("[Panel] saveContextEdit ENTRY", {
      politician_id,
      topic_id,
      draft,
    });

    const rawReasoning = draft?.reasoning ?? "";
    const rawSources = draft?.sources ?? "";
    const value = draft?.value;

    const sources = Array.isArray(rawSources)
      ? rawSources.filter(Boolean).map((s) => s.trim())
      : String(rawSources)
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean);

    const hasValue = Number.isFinite(value);

    try {
      // 1) Upsert context
      const ctxUrl = `${
        import.meta.env.VITE_API_URL
      }/compass/politicians/context`;
      console.log("[Panel] POST context ->", ctxUrl, {
        politician_id,
        topic_id,
        reasoning: rawReasoning,
        sources,
      });
      const ctxRes = await fetch(ctxUrl, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          politician_id,
          topic_id,
          reasoning: rawReasoning,
          sources,
        }),
      });
      console.log("[Panel] context response status:", ctxRes.status);
      if (!ctxRes.ok) {
        const t = await ctxRes.text();
        console.error("[Panel] context error body:", t);
        throw new Error(`Context upsert failed: ${ctxRes.status} ${t}`);
      }

      // 2) Upsert answer (optional)
      if (hasValue) {
        const ansUrl = `${
          import.meta.env.VITE_API_URL
        }/compass/politicians/${politician_id}/answers`;
        console.log("[Panel] PUT answers ->", ansUrl, [{ topic_id, value }]);
        const ansRes = await fetch(ansUrl, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify([{ topic_id, value }]),
        });
        console.log("[Panel] answer response status:", ansRes.status);
        if (!ansRes.ok) {
          const t = await ansRes.text();
          console.error("[Panel] answer error body:", t);
          throw new Error(`Answer upsert failed: ${ansRes.status} ${t}`);
        }

        setAnswersByPol((prev) => {
          const prevAnswers = prev[politician_id] || [];
          const has = prevAnswers.some((a) => a.topic_id === topic_id);
          const updated = has
            ? prevAnswers.map((a) =>
                a.topic_id === topic_id ? { ...a, value } : a
              )
            : [...prevAnswers, { topic_id, value }];
          return { ...prev, [politician_id]: updated };
        });
      } else {
        console.log("[Panel] no stance value selected; skipped answers PUT");
      }

      // Update local context cache
      setContextByPolitician((prev) => {
        const list = prev[politician_id] || [];
        const has = list.some((c) => c.topic_id === topic_id);
        const updated = has
          ? list.map((c) =>
              c.topic_id === topic_id
                ? { ...c, reasoning: rawReasoning, sources }
                : c
            )
          : [...list, { topic_id, reasoning: rawReasoning, sources }];
        return { ...prev, [politician_id]: updated };
      });

      // Clear edited fields for this topic
      setEditedContextFields((prev) => {
        const cp = { ...prev };
        if (cp[politician_id]) {
          const { [topic_id]: _omit, ...rest } = cp[politician_id];
          cp[politician_id] = rest;
        }
        return cp;
      });

      // Exit edit mode
      setEditingContext((cur) =>
        cur && cur.politician_id === politician_id && cur.topic_id === topic_id
          ? null
          : cur
      );

      console.log("[Panel] saveContextEdit SUCCESS");
    } catch (e) {
      console.error("[Panel] saveContextEdit ERROR:", e);
      alert("Failed to save");
    }
  };

  const toggleTopicOpenFor = (politician_id, topic_id) => {
    console.log("[Panel] toggleTopicOpenFor", { politician_id, topic_id });
    setOpenTopicsByPol((prev) => {
      const current = prev[politician_id] || [];
      const next = current.includes(topic_id)
        ? current.filter((id) => id !== topic_id)
        : [...current, topic_id];
      return { ...prev, [politician_id]: next };
    });
  };

  return (
    <div className="w-3/4 mx-auto mt-6 space-y-4">
      <h1 className="text-2xl font-bold text-center">Politicians</h1>
      {politicians.map((p) => (
        <PoliticianAccordion
          key={p.id}
          politician={p}
          answers={answersByPol[p.id] || []}
          isOpen={expanded.includes(p.id)}
          toggleOpen={() => toggleExpanded(p.id)}
          topics={topics}
          context={contextByPolitician[p.id] || []}
          openTopics={openTopicsByPol[p.id] || []}
          toggleTopicOpen={(topic_id) => toggleTopicOpenFor(p.id, topic_id)}
          editingContext={editingContext}
          setEditingContext={setEditingContext}
          editedContextFields={editedContextFields}
          setEditedContextFields={setEditedContextFields}
          // Expose 2-arg saver (topic_id, draft); bind politician_id here
          saveContextEdit={(topic_id, draft) => {
            console.log("[Panel->Accordion prop] saveContextEdit called", {
              topic_id,
              draft,
              boundPolitician: p.id,
            });
            return saveContextEdit(p.id, topic_id, draft);
          }}
        />
      ))}
    </div>
  );
}

export default PoliticianAdminPanel;
