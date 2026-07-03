"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Reads text aloud. Prefers Sarvam's Bulbul TTS for natural, native-sounding
 * Indian-language voices; if that's unavailable (mock mode / error), it falls
 * back to the browser's free Web Speech API. Fetched audio is cached per text
 * so re-clicking never spends credits twice.
 */
export function SpeakButton({
  text,
  lang = "English",
  label = "Listen",
}: {
  text: string;
  lang?: string;
  label?: string;
}) {
  const [speaking, setSpeaking] = useState(false);
  const [loading, setLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cacheRef = useRef<{ key: string; url: string } | null>(null);

  useEffect(() => {
    return () => {
      // Cleanup on unmount: stop any playback.
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      audioRef.current?.pause();
    };
  }, []);

  function stop() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setSpeaking(false);
  }

  function browserSpeak() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setSpeaking(false);
      return;
    }
    const synth = window.speechSynthesis;
    synth.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1;
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    setSpeaking(true);
    synth.speak(utter);
  }

  async function playSarvam(): Promise<boolean> {
    const key = `${lang}::${text}`;
    let url = cacheRef.current?.key === key ? cacheRef.current.url : null;

    if (!url) {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.mock || !json.audio) return false; // → browser fallback
      url = `data:${json.mime || "audio/mpeg"};base64,${json.audio}`;
      cacheRef.current = { key, url };
    }

    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onended = () => setSpeaking(false);
    audio.onerror = () => setSpeaking(false);
    setSpeaking(true);
    await audio.play();
    return true;
  }

  async function toggle() {
    if (speaking) {
      stop();
      return;
    }
    setLoading(true);
    try {
      const ok = await playSarvam();
      if (!ok) browserSpeak();
    } catch {
      browserSpeak();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white/[0.03] px-3 py-1.5 text-xs text-muted transition hover:border-primary/50 hover:text-foreground disabled:opacity-50"
    >
      {loading ? (
        <>
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted/40 border-t-accent" />
          Loading
        </>
      ) : speaking ? (
        <>
          <span className="flex gap-0.5">
            <span className="h-3 w-0.5 animate-pulse rounded bg-accent" />
            <span className="h-3 w-0.5 animate-pulse rounded bg-accent [animation-delay:120ms]" />
            <span className="h-3 w-0.5 animate-pulse rounded bg-accent [animation-delay:240ms]" />
          </span>
          Stop
        </>
      ) : (
        <>🔊 {label}</>
      )}
    </button>
  );
}

/** Small copy-to-clipboard button. */
export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }
  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white/[0.03] px-3 py-1.5 text-xs text-muted transition hover:border-primary/50 hover:text-foreground"
    >
      {copied ? <>✓ Copied</> : <>📋 Copy</>}
    </button>
  );
}

/** Downloads given text as a .txt file. */
export function DownloadButton({ text, filename }: { text: string; filename: string }) {
  function download() {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <button
      onClick={download}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white/[0.03] px-3 py-1.5 text-xs text-muted transition hover:border-primary/50 hover:text-foreground"
    >
      📥 Download
    </button>
  );
}
