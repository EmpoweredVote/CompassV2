// One stance list for every surface that asks a question: the calibration
// overlay, Full Calibration, the quiz and the library drawer. Each of those
// used to carry its own copy of this UI, which is how they drifted — different
// restore rules, two different readings of which pole goes on top, and four
// places to fix a write-in bug.
//
// What it owns: the display order (always via `orderStances`, always relative
// to this spoke's inversion), the "Write your own..." affordance, the
// drag-to-place write-in card, the placement <-> value math (via
// `src/lib/writeIn.js` — never reimplemented here), and the 600 ms debounce in
// front of the write-in save, so naive adoption cannot flood the API.
//
// What it does NOT own: persistence itself, analytics, navigation, or any copy
// that belongs to one surface (the overlay's first-question onboarding hint
// stays in the overlay). Those arrive as callbacks.
//
// Props
//   topic              the topic object; handed back verbatim to every callback
//   stances            [{ id, value, text }]; any order — it sorts
//   currentAnswer      the stored value for this topic (1..5, or a x.5 write-in)
//   pendingValue       an optimistic value that outranks currentAnswer for the
//                      highlight, for a surface that shows a pick before the
//                      save lands (Full Calibration's `selectedValue`)
//   writeInText        the stored write-in text; seeds the card's editor
//   isInverted         this spoke's random display inversion (anti-bias; it
//                      never changes a stored value). Safe to flip while a card
//                      is open: a placed card re-derives its row, an unplaced
//                      one keeps its position and, above all, its text
//   disabled           no picks accepted; the unchosen options dim. It does NOT
//                      freeze a drag already on screen
//   gapClassName       the Tailwind gap between options. Four surfaces use four
//                      different gaps and a wrapper cannot override one
//   scaleWithViewport  opt in to the overlay's viewport-height type/padding
//                      scaling. Off by default: it drops desktop body text to
//                      <=14px and ties it to window height, which is right in a
//                      full-screen flow and wrong in a side panel
//   onSelectStance(topic, value)
//   onSelectWriteIn(topic, value, text)   immediate, every keystroke; local state
//   onPersistWriteIn(topic, value, text)  debounced 600 ms; wire THIS to the API
//   onCancelWriteIn(topic, reason)        the parent MUST clear its stored value.
//                      `reason` is "abandoned" (the card's ×; card closes),
//                      "emptied" (textarea cleared; card STAYS OPEN at its
//                      placement) or "replaced" (on the way into a pre-written
//                      pick). See the note on `reason` below — a parent that
//                      deletes server-side has to tell them apart.
//   onWriteInModeChange(isOpen)           fires on every open/close, restore included
//   onOpenWriteIn()                       fires only when the user asks for the card
//
// The editor takes focus on a deliberate "Write your own...", never on a
// restore. A restored card is a side effect of arriving at a question, and
// focusing it there scrolls the question's own heading out of a scrolling
// panel and pulls a keyboard user out of the list they were arrowing through.
//
// Placing a write-in has two gestures, and they can do exactly the same
// things. Pointer users drag the card by its handle. Keyboard users focus that
// same handle (Shift+Tab from the editor) and press ↑ / ↓; each press moves
// the card one place and saves it there. The handle is the only control that
// moves the card either way, which is why dnd-kit's attributes live on it
// rather than on the card: one tab stop, one thing it does.
//
// The two gestures differ in exactly one respect, and deliberately. A drop is
// one finished act, so it saves at once; an arrow press is one step of a run,
// so it rides the 600 ms debounce and a sweep down the list costs one POST
// rather than five.
//
// Clearing the text and cancelling are deliberately different gestures. An
// empty textarea clears the answer and keeps the card at its placement, so
// rewriting your own words never costs you your position on the scale; the ×
// is how a write-in is abandoned. Both report `onCancelWriteIn`, because in
// both the stored answer must go.
//
// 🔴 WHY `reason` EXISTS, AND IT IS NOT BOOKKEEPING. A third thing reports a
// cancel: picking a pre-written stance, which fires one on the way in to drop
// stale text. All three mean "the stored write-in must go", so for a parent
// holding local state they are the same event — which is why this used to be a
// bare `onCancelWriteIn(topic)`.
//
// They stop being the same the moment a parent clears the SERVER copy, because
// "replaced" is followed within the same tick by a POST of the new stance.
// Those are two independent fire-and-forget requests with no ordering between
// them, so a DELETE sent on that path can land after the POST and soft-delete
// the answer the user just gave. A write-in swapped for a stance would vanish
// server-side, and only on a reload, which is the worst way to find out.
//
// The parent cannot infer this. StanceChooser is the only thing that knows
// which gesture it was, so it says so.
//
// `onCancelWriteIn` is an obligation, not a notification. A dismissal is
// latched here against the value it dismissed (see `dismissedValueRef`), so a
// parent that leaves a half-step `currentAnswer` standing gets a component that
// shows an unselected stance list for a question its own state calls answered —
// and because the latch is on the value, a later refetch re-asserting that same
// half-step stays suppressed too. Clear the value; do not rely on the card
// coming back.
import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { useTheme } from "../ThemeProvider";
import { DARK_THEME, LIGHT_THEME } from "../lib/calibrationTheme";
import {
  orderStances,
  valueFromPlacement,
  placementFromValue,
  isWriteIn,
} from "../lib/writeIn";

