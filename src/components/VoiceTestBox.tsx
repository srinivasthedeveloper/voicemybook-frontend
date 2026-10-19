import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { getPreviewProgress, previewStreamUrl, previewVoice, type PreviewProgress } from "../api/client";
import { formatEta } from "../utils/formatEta";
import useJobStore from "../store/useJobStore";
import ErrorBanner from "./ErrorBanner";
import { exclusive, release } from "../utils/exclusiveAudio";

export default function VoiceTestBox() {
  const voice = useJobStore((s) => s.selectedVoice);
  const speed = useJobStore((s) => s.selectedSpeed);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<PreviewProgress | null>(null);
  const [stream, setStream] = useState(true);
  // While streaming, the player plays the live stream; when it ends it swaps to the finished file for replay/download
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const streamedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Free the previous clip whenever a new one replaces it (or on unmount)
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  async function generate() {
    const ac = new AbortController();
    abortRef.current = ac;
    setError(null);
    setProgress(null);
    setLoading(true);
    const id = Math.random().toString(36).slice(2); // randomUUID needs https, breaks phone-over-LAN
    setUrl(null);
    streamedRef.current = stream;
    setStreamUrl(stream ? previewStreamUrl(id) : null);
    const poll = setInterval(() => {
      getPreviewProgress(id).then((p) => { if (abortRef.current === ac) setProgress(p); }, () => {});
    }, 1000);
    try {
      const blob = await previewVoice(voice, speed, text, ac.signal, id);
      setUrl(URL.createObjectURL(blob));
    } catch (e: unknown) {
      if (!axios.isCancel(e)) setError(e instanceof Error ? e.message : "Preview failed");
    } finally {
      clearInterval(poll);
      if (abortRef.current === ac) setLoading(false);
    }
  }

  function stop() {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    setStreamUrl(null);
  }

  // Stream gone (finished, or the preview was already done before it connected): fall back to the file
  function endStream() {
    setStreamUrl(null);
  }

  const src = streamUrl ?? url;
  const register = useCallback((el: HTMLAudioElement | null) => {
    if (!el) return;
    exclusive(el);
    return () => release(el);
  }, []);

  return (
    <div className="flex flex-col gap-2 border-t border-slate-200 pt-4">
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
          onClick={() => (loading ? stop() : void generate())}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
        >
          {loading ? "Stop" : "Generate"}
        </button>
        <label className="flex items-center gap-1.5 text-sm text-slate-600">
          <input type="checkbox" checked={stream} disabled={loading} onChange={(e) => setStream(e.target.checked)} />
          Stream
        </label>
        <span className="text-xs text-slate-400">
          {loading && (
            <span className="mr-2 text-warn">
              Generating…
              {progress && ` part ${Math.min(progress.done + 1, progress.total)}/${progress.total} · `}
              {progress && (progress.etaSec != null ? `${formatEta(progress.etaSec)} left` : "estimating…")}
            </span>
          )}
          {voice} · {speed.toFixed(2)}x
        </span>
      </div>
      {loading && progress && (
        <div className="h-1 w-full overflow-hidden rounded bg-slate-200">
          <div className="h-full bg-indigo-500 transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
        </div>
      )}
      {src && (
        <div className="flex items-center gap-3">
          <audio
            key={src}
            ref={register}
            src={src}
            controls
            autoPlay={src === streamUrl || !streamedRef.current}
            onEnded={streamUrl ? endStream : undefined}
            onError={streamUrl ? () => { streamedRef.current = false; endStream(); } : undefined}
            className="h-10 min-w-0 flex-1"
          />
          {url && (
            <a href={url} download="voice-test.mp3" className="text-sm font-medium text-indigo-600 hover:underline">
              Download
            </a>
          )}
        </div>
      )}
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
    </div>
  );
}
