import { useNavigate, useLocation } from "react-router";
import { SiteHeader, evContext } from "@empoweredvote/ev-ui";
import { useCompass } from "../components/CompassContext";
import ReturnBanner from "./ReturnBanner";
import { apiFetch, getToken, clearToken, API_BASE } from "../lib/auth";

function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { topics, selectedTopics, setSelectedTopics, answers, setAnswers, writeIns, setWriteIns, invertedSpokes, setInvertedSpokes, isLoggedIn, isAdmin, username, userId, setIsLoggedIn, authChecking, setCompassVersion } = useCompass();

  const logout = async () => {
    try {
      const token = getToken();
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
    } catch {
      // Network error — clear local state anyway
    }
    clearToken();
    localStorage.removeItem("compareUser");
    localStorage.removeItem("invertedSpokes");
    localStorage.removeItem("selectedTopics");
    localStorage.removeItem("answers");
    localStorage.removeItem("writeIns");
    setSelectedTopics([]);
    setAnswers({});
    setWriteIns({});
    setIsLoggedIn(false);
    // Clear ev-context authed slice so other subdomains (Essentials, etc.)
    // don't show stale compass data after logout.
    if (userId) {
      evContext.setAuthedSlice(userId, {
        compass: { a: {}, i: {}, w: {} },
      }).catch(() => {});
    }
  };

  const handleClearCompass = () => {
    if (!window.confirm("Start a demo compass? Your stances are preserved and can be restored from this menu at any time.")) return;
    // Clear all local state and onboarding flags so the app looks brand-new
    localStorage.removeItem("answers");
    localStorage.removeItem("writeIns");
    localStorage.removeItem("selectedTopics");
    localStorage.removeItem("invertedSpokes");
    localStorage.removeItem("onboarding_spokeFlip");
    localStorage.removeItem("onboarding_postCalTour");
    localStorage.removeItem("onboarding_writeInHint");
    localStorage.removeItem("calibration_skipped");
    localStorage.removeItem("calibration_completed");
    localStorage.removeItem("calibration_progress");
    localStorage.removeItem("savePromptModalDismissed");
    localStorage.removeItem("quiz_progress");
    localStorage.removeItem("onboarding_libraryTour");
    localStorage.removeItem("onboarding_compareTour");
    localStorage.removeItem("onboarding_topicPickHint");
    localStorage.removeItem("onboarding_answerTour");
    // Clear context state
    setAnswers({});
    setWriteIns({});
    setSelectedTopics([]);
    setInvertedSpokes({});
    // Clear active topics on server so other EV features see an empty compass.
    // Answers (stances) are intentionally preserved — Restore reactivates them.
    apiFetch('/compass/selected-topics', {
      method: "PUT",
      body: JSON.stringify({ topic_ids: [] }),
    }).catch(() => {});
    // Remount Compass.jsx and navigate to it so the calibration tutorial fires.
    setCompassVersion((v) => v + 1);
    navigate('/results');
  };

  const ADMIN_SNAPSHOT_KEY = "admin_compass_snapshot";

  const handleSaveStances = async () => {
    const count = Object.keys(answers).length;
    if (count === 0) {
      alert("No answers to save — calibrate your compass first.");
      return;
    }
    const snapshot = { answers, writeIns, invertedSpokes, selectedTopics };

    // Save to localStorage
    localStorage.setItem(ADMIN_SNAPSHOT_KEY, JSON.stringify(snapshot));

    // Verify the write succeeded
    const verify = localStorage.getItem(ADMIN_SNAPSHOT_KEY);
    if (!verify) {
      alert("localStorage save failed — your browser may be blocking storage. Stances NOT saved.");
      return;
    }

    // Also back up to server: re-POST all current answers so the server copy
    // is fresh even if localStorage is cleared before Restore is used.
    const titleToId = new Map(topics.map((t) => [t.short_title, t.id]));
    let serverSaveOk = true;
    for (const [shortTitle, value] of Object.entries(answers)) {
      const topic_id = titleToId.get(shortTitle);
      if (!topic_id) continue;
      const body = { topic_id, value };
      if (writeIns[shortTitle]) body.write_in_text = writeIns[shortTitle];
      const res = await apiFetch('/compass/answers', { method: 'POST', body: JSON.stringify(body) }).catch(() => null);
      if (!res || !res.ok) serverSaveOk = false;
    }
    await apiFetch('/compass/selected-topics', {
      method: 'PUT',
      body: JSON.stringify({ topic_ids: selectedTopics }),
    }).catch(() => { serverSaveOk = false; });

    alert(`Stances saved (${count} topic${count === 1 ? "" : "s"})${serverSaveOk ? " — backed up to server." : " — localStorage only (server sync failed)."}`);
  };

  const handleRestoreStances = async () => {
    // Try localStorage first, fall back to server if missing
    const raw = localStorage.getItem(ADMIN_SNAPSHOT_KEY);
    let ans, wi, inv, sel;

    if (raw) {
      let snapshot;
      try { snapshot = JSON.parse(raw); } catch {
        alert("Saved snapshot is corrupted. Try restoring from server...");
      }
      if (snapshot) {
        ans = snapshot.answers || {};
        wi  = snapshot.writeIns || {};
        inv = snapshot.invertedSpokes || {};
        sel = snapshot.selectedTopics || [];
      }
    }

    // Fall back to fetching from server
    if (!ans || Object.keys(ans).length === 0) {
      const res = await apiFetch('/compass/answers').catch(() => null);
      if (!res || !res.ok) {
        alert("No saved stances found locally or on the server. Use 'Save stances' first.");
        return;
      }
      const data = await res.json();
      if (!data || data.length === 0) {
        alert("No saved stances found — use 'Save stances' first.");
        return;
      }
      // Rebuild answers map from server data
      ans = {};
      wi  = {};
      for (const row of data) {
        const topic = topics.find(t => t.id === row.topic_id);
        if (!topic) continue;
        ans[topic.short_title] = row.value;
        if (row.write_in_text) wi[topic.short_title] = row.write_in_text;
      }
      inv = invertedSpokes; // can't recover from server, keep current
      sel = data.map(r => r.topic_id);
      // Also fetch selected topics from server
      const selRes = await apiFetch('/compass/selected-topics').catch(() => null);
      if (selRes && selRes.ok) {
        const selData = await selRes.json();
        if (Array.isArray(selData) && selData.length > 0) sel = selData;
      }
    }

    // Active compass topics are capped at 8 — the compass is designed for 3–8 spokes.
    // Answers (stances) can exist for any number of topics regardless of this cap.
    sel = (sel || []).slice(0, 8);

    const count = Object.keys(ans).length;

    // Restore local state + localStorage
    setAnswers(ans);
    setWriteIns(wi);
    setInvertedSpokes(inv);
    setSelectedTopics(sel);
    localStorage.setItem("answers", JSON.stringify(ans));
    localStorage.setItem("writeIns", JSON.stringify(wi));
    localStorage.setItem("invertedSpokes", JSON.stringify(inv));
    localStorage.setItem("selectedTopics", JSON.stringify(sel));
    localStorage.setItem("calibration_completed", "true");
    localStorage.removeItem("calibration_skipped");
    localStorage.removeItem("calibration_progress");

    // Re-sync answers to server and WAIT before navigating — the batch fetch in
    // Compass.jsx fires on mount and uses the server as its source of truth.
    // If we navigate before the POSTs land, the batch fetch sees empty server
    // state and the compass appears blank even though local state is correct.
    const titleToId = new Map(topics.map((t) => [t.short_title, t.id]));
    const syncPromises = Object.entries(ans).map(([shortTitle, value]) => {
      const topic_id = titleToId.get(shortTitle);
      if (!topic_id) return Promise.resolve();
      const body = { topic_id, value };
      if (wi[shortTitle]) body.write_in_text = wi[shortTitle];
      return apiFetch('/compass/answers', { method: 'POST', body: JSON.stringify(body) }).catch(() => {});
    });
    syncPromises.push(
      apiFetch('/compass/selected-topics', {
        method: 'PUT',
        body: JSON.stringify({ topic_ids: sel }),
      }).catch(() => {})
    );
    await Promise.all(syncPromises);

    alert(`Stances restored (${count} topic${count === 1 ? "" : "s"}).`);

    // Bump compassVersion to remount Compass.jsx — this resets its local calibration
    // state (calibrationActive etc.) without a full page reload, so all the correctly
    // restored CompassContext state (answers, selectedTopics) is preserved intact.
    setCompassVersion((v) => v + 1);
    // Navigate to /results so the user sees the compass. If already there the key
    // change above is sufficient; navigate is still called to ensure they land there.
    navigate('/results');

    // Update ev-context cache in background so other subdomains see the restored data.
    if (userId) {
      evContext.setAuthedSlice(userId, {
        compass: { a: ans, i: inv, w: wi },
      }).catch(() => {});
    }
  };

  const handleNavigate = (href) => {
    if (href.startsWith("/")) {
      navigate(href);
    } else {
      window.location.href = href;
    }
  };

  const profileItems = [
    ...(isAdmin ? [
      { label: "Admin", href: "/admin" },
      { label: "Save stances", onClick: handleSaveStances },
      { label: "Restore stances", onClick: handleRestoreStances },
    ] : []),
    { label: "Reset compass", onClick: handleClearCompass },
    { label: "Logout", onClick: logout },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <ReturnBanner />
      <SiteHeader
        logoSrc="/EVLogo.svg"
        currentPath={location.pathname}
        onNavigate={handleNavigate}
        profileMenu={
          authChecking
            ? { label: null, items: [] }
            : isLoggedIn
              ? { label: username, items: profileItems }
              : { label: null, items: [{ label: "Sign in", onClick: () => navigate("/login") }] }
        }
      />
      <main className="flex-1">{children}</main>
      {/* How It Works button — always visible */}
      <button
        onClick={() => navigate("/how-it-works")}
        className="fixed bottom-4 right-4 z-40 w-9 h-9 rounded-full bg-white border border-gray-300 shadow-md flex items-center justify-center text-gray-500 hover:text-[#00657c] hover:border-[#00657c] transition-colors cursor-pointer"
        title="How the Compass works"
        aria-label="How the Compass works"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM8.94 6.94a.75.75 0 11-1.061-1.061 3 3 0 112.871 5.026v.345a.75.75 0 01-1.5 0v-.5c0-.72.57-1.172 1.081-1.287A1.5 1.5 0 108.94 6.94zM10 15a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  );
}

export default Layout;
