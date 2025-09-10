import { useEffect, useMemo, useRef, useState } from "react";

// --- Small utilities ---
const normalize = (s) =>
  (s || "")
    .toString()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

const displayName = (p) =>
  p.full_name || [p.first_name, p.last_name].filter(Boolean).join(" ").trim();

function PoliticianPicker({
  politicians = [],
  value,
  onSelect,
  placeholder = "Search name…",
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const boxRef = useRef(null);
  const listRef = useRef(null);

  // Filter locally by name + office
  const options = useMemo(() => {
    const q = normalize(query);
    if (!q) return politicians;
    return politicians.filter((p) => {
      const name = normalize(displayName(p));
      const office = normalize(p.office_title);
      return name.includes(q) || office.includes(q);
    });
  }, [politicians, query]);

  // Keep highlight within bounds
  useEffect(() => {
    if (highlight >= options.length) setHighlight(0);
  }, [options.length, highlight]);

  // Close when clicking outside
  useEffect(() => {
    const onDocClick = (e) => {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const handleKeyDown = (e) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) setOpen(true);

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(0, options.length - 1)));
      ensureVisible(highlight + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
      ensureVisible(highlight - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const pick = options[highlight];
      if (pick) choose(pick);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const ensureVisible = (index) => {
    const list = listRef.current;
    if (!list) return;
    const item = list.children[index];
    if (!item) return;
    const itemTop = item.offsetTop;
    const itemBottom = itemTop + item.offsetHeight;
    const viewTop = list.scrollTop;
    const viewBottom = viewTop + list.clientHeight;
    if (itemTop < viewTop) list.scrollTop = itemTop;
    else if (itemBottom > viewBottom)
      list.scrollTop = itemBottom - list.clientHeight;
  };

  const choose = (p) => {
    onSelect?.(p);
    setQuery(displayName(p)); // show selected name in the input
    setOpen(false);
  };

  // Show selected
  useEffect(() => {
    if (!value) return;
    setQuery(displayName(value));
  }, [value]);

  return (
    <div className="relative w-full md:w-1/2" ref={boxRef}>
      <input
        className="border rounded p-2 w-full bg-white"
        placeholder={placeholder}
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onKeyDown={handleKeyDown}
      />
      {open && (
        <div
          className="absolute z-10 mt-1 w-full max-h-64 overflow-auto rounded-md border bg-white shadow"
          ref={listRef}
        >
          {options.length === 0 && (
            <div className="px-3 py-2 text-sm text-gray-500">No results</div>
          )}
          {options.map((p, i) => {
            const active = i === highlight;
            return (
              <button
                type="button"
                key={p.id}
                onMouseEnter={() => setHighlight(i)}
                onMouseDown={(e) => e.preventDefault()} // prevent input blur before click
                onClick={() => choose(p)}
                className={`w-full text-left px-3 py-2 text-md ${
                  active ? "bg-gray-100" : ""
                }`}
              >
                <div className="flex flex-row gap-4 items-center">
                  <div className="size-24 rounded-full overflow-hidden shrink-0">
                    <img
                      src={p.photo_origin_url}
                      className="w-full h-full object-cover "
                    />
                  </div>
                  <div className="flex flex-col">
                    <div className="font-medium">{displayName(p)}</div>
                    <div className="text-gray-500">{p.office_title}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AttachAnswers({ topics, politicians = [] }) {
  const [status, setStatus] = useState(null);
  const [selectedPol, setSelectedPol] = useState(null); // full object
  const [checkedStances, setCheckedStances] = useState({}); // { [topicId]: number|null }
  const [search, setSearch] = useState("");
  const [openTopicIds, setOpenTopicIds] = useState([]);

  const visibleTopics = useMemo(() => {
    const q = normalize(search);
    return (topics || []).filter((t) => normalize(t.short_title).includes(q));
  }, [topics, search]);

  const toggleTopicOpen = (topicId) => {
    setOpenTopicIds((prev) =>
      prev.includes(topicId)
        ? prev.filter((id) => id !== topicId)
        : [...prev, topicId]
    );
  };

  const handleCheck = (topic, value) => {
    setCheckedStances((prev) => ({ ...prev, [topic.id]: value }));
  };

  const formatAnswers = () =>
    Object.entries(checkedStances)
      .filter(([_, v]) => Number.isFinite(v))
      .map(([topic_id, value]) => ({ topic_id, value }));

  const submit = async () => {
    setStatus(null);
    const payload = formatAnswers();
    const politicianId = selectedPol?.id;

    if (!politicianId || payload.length === 0) {
      setStatus("error");
      return;
    }

    try {
      const url = `${
        import.meta.env.VITE_API_URL
      }/compass/politicians/${politicianId}/answers`;
      const res = await fetch(url, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      setStatus("success");
      setCheckedStances({});
    } catch (e) {
      console.error("[AttachAnswers] submit failed", e);
      setStatus("error");
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold text-center">
        Attach Answers to a Politician
      </h1>

      {/* Politician picker */}
      <div className="mt-4 flex flex-col items-center gap-2">
        <label className="font-semibold">Select Politician</label>
        <PoliticianPicker
          politicians={politicians}
          value={selectedPol}
          onSelect={setSelectedPol}
        />
        {/* If you still want to display the UUID selected: */}
        {selectedPol && (
          <div className="text-sm text-gray-600 mt-1">
            Selected ID: <code>{selectedPol.id}</code>
          </div>
        )}
      </div>

      {selectedPol && (
        <div>
          <div className="w-full mt-6 flex flex-col gap-4 bg-neutral-50 border border-neutral-200 p-4 rounded-xl">
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Add Answers</h2>
                <span className="text-sm text-gray-500">
                  {visibleTopics.length} topics
                </span>
              </div>

              <input
                id="search"
                className="border rounded p-2 w-full bg-white"
                value={search}
                placeholder="Search topics…"
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              {visibleTopics.map((topic) => (
                <div key={topic.id} className="border rounded-lg bg-white">
                  <button
                    type="button"
                    className="w-full flex justify-between items-center px-3 py-2 text-left hover:bg-gray-50"
                    onClick={() => toggleTopicOpen(topic.id)}
                  >
                    <span className="font-semibold">{topic.short_title}</span>
                    <span className="text-sm text-gray-500">
                      {openTopicIds.includes(topic.id) ? "▲" : "▼"}
                    </span>
                  </button>

                  {openTopicIds.includes(topic.id) && (
                    <div className="px-3 pb-3">
                      {(topic.stances || []).map((s) => (
                        <label
                          key={s.value}
                          className="flex items-start gap-2 py-1 cursor-pointer"
                        >
                          <input
                            type="radio"
                            name={`stance-${topic.id}`}
                            value={s.value}
                            checked={
                              (checkedStances[topic.id] ?? null) === s.value
                            }
                            onChange={() => handleCheck(topic, s.value)}
                          />
                          <span>
                            <span className="font-medium">{s.value}.</span>{" "}
                            {s.text}
                          </span>
                        </label>
                      ))}
                      <div className="pt-2">
                        <button
                          type="button"
                          className="text-sm underline text-gray-600 hover:text-black"
                          onClick={() => handleCheck(topic, null)}
                        >
                          Clear selection
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-center mt-6">
            <button
              disabled={
                !selectedPol ||
                Object.values(checkedStances).every((v) => v == null)
              }
              onClick={submit}
              className="px-4 py-2 bg-black text-white rounded disabled:opacity-50"
            >
              Save Answers
            </button>
          </div>
        </div>
      )}

      {status === "success" && (
        <p className="text-green-700 text-center mt-2">Saved!</p>
      )}
      {status === "error" && (
        <p className="text-red-600 text-center mt-2">Failed to save.</p>
      )}
    </div>
  );
}

export default AttachAnswers;
