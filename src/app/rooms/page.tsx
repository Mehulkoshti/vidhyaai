"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RoomsHome() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [joinCode, setJoinCode] = useState("");

  async function create() {
    setLoading(true);
    try {
      const res = await fetch("/api/room", { method: "POST" });
      const json = await res.json();
      if (res.ok && json.code) router.push(`/rooms/${json.code}`);
    } finally {
      setLoading(false);
    }
  }

  function join() {
    const c = joinCode.trim().toUpperCase();
    if (c.length >= 4) router.push(`/rooms/${c}`);
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
          🤝 <span className="text-gradient">Study Rooms</span>
        </h1>
        <p className="mx-auto mt-3 max-w-md text-muted">
          Study together. Create a room, share the code, and everyone&apos;s AI-generated
          summaries, quizzes and flashcards appear in one shared live feed.
        </p>
      </section>

      <section className="mx-auto grid w-full max-w-3xl gap-5 px-5 pb-16 sm:grid-cols-2">
        <div className="glass rounded-2xl p-6">
          <h2 className="font-serif text-xl">Start a room</h2>
          <p className="mt-1 text-sm text-muted">Get a fresh room and invite your study group.</p>
          <button
            onClick={create}
            disabled={loading}
            className="btn-glow mt-4 w-full rounded-xl px-5 py-3 font-medium text-white disabled:opacity-50"
          >
            {loading ? "Creating…" : "✨ Create a room"}
          </button>
        </div>

        <div className="glass rounded-2xl p-6">
          <h2 className="font-serif text-xl">Join a room</h2>
          <p className="mt-1 text-sm text-muted">Enter a room code from a friend.</p>
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && join()}
            placeholder="ABC123"
            maxLength={6}
            className="mt-4 w-full rounded-xl border border-border bg-black/20 px-4 py-2.5 text-center font-mono text-2xl tracking-widest text-foreground outline-none focus:border-primary/60"
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
