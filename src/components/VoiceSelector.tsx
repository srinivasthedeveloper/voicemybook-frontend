import { useEffect, useRef, useState } from "react";
import { getVoices, voicePreviewUrl, type Voice } from "../api/client";
import useJobStore from "../store/useJobStore";
import { exclusive, release } from "../utils/exclusiveAudio";

interface Props {
  value: string;
  onChange: (voice: string) => void;
  disabled?: boolean;
  previewSpeed?: number;
}

const FALLBACK_VOICES: Voice[] = [
  { id: "af_heart", label: "Heart", description: "US Female ❤️" },
  { id: "af_bella", label: "Bella", description: "US Female 🔥" },
  { id: "af_nicole", label: "Nicole", description: "US Female 🎧" },
  { id: "am_fenrir", label: "Fenrir", description: "US Male" },
  { id: "am_michael", label: "Michael", description: "US Male" },
  { id: "am_puck", label: "Puck", description: "US Male" },
  { id: "bf_emma", label: "Emma", description: "British Female" },
  { id: "bm_george", label: "George", description: "British Male" },
  { id: "bm_lewis", label: "Lewis", description: "British Male" },
  { id: "bf_isabella", label: "Isabella", description: "British Female" },
  { id: "af_sarah", label: "Sarah", description: "US Female" },
  { id: "af_sky", label: "Sky", description: "US Female" },
  { id: "am_adam", label: "Adam", description: "US Male" },
  { id: "bm_fable", label: "Fable", description: "British Male" },
] as (Voice & { description: string })[];

type VoiceWithDesc = Voice & { description?: string };

export default function VoiceSelector({ value, onChange, disabled, previewSpeed }: Props) {
  const [voices, setVoices] = useState<VoiceWithDesc[]>(FALLBACK_VOICES);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const storeSpeed = useJobStore((s) => s.selectedSpeed);
  const speed = previewSpeed ?? storeSpeed;

  useEffect(() => {
    getVoices()
      .then((v) => setVoices(v.length ? v : FALLBACK_VOICES))
      .catch(() => setVoices(FALLBACK_VOICES));
  }, []);

  const clearAudioRef = () => {
    const audio = audioRef.current;
    if (audio) {
      audioRef.current = null;
      audio.pause();
      audio.removeAttribute("src");
      release(audio);
    }
  };

  function stopCurrent() {
    clearAudioRef();
    setPlayingId(null);
    setLoadingId(null);
  }

  function handlePreview(e: React.MouseEvent, voiceId: string) {
    e.stopPropagation(); // don't also select the voice

    // Clicking the same voice again → stop
    if (playingId === voiceId || loadingId === voiceId) {
      stopCurrent();
      return;
    }

    stopCurrent();

    const audio = exclusive(new Audio(voicePreviewUrl(voiceId, speed)));
    audioRef.current = audio;
    setLoadingId(voiceId);
    // Events from an audio that's already been replaced must not touch the current one
    const isCurrent = () => audioRef.current === audio;

    audio.addEventListener("playing", () => {
      if (!isCurrent()) return;
      setLoadingId(null);
      setPlayingId(voiceId);
    });
    // Ended, failed, or paused by another sound starting
    for (const ev of ["ended", "error", "pause"]) {
      audio.addEventListener(ev, () => { if (isCurrent()) stopCurrent(); });
    }

    audio.play().catch(() => { if (isCurrent()) stopCurrent(); });
  }

  // Stop playback if selector is disabled (e.g. upload started)
  useEffect(() => {
    if (disabled) {
      setTimeout(() => {
        console.log("🚀 ~ useEffect ~ stopCurrent");
        stopCurrent();
      }, 0);
    }
  }, [disabled]);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-slate-700">Voice</span>
      <div role="radiogroup" aria-label="Voice" className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-2">
        {voices.map((v) => {
          const selected = v.id === value;
          const isPlaying = playingId === v.id;
          const isLoading = loadingId === v.id;
          return (
            <div
              key={v.id}
              role="radio"
              aria-checked={selected}
              tabIndex={disabled ? -1 : 0}
              onClick={() => !disabled && onChange(v.id)}
              onKeyDown={(e) => { if (!disabled && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onChange(v.id); } }}
              className={`flex min-h-11 items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition
                focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400
                ${selected ? "border-indigo-500 bg-indigo-50" : "border-slate-200 hover:border-indigo-300"}
                ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
            >
              <span className="min-w-0 flex-1 leading-tight">
                <span className={`block truncate text-sm font-semibold ${selected ? "text-indigo-700" : "text-slate-800"}`}>
                  {v.label}
                </span>
                <span className="block truncate text-xs text-slate-400">
                  {v.description ?? v.id}
                </span>
              </span>
              <button
                type="button"
                disabled={disabled}
                onClick={(e) => handlePreview(e, v.id)}
                aria-label={isPlaying || isLoading ? `Stop ${v.label} preview` : `Preview ${v.label}`}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition disabled:pointer-events-none
                  ${isPlaying || isLoading ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-indigo-100 hover:text-indigo-700"}`}
              >
                {isLoading ? (
                  <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : isPlaying ? (
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                ) : (
                  <svg className="h-3.5 w-3.5 translate-x-px" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
