import { useState, useEffect, useMemo, useCallback } from "react";
import { apiFetch } from "../../lib/auth";
import { LOCAL_LENS } from "../../lib/lenses";
import { getPolName, getOfficeSubtitle } from "../../util/name";

const LOCAL_DISTRICT_TYPES = new Set([
  'LOCAL', 'LOCAL_EXEC', 'COUNTY', 'SCHOOL', 'JUDICIAL',
]);

// 2-char abbreviations for each lens topic, in lens order
const TOPIC_ABBREVS = {
  'Housing':                      'Ho',
  'Homelessness':                 'Hm',
  'Residential Zoning':           'RZ',
  'Civil Rights':                 'CR',
  'Public Safety Approach':       'PS',
  'Voting Rights':                'VR',
  'Economic Development Incentives': 'ED',
  'Transportation Priorities':    'TP',
};

const FILTER_OPTIONS = ['All', 'Incomplete', 'Complete'];

function CoverageDots({ lensTopics, answeredIds }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {lensTopics.map(t => {
        const answered = answeredIds.has(t.id);
        return (
          <span
            key={t.id}
            title={t.short_title}
            className="inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold"
            style={{
              background: answered ? '#5A9A6E' : '#E5E7EB',
              color: answered ? '#fff' : '#9CA3AF',
            }}
          >
            {TOPIC_ABBREVS[t.short_title] ?? t.short_title.slice(0, 2)}
          </span>
        );
      })}
    </div>
  );
}

