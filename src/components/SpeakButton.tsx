"use client";

import { useEffect, useState } from "react";

/**
 * Reads text aloud using the browser's free Web Speech API (no API cost).
 * Toggles between play and stop.
 */
export function SpeakButton({ text, label = "Listen" }: { text: string; label?: string }) {
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  if (!supported) return null;

  function toggle() {
    const synth = window.speechSynthesis;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    synth.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1;
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    setSpeaking(true);
    synth.speak(utter);
  }

  return (
    <button
      onClick={toggle}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white/[0.03] px-3 py-1.5 text-xs text-muted transition hover:border-primary/50 hover:text-foreground"
    >
      {speaking ? (
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
