// The one stance list every answering surface renders. These tests pin the
// contract four call sites depend on: the display order (which is relative to
// the spoke's random inversion, never to a fixed pole), the smoke suite's
// `stance-option` hook, and the write-in card's placement -> value math.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";

// A dnd-kit pointer drag is not reproducible under jsdom: the sensors need
// real pointer geometry and the collision detection needs layout, neither of
// which jsdom provides. The real DndContext still renders here — this wrapper
// only records the `onDragEnd` it is handed, so a test can invoke the
// component's own handler with the active/over pair a real drag would produce.
const drag = { end: null };
vi.mock("@dnd-kit/core", async (importOriginal) => {
  const actual = await importOriginal();
  const { createElement } = await import("react");
  return {
    ...actual,
    DndContext: (props) => {
      drag.end = props.onDragEnd;
      return createElement(actual.DndContext, props);
    },
  };
});

import StanceChooser, { WRITE_IN_SAVE_DEBOUNCE_MS } from "./StanceChooser.jsx";

const TOPIC = { id: "t1", short_title: "Topic One" };

// Deliberately out of order: display order must come from `orderStances`,
// not from the order the caller happened to hold them in.
const STANCES = [
  { id: "s3", value: 3, text: "Stance 3" },
  { id: "s1", value: 1, text: "Stance 1" },
  { id: "s5", value: 5, text: "Stance 5" },
  { id: "s2", value: 2, text: "Stance 2" },
  { id: "s4", value: 4, text: "Stance 4" },
];

let container;
let root;

beforeEach(() => {
  drag.end = null;
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
    root.render(<StanceChooser topic={TOPIC} stances={STANCES} {...props} />);
  });

const options = () => [...container.querySelectorAll('[data-testid="stance-option"]')];
const optionText = () => options().map((b) => b.textContent);
const writeOwn = () => container.querySelector('[data-testid="write-own-option"]');
const card = () => container.querySelector('[data-testid="write-in-card"]');
const stanceRowTexts = () =>
  [...container.querySelectorAll('[data-testid="stance-row"]')].map((el) => el.textContent);
const rowIndexOfCard = () => {
  const rows = [
    ...container.querySelectorAll('[data-testid="stance-row"], [data-testid="write-in-card"]'),
  ];
  return rows.findIndex((el) => el.dataset.testid === "write-in-card");
};

const click = (el) =>
  act(() => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

const type = (text) =>
  act(() => {
    const textarea = card().querySelector("textarea");
    const setValue = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value",
    ).set;
    setValue.call(textarea, text);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });

describe("ordering", () => {
  it("renders stances descending when not inverted, each tagged for the smoke suite", () => {
    render({ isInverted: false });

    expect(optionText()).toEqual([
      "Stance 5",
      "Stance 4",
      "Stance 3",
      "Stance 2",
      "Stance 1",
    ]);
    // The smoke suite's only stance selector.
    expect(options()).toHaveLength(5);
    for (const button of options()) {
      expect(button.dataset.testid).toBe("stance-option");
    }
  });

  it("renders ascending when inverted", () => {
    render({ isInverted: true });

    expect(optionText()).toEqual([
      "Stance 1",
      "Stance 2",
      "Stance 3",
      "Stance 4",
      "Stance 5",
    ]);
  });
});

describe("picking a pre-written stance", () => {
  it("clears a write-in before reporting a pre-written stance pick", () => {
    const calls = [];
    const onCancelWriteIn = vi.fn(() => calls.push("cancel"));
    const onSelectStance = vi.fn(() => calls.push("select"));

    // A stored stance value with write-in text still hanging off it: the
    // state both parents hand-cleared before this component owned it.
    render({
      currentAnswer: 3,
      writeInText: "my own view",
      onCancelWriteIn,
      onSelectStance,
    });

    click(options()[0]); // Stance 5

    expect(onCancelWriteIn).toHaveBeenCalledWith(TOPIC);
    expect(onSelectStance).toHaveBeenCalledWith(TOPIC, 5);
    expect(calls).toEqual(["cancel", "select"]);
  });

  it("does not report a cancel when there is no write-in to clear", () => {
    const onCancelWriteIn = vi.fn();
    const onSelectStance = vi.fn();
    render({ currentAnswer: 3, onCancelWriteIn, onSelectStance });

    click(options()[1]); // Stance 4

    expect(onCancelWriteIn).not.toHaveBeenCalled();
    expect(onSelectStance).toHaveBeenCalledWith(TOPIC, 4);
  });
});

