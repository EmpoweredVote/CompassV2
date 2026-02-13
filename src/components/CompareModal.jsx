// CompareModal.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { normalizeOfficeTitle, getPolName } from "../util/name";
import placeholder from "../assets/placeholder.png";

const normalize = (s = "") =>
  s
    .toString()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

const displayName = (p) => getPolName(p);

function PoliticianPicker({ politicians = [], onPick }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(true);
  const [highlight, setHighlight] = useState(0);
  const boxRef = useRef(null);
  const listRef = useRef(null);

  const options = useMemo(() => {
    const q = normalize(query);
    if (!q) return politicians;
    return politicians.filter((p) => {
      const name = normalize(displayName(p));
      const office = normalize(p.office_title);
      return name.includes(q) || office.includes(q);
    });
  }, [politicians, query]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const ensureVisible = (i) => {
    const list = listRef.current;
    if (!list) return;
    const el = list.children[i];
    if (!el) return;
    const t = el.offsetTop;
    const b = t + el.offsetHeight;
    const vt = list.scrollTop;
    const vb = vt + list.clientHeight;
    if (t < vt) list.scrollTop = t;
    else if (b > vb) list.scrollTop = b - list.clientHeight;
  };

  const choose = (p) => {
    onPick?.(p);
  };

  return (
    <div className="relative" ref={boxRef}>
      <input
        className="w-full border rounded p-2"
        placeholder="Search politician by name or office…"
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp"))
            setOpen(true);
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => {
              const nh = Math.min(h + 1, Math.max(0, options.length - 1));
              ensureVisible(nh);
              return nh;
            });
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => {
              const nh = Math.max(h - 1, 0);
              ensureVisible(nh);
              return nh;
            });
          } else if (e.key === "Enter") {
            e.preventDefault();
            const pick = options[highlight];
            if (pick) choose(pick);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && (
        <div
          ref={listRef}
          className="absolute z-10 mt-1 w-full max-h-64 overflow-auto rounded-md border bg-white shadow"
        >
          {options.length === 0 && (
            <div className="px-3 py-2 text-sm text-gray-500">No results</div>
          )}
          {options.map((p, i) => {
            const active = i === highlight;
            return (
              <button
                key={p.id}
                type="button"
                onMouseEnter={() => setHighlight(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(p)}
                className={`w-full text-left px-3 py-2 text-sm ${
                  active ? "bg-gray-100" : ""
                }`}
              >
                <div className="flex flex-row gap-4 items-center">
                  <div className="size-18 rounded-full overflow-hidden shrink-0">
                    <img
                      src={p.photo_origin_url || placeholder}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex flex-col">
                    <div className="font-medium">{displayName(p)}</div>
                    <div className="text-gray-500">
                      {normalizeOfficeTitle(p.office_title)}
                    </div>
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

function CompareModal({ onCompare, onClose }) {
  const [politicians, setPoliticians] = useState([]);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/compass/politicians`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((r) => setPoliticians(Array.isArray(r) ? r : []))
      .catch((e) =>
        console.error("[CompareModal] fetch politicians failed", e)
      );
  }, []);

  return (
    <div className="fixed inset-0 backdrop-blur-sm bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">
          Select a politician to compare
        </h2>

        <PoliticianPicker
          politicians={politicians}
          onPick={(p) => {
            onCompare(p); // pass full politician object
            onClose();
          }}
        />

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default CompareModal;
