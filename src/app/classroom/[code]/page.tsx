"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface Result { name: string; score: number; total: number; at: number }

export default function ClassRoomPage() {
  const params = useParams();
  const code = String(params.code || "").toUpperCase();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [data, setData] = useState<{ topic: string; test: any } | null>(null);
  const [results, setResults] = useState<Result[]>([]);

  const [name, setName] = useState("");
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);

  async function load() {
    try {
      const res = await fetch(`/api/classroom/${code}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      const json = await res.json();
      setData({ topic: json.topic, test: json.test });
      setResults(json.results || []);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const test = data?.test;
  const total = test?.questions?.length || 0;
  const answered = Object.keys(answers).length;
  const score = (test?.questions || []).reduce(
    (a: number, q: any, i: number) => a + (answers[i] === q.answerIndex ? 1 : 0),
    0
  );
  const percent = total ? Math.round((score / total) * 100) : 0;

  async function submit() {
    setSubmitted(true);
    try {
      const res = await fetch(`/api/classroom/${code}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, score, total }),
      });
      const json = await res.json();
      if (res.ok && json.results) setResults(json.results);
    } catch {
      /* ignore */
    }
  }

  async function refresh() {
    try {
      const res = await fetch(`/api/classroom/${code}`);
      const json = await res.json();
      if (res.ok) setResults(json.results || []);
    } catch {
      /* ignore */
    }
  }

  const board = [...results].sort((a, b) => b.score / b.total - a.score / a.total);
  const avg = results.length
    ? Math.round(results.reduce((s, r) => s + (r.score / r.total) * 100, 0) / results.length)
    : 0;

  return (
    <div className="flex-1">
      <nav className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 py-5">
        <Link href="/classroom" className="font-serif text-xl font-semibold">
          <span className="text-gradient">VidhyaAI</span> · Classroom
        </Link>
        <span className="font-mono text-sm tracking-widest text-muted">{code}</span>
      </nav>

      <div className="mx-auto w-full max-w-2xl px-5 pb-16">
        {loading ? (
          <p className="mt-10 text-center text-muted">Loading…</p>
        ) : notFound ? (
          <div className="glass mt-10 rounded-2xl p-8 text-center">
            <p className="text-lg">Class <span className="font-mono text-rose-300">{code}</span> not found.</p>
            <Link href="/classroom" className="mt-4 inline-block text-sm text-primary hover:underline">← Back</Link>
          </div>
        ) : (
          <>
            <h1 className="font-serif text-3xl font-semibold">{test?.title || data?.topic}</h1>
            <p className="mt-1 text-sm text-muted">{total} questions · Class code {code}</p>

            {!submitted ? (
              <div className="mt-6 space-y-5">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full rounded-xl border border-border bg-black/20 px-4 py-2.5 text-foreground outline-none focus:border-primary/60"
                />

                {test?.questions?.map((q: any, qi: number) => (
                  <div key={qi} className="glass rounded-2xl p-5">
                    <p className="mb-3 font-medium">{qi + 1}. {q.question}</p>
                    <div className="grid gap-2">
                      {q.options.map((opt: string, oi: number) => {
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
                  onClick={submit}
                  disabled={answered < total || !name.trim()}
                  className="btn-glow w-full rounded-xl px-6 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {!name.trim()
                    ? "Enter your name to submit"
                    : answered < total
                    ? `Answer all ${total} questions`
                    : "Submit ✓"}
                </button>
              </div>
            ) : (
              <div className="mt-6 space-y-6">
                <div className="glass rounded-2xl p-6 text-center">
                  <div className="text-4xl">{percent >= 60 ? "🎉" : "💪"}</div>
                  <p className="mt-2 font-serif text-3xl font-semibold">{score}/{total} ({percent}%)</p>
                  <p className="text-muted">Nice work, {name || "student"}! Your score is on the board.</p>
                </div>

                <Leaderboard board={board} avg={avg} onRefresh={refresh} />
              </div>
            )}

            {!submitted && results.length > 0 && (
              <div className="mt-8">
                <Leaderboard board={board} avg={avg} onRefresh={refresh} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Leaderboard({ board, avg, onRefresh }: { board: Result[]; avg: number; onRefresh: () => void }) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-serif text-xl">🏆 Leaderboard <span className="text-sm text-muted">· avg {avg}%</span></h2>
        <button onClick={onRefresh} className="rounded-lg border border-border bg-white/[0.03] px-3 py-1.5 text-xs text-muted transition hover:text-foreground">
          ↻ Refresh
        </button>
      </div>
      {board.length === 0 ? (
        <p className="text-sm text-muted">No submissions yet.</p>
      ) : (
        <div className="space-y-2">
          {board.map((r, i) => {
            const pct = Math.round((r.score / r.total) * 100);
            return (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-border bg-white/[0.02] px-4 py-2.5">
                <span className="w-6 text-center font-serif text-lg text-muted">{i + 1}</span>
                <span className="flex-1 truncate text-foreground/90">{r.name}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${pct >= 60 ? "bg-accent/15 text-accent" : "bg-amber-400/15 text-amber-300"}`}>
                  {r.score}/{r.total} · {pct}%
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