describe("the write-in card", () => {
  it("reports placement as a half-step value", () => {
    const onSelectWriteIn = vi.fn();
    render({ isInverted: false, onSelectWriteIn });

    click(writeOwn());
    type("my own view");

    // The card opens appended below the five stances (index 5); this is the
    // drop a user makes by dragging it up onto the second row.
    act(() => drag.end({ active: { id: "write-in" }, over: { id: "s4" } }));

    expect(onSelectWriteIn).toHaveBeenCalledWith(TOPIC, 4.5, "my own view");
    // The reported value and the card the user is looking at agree.
    expect(rowIndexOfCard()).toBe(1);
  });

  // The drop reports a value outward, but a parent that saves async — or never
  // feeds currentAnswer back — would leave the component thinking nothing is
  // placed, and every keystroke after the drop would go nowhere.
  it("keeps saving text after a drop without waiting for the parent to echo the value", () => {
    const onSelectWriteIn = vi.fn();
    render({ currentAnswer: null, onSelectWriteIn });

    click(writeOwn());
    type("first");
    act(() => drag.end({ active: { id: "write-in" }, over: { id: "s4" } }));
    onSelectWriteIn.mockClear();

    // currentAnswer is deliberately still null: the parent never echoed.
    type("first and more");

    expect(onSelectWriteIn).toHaveBeenCalledWith(TOPIC, 4.5, "first and more");
  });

  // Dragging before typing is the natural order — the card opens empty and the
  // drag hint sits inside it. A blank write-in is not an answer: reported, it
  // would POST `write_in_text: ""` and, if it filled the last gap, raise the
  // "Fully calibrated" banner on nothing.
  it("records nothing for a drag made before anything is typed", () => {
    const onSelectWriteIn = vi.fn();
    const onPersistWriteIn = vi.fn();
    render({ currentAnswer: null, onSelectWriteIn, onPersistWriteIn });

    click(writeOwn());
    act(() => drag.end({ active: { id: "write-in" }, over: { id: "s4" } }));

    expect(onSelectWriteIn).not.toHaveBeenCalled();
    expect(onPersistWriteIn).not.toHaveBeenCalled();
    // The placement is held on screen, so no second drag is needed.
    expect(rowIndexOfCard()).toBe(1);

    // ...and the first keystroke saves at the slot just dragged to, not at the
    // foot of the list where the card started.
    type("my own view");

    expect(onSelectWriteIn).toHaveBeenCalledWith(TOPIC, 4.5, "my own view");
  });

  it("tells the parent when write-in mode opens and closes", () => {
    const onWriteInModeChange = vi.fn();
    const onOpenWriteIn = vi.fn();
    render({ onWriteInModeChange, onOpenWriteIn });

    click(writeOwn());
    expect(onOpenWriteIn).toHaveBeenCalledTimes(1);
    expect(onWriteInModeChange).toHaveBeenCalledTimes(1);
    expect(onWriteInModeChange).toHaveBeenLastCalledWith(true);
    expect(card()).not.toBeNull();

    click(card().querySelector('[data-testid="write-in-cancel"]'));
    expect(onWriteInModeChange).toHaveBeenCalledTimes(2);
    expect(onWriteInModeChange).toHaveBeenLastCalledWith(false);
    expect(card()).toBeNull();
    expect(options()).toHaveLength(5);
  });

  it("clears the stored answer when the text is emptied, without closing the card", () => {
    const onCancelWriteIn = vi.fn();
    render({ currentAnswer: 2.5, writeInText: "my own view", onCancelWriteIn });

    expect(card()).not.toBeNull();
    expect(rowIndexOfCard()).toBe(3); // 5 stances, value 2.5, not inverted
    type("   ");

    // The answer goes — an empty write-in is not an answer.
    expect(onCancelWriteIn).toHaveBeenCalledWith(TOPIC);
    // The placement does not.
    expect(card()).not.toBeNull();
    expect(rowIndexOfCard()).toBe(3);
  });

  // Select-all-and-retype is how people rewrite a sentence. It must not cost
  // them the position on the scale they already chose.
  it("re-saves at the same placement after the text is cleared and retyped", () => {
    const onSelectWriteIn = vi.fn();
    const onCancelWriteIn = vi.fn();
    render({ currentAnswer: null, onSelectWriteIn, onCancelWriteIn });

    click(writeOwn());
    type("my own view");
    act(() => drag.end({ active: { id: "write-in" }, over: { id: "s4" } }));
    expect(onSelectWriteIn).toHaveBeenLastCalledWith(TOPIC, 4.5, "my own view");
    expect(rowIndexOfCard()).toBe(1);

    type("");
    expect(onCancelWriteIn).toHaveBeenCalledWith(TOPIC);

    // The parent honours that by clearing its stored value, and re-renders.
    render({ currentAnswer: null, onSelectWriteIn, onCancelWriteIn });
    expect(card()).not.toBeNull();
    expect(rowIndexOfCard()).toBe(1);
    expect(card().querySelector("textarea").value).toBe("");

    onSelectWriteIn.mockClear();
    type("second thoughts");

    // The original half-step, with no second drag — not a default.
    expect(onSelectWriteIn).toHaveBeenCalledWith(TOPIC, 4.5, "second thoughts");
  });

  // Review Focus 3
  it("shows the write-in card for a half-step value with no text", () => {
    render({ currentAnswer: 2.5, writeInText: "" });

    expect(card()).not.toBeNull();
    expect(card().querySelector("textarea").value).toBe("");
  });

  // Full Calibration puts a Flip control inches above this card. Nothing is
  // stored until a placement exists, so a flip mid-sentence had nothing to
  // restore the typed text from and simply threw it away.
  it("keeps an open, undragged card and its text when the spoke is flipped", () => {
    render({ currentAnswer: null, isInverted: false });
    click(writeOwn());
    type("half a thought");

    render({ currentAnswer: null, isInverted: true });

    expect(card()).not.toBeNull();
    expect(card().querySelector("textarea").value).toBe("half a thought");
    // Never placed, so it stays parked at the foot of the flipped list.
    expect(rowIndexOfCard()).toBe(5);
    expect(container.querySelectorAll('[data-testid="stance-row"]')).toHaveLength(5);
  });

  it("re-derives a dragged card's row when the spoke is flipped mid-write-in", () => {
    const onSelectWriteIn = vi.fn();
    render({ currentAnswer: null, isInverted: false, onSelectWriteIn });
    click(writeOwn());
    type("my own view");
    act(() => drag.end({ active: { id: "write-in" }, over: { id: "s4" } }));
    expect(rowIndexOfCard()).toBe(1); // value 4.5, descending list

    render({ currentAnswer: null, isInverted: true, onSelectWriteIn });

    // Same stored value, mirrored list: 4.5 of 5 ascending sits at row 4.
    expect(rowIndexOfCard()).toBe(4);
    expect(card().querySelector("textarea").value).toBe("my own view");

    onSelectWriteIn.mockClear();
    type("my own view, restated");
    expect(onSelectWriteIn).toHaveBeenCalledWith(TOPIC, 4.5, "my own view, restated");
  });

  // Roughly half of all question changes carry the same inversion as the one
  // before, which is exactly when a flip-tracking ref never gets written. The
  // flip that follows must still work — and the list the user is looking at is
  // what a drop has to be scored against. Reporting the far end of someone's
  // scale to the server is the worst thing this component can do.
  it("still flips after a question change that did not change inversion", () => {
    const onSelectWriteIn = vi.fn();
    const NEXT = { id: "t2", short_title: "Topic Two" };
    const common = { currentAnswer: null, onSelectWriteIn };

    render({ isInverted: false, ...common });
    render({ topic: NEXT, isInverted: false, ...common });

    click(writeOwn());
    type("my own view");
    act(() => drag.end({ active: { id: "write-in" }, over: { id: "s4" } }));
    expect(rowIndexOfCard()).toBe(1);
    expect(onSelectWriteIn).toHaveBeenLastCalledWith(NEXT, 4.5, "my own view");

    render({ topic: NEXT, isInverted: true, ...common });

    // The list really did mirror, and the card followed its value.
    expect(stanceRowTexts()).toEqual([
      "Stance 1",
      "Stance 2",
      "Stance 3",
      "Stance 4",
      "Stance 5",
    ]);
    expect(rowIndexOfCard()).toBe(4);

    // Dropping on the top row of an ascending list is the bottom of the scale.
    act(() => drag.end({ active: { id: "write-in" }, over: { id: "s1" } }));
    expect(onSelectWriteIn).toHaveBeenLastCalledWith(NEXT, 0.5, "my own view");
  });

  // Review Focus 4
  it("re-derives the card position when inversion changes", () => {
    render({ currentAnswer: 4.5, writeInText: "my own view", isInverted: false });
    expect(rowIndexOfCard()).toBe(1);

    render({ currentAnswer: 4.5, writeInText: "my own view", isInverted: true });
    expect(card()).not.toBeNull();
    expect(rowIndexOfCard()).toBe(4);
  });
});

