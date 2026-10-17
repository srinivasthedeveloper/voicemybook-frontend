import { useEffect, useRef, useState } from "react";
import { previewVoice } from "../api/client";
import useJobStore from "../store/useJobStore";
import ErrorBanner from "./ErrorBanner";

export default function VoiceTestBox() {
  const voice = useJobStore((s) => s.selectedVoice);
  const speed = useJobStore((s) => s.selectedSpeed);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "playing">("idle");
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function stop() {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      URL.revokeObjectURL(audio.src);
      audioRef.current = null;
    }
    setStatus("idle");
  }

  useEffect(() => stop, []);

  async function play() {
    stop();
    setError(null);
    setStatus("loading");
    try {
      const blob = await previewVoice(voice, speed, text);
      const audio = new Audio(URL.createObjectURL(blob));
      audioRef.current = audio;
      audio.onended = stop;
      await audio.play();
      setStatus("playing");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Preview failed");
      stop();
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <label className="text-sm font-medium text-slate-700">Test voice</label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="Paste text to test (empty = default sample)"
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800
                   focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
      />
      <div className="flex items-center gap-3">
        <button
          onClick={() => { if (status === "idle") void play(); else stop(); }}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
        >
          {status === "loading" ? "Generating…" : status === "playing" ? "Stop" : "Play"}
        </button>
        <span className="text-xs text-slate-400">{voice} · {speed.toFixed(2)}x</span>
      </div>
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
    </div>
  );
}
