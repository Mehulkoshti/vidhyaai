"use client";

import { useRef, useState } from "react";

/**
 * Push-to-record voice input. Records mic audio, sends it to /api/stt (Sarvam
 * Saaras speech-to-text) and hands the transcript back to the composer.
 */
export function MicButton({
  lang,
  onTranscript,
  disabled,
}: {
  lang: string;
  onTranscript: (text: string) => void;
  disabled?: boolean;
}) {
  const [state, setState] = useState<"idle" | "recording" | "busy">("idle");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        if (!blob.size) {
          setState("idle");
          return;
        }
        setState("busy");
        try {
          const fd = new FormData();
          fd.append("file", blob, "audio.webm");
          fd.append("lang", lang);
          const res = await fetch("/api/stt", { method: "POST", body: fd });
          const json = await res.json();
          if (res.ok && json.transcript) onTranscript(json.transcript.trim());
        } catch {
          /* ignore — user can type instead */
        } finally {
          setState("idle");
        }
      };
      recorderRef.current = rec;
      rec.start();
      setState("recording");
    } catch {
      // Permission denied / no mic — silently stay idle.
      setState("idle");
    }
  }

  function stop() {
    recorderRef.current?.stop();
  }

  function toggle() {
    if (state === "recording") stop();
    else if (state === "idle") start();
  }

  const title =
    state === "recording" ? "Stop & transcribe" : state === "busy" ? "Transcribing…" : "Speak your doubt";

  return (
    <button
      onClick={toggle}
      disabled={disabled || state === "busy"}
      title={title}
      className={`shrink-0 rounded-lg px-2.5 py-2 text-lg transition disabled:opacity-40 ${
        state === "recording"
          ? "text-rose-400 animate-pulse"
          : "text-muted hover:text-foreground"
      }`}
    >
      {state === "busy" ? (
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-muted/40 border-t-accent align-middle" />
      ) : state === "recording" ? (
        "⏺"
      ) : (
        "🎤"
      )}
    </button>
  );
}