describe("saving", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("debounces the persistence callback instead of firing it per keystroke", () => {
    const onPersistWriteIn = vi.fn();
    const onSelectWriteIn = vi.fn();
    render({ currentAnswer: 4.5, writeInText: "mine", onPersistWriteIn, onSelectWriteIn });

    type("mine a");
    type("mine an");
    type("mine and more");

    // Local state is told every time; the API is not.
    expect(onSelectWriteIn).toHaveBeenCalledTimes(3);
    expect(onPersistWriteIn).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(WRITE_IN_SAVE_DEBOUNCE_MS));

    expect(onPersistWriteIn).toHaveBeenCalledTimes(1);
    expect(onPersistWriteIn).toHaveBeenCalledWith(TOPIC, 4.5, "mine and more");
  });

  it("saves a placement immediately rather than waiting out the debounce", () => {
    const onPersistWriteIn = vi.fn();
    render({ currentAnswer: null, onPersistWriteIn });

    click(writeOwn());
    type("my own view");
    act(() => drag.end({ active: { id: "write-in" }, over: { id: "s4" } }));

    expect(onPersistWriteIn).toHaveBeenCalledTimes(1);
    expect(onPersistWriteIn).toHaveBeenCalledWith(TOPIC, 4.5, "my own view");
  });

  it("flushes buffered text when the question changes", () => {
    const onPersistWriteIn = vi.fn();
    render({ currentAnswer: 4.5, writeInText: "mine", onPersistWriteIn });
    type("mine and more");
    expect(onPersistWriteIn).not.toHaveBeenCalled();

    const NEXT = { id: "t2", short_title: "Topic Two" };
    render({ topic: NEXT, currentAnswer: null, onPersistWriteIn });

    // Saved against the topic it was typed on, not the one now on screen.
    expect(onPersistWriteIn).toHaveBeenCalledTimes(1);
    expect(onPersistWriteIn).toHaveBeenCalledWith(TOPIC, 4.5, "mine and more");
  });

  it("drops the buffered save when the write-in is cancelled", () => {
    const onPersistWriteIn = vi.fn();
    render({ currentAnswer: 4.5, writeInText: "mine", onPersistWriteIn });

    type("mine and more");
    click(card().querySelector('[data-testid="write-in-cancel"]'));
    act(() => vi.advanceTimersByTime(WRITE_IN_SAVE_DEBOUNCE_MS * 2));

    expect(onPersistWriteIn).not.toHaveBeenCalled();
    // The × really does abandon it: currentAnswer is still a half-step here,
    // and the dismissal latch is what stops the card springing back open.
    expect(card()).toBeNull();
  });
});

