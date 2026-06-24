"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Results } from "@/components/Results";
import { SpeakButton } from "@/components/SpeakButton";
import type { StudyMode } from "@/lib/gemini";

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
];

const LANGS = ["English", "Hindi", "Hinglish", "Marathi", "Tamil", "Bengali"];

type Message =
  | { id: string; role: "user"; text: string; mode: InputMode; fileName?: string }
  | { id: string; role: "assistant"; kind: "study"; mode: StudyMode; data: unknown }
  | { id: string; role: "assistant"; kind: "answer"; text: string }
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
          ? { id: newId(), role: "assistant", kind: "answer", text: json.data.answer }
          : { id: newId(), role: "assistant", kind: "study", mode, data: json.data };
      setMessages((m) => [...m, aMsg]);
    } catch (e: unknown) {
      setMessages((m) => [
        ...m,
        { id: newId(), role: "assistant", kind: "error", text: e instanceof Error ? e.message : "Something went wrong" },
      ]);
    } finally {
      setLoading(false);
    }
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
        <button
          onClick={newChat}
          className="rounded-lg border border-border bg-white/[0.03] px-3 py-1.5 text-xs text-muted transition hover:border-primary/50 hover:text-foreground"
        >
          ＋ New chat
        </button>
      </header>

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
              <MessageBubble key={m.id} message={m} />
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
              accept="image/png,image/jpeg,image/webp,application/pdf"
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
function MessageBubble({ message }: { message: Message }) {
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
            <SpeakButton text={message.text} />
          </div>
        </div>
      </div>
    );
  }

  // study card
  return (
    <div className="glass rounded-2xl p-5 sm:p-6 animate-fade-up">
      <Results mode={message.mode} data={message.data} />
    </div>
  );
}
