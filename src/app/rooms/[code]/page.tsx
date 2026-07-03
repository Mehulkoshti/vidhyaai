"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Results } from "@/components/Results";
import type { StudyMode } from "@/lib/sarvam";

interface RoomItem { id: string; by: string; mode: StudyMode; topic: string; data: unknown; at: number }

const MODES: { key: StudyMode; label: string; icon: string }[] = [
  { key: "summary", label: "Summary", icon: "📝" },
  { key: "explain", label: "Explain", icon: "💡" },
  { key: "quiz", label: "Quiz", icon: "🎯" },
  { key: "flashcards", label: "Flashcards", icon: "🃏" },
  { key: "mindmap", label: "Mind Map", icon: "🗺️" },
];
const LANGS = [
  "English", "Hindi", "Hinglish", "Marathi", "Tamil", "Bengali",
  "Telugu", "Kannada", "Gujarati", "Malayalam", "Punjabi", "Odia",
];

export default function RoomPage() {
  const params = useParams();
  const code = String(params.code || "").toUpperCase();

  const [name, setName] = useState("");
  const [named, setNamed] = useState(false);
  const [mode, setMode] = useState<StudyMode>("summary");
  const [lang, setLang] = useState("English");
  const [topic, setTopic] = useState("");
  const [items, setItems] = useState<RoomItem[]>([]);
  const [sending, setSending] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Restore a saved display name.
  useEffect(() => {
    try {
      const n = localStorage.getItem("vidhyaai_name");
      if (n) { setName(n); setNamed(true); }
    } catch { /* ignore */ }
  }, []);

  // Poll the shared feed.
  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const res = await fetch(`/api/room/${code}`);
        if (res.status === 404) { setNotFound(true); return; }
        const json = await res.json();
        if (alive && Array.isArray(json.items)) setItems(json.items);
      } catch { /* ignore */ }
    }
    poll();
    const t = setInterval(poll, 4000);
    return () => { alive = false; clearInterval(t); };
  }, [code]);

  function saveName() {
    if (!name.trim()) return;
    try { localStorage.setItem("vidhyaai_name", name.trim()); } catch { /* ignore */ }
    setNamed(true);
  }

  async function send() {
    if (!topic.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/room/${code}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ by: name, mode, topic: topic.trim(), lang }),
      });
      const json = await res.json();
      if (res.ok && Array.isArray(json.items)) {
        setItems(json.items);
        setTopic("");
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      }
    } finally {
      setSending(false);
    }
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-lg px-5 py-20 text-center">
        <p className="text-lg">Room <span className="font-mono text-rose-300">{code}</span> not found.</p>
        <Link href="/rooms" className="mt-4 inline-block text-sm text-primary hover:underline">← Back to rooms</Link>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <Link href="/rooms" className="font-serif text-lg font-semibold">
          <span className="text-gradient">VidhyaAI</span> · Room
        </Link>
        <span className="font-mono text-sm tracking-widest text-muted">{code}</span>
      </header>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-6">
          {items.length === 0 ? (
            <p className="mt-10 text-center text-muted">
              No study material yet. Add the first one below — everyone in this room will see it. 🎉
            </p>
          ) : (
            <div className="space-y-5">
              {items.map((it) => (
                <div key={it.id} className="animate-fade-up">
                  <p className="mb-1.5 px-1 text-xs text-muted">
                    <span className="text-foreground/80">{it.by}</span> added a {MODES.find((m) => m.key === it.mode)?.label || it.mode} · <span className="text-muted">{it.topic}</span>
                  </p>
                  <div className="glass rounded-2xl p-5 sm:p-6">
                    <Results mode={it.mode} data={it.data} lang={lang} />
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-border bg-background/60 backdrop-blur">
        <div className="mx-auto w-full max-w-3xl px-4 py-3">
          {!named ? (
            <div className="flex items-center gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveName()}
                placeholder="Enter your name to join the room…"
                className="flex-1 rounded-xl border border-border bg-black/20 px-4 py-2.5 text-foreground outline-none focus:border-primary/60"
              />
              <button onClick={saveName} className="btn-glow rounded-xl px-5 py-2.5 text-sm font-medium text-white">Join</button>
            </div>
          ) : (
            <>
              <div className="mb-2.5 flex flex-wrap gap-1.5">
                {MODES.map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setMode(m.key)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      mode === m.key ? "border-primary/70 bg-primary/15 text-foreground" : "border-border bg-white/[0.02] text-muted hover:text-foreground"
                    }`}
                  >
                    {m.icon} {m.label}
                  </button>
                ))}
              </div>
              <div className="flex items-end gap-2 rounded-2xl border border-border bg-black/20 p-2 focus-within:border-primary/60">
                <input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  placeholder={`Add a ${MODES.find((m) => m.key === mode)?.label.toLowerCase()} for the room…`}
                  className="flex-1 bg-transparent px-2 py-2 text-foreground placeholder:text-muted/60 outline-none"
                />
                <select
                  value={lang}
                  onChange={(e) => setLang(e.target.value)}
                  className="shrink-0 rounded-lg border border-border bg-black/20 px-2 py-2 text-xs text-muted outline-none focus:border-primary/60"
                >
                  {LANGS.map((l) => <option key={l} value={l} className="bg-[#11141d]">{l}</option>)}
                </select>
                <button onClick={send} disabled={sending} className="btn-glow shrink-0 rounded-xl px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">
                  {sending ? "…" : "Share ↑"}
                </button>
              </div>
              <p className="mt-2 text-center text-[11px] text-muted/40">Posting as {name} · everyone in room {code} sees this</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
