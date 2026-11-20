// One stance list for every surface that asks a question: the calibration
// overlay, Full Calibration, the quiz and the library drawer. Each of those
// used to carry its own copy of this UI, which is how they drifted — different
// restore rules, two different readings of which pole goes on top, and four
// places to fix a write-in bug.
//
// What it owns: the display order (always via `orderStances`, always relative
// to this spoke's inversion), the "Write your own..." affordance, the
// drag-to-place write-in card, and the placement <-> value math (via
// `src/lib/writeIn.js` — never reimplemented here).
//
// What it does NOT own: persistence, analytics, navigation, or any copy that
// belongs to one surface (the overlay's first-question onboarding hint stays
// in the overlay). Those arrive as callbacks.
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
//                      never changes a stored value)
//   disabled           no picks accepted; the unchosen options dim
//   onSelectStance(topic, value)
//   onSelectWriteIn(topic, value, text)   value is always a half-step
//   onCancelWriteIn(topic)
//   onWriteInModeChange(isOpen)           fires on every open/close, restore included
//   onOpenWriteIn()                       fires only when the user asks for the card
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

// Lifted verbatim from CalibrationOverlay — it was byte-identical in all three
// copies, and the drag only reads right at this easing.
const SMOOTH_TRANSITION = {
  duration: 300,
  easing: "cubic-bezier(0.25, 1, 0.5, 1)",
};

// The orange is the hint's own colour in every copy; it is not a theme token
// because it has to shout in both themes.
const HINT_COLOR = "#E85D26";

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

