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

/**
 * Opens a clean, branded, print-friendly page and triggers the browser's
 * print dialog — the user picks "Save as PDF". Uses system fonts, so every
 * language (Hindi, Tamil, Bengali…) renders correctly, with no font bundling.
 */
export function PrintButton({ text, title }: { text: string; title: string }) {
  function printPdf() {
    const w = window.open("", "_blank");
    if (!w) return;
    const esc = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    w.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>` +
        `<style>` +
        `body{font-family:system-ui,-apple-system,'Segoe UI','Noto Sans',sans-serif;max-width:720px;margin:40px auto;padding:0 28px;color:#141414;line-height:1.65}` +
        `.brand{color:#7c8cff;font-weight:700;letter-spacing:.02em;margin-bottom:6px}` +
        `h1{font-family:Georgia,'Times New Roman',serif;font-size:26px;margin:0 0 8px}` +
        `hr{border:none;border-top:1px solid #e2e2e2;margin:14px 0 20px}` +
        `pre{white-space:pre-wrap;font-family:inherit;font-size:15px}` +
        `footer{margin-top:32px;color:#9aa;font-size:12px;text-align:center}` +
        `</style></head><body>` +
        `<div class="brand">✦ VidhyaAI</div><h1>${esc(title)}</h1><hr>` +
        `<pre>${esc(text)}</pre>` +
        `<footer>Generated by VidhyaAI · Powered by Sarvam AI</footer>` +
        `<script>window.onload=function(){window.print();}</script>` +
        `</body></html>`
    );
    w.document.close();
  }
  return (
    <button
      onClick={printPdf}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white/[0.03] px-3 py-1.5 text-xs text-muted transition hover:border-primary/50 hover:text-foreground"
    >
      🖨️ PDF
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