export default function GreenLensCoverage({ politicians, topics, onAttachPolitician }) {
  const lensTopics = useMemo(
    () => LOCAL_LENS.topicIds.map(id => topics.find(t => t.id === id)).filter(Boolean),
    [topics]
  );

  const localPoliticians = useMemo(
    () => politicians.filter(p => LOCAL_DISTRICT_TYPES.has(p.district_type)),
    [politicians]
  );

  // Map: politicianId → Set<topicId>
  const [coverageMap, setCoverageMap] = useState({});
  const [loadedCount, setLoadedCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('Incomplete');
  const [search, setSearch] = useState('');

  const fetchCoverage = useCallback(async () => {
    if (localPoliticians.length === 0 || lensTopics.length === 0) return;
    setLoading(true);
    setLoadedCount(0);
    setCoverageMap({});

    const map = {};
    let done = 0;

    await Promise.all(
      localPoliticians.map(async pol => {
        try {
          const res = await apiFetch(`/compass/politicians/${pol.id}/answers`);
          const answers = res ? await res.json() : [];
          const lensAnswered = new Set(
            (Array.isArray(answers) ? answers : [])
              .map(a => a.topic_id)
              .filter(id => LOCAL_LENS.topicIds.includes(id))
          );
          map[pol.id] = lensAnswered;
        } catch {
          map[pol.id] = new Set();
        }
        done++;
        setLoadedCount(done);
      })
    );

    setCoverageMap({ ...map });
    setLoading(false);
  }, [localPoliticians, lensTopics]);

  useEffect(() => {
    fetchCoverage();
  }, [fetchCoverage]);

  const filteredPoliticians = useMemo(() => {
    const q = search.toLowerCase();
    return localPoliticians.filter(pol => {
      const answered = coverageMap[pol.id] ?? new Set();
      const count = answered.size;

      if (filter === 'Complete' && count < lensTopics.length) return false;
      if (filter === 'Incomplete' && count >= lensTopics.length) return false;

      if (q) {
        const name = getPolName(pol).toLowerCase();
        const office = getOfficeSubtitle(pol).toLowerCase();
        if (!name.includes(q) && !office.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => {
      const aCount = (coverageMap[a.id] ?? new Set()).size;
      const bCount = (coverageMap[b.id] ?? new Set()).size;
      return aCount - bCount; // fewest answers first
    });
  }, [localPoliticians, coverageMap, filter, search, lensTopics.length]);

  const totalAnswered = useMemo(
    () => localPoliticians.filter(p => (coverageMap[p.id] ?? new Set()).size >= lensTopics.length).length,
    [localPoliticians, coverageMap, lensTopics.length]
  );

  const progress = localPoliticians.length > 0 ? loadedCount / localPoliticians.length : 0;

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-xl font-bold text-center mb-1">Green Lens Coverage</h2>
      <p className="text-sm text-gray-500 text-center mb-4">
        Local politicians × 9 Local Lens questions
      </p>

      {/* Legend */}
      <div className="flex flex-wrap gap-1.5 justify-center mb-4">
        {lensTopics.map(t => (
          <span key={t.id} className="flex items-center gap-1 text-xs text-gray-600">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded text-xs font-bold bg-gray-200 text-gray-500">
              {TOPIC_ABBREVS[t.short_title] ?? t.short_title.slice(0, 2)}
            </span>
            {t.short_title}
          </span>
        ))}
      </div>

      {/* Loading bar */}
      {loading && (
        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Loading answers…</span>
            <span>{loadedCount} / {localPoliticians.length}</span>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-200"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Stats + controls */}
      {!loading && (
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between mb-4">
          <p className="text-sm text-gray-500">
            <span className="font-semibold text-green-700">{totalAnswered}</span> of{' '}
            <span className="font-semibold">{localPoliticians.length}</span> fully covered ·{' '}
            <span className="font-semibold text-amber-600">
              {localPoliticians.length - totalAnswered}
            </span> need work
          </p>
          <button
            onClick={fetchCoverage}
            className="text-xs text-blue-600 underline cursor-pointer hover:text-blue-800"
          >
            Refresh
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input
          type="text"
          placeholder="Search by name or office…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm flex-1 bg-white"
        />
        <div className="flex gap-1">
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt}
              onClick={() => setFilter(opt)}
              className={`px-3 py-1.5 rounded text-xs font-semibold cursor-pointer transition-colors ${
                filter === opt ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex flex-col gap-2">
        {filteredPoliticians.length === 0 && !loading && (
          <p className="text-center text-gray-400 py-8">No politicians match this filter.</p>
        )}
        {filteredPoliticians.map(pol => {
          const answered = coverageMap[pol.id] ?? new Set();
          const count = answered.size;
          const total = lensTopics.length;
          const complete = count >= total;

          return (
            <div
              key={pol.id}
              className="flex items-center gap-3 px-4 py-3 rounded-lg border bg-white"
              style={{ borderColor: complete ? '#BBF7D0' : '#E5E7EB' }}
            >
              {/* Photo */}
              {pol.photo_origin_url ? (
                <img
                  src={pol.photo_origin_url}
                  alt=""
                  className="w-9 h-9 rounded-full object-cover shrink-0"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-gray-100 shrink-0" />
              )}

              {/* Name + office */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-tight truncate">{getPolName(pol)}</p>
                <p className="text-xs text-gray-500 truncate">{getOfficeSubtitle(pol)}</p>
              </div>

              {/* Coverage dots */}
              <div className="hidden sm:block shrink-0">
                <CoverageDots lensTopics={lensTopics} answeredIds={answered} />
              </div>

              {/* Count badge */}
              <span
                className="shrink-0 text-xs font-bold px-2 py-1 rounded-full"
                style={{
                  background: complete ? '#DCFCE7' : count === 0 ? '#FEE2E2' : '#FEF3C7',
                  color: complete ? '#166534' : count === 0 ? '#991B1B' : '#92400E',
                }}
              >
                {count}/{total}
              </span>

              {/* Action */}
              {!complete && (
                <button
                  onClick={() => onAttachPolitician(pol)}
                  className="shrink-0 px-3 py-1.5 rounded text-xs font-semibold bg-gray-800 text-white cursor-pointer hover:bg-gray-700 transition-colors"
                >
                  Attach
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