function SortableWriteInCard({ id, text, onChange, onCancel, showHint, disabled, t }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, transition: SMOOTH_TRANSITION });

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
      {...attributes}
    >
      {/* Only the grip starts a drag, so the textarea stays typeable */}
      <div
        {...listeners}
        data-testid="write-in-grip"
        className={`cursor-grab active:cursor-grabbing pt-1.5 shrink-0 rounded p-1 ${
          showHint ? "animate-pulse" : ""
        }`}
        style={{ color: showHint ? HINT_COLOR : t.textMuted }}
        aria-label="Drag your stance into place"
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
          <circle cx="9" cy="6" r="1.5" />
          <circle cx="15" cy="6" r="1.5" />
          <circle cx="9" cy="12" r="1.5" />
          <circle cx="15" cy="12" r="1.5" />
          <circle cx="9" cy="18" r="1.5" />
          <circle cx="15" cy="18" r="1.5" />
        </svg>
      </div>
      <div className="flex-1 flex flex-col gap-1">
        <textarea
          autoFocus
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
            Drag your own view to where it fits among these stances
          </p>
        )}
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
  onSelectStance,
  onSelectWriteIn,
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

  // The value a pick is measured against: an optimistic pending value wins,
  // so a surface that renders a choice before the save returns stays honest.
  const value = pendingValue != null ? pendingValue : currentAnswer;
  // The handlers below run after a user gesture, by which time `value` may be
  // a render behind; a ref keeps them reading what is on screen now.
  const valueRef = useRef(value);
  valueRef.current = value;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    })
  );

  // Restore: put an existing write-in back where its value says it belongs.
  //
  // `isInverted` is a dependency on purpose. Inversion is display-only, so the
  // stored value does not move — but the list it sits in flips, and a card
  // left at its old index would be showing the wrong stance. The drawer's
  // `[topic?.id]`-only version was the bug this re-derivation fixes.
  //
  // It restores on the value alone, not on the text: a half-step with no text
  // yet is a real state (placed, still being written) and must not collapse
  // the card out from under the typist.
  useEffect(() => {
    const restored = valueRef.current;
    if (!topic || !isWriteIn(restored)) {
      setShowWriteIn(false);
      setText("");
      setOrderedItems([]);
      setHasRepositioned(false);
      return;
    }
    const list = orderStances(stances, isInverted);
    const items = list.map((s) => s.id);
    items.splice(placementFromValue(restored, list.length, isInverted), 0, WRITE_IN_ID);
    setShowWriteIn(true);
    setText(writeInText || "");
    // Already placed, so the drag hint has nothing to teach.
    setHasRepositioned(true);
    setOrderedItems(items);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic?.id, isInverted]);

  // One place reports the mode, so restore, cancel and a cleared textarea all
  // tell the parent the same way.
  const reportedMode = useRef(false);
  useEffect(() => {
    if (reportedMode.current === showWriteIn) return;
    reportedMode.current = showWriteIn;
    onWriteInModeChange?.(showWriteIn);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showWriteIn]);

  const closeWriteIn = () => {
    setShowWriteIn(false);
    setText("");
    setOrderedItems([]);
    setHasRepositioned(false);
  };

  const handleSelectStance = (stanceValue) => {
    if (disabled) return;
    // The clear is guaranteed here so no parent has to remember it, and it is
    // reported first: a parent that writes both through one store would
    // otherwise delete the answer it was just given.
    const hadWriteIn =
      showWriteIn || isWriteIn(valueRef.current) || !!(writeInText || "").trim();
    if (hadWriteIn) {
      closeWriteIn();
      onCancelWriteIn?.(topic);
    }
    onSelectStance?.(topic, stanceValue);
  };

  const handleOpenWriteIn = () => {
    if (disabled) return;
    setShowWriteIn(true);
    setHasRepositioned(false);
    setOrderedItems([...ordered.map((s) => s.id), WRITE_IN_ID]);
    onOpenWriteIn?.();
  };

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oldIndex = orderedItems.indexOf(active.id);
    const newIndex = orderedItems.indexOf(over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(orderedItems, oldIndex, newIndex);
    setOrderedItems(reordered);
    setHasRepositioned(true);
    const placed = valueFromPlacement(
      reordered.indexOf(WRITE_IN_ID),
      ordered.length,
      isInverted
    );
    onSelectWriteIn?.(topic, placed, text);
  };

  const handleTextChange = (newText) => {
    setText(newText);
    // Before a placement there is no value to save against; the text is held
    // locally until the drag gives it one.
    if (!isWriteIn(valueRef.current)) return;
    if (newText.trim()) {
      onSelectWriteIn?.(topic, valueRef.current, newText);
    } else {
      closeWriteIn();
      onCancelWriteIn?.(topic);
    }
  };

  const handleCancelWriteIn = () => {
    const hadValue = isWriteIn(valueRef.current);
    closeWriteIn();
    if (hadValue) onCancelWriteIn?.(topic);
  };

  // Nothing to choose between: a topic still loading, or one whose stances the
  // API did not send. Rendering an empty shell would read as a broken list.
  if (!topic || ordered.length === 0) return null;

  if (showWriteIn) {
    return (
      <div className="flex flex-col gap-1.5" data-testid="stance-chooser">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={orderedItems} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-1.5">
              {orderedItems.map((itemId) =>
                itemId === WRITE_IN_ID ? (
                  <SortableWriteInCard
                    key={WRITE_IN_ID}
                    id={WRITE_IN_ID}
                    text={text}
                    onChange={handleTextChange}
                    onCancel={handleCancelWriteIn}
                    showHint={!!text.trim() && !hasRepositioned}
                    disabled={disabled}
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
    <div className="flex flex-col gap-1.5" data-testid="stance-chooser">
      {ordered.map((stance) => {
        const isSelected = value === stance.value;
        return (
          <button
            key={stance.id}
            data-testid="stance-option"
            disabled={disabled}
            onClick={() => handleSelectStance(stance.value)}
            className="text-left px-3 py-2.5 md:py-[clamp(0.375rem,1.05vh,0.625rem)] rounded-lg transition-all duration-200 text-sm md:text-[clamp(0.8125rem,1.5vh,0.875rem)] leading-snug font-medium cursor-pointer disabled:cursor-default"
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
        className="text-left px-3 py-2.5 md:py-[clamp(0.375rem,1.05vh,0.625rem)] rounded-lg transition-all duration-200 text-sm md:text-[clamp(0.8125rem,1.5vh,0.875rem)] leading-snug font-medium cursor-pointer disabled:cursor-default"
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
