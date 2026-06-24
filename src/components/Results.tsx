"use client";

import { useState } from "react";
import type { StudyMode } from "@/lib/gemini";
import { SpeakButton, CopyButton, DownloadButton } from "@/components/SpeakButton";
import { ExamMode, type TestData } from "@/components/ExamMode";

/* ---------- Types matching the Gemini schemas ---------- */
export interface SummaryData {
  title: string;
  keyPoints: string[];
  summary: string;
}
export interface QuizQuestion {
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
}
export interface QuizData {
  title: string;
  questions: QuizQuestion[];
}
export interface FlashcardsData {
  title: string;
  cards: { front: string; back: string }[];
}
export interface ExplainData {
  title: string;
  eli5: string;
  detailed: string;
  analogy: string;
}
export interface MindMapData {
  title: string;
  branches: { title: string; nodes: string[] }[];
}
export interface PlannerData {
  title: string;
  totalDays: number;
  days: { day: number; focus: string; tasks: string[] }[];
}

/** Flattens structured result into plain text for copy / download / speech. */
function toText(mode: StudyMode, data: unknown): string {
  if (mode === "summary") {
    const d = data as SummaryData;
    return `${d.title}\n\n${d.keyPoints.map((p, i) => `${i + 1}. ${p}`).join("\n")}\n\n${d.summary}`;
  }
  if (mode === "quiz") {
    const d = data as QuizData;
    return (
      `${d.title}\n\n` +
      d.questions
        .map(
          (q, i) =>
            `${i + 1}. ${q.question}\n` +
            q.options.map((o, oi) => `   ${String.fromCharCode(65 + oi)}. ${o}`).join("\n") +
            `\n   Answer: ${String.fromCharCode(65 + q.answerIndex)} — ${q.explanation}`
        )
        .join("\n\n")
    );
  }
  if (mode === "flashcards") {
    const d = data as FlashcardsData;
    return `${d.title}\n\n${d.cards.map((c, i) => `${i + 1}. Q: ${c.front}\n   A: ${c.back}`).join("\n\n")}`;
  }
  if (mode === "mindmap") {
    const d = data as MindMapData;
    return `${d.title}\n\n${d.branches.map((b) => `• ${b.title}\n${b.nodes.map((n) => `   - ${n}`).join("\n")}`).join("\n\n")}`;
  }
  if (mode === "planner") {
    const d = data as PlannerData;
    return (
      `${d.title} (${d.totalDays} days)\n\n` +
      d.days.map((day) => `Day ${day.day} — ${day.focus}\n${day.tasks.map((t) => `   • ${t}`).join("\n")}`).join("\n\n")
    );
  }
  if (mode === "test") return (data as TestData).title;
  const d = data as ExplainData;
  return `${d.title}\n\nExplain like I'm 5:\n${d.eli5}\n\nIn depth:\n${d.detailed}\n\nAnalogy:\n${d.analogy}`;
}

export function Results({ mode, data }: { mode: StudyMode; data: unknown }) {
  // Test mode is fully interactive — no copy/listen action bar.
  if (mode === "test") return <ExamMode data={data as TestData} />;

  const plain = toText(mode, data);
  const fname = `vidhyaai-${mode}.txt`;

  return (
    <div>
      {/* Action bar */}
      <div className="mb-5 flex flex-wrap justify-end gap-2">
        <SpeakButton text={plain} />
        <CopyButton text={plain} />
        <DownloadButton text={plain} filename={fname} />
      </div>

      {mode === "summary" && <SummaryView data={data as SummaryData} />}
      {mode === "quiz" && <QuizView data={data as QuizData} />}
      {mode === "flashcards" && <FlashcardsView data={data as FlashcardsData} />}
      {mode === "explain" && <ExplainView data={data as ExplainData} />}
      {mode === "mindmap" && <MindMapView data={data as MindMapData} />}
      {mode === "planner" && <PlannerView data={data as PlannerData} />}
    </div>
  );
}