// Important 1: both calibration surfaces load answers after mount, with the
// same topic.id throughout.
describe("data that arrives after mount", () => {
  it("opens the card when a half-step answer lands later", () => {
    render({ currentAnswer: null, writeInText: "" });
    expect(card()).toBeNull();

    render({ currentAnswer: 4.5, writeInText: "my own view" });

    expect(card()).not.toBeNull();
    expect(card().querySelector("textarea").value).toBe("my own view");
    expect(rowIndexOfCard()).toBe(1);
  });

  it("places the card among the stances when the stances land later", () => {
    render({ stances: [], currentAnswer: 4.5, writeInText: "my own view" });
    expect(container.firstChild).toBeNull();

    render({ stances: STANCES, currentAnswer: 4.5, writeInText: "my own view" });

    expect(card()).not.toBeNull();
    expect(container.querySelectorAll('[data-testid="stance-row"]')).toHaveLength(5);
    expect(rowIndexOfCard()).toBe(1);
  });

  // The guarded door CAN fire into an open card — a stance list that changes
  // under it makes `itemsMatchStances` false. What it must never do is put the
  // stored text back over what is being typed.
  it("re-places the card without re-seeding the editor the user is typing in", () => {
    render({ currentAnswer: 4.5, writeInText: "stored text" });
    type("my fresher text");

    // A shorter revision of the same question arrives: the list no longer
    // matches, so the guarded effect runs.
    const SHORTER = STANCES.filter((s) => s.value !== 1);
    render({ stances: SHORTER, currentAnswer: 4.5, writeInText: "stored text" });

    expect(container.querySelectorAll('[data-testid="stance-row"]')).toHaveLength(4);
    expect(rowIndexOfCard()).toBe(0); // 4 stances, value 4.5, not inverted
    expect(card().querySelector("textarea").value).toBe("my fresher text");
  });

  // The round-1 fix closed this for the first question only: an early return
  // that skipped the resets left the previous question's card standing, and the
  // guarded door then saw a list that already looked complete.
  it("does not carry one question's write-in onto the next when stances lag", () => {
    const NEXT = { id: "t2", short_title: "Topic Two" };
    const onSelectWriteIn = vi.fn();
    const onPersistWriteIn = vi.fn();
    const common = { onSelectWriteIn, onPersistWriteIn };

    render({ currentAnswer: 4.5, writeInText: "TOPIC ONE TEXT", ...common });
    expect(card().querySelector("textarea").value).toBe("TOPIC ONE TEXT");

    // Next question, its stances not loaded yet.
    render({ topic: NEXT, stances: [], currentAnswer: 2.5, writeInText: "TOPIC TWO TEXT", ...common });
    expect(container.firstChild).toBeNull();

    // They land.
    render({ topic: NEXT, stances: STANCES, currentAnswer: 2.5, writeInText: "TOPIC TWO TEXT", ...common });

    expect(card().querySelector("textarea").value).toBe("TOPIC TWO TEXT");
    expect(rowIndexOfCard()).toBe(3); // 5 stances, value 2.5, not inverted

    onSelectWriteIn.mockClear();
    onPersistWriteIn.mockClear();
    type("TOPIC TWO TEXT edited");

    expect(onSelectWriteIn).toHaveBeenCalledWith(NEXT, 2.5, "TOPIC TWO TEXT edited");
    // Nothing from the question just left may reach the new one's record.
    for (const [calledTopic, calledValue, calledText] of onSelectWriteIn.mock.calls) {
      expect(calledTopic).toBe(NEXT);
      expect(calledValue).toBe(2.5);
      expect(calledText).not.toContain("TOPIC ONE");
    }
    expect(onPersistWriteIn).not.toHaveBeenCalled(); // still inside the debounce
  });
});

