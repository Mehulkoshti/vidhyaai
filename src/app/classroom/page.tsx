"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const LANGS = [
  "English", "Hindi", "Hinglish", "Marathi", "Tamil", "Bengali",
  "Telugu", "Kannada", "Gujarati", "Malayalam", "Punjabi", "Odia",
];

export default function ClassroomHome() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [lang, setLang] = useState("English");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");

  async function create() {
    if (!topic.trim()) {
      setError("Enter a topic for the class test.");
      return;
    }
    setError("");
    setLoading(true);
    setCreated(null);
    try {
      const res = await fetch("/api/classroom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, lang }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create class");
      setCreated(json.code);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function join() {
    const c = joinCode.trim().toUpperCase();
    if (c.length >= 4) router.push(`/classroom/${c}`);
  }

  return (
    <div className="flex-1">
      <nav className="mx-auto flex w-full max-w-4xl items-center justify-between px-5 py-5">
        <Link href="/" className="font-serif text-xl font-semibold">
          <span className="text-gradient">VidhyaAI</span>
        </Link>
        <Link href="/app" className="text-sm text-muted hover:text-foreground">Open app →</Link>
      </nav>

      <section className="mx-auto w-full max-w-2xl px-5 py-8 text-center">
        <h1 className="font-serif text-4xl font-semibold sm:text-5xl">
          👩‍🏫 <span className="text-gradient">Classroom</span>
        </h1>
        <p className="mx-auto mt-3 max-w-md text-muted">
          Teachers turn any topic into a shareable live quiz. Students join with a code
          and their scores appear on a live leaderboard.
        </p>
      </section>

      <section className="mx-auto grid w-full max-w-3xl gap-5 px-5 pb-16 sm:grid-cols-2">
        {/* Teacher */}
        <div className="glass rounded-2xl p-6">
          <h2 className="font-serif text-xl">Create a class</h2>
          <p className="mt-1 text-sm text-muted">Generate a 10-question test students can take.</p>

          <label className="mt-4 block text-xs uppercase tracking-wide text-muted">Topic</label>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Photosynthesis"
            className="mt-1.5 w-full rounded-xl border border-border bg-black/20 px-4 py-2.5 text-foreground outline-none focus:border-primary/60"
          />

          <label className="mt-3 block text-xs uppercase tracking-wide text-muted">Language</label>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-border bg-black/20 px-3 py-2.5 text-sm text-muted outline-none focus:border-primary/60"
          >
            {LANGS.map((l) => (
              <option key={l} value={l} className="bg-[#11141d]">{l}</option>
            ))}
          </select>

          {error && <p className="mt-3 text-xs text-rose-300">⚠️ {error}</p>}

          <button
            onClick={create}
            disabled={loading}
            className="btn-glow mt-4 w-full rounded-xl px-5 py-3 font-medium text-white disabled:opacity-50"
          >
            {loading ? "Creating…" : "✨ Create class"}
          </button>

          {created && (
            <div className="mt-4 rounded-xl border border-accent/30 bg-accent/[0.06] p-4 text-center">
              <p className="text-xs uppercase tracking-wide text-muted">Class code</p>
              <p className="my-1 font-mono text-3xl font-bold tracking-widest text-accent">{created}</p>
              <p className="text-xs text-muted">Share this code with your students.</p>
              <Link
                href={`/classroom/${created}`}
                className="mt-3 inline-block rounded-lg border border-primary/50 bg-primary/10 px-4 py-2 text-sm text-foreground transition hover:bg-primary/20"
              >
                Open class & live results →
              </Link>
            </div>
          )}
        </div>

        {/* Student */}
        <div className="glass rounded-2xl p-6">
          <h2 className="font-serif text-xl">Join a class</h2>
          <p className="mt-1 text-sm text-muted">Enter the code your teacher gave you.</p>

          <label className="mt-4 block text-xs uppercase tracking-wide text-muted">Class code</label>
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && join()}
            placeholder="ABC123"
            maxLength={6}
            className="mt-1.5 w-full rounded-xl border border-border bg-black/20 px-4 py-2.5 text-center font-mono text-2xl tracking-widest text-foreground outline-none focus:border-primary/60"
          />
          <button
            onClick={join}
            className="mt-4 w-full rounded-xl border border-border bg-white/[0.03] px-5 py-3 font-medium text-foreground transition hover:border-primary/50"
          >
            Join →
          </button>
        </div>
      </section>
    </div>
  );
}
