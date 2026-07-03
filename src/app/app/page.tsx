"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Results } from "@/components/Results";
import { SpeakButton } from "@/components/SpeakButton";
import { MicButton } from "@/components/MicButton";
import type { StudyMode } from "@/lib/sarvam";
import { loadLibrary, saveItem, removeItem, type SavedItem } from "@/lib/library";
import { recordStudyDay, getProgress, type ProgressSummary } from "@/lib/stats";

type InputMode = "ask" | StudyMode;

const MODES: { key: InputMode; label: string; icon: string }[] = [
  { key: "ask", label: "Ask", icon: "💬" },
  { key: "summary", label: "Summary", icon: "📝" },
  { key: "quiz", label: "Quiz", icon: "🎯" },
  { key: "flashcards", label: "Flashcards", icon: "🃏" },
  { key: "explain", label: "Explain", icon: "💡" },
  { key: "mindmap", label: "Mind Map", icon: "🗺️" },
  { key: "test", label: "Mock Test", icon: "📝" },
  { key: "planner", label: "Planner", icon: "📅" },
  { key: "course", label: "Course", icon: "📖" },
];

const LANGS = [
  "English", "Hindi", "Hinglish", "Marathi", "Tamil", "Bengali",
  "Telugu", "Kannada", "Gujarati", "Malayalam", "Punjabi", "Odia",
];

type Message =
  | { id: string; role: "user"; text: string; mode: InputMode; fileName?: string }
  | { id: string; role: "assistant"; kind: "study"; mode: StudyMode; data: unknown; lang: string }
  | { id: string; role: "assistant"; kind: "answer"; text: string; lang: string }
  | { id: string; role: "assistant"; kind: "error"; text: string };

interface AttachedFile {
  data: string;
  mimeType: string;
  name: string;
}

const STORAGE_KEY = "vidhyaai_session";

function newId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  }
}

function lastStudyTopic(messages: Message[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === "user" && m.mode !== "ask") return m.text;
  }
  return "general studies";
}