describe("focus", () => {
  it("focuses the editor when the user asks for the card", () => {
    render({ currentAnswer: null });
    click(writeOwn());

    expect(document.activeElement).toBe(card().querySelector("textarea"));
  });

  it("does not take focus when a card is restored", () => {
    // Arriving at an answered question must not pull focus out of whatever
    // list the user is navigating, or scroll the question's heading away.
    render({ currentAnswer: 4.5, writeInText: "my own view" });

    expect(card()).not.toBeNull();
    expect(document.activeElement).not.toBe(card().querySelector("textarea"));
  });
});

describe("layout", () => {
  it("lets the caller set the gap, because four surfaces use four", () => {
    render({ gapClassName: "gap-3" });
    const root = container.querySelector('[data-testid="stance-chooser"]');
    expect(root.className).toContain("gap-3");
    expect(root.className).not.toContain("gap-1.5");
  });

  it("keeps the viewport-height type scaling opt-in", () => {
    render({});
    expect(options()[0].className).not.toContain("clamp");
    expect(options()[0].className).toContain("sm:text-base");

    render({ scaleWithViewport: true });
    expect(options()[0].className).toContain("md:text-[clamp(0.8125rem,1.5vh,0.875rem)]");
  });
});

// Review Focus 5
describe("missing data", () => {
  it("renders nothing rather than throwing when stances are missing or empty", () => {
    // firstChild, not textContent: an empty wrapper div has no text either,
    // and that is the exact thing this is here to rule out.
    render({ stances: [] });
    expect(container.firstChild).toBeNull();

    render({ stances: undefined });
    expect(container.firstChild).toBeNull();

    render({ topic: null });
    expect(container.firstChild).toBeNull();
  });
});