/* ---------- Summary ---------- */
function SummaryView({ data }: { data: SummaryData }) {
  return (
    <div className="animate-fade-up space-y-5">
      <SectionTitle icon="📝" title={data.title} />
      <ul className="stagger space-y-2.5">
        {data.keyPoints.map((p, i) => (
          <li
            key={i}
            className="flex gap-3 rounded-xl border border-border bg-white/[0.02] px-4 py-3 text-foreground/90"
          >
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[10px] font-semibold text-accent">
              {i + 1}
            </span>
            <span>{p}</span>
          </li>
        ))}
      </ul>
      <div className="rounded-xl border border-border bg-white/[0.02] p-4">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary-2">Overview</p>
        <p className="leading-relaxed text-muted">{data.summary}</p>
      </div>
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-white/[0.04] text-lg">
        {icon}
      </span>
      <h2 className="font-serif text-2xl leading-tight text-foreground">{title}</h2>
    </div>
  );
}

/* ---------- Quiz ---------- */
function QuizView({ data }: { data: QuizData }) {
  const [picked, setPicked] = useState<Record<number, number>>({});
  const answered = Object.keys(picked).length;
  const score = data.questions.reduce(
    (acc, q, i) => acc + (picked[i] === q.answerIndex ? 1 : 0),
    0
  );

  const allDone = answered === data.questions.length;

  return (
    <div className="animate-fade-up space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionTitle icon="🎯" title={data.title} />
        {answered > 0 && (
          <span
            className={`rounded-full border px-4 py-1.5 text-sm font-medium ${
              allDone
                ? "border-accent/40 bg-accent/10 text-accent"
                : "border-border bg-white/[0.03] text-muted"
            }`}
          >
            Score: {score} / {data.questions.length}
          </span>
        )}
      </div>

      {data.questions.map((q, qi) => {
        const chosen = picked[qi];
        const isAnswered = chosen !== undefined;
        return (
          <div key={qi} className="rounded-2xl border border-border bg-white/[0.02] p-5">
            <p className="mb-3 font-medium text-foreground">
              {qi + 1}. {q.question}
            </p>
            <div className="grid gap-2">
              {q.options.map((opt, oi) => {
                const isCorrect = oi === q.answerIndex;
                const isChosen = oi === chosen;
                let cls =
                  "border-border bg-surface-2 hover:border-primary/60 text-foreground/90";
                if (isAnswered) {
                  if (isCorrect) cls = "border-accent/70 bg-accent/10 text-accent";
                  else if (isChosen) cls = "border-rose-500/60 bg-rose-500/10 text-rose-300";
                  else cls = "border-border bg-surface-2 text-muted";
                }
                return (
                  <button
                    key={oi}
                    disabled={isAnswered}
                    onClick={() => setPicked((p) => ({ ...p, [qi]: oi }))}
                    className={`rounded-lg border px-4 py-2.5 text-left text-sm transition ${cls} ${
                      isAnswered ? "cursor-default" : "cursor-pointer"
                    }`}
                  >
                    <span className="mr-2 font-mono text-xs text-muted">
                      {String.fromCharCode(65 + oi)}
                    </span>
                    {opt}
                  </button>
                );
              })}
            </div>
            {isAnswered && (
              <p className="mt-3 text-sm text-muted">
                <span className="text-accent">Why:</span> {q.explanation}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Flashcards ---------- */
function FlashcardsView({ data }: { data: FlashcardsData }) {
  return (
    <div className="animate-fade-up space-y-5">
      <SectionTitle icon="🃏" title={data.title} />
      <p className="text-sm text-muted">Tap a card to flip it. 👆</p>
      <div className="stagger grid gap-4 sm:grid-cols-2">
        {data.cards.map((c, i) => (
          <Flashcard key={i} front={c.front} back={c.back} index={i} />
        ))}
      </div>
    </div>
  );
}

function Flashcard({ front, back, index }: { front: string; back: string; index: number }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <div
      className={`flip-card h-48 cursor-pointer ${flipped ? "is-flipped" : ""}`}
      onClick={() => setFlipped((f) => !f)}
    >
      <div className="flip-inner relative h-full w-full">
        {/* Front */}
        <div className="flip-face absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-border bg-white/[0.03] p-5 text-center backdrop-blur">
          <span className="absolute left-4 top-3 text-[11px] font-mono text-muted/50">
            #{index + 1}
          </span>
          <span className="font-medium text-foreground">{front}</span>
          <span className="absolute bottom-3 text-[10px] uppercase tracking-wide text-muted/40">
            tap to flip
          </span>
        </div>
        {/* Back */}
        <div className="flip-face flip-back absolute inset-0 flex items-center justify-center rounded-2xl border border-primary/40 bg-primary/10 p-5 text-center backdrop-blur">
          <span className="text-sm leading-relaxed text-foreground/90">{back}</span>
        </div>
      </div>
    </div>
  );
}

/* ---------- Explain ---------- */
function ExplainView({ data }: { data: ExplainData }) {
  const blocks = [
    { label: "Explain like I'm 5", text: data.eli5, color: "text-accent", emoji: "🧒" },
    { label: "In depth", text: data.detailed, color: "text-primary", emoji: "📚" },
    { label: "Analogy", text: data.analogy, color: "text-primary-2", emoji: "🔗" },
  ];
  return (
    <div className="animate-fade-up space-y-5">
      <SectionTitle icon="💡" title={data.title} />
      <div className="stagger space-y-4">
        {blocks.map((b) => (
          <div key={b.label} className="rounded-2xl border border-border bg-white/[0.02] p-5">
            <p className={`mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide ${b.color}`}>
              <span>{b.emoji}</span> {b.label}
            </p>
            <p className="leading-relaxed text-foreground/90">{b.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Mind Map ---------- */
const BRANCH_COLORS = [
  "border-primary/40 bg-primary/[0.07]",
  "border-accent/40 bg-accent/[0.07]",
  "border-primary-2/40 bg-primary-2/[0.07]",
  "border-pink/40 bg-pink/[0.07]",
  "border-amber-400/40 bg-amber-400/[0.07]",
  "border-sky-400/40 bg-sky-400/[0.07]",
];
const DOT_COLORS = ["bg-primary", "bg-accent", "bg-primary-2", "bg-pink", "bg-amber-400", "bg-sky-400"];

function MindMapView({ data }: { data: MindMapData }) {
  return (
    <div className="animate-fade-up space-y-5">
      <SectionTitle icon="🗺️" title={data.title} />

      {/* Central node */}
      <div className="flex justify-center">
        <span className="rounded-full bg-gradient-to-r from-primary to-primary-2 px-5 py-2 font-medium text-white shadow-lg shadow-primary/30">
          {data.title}
        </span>
      </div>
      <div className="mx-auto h-5 w-px bg-border" />

      {/* Branches */}
      <div className="stagger grid gap-4 sm:grid-cols-2">
        {data.branches.map((b, i) => (
          <div key={i} className={`rounded-2xl border p-4 ${BRANCH_COLORS[i % BRANCH_COLORS.length]}`}>
            <p className="mb-3 flex items-center gap-2 font-medium text-foreground">
              <span className={`h-2.5 w-2.5 rounded-full ${DOT_COLORS[i % DOT_COLORS.length]}`} />
              {b.title}
            </p>
            <ul className="space-y-1.5 border-l border-border pl-4">
              {b.nodes.map((n, ni) => (
                <li key={ni} className="relative text-sm text-foreground/85">
                  <span className="absolute -left-[17px] top-2 h-px w-3 bg-border" />
                  {n}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Study Planner ---------- */
function PlannerView({ data }: { data: PlannerData }) {
  return (
    <div className="animate-fade-up space-y-5">
      <SectionTitle icon="📅" title={data.title} />
      <p className="text-sm text-muted">{data.totalDays}-day revision plan</p>

      <div className="stagger space-y-3">
        {data.days.map((d) => (
          <div key={d.day} className="flex gap-4 rounded-2xl border border-border bg-white/[0.02] p-4">
            <div className="flex flex-col items-center">
              <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-2 text-white">
                <span className="text-[9px] uppercase opacity-80">Day</span>
                <span className="font-serif text-lg font-semibold leading-none">{d.day}</span>
              </div>
            </div>
            <div className="flex-1">
              <p className="font-medium text-foreground">{d.focus}</p>
              <ul className="mt-2 space-y-1.5">
                {d.tasks.map((t, ti) => (
                  <li key={ti} className="flex gap-2 text-sm text-foreground/85">
                    <span className="mt-0.5 text-accent">✓</span> {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