const WRITE_IN_ID = "write-in";

// CalibrationOverlay's proven value: long enough that a sentence is one save,
// short enough that a user who types and navigates away keeps their words.
export const WRITE_IN_SAVE_DEBOUNCE_MS = 600;

// Lifted verbatim from CalibrationOverlay — it was byte-identical in all three
// copies, and the drag only reads right at this easing.
const SMOOTH_TRANSITION = {
  duration: 300,
  easing: "cubic-bezier(0.25, 1, 0.5, 1)",
};

// The orange is the hint's own colour in every copy; it is not a theme token
// because it has to shout in both themes.
const HINT_COLOR = "#E85D26";

// What a screen reader reads off the handle. dnd-kit's default text describes
// a space-bar pick-up that exists only where a KeyboardSensor is registered —
// this component has never registered one, so the default was an invitation to
// a route that was not there. The arrow keys are the route; say so.
const KEYBOARD_INSTRUCTIONS = {
  draggable:
    "Press the up and down arrow keys to move your stance among the stances. " +
    "Each press moves it one place and saves it there.",
};

function SortableStanceLabel({ id, text, t }) {
  const { setNodeRef, transform, transition } = useSortable({
    id,
    disabled: { draggable: true },
    transition: SMOOTH_TRANSITION,
  });

  return (
    <div
      ref={setNodeRef}
      data-testid="stance-row"
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        background: t.card,
        color: t.textBody,
        border: `1px solid ${t.border}`,
      }}
      className="px-4 py-2.5 rounded-lg text-sm font-medium"
    >
      {text}
    </div>
  );
}

