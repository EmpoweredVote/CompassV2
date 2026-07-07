import { useNavigate, useLocation } from "react-router";
import { Header, evContext, getFeedbackUrl } from "@empoweredvote/ev-ui";
import { useCompass } from "../components/CompassContext";
import { useTheme } from "../ThemeProvider";
import ReturnBanner from "./ReturnBanner";
import { apiFetch, getToken, clearToken, API_BASE } from "../lib/auth";
import { isLensTopicSet } from "../lib/lenses";

function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDark, toggle: toggleDark } = useTheme();
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
    if (!window.confirm("Reset to a demo compass? This clears your current stances locally — use 'Save stances' first if you want to restore them later.")) return;
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
    // Clear active topics and all stored answers on server so batch fetch on
    // remount finds nothing and cannot repopulate the freshly-reset compass.
    apiFetch('/compass/selected-topics', {
      method: "PUT",
      body: JSON.stringify({ topic_ids: [] }),
    }).catch(() => {});
    apiFetch('/compass/answers/me', { method: "DELETE" }).catch(() => {});
    // Remount CombinedPage and navigate to it so the calibration tutorial fires.
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
    // Only persist selected topics when they represent the user's own chosen compass.
    // A lens (Local/Judicial) is a view overlay — saving it would overwrite the user's
    // real compass on the server. Answers above always save; the lens view does not.
    if (!isLensTopicSet(selectedTopics)) {
      await apiFetch('/compass/selected-topics', {
        method: 'PUT',
        body: JSON.stringify({ topic_ids: selectedTopics }),
      }).catch(() => { serverSaveOk = false; });
    }

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

    // Build a title→id map (used for both sel expansion and server sync below).
    const titleToId = new Map(topics.map((t) => [t.short_title, t.id]));

    // Cap at 8, then fill up from other answered topics so the restored compass
    // shows a full picture instead of the same few spokes that were active when
    // the snapshot was saved.
    sel = (sel || []).slice(0, 8);
    if (sel.length < 8) {
      const selSet = new Set(sel);
      const moreAnswered = Object.entries(ans)
        .filter(([, v]) => typeof v === 'number' && v > 0)
        .map(([title]) => titleToId.get(title))
        .filter(id => id != null && !selSet.has(id));
      sel = [...sel, ...moreAnswered].slice(0, 8);
    }

    const count = Object.keys(ans).length;

    // Write directly to localStorage — do NOT call React state setters here.
    // State setters would trigger the ev-context write effect, which posts to the
    // ev-context broker iframe; the MessagePort response arrives during an active
    // React reconciliation cycle and crashes ev-ui with a TDZ error. Since we
    // redirect with window.location.href below, localStorage is the source of
    // truth and React state is irrelevant for this render.
    localStorage.setItem("answers", JSON.stringify(ans));
    localStorage.setItem("writeIns", JSON.stringify(wi));
    localStorage.setItem("invertedSpokes", JSON.stringify(inv));
    localStorage.setItem("selectedTopics", JSON.stringify(sel));
    localStorage.setItem("calibration_completed", "true");
    localStorage.removeItem("calibration_skipped");
    localStorage.removeItem("calibration_progress");

    // Sync to server before navigating — CombinedPage batch-fetches answers on
    // mount so the server must be up-to-date before the page reloads.
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

    // Update context state directly — no page reload needed.
    // setCompassVersion remounts CombinedPage (keyed on compassVersion in App.jsx)
    // so its local calibration flags re-initialize from localStorage.
    setAnswers(ans);
    setWriteIns(wi);
    setInvertedSpokes(inv);
    setSelectedTopics(sel);
    setCompassVersion((v) => v + 1);
    navigate('/results');
  };

  const handleNavigate = (href) => {
    if (href === '/') {
      window.location.href = 'https://alpha.empowered.vote';
    } else if (href.startsWith("/")) {
      navigate(href);
    } else {
      window.location.href = href;
    }
  };

  const profileItems = [
    ...(isAdmin ? [
      { label: "Admin", href: "/admin" },
      { label: `Save stances (${Object.keys(answers).length})`, onClick: handleSaveStances },
      { label: "Restore stances", onClick: handleRestoreStances },
      { label: "Reset compass", onClick: handleClearCompass },
    ] : []),
    { label: "Profile", onClick: () => { window.location.href = 'https://login.empowered.vote/profile'; } },
    { label: "EV Financials", onClick: () => { window.location.href = 'https://financials.empowered.vote'; } },
    { label: "Feedback", href: getFeedbackUrl() },
    { label: "Logout", onClick: logout },
  ];

  const DarkToggle = () => (
    <button
      onClick={toggleDark}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
    >
      {isDark ? (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path d="M10 2a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 2zM10 15a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15zM10 7a3 3 0 100 6 3 3 0 000-6zM15.657 5.404a.75.75 0 10-1.06-1.06l-1.061 1.06a.75.75 0 001.06 1.06l1.061-1.06zM6.464 14.596a.75.75 0 10-1.06-1.06l-1.061 1.06a.75.75 0 001.06 1.06l1.061-1.06zM18 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 0118 10zM5 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 015 10zM14.596 15.657a.75.75 0 001.06-1.06l-1.06-1.061a.75.75 0 10-1.06 1.06l1.06 1.061zM5.404 6.464a.75.75 0 001.06-1.06l-1.06-1.061a.75.75 0 10-1.06 1.06l1.06 1.061z" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path fillRule="evenodd" d="M7.455 2.004a.75.75 0 01.26.77 7 7 0 009.958 7.967.75.75 0 011.067.853A8.5 8.5 0 116.647 1.921a.75.75 0 01.808.083z" clipRule="evenodd" />
        </svg>
      )}
    </button>
  );

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#131416] text-gray-900 dark:text-[#D3D7DE]">
      <ReturnBanner />
      <Header
        logoSrc={isDark ? "/compass-logo-dark.png" : "/compass-logo-light.svg"}
        logoAlt="Empowered Compass"
        navItems={[]}
        currentPath={location.pathname}
        onNavigate={handleNavigate}
        darkMode={isDark}
        secondaryAction={<DarkToggle />}
        profileMenu={
          authChecking
            ? { label: null, items: [] }
            : isLoggedIn
              ? { label: username, items: profileItems }
              : { label: null, items: [
                  { label: "Sign in", onClick: () => navigate("/login") },
                  { label: "Feedback", href: getFeedbackUrl() },
                  { label: "EV Financials", onClick: () => { window.location.href = 'https://financials.empowered.vote'; } },
                ] }
        }
      />
      <main className="flex-1">{children}</main>
      {/* How It Works button — always visible */}
      <button
        onClick={() => navigate("/how-it-works")}
        className="fixed bottom-4 right-4 z-40 w-9 h-9 rounded-full bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 shadow-md flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-[#00657c] dark:hover:text-ev-teal-light hover:border-[#00657c] dark:hover:border-ev-teal-light transition-colors cursor-pointer"
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