export default function ChatApp() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<InputMode>("ask");
  const [lang, setLang] = useState("English");
  const [file, setFile] = useState<AttachedFile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [library, setLibrary] = useState<SavedItem[]>([]);
  const [showLibrary, setShowLibrary] = useState(false);
  const [progress, setProgress] = useState<ProgressSummary | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  /* Load session on mount */
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) setMessages(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    setLibrary(loadLibrary());
    setHydrated(true);
  }, []);

  /* Persist session + autoscroll on every message change */
  useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      /* ignore (quota) */
    }
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, hydrated, loading]);

  function handleFile(f: File | undefined) {
    if (!f) return;
    if (f.size > 7 * 1024 * 1024) {
      setError("File too large. Keep it under 7 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      setFile({ data: res.split(",")[1] || "", mimeType: f.type, name: f.name });
      setError("");
    };
    reader.readAsDataURL(f);
  }

  function clearFile() {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function newChat() {
    setMessages([]);
    setInput("");
    clearFile();
    setError("");
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  async function send() {
    const text = input.trim();
    if (loading) return;
    if (mode === "ask" && !text) {
      setError("Type your question.");
      return;
    }
    if (mode !== "ask" && !text && !file) {
      setError("Enter a topic / notes, or attach an image or PDF.");
      return;
    }
    setError("");

    const userMsg: Message = {
      id: newId(),
      role: "user",
      text: text || file?.name || "Uploaded notes",
      mode,
      fileName: file?.name,
    };
    const snapshot = [...messages, userMsg];
    setMessages(snapshot);
    setInput("");
    const attached = file;
    clearFile();
    setLoading(true);

    try {
      let body: Record<string, unknown>;
      if (mode === "ask") {
        body = { mode: "ask", context: lastStudyTopic(snapshot), question: text, lang };
      } else {
        body = {
          mode,
          topic: text,
          lang,
          file: attached ? { data: attached.data, mimeType: attached.mimeType } : undefined,
        };
      }

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to generate");

      const aMsg: Message =
        mode === "ask"
          ? { id: newId(), role: "assistant", kind: "answer", text: json.data.answer, lang }
          : { id: newId(), role: "assistant", kind: "study", mode, data: json.data, lang };
      setMessages((m) => [...m, aMsg]);
      recordStudyDay();
    } catch (e: unknown) {
      setMessages((m) => [
        ...m,
        { id: newId(), role: "assistant", kind: "error", text: e instanceof Error ? e.message : "Something went wrong" },
      ]);
    } finally {
      setLoading(false);
    }
  }

  // Programmatically generate study material for a topic (used by "revise this
  // weak concept" buttons after a mock test). Shares the /api/generate flow.
  async function runStudy(topic: string, studyMode: StudyMode) {
    if (loading) return;
    const userMsg: Message = { id: newId(), role: "user", text: topic, mode: studyMode };
    setMessages((m) => [...m, userMsg]);
    setLoading(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: studyMode, topic, lang }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to generate");
      setMessages((m) => [
        ...m,
        { id: newId(), role: "assistant", kind: "study", mode: studyMode, data: json.data, lang },
      ]);
      recordStudyDay();
    } catch (e: unknown) {
      setMessages((m) => [
        ...m,
        { id: newId(), role: "assistant", kind: "error", text: e instanceof Error ? e.message : "Something went wrong" },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function saveToLibrary(item: SavedItem) {
    setLibrary(saveItem(item));
  }
  function deleteSaved(id: string) {
    setLibrary(removeItem(id));
  }
  function openSaved(item: SavedItem) {
    setMessages((m) => [
      ...m,
      { id: newId(), role: "assistant", kind: "study", mode: item.mode, data: item.data, lang: item.lang },
    ]);
    setShowLibrary(false);
  }

  const activeMode = MODES.find((m) => m.key === mode)!;
  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-[100dvh] w-full flex-col">
      {/* Top bar */}
      <header className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3 backdrop-blur">
        <Link href="/" className="font-serif text-lg font-semibold">
          <span className="text-gradient">VidhyaAI</span>
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setProgress(getProgress())}
            className="rounded-lg border border-border bg-white/[0.03] px-3 py-1.5 text-xs text-muted transition hover:border-primary/50 hover:text-foreground"
          >
            📊 Progress
          </button>
          <button
            onClick={() => setShowLibrary(true)}
            className="rounded-lg border border-border bg-white/[0.03] px-3 py-1.5 text-xs text-muted transition hover:border-primary/50 hover:text-foreground"
          >
            📚 Saved{library.length > 0 ? ` (${library.length})` : ""}
          </button>
          <button
            onClick={newChat}
            className="rounded-lg border border-border bg-white/[0.03] px-3 py-1.5 text-xs text-muted transition hover:border-primary/50 hover:text-foreground"
          >
            ＋ New chat
          </button>
        </div>
      </header>

      {showLibrary && (
        <LibraryDrawer
          items={library}
          onClose={() => setShowLibrary(false)}
          onOpen={openSaved}
          onDelete={deleteSaved}
        />
      )}

      {progress && <ProgressDrawer p={progress} onClose={() => setProgress(null)} />}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-6">
          {isEmpty && hydrated && (
            <div className="mt-10 flex flex-col items-center text-center animate-fade-up">
              <div className="floaty text-5xl">📚</div>
              <h1 className="mt-5 font-serif text-3xl font-semibold">
                Hey! What are we <span className="text-gradient">studying</span> today?
              </h1>
              <p className="mt-3 max-w-md text-muted">
                Pick a mode below, type a topic (or attach a photo/PDF of your
                notes), and hit send. Ask follow-up doubts anytime — your whole
                session stays right here.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {["Photosynthesis", "Newton's laws", "French Revolution", "OOP concepts"].map((ex) => (
                  <button
                    key={ex}
                    onClick={() => setInput(ex)}
                    className="rounded-full border border-border bg-white/[0.03] px-3.5 py-1.5 text-sm text-muted transition hover:border-primary/50 hover:text-foreground"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-5">
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} onStudyConcept={runStudy} onSave={saveToLibrary} />
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted animate-fade-up">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted/40 border-t-accent" />
                Thinking…
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-border bg-background/60 backdrop-blur">
        <div className="mx-auto w-full max-w-3xl px-4 py-3">
          {/* Mode chips */}
          <div className="mb-2.5 flex flex-wrap gap-1.5">
            {MODES.map((m) => (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  mode === m.key
                    ? "border-primary/70 bg-primary/15 text-foreground"
                    : "border-border bg-white/[0.02] text-muted hover:border-border-strong hover:text-foreground"
                }`}
              >
                {m.icon} {m.label}
              </button>
            ))}
          </div>

          {/* Attached file pill */}
          {file && (
            <div className="mb-2 flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs text-accent">
              <span>{file.mimeType === "application/pdf" ? "📄" : "🖼️"}</span>
              <span className="truncate">{file.name}</span>
              <button onClick={clearFile} className="ml-auto text-accent/80 hover:text-accent" aria-label="Remove">
                ✕
              </button>
            </div>
          )}

          {error && <p className="mb-2 text-xs text-rose-300">⚠️ {error}</p>}

          {/* Input row */}
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-black/20 p-2 focus-within:border-primary/60">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,application/pdf"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={mode === "ask"}
              title={mode === "ask" ? "Switch to a study mode to attach notes" : "Attach photo / PDF"}
              className="shrink-0 rounded-lg px-2.5 py-2 text-lg text-muted transition hover:text-foreground disabled:opacity-30"
            >
              📎
            </button>

            <MicButton
              lang={lang}
              disabled={loading}
              onTranscript={(t) => setInput((prev) => (prev ? `${prev} ${t}` : t))}
            />

            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              placeholder={
                mode === "ask"
                  ? "Ask a doubt about what you're studying…"
                  : `Enter a topic for ${activeMode.label.toLowerCase()} (or attach a file)…`
              }
              className="max-h-32 flex-1 resize-none bg-transparent py-2 text-foreground placeholder:text-muted/60 outline-none"
            />

            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              className="shrink-0 rounded-lg border border-border bg-black/20 px-2 py-2 text-xs text-muted outline-none focus:border-primary/60"
              title="Language"
            >
              {LANGS.map((l) => (
                <option key={l} value={l} className="bg-[#11141d]">
                  {l}
                </option>
              ))}
            </select>

            <button
              onClick={send}
              disabled={loading}
              className="btn-glow shrink-0 rounded-xl px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {loading ? "…" : "Send ↑"}
            </button>
          </div>
          <p className="mt-2 text-center text-[11px] text-muted/40">
            VidhyaAI can make mistakes — verify important facts. Your session stays until you close this tab.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------- Message bubble ---------- */
function MessageBubble({
  message,
  onStudyConcept,
  onSave,
}: {
  message: Message;
  onStudyConcept: (topic: string, mode: StudyMode) => void;
  onSave: (item: SavedItem) => void;
}) {
  if (message.role === "user") {
    const m = MODES.find((x) => x.key === message.mode);
    return (
      <div className="flex justify-end animate-fade-up">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary/20 px-4 py-2.5 text-foreground">
          <span className="mr-1.5 text-xs text-muted">{m?.icon}{message.mode !== "ask" ? ` ${m?.label}` : ""}</span>
          {message.fileName && <span className="mr-1.5">📎</span>}
          {message.text}
        </div>
      </div>
    );
  }

  if (message.kind === "error") {
    return (
      <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300 animate-fade-up">
        ⚠️ {message.text}
      </div>
    );
  }

  if (message.kind === "answer") {
    return (
      <div className="animate-fade-up">
        <div className="glass max-w-[92%] rounded-2xl rounded-bl-sm p-4">
          <p className="leading-relaxed text-foreground/90 whitespace-pre-wrap">{message.text}</p>
          <div className="mt-3">
            <SpeakButton text={message.text} lang={message.lang} />
          </div>
        </div>
      </div>
    );
  }

  // study card
  return (
    <div className="glass rounded-2xl p-5 sm:p-6 animate-fade-up">
      <Results mode={message.mode} data={message.data} lang={message.lang} onStudyConcept={onStudyConcept} onSave={onSave} />
    </div>
  );
}

/* ---------- Saved library drawer ---------- */
function LibraryDrawer({
  items,
  onClose,
  onOpen,
  onDelete,
}: {
  items: SavedItem[];
  onClose: () => void;
  onOpen: (item: SavedItem) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-up" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-sm flex-col border-l border-border bg-background/95 backdrop-blur">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="font-serif text-lg">📚 Saved decks</span>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-muted hover:text-foreground" aria-label="Close">
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <p className="mt-10 text-center text-sm text-muted">
              Nothing saved yet. Hit <span className="text-foreground">☆ Save</span> on any result to keep it here — it stays even after you close the tab.
            </p>
          ) : (
            <div className="space-y-2.5">
              {items.map((it) => {
                const m = MODES.find((x) => x.key === it.mode);
                return (
                  <div key={it.id} className="rounded-xl border border-border bg-white/[0.02] p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{it.title}</p>
                        <p className="mt-0.5 text-xs text-muted">
                          {m?.icon} {m?.label} · {it.lang}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2.5 flex gap-2">
                      <button
                        onClick={() => onOpen(it)}
                        className="rounded-lg border border-primary/50 bg-primary/10 px-3 py-1 text-xs text-foreground transition hover:bg-primary/20"
                      >
                        Open
                      </button>
                      <button
                        onClick={() => onDelete(it.id)}
                        className="rounded-lg border border-border bg-white/[0.03] px-3 py-1 text-xs text-muted transition hover:border-rose-500/50 hover:text-rose-300"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

/* ---------- Progress dashboard drawer ---------- */
function ProgressDrawer({ p, onClose }: { p: ProgressSummary; onClose: () => void }) {
  const cards = [
    { label: "Day streak", value: `${p.streak}🔥` },
    { label: "Tests taken", value: p.attempts },
    { label: "Avg score", value: `${p.avgPercent}%` },
    { label: "Best score", value: `${p.bestPercent}%` },
  ];
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-up" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-sm flex-col border-l border-border bg-background/95 backdrop-blur">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="font-serif text-lg">📊 Your progress</span>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-muted hover:text-foreground" aria-label="Close">
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-3">
            {cards.map((c) => (
              <div key={c.label} className="rounded-xl border border-border bg-white/[0.02] p-4 text-center">
                <div className="font-serif text-2xl font-semibold text-gradient">{c.value}</div>
                <div className="mt-1 text-xs uppercase tracking-wide text-muted">{c.label}</div>
              </div>
            ))}
          </div>

          <p className="mt-6 mb-2 text-sm font-medium text-muted">Recent tests</p>
          {p.recent.length === 0 ? (
            <p className="text-sm text-muted/70">Take a Mock Test to start tracking your progress here.</p>
          ) : (
            <div className="space-y-2">
              {p.recent.map((a, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl border border-border bg-white/[0.02] px-3 py-2.5">
                  <span className="min-w-0 truncate pr-2 text-sm text-foreground/90">{a.topic}</span>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      a.percent >= 60 ? "bg-accent/15 text-accent" : "bg-amber-400/15 text-amber-300"
                    }`}
                  >
                    {a.percent}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
