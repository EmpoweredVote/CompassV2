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

import StanceChooser from "./StanceChooser.jsx";

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
  });

  it("tells the parent when write-in mode opens and closes", () => {
    const onWriteInModeChange = vi.fn();
    const onOpenWriteIn = vi.fn();
    render({ onWriteInModeChange, onOpenWriteIn });

    click(writeOwn());
    expect(onOpenWriteIn).toHaveBeenCalledTimes(1);
    expect(onWriteInModeChange).toHaveBeenLastCalledWith(true);
    expect(card()).not.toBeNull();

    click(card().querySelector('[data-testid="write-in-cancel"]'));
    expect(onWriteInModeChange).toHaveBeenLastCalledWith(false);
    expect(card()).toBeNull();
    expect(options()).toHaveLength(5);
  });

  it("cancels when the text is cleared", () => {
    const onCancelWriteIn = vi.fn();
    render({ currentAnswer: 2.5, writeInText: "my own view", onCancelWriteIn });

    expect(card()).not.toBeNull();
    type("   ");

    expect(onCancelWriteIn).toHaveBeenCalledWith(TOPIC);
    expect(card()).toBeNull();
  });

  // Review Focus 3
  it("shows the write-in card for a half-step value with no text", () => {
    render({ currentAnswer: 2.5, writeInText: "" });

    expect(card()).not.toBeNull();
    expect(card().querySelector("textarea").value).toBe("");
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

// Review Focus 5
describe("missing data", () => {
  it("renders nothing rather than throwing when stances are missing or empty", () => {
    render({ stances: [] });
    expect(container.textContent).toBe("");

    render({ stances: undefined });
    expect(container.textContent).toBe("");

    render({ topic: null });
    expect(container.textContent).toBe("");
  });
});