function SortableWriteInCard({
  id,
  text,
  onChange,
  onCancel,
  onMove,
  handleLabel,
  announcement,
  showHint,
  disabled,
  autoFocus,
  t,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, transition: SMOOTH_TRANSITION });

  // The focus ring is ours to draw. The handle is the keyboard's only way in,
  // and a control you cannot see you are standing on is not a route.
  const [handleFocused, setHandleFocused] = useState(false);

  const handleKeyDown = (e) => {
    const delta = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
    if (!delta) return;
    // Without this the page scrolls under the card instead, which is exactly
    // what "there is no keyboard route" looked like from the outside.
    e.preventDefault();
    onMove?.(delta);
  };

  const handleFocus = (e) => {
    // The ring belongs to the keyboard route, not to the mouse press that
    // starts a drag. jsdom's selector engine may not know :focus-visible; a
    // focus we cannot classify gets the ring rather than silently losing it.
    let visible = true;
    try {
      visible = e.target.matches(":focus-visible");
    } catch {
      visible = true;
    }
    setHandleFocused(visible);
  };

  return (
    <div
      ref={setNodeRef}
      data-testid="write-in-card"
      style={{
        transform: CSS.Translate.toString(transform),
        transition: isDragging ? undefined : transition,
        opacity: isDragging ? 0.5 : 1,
        border: `2px solid ${t.yellow}`,
        background: t.yellowBg,
      }}
      className="flex items-start gap-2 px-3 py-2.5 rounded-lg"
    >
      {/* The one control that moves the card, by either gesture: a pointer
          drags from here, and the arrow keys work from here. dnd-kit's own
          attributes (tabIndex, role, aria-describedby) ride on this button
          rather than on the card, so the editor is not announced as part of a
          button and there is exactly one tab stop that means "move me". The
          textarea beside it stays typeable because the drag listeners never
          reach it. */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={() => setHandleFocused(false)}
        data-testid="write-in-grip"
        aria-label={handleLabel}
        className={`cursor-grab active:cursor-grabbing pt-1.5 shrink-0 rounded p-1 ${
          showHint ? "animate-pulse" : ""
        }`}
        style={{
          color: showHint ? HINT_COLOR : t.textMuted,
          outline: handleFocused ? `2px solid ${t.yellowDark}` : "none",
          outlineOffset: "2px",
        }}
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
          <circle cx="9" cy="6" r="1.5" />
          <circle cx="15" cy="6" r="1.5" />
          <circle cx="9" cy="12" r="1.5" />
          <circle cx="15" cy="12" r="1.5" />
          <circle cx="9" cy="18" r="1.5" />
          <circle cx="15" cy="18" r="1.5" />
        </svg>
      </button>
      <div className="flex-1 flex flex-col gap-1">
        <textarea
          autoFocus={autoFocus}
          value={text}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Write your stance here..."
          rows={2}
          className="text-sm font-medium resize-none bg-transparent focus:outline-none"
          style={{ color: t.textHead }}
        />
        {showHint && (
          <p className="text-xs font-medium" style={{ color: HINT_COLOR }}>
            Drag your own view to where it fits among these stances, or use ↑
            and ↓ on its handle
          </p>
        )}
        {/* Mounted for as long as the card is, so it is already in the page
            when its text changes — a live region added at the same moment as
            its message is not announced. */}
        <p className="sr-only" aria-live="polite" data-testid="write-in-announcement">
          {announcement}
        </p>
      </div>
      <button
        onClick={onCancel}
        data-testid="write-in-cancel"
        aria-label="Discard your stance"
        className="shrink-0 pt-1 cursor-pointer hover:opacity-70 transition-opacity"
        style={{ color: t.textMuted }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
        </svg>
      </button>
    </div>
  );
}

function StanceChooser({
  topic,
  stances,
  currentAnswer = null,
  pendingValue = null,
  writeInText = "",
  isInverted = false,
  disabled = false,
  gapClassName = "gap-1.5",
  scaleWithViewport = false,
  onSelectStance,
  onSelectWriteIn,
  onPersistWriteIn,
  onCancelWriteIn,
  onWriteInModeChange,
  onOpenWriteIn,
}) {
  const { isDark } = useTheme();
  const t = isDark ? DARK_THEME : LIGHT_THEME;

  const ordered = orderStances(stances, isInverted);

  const [showWriteIn, setShowWriteIn] = useState(false);
  const [text, setText] = useState("");
  const [orderedItems, setOrderedItems] = useState([]);
  const [hasRepositioned, setHasRepositioned] = useState(false);
  // Focus the editor on a deliberate "Write your own...", never on a restore.
  // A restored card is a side effect of arriving at a question; stealing focus
  // then scrolls the question's own heading out of a scrolling panel, and
  // yanks a keyboard user out of whatever list they were arrowing through.
  const [autoFocusCard, setAutoFocusCard] = useState(false);

  // What the last keyboard move did, for a screen reader. A pointer drag keeps
  // dnd-kit's own announcements; this covers the route dnd-kit is not driving.
  const [announcement, setAnnouncement] = useState("");

  // `orderedItems` is a DISPLAY order, so it only means anything alongside the
  // inversion it was built under. Keeping them together is what lets a flip be
  // read correctly in the render before the re-derive effect has run.
  //
  // The ref is for the handlers: held arrow keys can fire faster than a
  // render, and a second press reading the list off the previous render would
  // undo the first. `orderedItems` only ever changes through here, so the two
  // cannot drift.
  const itemsInverted = useRef(isInverted);
  const itemsRef = useRef([]);
  const setItems = (items, builtUnder = isInverted) => {
    itemsInverted.current = builtUnder;
    itemsRef.current = items;
    setOrderedItems(items);
  };

  // The value a pick is measured against: an optimistic pending value wins,
  // so a surface that renders a choice before the save returns stays honest.
  const value = pendingValue != null ? pendingValue : currentAnswer;

  // Where the card sits NOW, read off the list on screen rather than off the
  // prop. A drop reports a value outward, but a parent that saves async — or
  // never feeds `currentAnswer` back at all — would otherwise leave the
  // component thinking nothing is placed, and every keystroke after the drop
  // would be dropped on the floor. `hasRepositioned` is the gate: a freshly
  // opened card is parked below the list and has not been placed by anyone.
  const writeInIndex = orderedItems.indexOf(WRITE_IN_ID);
  const placedValue =
    showWriteIn && hasRepositioned && writeInIndex >= 0 && ordered.length > 0
      ? valueFromPlacement(writeInIndex, ordered.length, itemsInverted.current)
      : null;

  // The one answer to "is there a live write-in, and at what value?". A ref
  // because the handlers below run after a user gesture, by which time the
  // render that created them may be a beat behind.
  const liveValueRef = useRef(null);
  liveValueRef.current =
    placedValue != null ? placedValue : isWriteIn(value) ? value : null;

  // The stored value alone, for the restore effect below. It must NOT read
  // `liveValueRef`: on the render where the topic changes, the card's on-screen
  // placement still belongs to the question just left, and restore would carry
  // it onto a question nobody has answered.
  const storedValueRef = useRef(null);
  storedValueRef.current = isWriteIn(value) ? value : null;

  // A value the user has just dismissed here. Without it the second restore
  // door below would fight the cancel: the parent has been told, but until it
  // clears its own state `currentAnswer` still reads as a live write-in, and
  // the card would spring straight back open. Cleared on a topic or inversion
  // change, and bypassed by any other value.
  const dismissedValueRef = useRef(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    })
  );

  // ── Debounced persistence ────────────────────────────────────────────────
  // The overlay debounced its POST by 600 ms "so typing doesn't flood the API"
  // and the other copies did not. Solving it here means four adopters cannot
  // each forget it. `onSelectWriteIn` stays immediate for local state; only
  // this one waits.
  const persistTimer = useRef(null);
  const pendingPersist = useRef(null);
  const persistRef = useRef(onPersistWriteIn);
  persistRef.current = onPersistWriteIn;
  const topicRef = useRef(topic);
  topicRef.current = topic;

  const flushPersist = () => {
    clearTimeout(persistTimer.current);
    persistTimer.current = null;
    const pending = pendingPersist.current;
    pendingPersist.current = null;
    // The pending payload carries its own topic: a flush triggered by moving
    // to the next question must not save the last answer against the new one.
    if (pending) persistRef.current?.(pending.topic, pending.value, pending.text);
  };

  const cancelPersist = () => {
    clearTimeout(persistTimer.current);
    persistTimer.current = null;
    pendingPersist.current = null;
  };

  const schedulePersist = (v, newText) => {
    pendingPersist.current = { topic: topicRef.current, value: v, text: newText };
    clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(flushPersist, WRITE_IN_SAVE_DEBOUNCE_MS);
  };

  const flushRef = useRef(flushPersist);
  flushRef.current = flushPersist;

  // Leaving the question (or the screen) saves what is in the buffer, rather
  // than silently losing the last 600 ms of typing.
  useEffect(() => () => flushRef.current(), [topic?.id]);

  // ── Restore ──────────────────────────────────────────────────────────────
  // Put an existing write-in back where its value says it belongs. Keyed on
  // the question, because arriving at a question is what calls for a restore.
  //
  // A flip is handled by the effect below instead, not here. It used to share
  // this one, which meant an inversion change ran the whole restore — and the
  // clearing branch with it. On a surface with a Flip control next to the card
  // (Full Calibration has one), hitting Flip with a card open but not yet
  // dragged threw away what the user had typed: nothing is stored until a
  // placement exists, so there was nothing to restore it from.
  //
  // It restores on the value alone, not on the text: a half-step with no text
  // yet is a real state (placed, still being written) and must not collapse
  // the card out from under the typist.
  useEffect(() => {
    const restored = storedValueRef.current;
    dismissedValueRef.current = null;
    // A position announced for the question just left must not stand as this
    // question's answer to "where am I?".
    setAnnouncement("");
    const list = topic ? orderStances(stances, isInverted) : [];
    // Nothing to show, or nothing to place it among yet. Clearing is not
    // optional here: a bare `return` would leave the previous question's card,
    // text and placement standing, and the second door below would then see a
    // list that already looks complete and leave them there — the last user's
    // words, at the last question's placement, on this question's record.
    if (!topic || !isWriteIn(restored) || list.length === 0) {
      setShowWriteIn(false);
      setText("");
      setItems([]);
      setHasRepositioned(false);
      setAutoFocusCard(false);
      return;
    }
    const items = list.map((s) => s.id);
    items.splice(placementFromValue(restored, list.length, isInverted), 0, WRITE_IN_ID);
    setShowWriteIn(true);
    setText(writeInText || "");
    // Already placed, so the drag hint has nothing to teach.
    setHasRepositioned(true);
    setItems(items);
    setAutoFocusCard(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic?.id]);

  // ── Inversion ────────────────────────────────────────────────────────────
  // A flip is display-only: no stored value moves. But the list the card sits
  // in reverses, so a card left at its old row index would be pointing at a
  // different stance — the re-derivation fix round 1 added, kept here.
  //
  // A card that has never been dragged has no placement to re-derive; it keeps
  // its parked position at the foot of the list, and above all it keeps what
  // the user has typed into it.
  const showWriteInRef = useRef(showWriteIn);
  showWriteInRef.current = showWriteIn;
  useEffect(() => {
    dismissedValueRef.current = null;
    // The list on screen was already built under this inversion, so there is
    // nothing to rebuild. That covers mount, and it covers a question whose
    // inversion differs from the last one's — both change in one commit (Full
    // Calibration reads `invertedSpokes[topic.short_title]`) and the restore
    // above has already built that question's list, under this inversion, in
    // this same commit.
    //
    // This asks the thing that matters — what the list on screen means —
    // rather than tracking which topic was seen last. A ref written only
    // inside this effect was wrong: half of all question changes do not flip,
    // so it never ran, and the next genuine flip compared against a question
    // the user had long since left and stood down on one that needed it.
    // `itemsInverted` cannot go stale the same way: `orderedItems` only ever
    // becomes non-empty through `setItems`, which sets both together.
    if (itemsInverted.current === isInverted) return;
    if (!showWriteInRef.current) return;
    const list = orderStances(stances, isInverted);
    if (list.length === 0) return;
    const items = list.map((s) => s.id);
    // `liveValueRef` is read through the inversion those items were built
    // under, so this is the card's value as it meant it a moment ago.
    const placed = liveValueRef.current;
    if (placed != null) {
      items.splice(placementFromValue(placed, list.length, isInverted), 0, WRITE_IN_ID);
    } else {
      items.push(WRITE_IN_ID);
    }
    setItems(items, isInverted);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInverted]);

  // The second door in. The effect above deliberately ignores `currentAnswer`,
  // `writeInText` and `stances` so that typing is never re-seeded — but a
  // parent that loads answers after mount (both calibration surfaces do) keeps
  // the same `topic.id` throughout, so without this a late half-step answer
  // would leave the user staring at an unanswered question, and a late
  // `stances` array would leave a lone card with no stances under it.
  //
  // Guarded so it cannot touch a card the user is working in: it fires only
  // when the card is closed, or when the list it was built from no longer
  // matches the stances on screen.
  const needsCard =
    !!topic &&
    isWriteIn(value) &&
    ordered.length > 0 &&
    value !== dismissedValueRef.current;
  const itemsMatchStances = orderedItems.length === ordered.length + 1;
  useEffect(() => {
    if (!needsCard) return;
    if (showWriteIn && itemsMatchStances) return;
    const items = ordered.map((s) => s.id);
    items.splice(placementFromValue(value, ordered.length, isInverted), 0, WRITE_IN_ID);
    setShowWriteIn(true);
    setHasRepositioned(true);
    setItems(items);
    // Only seed text into an empty editor: this effect can also fire while the
    // card is open (late stances), and it must not overwrite what is typed.
    setText((prev) => prev || writeInText || "");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsCard, itemsMatchStances, showWriteIn, value, writeInText, ordered.length, isInverted]);

  // One place reports the mode, so restore, cancel and a cleared textarea all
  // tell the parent the same way, exactly once per transition.
  const reportedMode = useRef(false);
  useEffect(() => {
    if (reportedMode.current === showWriteIn) return;
    reportedMode.current = showWriteIn;
    onWriteInModeChange?.(showWriteIn);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showWriteIn]);

  // Where the card sits, said in terms of the stances around it. The index and
  // the half-step value are ours; what the user placed is a sentence between
  // two sentences.
  const describePlacement = (items) => {
    const i = items.indexOf(WRITE_IN_ID);
    if (i <= 0) return "Your stance is above every stance in the list.";
    if (i >= items.length - 1) return "Your stance is below every stance in the list.";
    const above = ordered.find((s) => s.id === items[i - 1])?.text ?? "";
    const below = ordered.find((s) => s.id === items[i + 1])?.text ?? "";
    return `Your stance is between "${above}" and "${below}".`;
  };

  // A live region only speaks when its text changes, so an arrow press that
  // changes nothing — the card is already at the end of the list — would be
  // silent, which is the one case most in need of an answer. The alternating
  // trailing non-breaking space is invisible and makes the string differ.
  const announceSeq = useRef(0);
  const announce = (message) => {
    announceSeq.current += 1;
    setAnnouncement(announceSeq.current % 2 ? message : `${message}\u00A0`);
  };

  const closeWriteIn = (dismissedValue = liveValueRef.current) => {
    dismissedValueRef.current = dismissedValue;
    setShowWriteIn(false);
    setText("");
    setItems([]);
    setHasRepositioned(false);
    setAutoFocusCard(false);
    setAnnouncement("");
  };

  const handleSelectStance = (stanceValue) => {
    if (disabled) return;
    // The clear is guaranteed here so no parent has to remember it, and it is
    // reported first: a parent that writes both through one store would
    // otherwise delete the answer it was just given.
    const hadWriteIn =
      showWriteIn || liveValueRef.current != null || !!(writeInText || "").trim();
    if (hadWriteIn) {
      cancelPersist();
      closeWriteIn();
      // Not a deletion — the stance POST that follows this in the same tick
      // is what records the answer, and it drops the stale text itself.
      onCancelWriteIn?.(topic, "replaced");
    }
    onSelectStance?.(topic, stanceValue);
  };

  const handleOpenWriteIn = () => {
    if (disabled) return;
    dismissedValueRef.current = null;
    setShowWriteIn(true);
    setHasRepositioned(false);
    setItems([...ordered.map((s) => s.id), WRITE_IN_ID]);
    // The one gesture that earns the focus: the user asked for this card.
    setAutoFocusCard(true);
    onOpenWriteIn?.();
  };

  // One commit for both gestures, so a keyboard placement cannot drift from a
  // dragged one. `saveNow` is the only difference: see the note at the top.
  const commitPlacement = (reordered, { saveNow }) => {
    // A move rearranges the list it is shown in, so the inversion it was built
    // under is unchanged.
    setItems(reordered, itemsInverted.current);
    setHasRepositioned(true);
    // An empty card has nothing to record yet, and placing before typing is
    // the natural order — the hint only appears once the card is open. Nothing
    // is reported or saved here, so a blank write-in can neither be POSTed as
    // an answered topic nor be the answer that completes a run. The placement
    // is still kept on screen: `hasRepositioned` is set above and `placedValue`
    // reads off the list, so the first keystroke saves at exactly the slot just
    // moved to, with no second move.
    if (!text.trim()) return;
    // Read through the inversion the list on screen was built under, which is
    // the list the user just moved within. In the steady state that is
    // `isInverted`; taking it from the items themselves means a placement can
    // never be scored against a list the user is not looking at.
    const placed = valueFromPlacement(
      reordered.indexOf(WRITE_IN_ID),
      ordered.length,
      itemsInverted.current
    );
    onSelectWriteIn?.(topic, placed, text);
    schedulePersist(placed, text);
    // A drop is one deliberate act, not a stream: it saves now, and takes
    // whatever text the buffer was holding with it.
    if (saveNow) flushPersist();
  };

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const items = itemsRef.current;
    const oldIndex = items.indexOf(active.id);
    const newIndex = items.indexOf(over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    commitPlacement(arrayMove(items, oldIndex, newIndex), { saveNow: true });
  };

  // The keyboard's route to a placement. Same commit as a drop, on purpose:
  // the whole point of the handle is that the two gestures can do the same
  // things. It is not gated on `disabled` for the same reason a drag already
  // on screen is not — see the prop note above.
  const moveWriteIn = (delta) => {
    const items = itemsRef.current;
    const from = items.indexOf(WRITE_IN_ID);
    if (from < 0) return;
    const to = from + delta;
    if (to < 0 || to >= items.length) {
      // Say the unchanged position rather than nothing. Silence at the end of
      // the list is indistinguishable from a key that does not work.
      announce(describePlacement(items));
      return;
    }
    const reordered = arrayMove(items, from, to);
    commitPlacement(reordered, { saveNow: false });
    announce(describePlacement(reordered));
  };

  const handleTextChange = (newText) => {
    setText(newText);
    const liveValue = liveValueRef.current;
    // Before a placement there is no value to save against; the text is held
    // locally until the drag gives it one.
    if (liveValue == null) return;
    if (newText.trim()) {
      onSelectWriteIn?.(topic, liveValue, newText);
      schedulePersist(liveValue, newText);
    } else {
      // Emptying the textarea is an edit, not an abandonment — select-all and
      // retype is how people rewrite a sentence. The stored answer goes (an
      // empty write-in must never count as answered, and Next must treat the
      // question as open), but the card stays exactly where it was dragged, so
      // the next keystroke re-saves at the same placement with no second drag.
      // `placedValue` is read off the list on screen, so it survives the
      // parent clearing `currentAnswer` in response to this very call.
      // Abandoning a write-in has its own control: the card's ×.
      cancelPersist();
      onCancelWriteIn?.(topic, "emptied");
    }
  };

  const handleCancelWriteIn = () => {
    const hadValue = liveValueRef.current != null;
    cancelPersist();
    closeWriteIn();
    if (hadValue) onCancelWriteIn?.(topic, "abandoned");
  };

  // Nothing to choose between: a topic still loading, or one whose stances the
  // API did not send. Rendering an empty shell would read as a broken list.
  if (!topic || ordered.length === 0) return null;

  // One flag picks a whole size recipe, so no call site has to fight Tailwind's
  // "same utility, source order wins" to undo half of one.
  const sizeClasses = scaleWithViewport
    ? "px-3 py-2.5 md:py-[clamp(0.375rem,1.05vh,0.625rem)] text-sm md:text-[clamp(0.8125rem,1.5vh,0.875rem)]"
    : "px-4 py-3 text-sm sm:text-base";
  const buttonClasses = `text-left rounded-lg transition-all duration-200 leading-snug font-medium cursor-pointer disabled:cursor-default ${sizeClasses}`;

  // The handle's accessible name carries the keys, because the visible hint
  // that carries them is gone the moment the card has been placed once — and
  // moving it again is exactly when a keyboard user needs to be told how.
  const handleSlot = writeInIndex >= 0 ? writeInIndex + 1 : orderedItems.length;
  const handleLabel =
    `Move your stance into place: position ${handleSlot} of ${orderedItems.length}. ` +
    `Press the up and down arrow keys, or drag.`;

  if (showWriteIn) {
    return (
      <div className={`flex flex-col ${gapClassName}`} data-testid="stance-chooser">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleDragEnd}
          accessibility={{ screenReaderInstructions: KEYBOARD_INSTRUCTIONS }}
        >
          <SortableContext items={orderedItems} strategy={verticalListSortingStrategy}>
            <div className={`flex flex-col ${gapClassName}`}>
              {orderedItems.map((itemId) =>
                itemId === WRITE_IN_ID ? (
                  <SortableWriteInCard
                    key={WRITE_IN_ID}
                    id={WRITE_IN_ID}
                    text={text}
                    onChange={handleTextChange}
                    onCancel={handleCancelWriteIn}
                    onMove={moveWriteIn}
                    handleLabel={handleLabel}
                    announcement={announcement}
                    showHint={!!text.trim() && !hasRepositioned}
                    disabled={disabled}
                    autoFocus={autoFocusCard}
                    t={t}
                  />
                ) : (
                  <SortableStanceLabel
                    key={itemId}
                    id={itemId}
                    text={ordered.find((s) => s.id === itemId)?.text ?? ""}
                    t={t}
                  />
                )
              )}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${gapClassName}`} data-testid="stance-chooser">
      {ordered.map((stance) => {
        const isSelected = value === stance.value;
        return (
          <button
            key={stance.id}
            data-testid="stance-option"
            disabled={disabled}
            onClick={() => handleSelectStance(stance.value)}
            className={buttonClasses}
            style={{
              ...(isSelected
                ? {
                    border: `2px solid ${t.yellow}`,
                    background: t.yellowBg,
                    color: t.textHead,
                  }
                : {
                    background: t.stanceBg,
                    color: t.stanceText,
                    border: `2px solid ${t.stanceBorder}`,
                  }),
              // While a pick is settling, the options not chosen step back.
              opacity: disabled && !isSelected ? 0.4 : 1,
            }}
          >
            {stance.text}
          </button>
        );
      })}
      <button
        data-testid="write-own-option"
        disabled={disabled}
        onClick={handleOpenWriteIn}
        className={buttonClasses}
        style={{
          border: `2px dashed ${t.writeOwnColor}`,
          color: t.writeOwnColor,
          background: "transparent",
          opacity: disabled ? 0.4 : 1,
        }}
      >
        Write your own...
      </button>
    </div>
  );
}

export default StanceChooser;
