"use client";

import { useState } from "react";
import { Certificate } from "@/components/Certificate";

interface TestQuestion {
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
  concept: string;
}
export interface TestData {
  title: string;
  questions: TestQuestion[];
}

const PASS_PERCENT = 60;

export function ExamMode({ data }: { data: TestData }) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [name, setName] = useState("");

  const total = data.questions.length;
  const answeredCount = Object.keys(answers).length;
  const score = data.questions.reduce(
    (acc, q, i) => acc + (answers[i] === q.answerIndex ? 1 : 0),
    0
  );
  const percent = Math.round((score / total) * 100);
  const passed = percent >= PASS_PERCENT;

  const weakConcepts = Array.from(
    new Set(
      data.questions
        .filter((q, i) => answers[i] !== q.answerIndex)
        .map((q) => q.concept)
    )
  );

  function reset() {
    setAnswers({});
    setSubmitted(false);
    setName("");
  }

  /* ---------- Result screen ---------- */
  if (submitted) {
    return (
      <div className="animate-fade-up space-y-6">
        {/* Score header */}
        <div className="rounded-2xl border border-border bg-white/[0.02] p-6 text-center">
          <div className="text-5xl">{passed ? "🎉" : "💪"}</div>
          <h2 className="mt-3 font-serif text-3xl font-semibold text-foreground">
            {passed ? "Congratulations!" : "Good effort — keep going!"}
          </h2>
          <p className="mt-2 text-muted">
            You scored{" "}
            <span className={passed ? "text-accent" : "text-amber-300"}>
              {score}/{total} ({percent}%)
            </span>{" "}
            on <span className="text-foreground/90">{data.title}</span>
          </p>

          {/* progress bar */}
          <div className="mx-auto mt-5 h-3 max-w-md overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className={`h-full rounded-full ${passed ? "bg-gradient-to-r from-primary to-accent" : "bg-gradient-to-r from-amber-400 to-rose-400"}`}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        {/* PASS → certificate */}
        {passed ? (
          <div className="rounded-2xl border border-accent/30 bg-accent/[0.06] p-5">
            <p className="mb-1 font-medium text-foreground">🏆 You earned a certificate!</p>
            <p className="mb-4 text-sm text-muted">
              Enter your name to personalise and download your VidhyaAI certificate.
            </p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              className="mb-4 w-full max-w-sm rounded-xl border border-border bg-black/20 px-4 py-2.5 text-foreground placeholder:text-muted/60 outline-none focus:border-primary/60"
            />
            <Certificate name={name} topic={data.title} score={score} total={total} />
          </div>
        ) : (
          /* FAIL → improvement plan */
          <div className="rounded-2xl border border-amber-400/30 bg-amber-400/[0.06] p-5">
            <p className="mb-2 font-medium text-foreground">
              📌 You need {PASS_PERCENT}% to earn a certificate. Focus on these to improve:
            </p>
            {weakConcepts.length > 0 ? (
              <ul className="space-y-2">
                {weakConcepts.map((c) => (
                  <li key={c} className="flex gap-2 text-sm text-foreground/90">
                    <span className="text-amber-300">→</span> Revise <span className="font-medium">{c}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Review the explanations below and retake the test.</p>
            )}
            <p className="mt-3 text-sm text-muted">
              Tip: generate <span className="text-foreground/90">Flashcards</span> or an{" "}
              <span className="text-foreground/90">Explain</span> for these topics, then retake. You&apos;ve got this! 💡
            </p>
          </div>
        )}

        {/* Answer review */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted">Review your answers</p>
          {data.questions.map((q, i) => {
            const chosen = answers[i];
            const correct = chosen === q.answerIndex;
            return (
              <div key={i} className="rounded-xl border border-border bg-white/[0.02] p-4">
                <p className="font-medium text-foreground">
                  {correct ? "✅" : "❌"} {i + 1}. {q.question}
                </p>
                <p className="mt-1.5 text-sm text-muted">
                  Correct: <span className="text-accent">{q.options[q.answerIndex]}</span>
                  {!correct && chosen !== undefined && (
                    <>
                      {" "}· You: <span className="text-rose-300">{q.options[chosen]}</span>
                    </>
                  )}
                </p>
                <p className="mt-1 text-xs text-muted/80">{q.explanation}</p>
              </div>
            );
          })}
        </div>

        <button
          onClick={reset}
          className="rounded-xl border border-border bg-white/[0.03] px-5 py-2.5 text-sm text-foreground transition hover:border-primary/50"
        >
          🔄 Retake test
        </button>
      </div>
    );
  }

  /* ---------- Test screen ---------- */
  return (
    <div className="animate-fade-up space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-white/[0.04] text-lg">📝</span>
          <h2 className="font-serif text-2xl text-foreground">{data.title}</h2>
        </div>
        <span className="rounded-full border border-border bg-white/[0.03] px-4 py-1.5 text-sm text-muted">
          {answeredCount}/{total} answered
        </span>
      </div>

      {data.questions.map((q, qi) => (
        <div key={qi} className="rounded-2xl border border-border bg-white/[0.02] p-5">
          <p className="mb-3 font-medium text-foreground">
            {qi + 1}. {q.question}
          </p>
          <div className="grid gap-2">
            {q.options.map((opt, oi) => {
              const chosen = answers[qi] === oi;
              return (
                <button
                  key={oi}
                  onClick={() => setAnswers((a) => ({ ...a, [qi]: oi }))}
                  className={`rounded-lg border px-4 py-2.5 text-left text-sm transition ${
                    chosen
                      ? "border-primary/70 bg-primary/15 text-foreground"
                      : "border-border bg-white/[0.02] text-foreground/90 hover:border-primary/40"
                  }`}
                >
                  <span className="mr-2 font-mono text-xs text-muted">{String.fromCharCode(65 + oi)}</span>
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <button
        onClick={() => setSubmitted(true)}
        disabled={answeredCount < total}
        className="btn-glow w-full rounded-xl px-6 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {answeredCount < total ? `Answer all ${total} questions to submit` : "Submit Test ✓"}
      </button>
    </div>
  );
}