// The card's hint has always said to drag it somewhere, and dnd-kit's default
// screen-reader text has always promised a space-bar pick-up. Neither was
// reachable without a pointer: no KeyboardSensor was ever registered, and the
// element carrying the drag listeners was not focusable. These pin the route
// that replaced that promise.
//
// Unlike a pointer drag — which jsdom cannot reproduce, hence the DndContext
// wrapper at the top of this file — an arrow press needs no geometry, so these
// drive the real component through the real handler.
describe("placing a write-in from the keyboard", () => {
  const grip = () => card().querySelector('[data-testid="write-in-grip"]');
  const region = () => container.querySelector('[data-testid="write-in-announcement"]');
  const announcement = () => region().textContent.trim();
  const press = (key, times = 1) => {
    for (let i = 0; i < times; i++) {
      act(() => {
        grip().dispatchEvent(
          new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
        );
      });
    }
  };

  it("puts the drag handle in the tab order, named for the keys that work on it", () => {
    render({});
    click(writeOwn());

    // A div with listeners on it is not reachable; a button is.
    expect(grip().tagName).toBe("BUTTON");
    expect(grip().tabIndex).toBe(0);
    expect(grip().getAttribute("aria-label")).toMatch(/up and down arrow keys/i);
  });

  it("describes the route that exists, not dnd-kit's space-bar pick-up", () => {
    render({});
    click(writeOwn());

    const describedBy = grip().getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const instructions = document.getElementById(describedBy);
    expect(instructions?.textContent).toMatch(/up and down arrow keys/i);
    // dnd-kit's default text. It needs a KeyboardSensor, which this component
    // does not register, so leaving it in place described a way in that was
    // not there.
    expect(instructions?.textContent).not.toMatch(/space bar/i);
  });

  it("leaves the card itself out of the tab order, so the editor is not inside a button", () => {
    render({});
    click(writeOwn());

    expect(card().getAttribute("role")).toBeNull();
    expect(card().hasAttribute("tabindex")).toBe(false);
  });


  it("consumes the arrow press rather than letting the page scroll under the card", () => {
    render({});
    click(writeOwn());

    const event = new KeyboardEvent("keydown", {
      key: "ArrowUp",
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      grip().dispatchEvent(event);
    });

    // Without this the browser scrolls instead, which is exactly what "the
    // arrow keys do nothing" looked like from the outside.
    expect(event.defaultPrevented).toBe(true);
  });

  it("leaves keys it does not use to the browser", () => {
    render({});
    click(writeOwn());

    const event = new KeyboardEvent("keydown", {
      key: "Home",
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      grip().dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(false);
    expect(rowIndexOfCard()).toBe(5);
  });
  it("names both routes in the hint, since one of them has no visible affordance", () => {
    render({});
    click(writeOwn());
    type("my own view");

    expect(card().textContent).toMatch(/drag/i);
    expect(card().textContent).toContain("↑");
    expect(card().textContent).toContain("↓");
  });

  // The drag test above drops the card on `s4` and gets 4.5 at row 1. The
  // keyboard must reach the same slot and report the same value, or the two
  // gestures are not the same feature.
  it("reaches the same slot and the same value as the equivalent drag", () => {
    const onSelectWriteIn = vi.fn();
    render({ isInverted: false, onSelectWriteIn });

    click(writeOwn());
    type("my own view");
    press("ArrowUp", 4);

    expect(rowIndexOfCard()).toBe(1);
    expect(onSelectWriteIn).toHaveBeenLastCalledWith(TOPIC, 4.5, "my own view");
  });

  it("reads the placement through the spoke's inversion", () => {
    const onSelectWriteIn = vi.fn();
    render({ isInverted: true, onSelectWriteIn });

    click(writeOwn());
    type("my own view");
    press("ArrowUp", 2);

    // Same two presses, inverted display: 3.5 rather than the 2.5 the
    // uninverted list would give. A keyboard placement is scored off the list
    // on screen, exactly as a drop is.
    expect(onSelectWriteIn).toHaveBeenLastCalledWith(TOPIC, 3.5, "my own view");
  });

  it("stops at the top of the list instead of running off it", () => {
    const onSelectWriteIn = vi.fn();
    render({ onSelectWriteIn });

    click(writeOwn());
    type("my own view");
    press("ArrowUp", 7); // five presses reach the top; two more are nothing

    expect(rowIndexOfCard()).toBe(0);
    expect(onSelectWriteIn).toHaveBeenLastCalledWith(TOPIC, 5.5, "my own view");
  });

  it("stops at the foot of the list instead of running off it", () => {
    const onSelectWriteIn = vi.fn();
    render({ onSelectWriteIn });

    click(writeOwn());
    type("my own view");
    press("ArrowDown"); // the card opens parked at the foot already

    expect(rowIndexOfCard()).toBe(5);
    expect(onSelectWriteIn).not.toHaveBeenCalled();
  });

  // Same rule as a drag made before typing: a blank write-in must never be
  // reported, or it POSTs an empty answer and can raise "Fully calibrated" on
  // nothing. The placement is still kept, so the first keystroke lands on it.
  it("records nothing for an arrow press made before anything is typed", () => {
    const onSelectWriteIn = vi.fn();
    const onPersistWriteIn = vi.fn();
    render({ onSelectWriteIn, onPersistWriteIn });

    click(writeOwn());
    press("ArrowUp");

    expect(onSelectWriteIn).not.toHaveBeenCalled();
    expect(onPersistWriteIn).not.toHaveBeenCalled();
    expect(rowIndexOfCard()).toBe(4);

    type("my own view");
    expect(onSelectWriteIn).toHaveBeenCalledWith(TOPIC, 1.5, "my own view");
  });

  // `disabled` does not freeze a drag already on screen, and the keyboard is
  // the same control by another gesture.
  it("still moves while a pick is settling, exactly as a drag on screen does", () => {
    const onSelectWriteIn = vi.fn();
    render({ disabled: true, currentAnswer: 4.5, writeInText: "mine", onSelectWriteIn });

    press("ArrowUp");

    expect(onSelectWriteIn).toHaveBeenLastCalledWith(TOPIC, 5.5, "mine");
  });

  describe("what it says out loud", () => {
    it("names the stances the card landed between", () => {
      render({});
      click(writeOwn());

      press("ArrowUp");

      expect(announcement()).toBe('Your stance is between "Stance 2" and "Stance 1".');
    });

    it("speaks again when a press changes nothing, so the key never reads as dead", () => {
      render({});
      click(writeOwn());

      press("ArrowDown");
      const first = region().textContent;
      press("ArrowDown");
      const second = region().textContent;

      expect(first.trim()).toBe("Your stance is below every stance in the list.");
      expect(second.trim()).toBe(first.trim());
      // Same words, different string. A live region handed its own text back
      // verbatim says nothing at all, and the end of the list is the one place
      // a user most needs an answer.
      expect(second).not.toBe(first);
    });

    it("does not carry a position across to the next question", () => {
      render({});
      click(writeOwn());
      press("ArrowUp");
      expect(announcement()).not.toBe("");

      render({ topic: { id: "t2", short_title: "Topic Two" } });

      expect(container.querySelector('[data-testid="write-in-announcement"]')).toBeNull();
    });
  });

  describe("saving", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    // A drop is one finished act and saves at once (pinned above). A run of
    // arrow presses is one act arriving in steps, so it rides the debounce:
    // sweeping the card down a five-stance list is one POST, not five.
    it("coalesces a run of arrow presses into a single save", () => {
      const onSelectWriteIn = vi.fn();
      const onPersistWriteIn = vi.fn();
      render({ onSelectWriteIn, onPersistWriteIn });

      click(writeOwn());
      type("my own view");
      press("ArrowUp", 3);

      // Local state hears every step, so the parent and the list on screen
      // never disagree about where the card is.
      expect(onSelectWriteIn).toHaveBeenCalledTimes(3);
      expect(onPersistWriteIn).not.toHaveBeenCalled();

      act(() => vi.advanceTimersByTime(WRITE_IN_SAVE_DEBOUNCE_MS));

      expect(onPersistWriteIn).toHaveBeenCalledTimes(1);
      expect(onPersistWriteIn).toHaveBeenCalledWith(TOPIC, 3.5, "my own view");
    });

    it("saves a keyboard placement left mid-debounce when the question changes", () => {
      const onPersistWriteIn = vi.fn();
      render({ onPersistWriteIn });

      click(writeOwn());
      type("my own view");
      press("ArrowUp", 2);
      expect(onPersistWriteIn).not.toHaveBeenCalled();

      render({ topic: { id: "t2", short_title: "Topic Two" }, onPersistWriteIn });

      expect(onPersistWriteIn).toHaveBeenCalledTimes(1);
      expect(onPersistWriteIn).toHaveBeenCalledWith(TOPIC, 2.5, "my own view");
    });
  });
});
