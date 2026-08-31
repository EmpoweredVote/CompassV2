import { describe, it, expect } from "vitest";
import {
  eventsForOpen,
  eventForGetStarted,
  eventForAnswer,
  eventForQuestionSkip,
  eventForComplete,
  eventForAbandon,
} from "./calibrationEvents.js";

// A first-time visitor: the overlay auto-routed them in and they are looking at
// the welcome screen, having chosen nothing yet.
const FRESH = {
  entryStep: "welcome",
  entryReason: "auto_uncalibrated",
  lens: "default",
  resume: false,
  totalTopics: 0,
};

describe("eventsForOpen", () => {
  it("🔴 reports the overlay appearing but NOT a start, while the user is still on welcome", () => {
    // THE MEASUREMENT BUG THIS MODULE EXISTS FOR. compass_quiz_started fired
    // from a bare mount effect, so "23 started" in the funnel actually counted
    // "the overlay appeared 23 times" — a welcome screen nobody pressed is
    // indistinguishable from a calibration somebody began.
    const events = eventsForOpen(FRESH);
    expect(events.map(e => e.event)).toEqual(["compass_quiz_started"]);
  });

  it("stamps the surface, entry step and entry reason on the open event", () => {
    // entry_reason is the only thing that separates "we showed this to an
    // uncalibrated visitor" from "they asked for it" — the two halves of the
    // 52 → 23 landing drop.
    const [open] = eventsForOpen(FRESH);
    expect(open.props).toMatchObject({
      quiz_type: "calibration",
      surface: "overlay",
      entry_step: "welcome",
      entry_reason: "auto_uncalibrated",
      lens: "default",
      resume: false,
    });
  });

  it("reports a start immediately when the overlay opens past the welcome screen", () => {
    // A resumed or lens-scoped overlay never shows a welcome screen, so there is
    // no press to wait for: opening IS starting. Without this the funnel would
    // show these sessions answering questions they never started.
    const events = eventsForOpen({
      ...FRESH,
      entryStep: "answer",
      entryReason: "auto_unanswered_topics",
      resume: true,
      totalTopics: 8,
    });
    expect(events.map(e => e.event)).toEqual([
      "compass_quiz_started",
      "compass_calibration_started",
    ]);
    expect(events[1].props).toMatchObject({
      total_topics: 8,
      surface: "overlay",
      from_step: "answer",
    });
  });

  it("reports a start when the overlay opens on a lens intro", () => {
    const events = eventsForOpen({ ...FRESH, entryStep: "lens_intro", lens: "federal_lens", totalTopics: 8 });
    expect(events.map(e => e.event)).toEqual([
      "compass_quiz_started",
      "compass_calibration_started",
    ]);
    expect(events[1].props.lens).toBe("federal_lens");
  });

  it("omits topic_count from the open event when no topics are picked yet", () => {
    // total_topics: 0 on the open event would read as "a calibration of zero
    // topics" rather than "not chosen yet". The catalog makes it optional.
    const [open] = eventsForOpen(FRESH);
    expect(open.props).not.toHaveProperty("topic_count");
    const [lensOpen] = eventsForOpen({ ...FRESH, entryStep: "lens_intro", totalTopics: 8 });
    expect(lensOpen.props.topic_count).toBe(8);
  });
});

describe("eventForGetStarted", () => {
  it("reports the start the user pressed for, from the step they pressed it on", () => {
    const { event, props } = eventForGetStarted({ fromStep: "welcome", totalTopics: 0, lens: "default" });
    expect(event).toBe("compass_calibration_started");
    expect(props).toMatchObject({ surface: "overlay", from_step: "welcome", total_topics: 0 });
  });
});

describe("eventForAnswer", () => {
  it("carries the topic, the running count and the total", () => {
    // answered_count per event is what gives the interior drop curve: which
    // question number people quit on, not merely which step.
    const { event, props } = eventForAnswer({
      topicSlug: "climate-change",
      answeredCount: 3,
      totalTopics: 8,
      answerType: "stance",
    });
    expect(event).toBe("compass_calibration_question_answered");
    expect(props).toEqual({
      topic_slug: "climate-change",
      answered_count: 3,
      total_topics: 8,
      surface: "overlay",
      answer_type: "stance",
    });
  });

  it("distinguishes a write-in from a pre-written stance", () => {
    const { props } = eventForAnswer({
      topicSlug: "housing",
      answeredCount: 1,
      totalTopics: 8,
      answerType: "write_in",
    });
    expect(props.answer_type).toBe("write_in");
  });
});

describe("eventForQuestionSkip", () => {
  it("reports a skipped question against the same counts as an answered one", () => {
    const { event, props } = eventForQuestionSkip({
      topicSlug: "taxes",
      answeredCount: 2,
      totalTopics: 8,
    });
    expect(event).toBe("compass_calibration_question_skipped");
    expect(props).toEqual({
      topic_slug: "taxes",
      answered_count: 2,
      total_topics: 8,
      surface: "overlay",
    });
  });
});

describe("eventForComplete", () => {
  it("carries the answer counts the overlay has never reported", () => {
    // The overlay fired compass_calibration_completed with only a lens, so a
    // completion told you nothing about how much of the compass got filled in.
    const { event, props } = eventForComplete({ answeredCount: 7, totalTopics: 8, lens: "default" });
    expect(event).toBe("compass_calibration_completed");
    expect(props).toMatchObject({ answered_count: 7, total_topics: 8, lens: "default", surface: "overlay" });
  });
});

describe("eventForAbandon", () => {
  it("reports how far through the flow the exit happened", () => {
    const { event, props } = eventForAbandon({
      exitFrom: "answer",
      exitVia: "dismiss",
      answeredCount: 2,
      totalTopics: 8,
    });
    expect(event).toBe("compass_calibration_abandoned");
    expect(props).toMatchObject({
      answered_count: 2,
      total_topics: 8,
      progress_pct: 25,
      exit_from: "answer",
      exit_via: "dismiss",
      surface: "overlay",
    });
  });

  it("reports 0% rather than NaN when nothing was picked", () => {
    // The welcome-screen exit is the single most common one and it divides by
    // zero. NaN ingests as null and silently drops the row out of any numeric
    // filter on progress_pct.
    const { props } = eventForAbandon({
      exitFrom: "welcome",
      exitVia: "dismiss",
      answeredCount: 0,
      totalTopics: 0,
    });
    expect(props.progress_pct).toBe(0);
  });

  it("distinguishes backing out of the first question from dismissing the flow", () => {
    // handleSkip had three callers — the welcome dismiss, the pick dismiss, and
    // the Back arrow on question one — collapsed into one silent exit. Backing
    // out is a navigation mistake; dismissing is a decision.
    const back = eventForAbandon({ exitFrom: "answer", exitVia: "back", answeredCount: 0, totalTopics: 8 });
    const dismiss = eventForAbandon({ exitFrom: "answer", exitVia: "dismiss", answeredCount: 0, totalTopics: 8 });
    expect(back.props.exit_via).toBe("back");
    expect(dismiss.props.exit_via).toBe("dismiss");
  });

  it("rounds progress to a whole percent", () => {
    const { props } = eventForAbandon({ exitFrom: "answer", exitVia: "dismiss", answeredCount: 1, totalTopics: 3 });
    expect(props.progress_pct).toBe(33);
  });
});
