// The panel has to work with a flag, with a thread, or with both — and the
// no-flag case is the one phase 2 added, so it is the one worth holding shut.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import QuestionNotes from "./QuestionNotes.jsx";

let container;
let root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = (props) =>
  act(() => {
    root.render(<QuestionNotes topicTitle="Childcare" onClose={() => {}} onRecalibrate={() => {}} {...props} />);
  });

const FLAG = {
  topicId: "t1",
  reason: "question_revised",
  disposition: "reworded",
  publicNote: "Rewrote the five options in plainer language.",
  answeredText: "The state should fund it.",
  effectiveText: "The state should fund most of it.",
  effectiveRevisionId: "rev-v2",
};

const ENTRIES = [
  {
    id: "j2", kind: "changed", title: "We split the funding question",
    body: "Two things were being asked at once.\n\nSo we split them.",
    season: { number: 2, name: "Season 2" }, revisionId: "rev-v2", answersId: "j1",
    author: { label: "riverkeeper" }, publishedAt: "2026-10-13T12:00:00.000Z",
    affectsYou: true,
  },
  {
    id: "j1", kind: "watching", title: null,
    body: "Officials keep answering this one two ways.",
    season: { number: 2, name: "Season 2" }, revisionId: null, answersId: null,
    author: { label: "Dana Reyes" }, publishedAt: "2026-09-01T12:00:00.000Z",
    affectsYou: false,
  },
];

const text = () => container.textContent;

describe("with a flag and a thread", () => {
  it("shows the flag's business first and the diary under it", () => {
    render({ flag: FLAG, entries: ENTRIES });

    expect(text()).toContain("This question was updated");
    // Editorial's own wording, verbatim.
    expect(text()).toContain("Rewrote the five options in plainer language.");
    expect(container.querySelector('[data-testid="topic-thread"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="journal-entry-j2"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="recalibrate-confirm"]')).not.toBeNull();
  });

  it("names the entry that caused this reader's flag, and only that one", () => {
    render({ flag: FLAG, entries: ENTRIES });

    const marked = container.querySelectorAll('[data-testid="journal-affects-you"]');
    expect(marked).toHaveLength(1);
    expect(
      container.querySelector('[data-testid="journal-entry-j2"]')
        .querySelector('[data-testid="journal-affects-you"]')
    ).not.toBeNull();
  });

  it("renders the body as paragraphs, not one block", () => {
    render({ flag: FLAG, entries: ENTRIES });

    const entry = container.querySelector('[data-testid="journal-entry-j2"]');
    expect(entry.querySelectorAll("p").length).toBeGreaterThan(2);
  });
});

describe("with a thread and no flag", () => {
  // 🔴 THE CASE PHASE 2 EXISTS FOR. Answering a flagged question clears its
  // flag; before this, that made the note unreachable for good. The panel must
  // open with nothing but the diary in it.
  it("opens on the diary alone", () => {
    render({ flag: undefined, entries: ENTRIES });

    expect(container.querySelector('[data-testid="topic-thread"]')).not.toBeNull();
    expect(text()).toContain("Childcare");
    expect(text()).toContain("We split the funding question");
  });

  // copyFor() falls back to the `reworded` wording for anything it does not
  // recognise, so a defaulted flag would tell a reader with no flag at all that
  // their answer "was given against the earlier wording".
  it("says nothing about an answer that was never flagged", () => {
    render({ flag: undefined, entries: ENTRIES });

    expect(text()).not.toContain("This question was updated");
    expect(text()).not.toContain("earlier wording");
    expect(container.querySelector('[data-testid="what-changed"]')).toBeNull();
    expect(container.querySelector('[data-testid="public-note"]')).toBeNull();
  });

  it("offers Close and no action that would change an answer", () => {
    render({ flag: undefined, entries: ENTRIES });

    expect(container.querySelector('[data-testid="recalibrate-confirm"]')).toBeNull();
    expect(container.querySelector('[data-testid="recalibrate-later"]').textContent).toBe("Close");
  });
});

describe("with a flag and no thread", () => {
  it("renders exactly what it rendered before the journal existed", () => {
    render({ flag: FLAG, entries: [] });

    expect(text()).toContain("This question was updated");
    expect(container.querySelector('[data-testid="topic-thread"]')).toBeNull();
    expect(container.querySelector('[data-testid="recalibrate-confirm"]')).not.toBeNull();
  });

  it("says it is loading rather than nothing while the thread is on its way", () => {
    render({ flag: FLAG, entries: [], loadingEntries: true });

    expect(container.querySelector('[data-testid="topic-thread"]')).not.toBeNull();
    expect(text()).toContain("Loading");
  });
});
