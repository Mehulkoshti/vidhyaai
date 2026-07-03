"use client";

import { useMemo, useState } from "react";
import { cardId, isDue, rate, type Quality } from "@/lib/srs";

interface Card {
  front: string;
  back: string;
}

const RATINGS: { label: string; q: Quality; cls: string }[] = [
  { label: "Again", q: 1, cls: "border-rose-500/50 text-rose-300 hover:bg-rose-500/10" },
  { label: "Hard", q: 3, cls: "border-amber-400/50 text-amber-300 hover:bg-amber-400/10" },
  { label: "Good", q: 4, cls: "border-primary/50 text-foreground hover:bg-primary/10" },
  { label: "Easy", q: 5, cls: "border-accent/50 text-accent hover:bg-accent/10" },
];

/**
 * Spaced-repetition review: shows due cards one at a time, flip to reveal,
 * then rate Again/Hard/Good/Easy. Ratings schedule the next review (SM-2 lite,
 * persisted in localStorage).
 */
export function FlashcardReview({ deck, cards, onExit }: { deck: string; cards: Card[]; onExit: () => void }) {
  // Build the initial queue once: cards due now (fall back to all if none due).
  const initialQueue = useMemo(() => {
    const due = cards.map((_, i) => i).filter((i) => isDue(cardId(deck, i)));
    return due.length ? due : cards.map((_, i) => i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [queue] = useState(initialQueue);
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(0);

  if (pos >= queue.length) {
    return (
      <div className="animate-fade-up rounded-2xl border border-accent/30 bg-accent/[0.06] p-6 text-center">
        <div className="text-4xl">🎉</div>
        <p className="mt-2 font-medium text-foreground">Review complete!</p>
        <p className="mt-1 text-sm text-muted">You reviewed {done} card{done === 1 ? "" : "s"}. They&apos;re scheduled to come back at the right time.</p>
        <button
          onClick={onExit}
          className="mt-4 rounded-xl border border-border bg-white/[0.03] px-5 py-2 text-sm text-foreground transition hover:border-primary/50"
        >
          ← Back to deck
        </button>
      </div>
    );
  }

  const idx = queue[pos];
  const card = cards[idx];

  function grade(q: Quality) {
    rate(cardId(deck, idx), q);
    setDone((d) => d + 1);
    setFlipped(false);
    setPos((p) => p + 1);
  }

  return (
    <div className="animate-fade-up space-y-4">
      <div className="flex items-center justify-between text-sm text-muted">
        <span>Card {pos + 1} / {queue.length}</span>
        <button onClick={onExit} className="rounded-lg px-2 py-1 hover:text-foreground">✕ Exit</button>
      </div>

      <div
        className={`flip-card h-56 cursor-pointer ${flipped ? "is-flipped" : ""}`}
        onClick={() => setFlipped((f) => !f)}
      >
        <div className="flip-inner relative h-full w-full">
          <div className="flip-face absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-border bg-white/[0.03] p-6 text-center backdrop-blur">
            <span className="font-medium text-foreground">{card.front}</span>
            <span className="absolute bottom-3 text-[10px] uppercase tracking-wide text-muted/40">tap to reveal</span>
          </div>
          <div className="flip-face flip-back absolute inset-0 flex items-center justify-center rounded-2xl border border-primary/40 bg-primary/10 p-6 text-center backdrop-blur">
            <span className="text-sm leading-relaxed text-foreground/90">{card.back}</span>
          </div>
        </div>
      </div>

      {flipped ? (
        <div className="grid grid-cols-4 gap-2">
          {RATINGS.map((r) => (
            <button
              key={r.label}
              onClick={() => grade(r.q)}
              className={`rounded-lg border bg-white/[0.02] py-2.5 text-sm font-medium transition ${r.cls}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-center text-sm text-muted">Tap the card to see the answer, then rate how well you knew it.</p>
      )}
    </div>
  );
}
