import { useEffect, useRef, useState } from "react";
import { getVoices, voicePreviewUrl, type Voice } from "../api/client";

interface Props {
  value: string;
  onChange: (voice: string) => void;
  disabled?: boolean;
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
] as (Voice & { description: string })[];

type VoiceWithDesc = Voice & { description?: string };

export default function VoiceSelector({ value, onChange, disabled }: Props) {
  const [voices, setVoices] = useState<VoiceWithDesc[]>(FALLBACK_VOICES);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    getVoices()
      .then((v) => setVoices(v.length ? v : FALLBACK_VOICES))
      .catch(() => setVoices(FALLBACK_VOICES));
  }, []);

  const clearAudioRef = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
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
      console.log("🚀 ~ handlePreview ~ stopCurrent inside condition");
      stopCurrent();
      return;
    }

    stopCurrent();

    const audio = new Audio(voicePreviewUrl(voiceId));
    audioRef.current = audio;
    setLoadingId(voiceId);

    audio.addEventListener(
      "canplaythrough",
      () => {
        setLoadingId(null);
        setPlayingId(voiceId);
      },
      { once: true },
    );

    audio.addEventListener(
      "ended",
      () => {
        setPlayingId(null);
        audioRef.current = null;
      },
      { once: true },
    );

    audio.addEventListener(
      "error",
      () => {
        setLoadingId(null);
        setPlayingId(null);
        audioRef.current = null;
      },
      { once: true },
    );

    audio.play().catch(() => {
      setLoadingId(null);
      setPlayingId(null);
    });
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
      <label className="text-sm font-medium text-slate-700">Voice</label>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {voices.map((v) => {
          const selected = v.id === value;
          const isPlaying = playingId === v.id;
          const isLoading = loadingId === v.id;
          const active = isPlaying || isLoading;

          return (
            <div
              key={v.id}
              onClick={() => !disabled && onChange(v.id)}
              className={`group relative flex flex-col items-start gap-1 rounded-xl border px-3 py-2.5 text-left
                          transition-all focus:outline-none focus:ring-2 focus:ring-indigo-300
                          disabled:cursor-not-allowed disabled:opacity-50
                          ${
                            selected
                              ? "border-indigo-500 bg-indigo-50 shadow-sm"
                              : `border-slate-200 bg-white ${!disabled ? "hover:border-indigo-300 hover:bg-indigo-50/40" : ""}`
                          }
                          
                          ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
            >
              {/* Selected checkmark */}
              {selected && (
                <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500">
                  <svg
                    className="h-2.5 w-2.5 text-white"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </span>
              )}

              {/* Name + description */}
              <span
                className={`text-sm font-semibold ${selected ? "text-indigo-700" : "text-slate-800"}`}
              >
                {v.label}
              </span>
              <span className="text-xs text-slate-400">
                {v.description ?? v.id.split("-").slice(2).join(" ")}
              </span>

              {/* Preview button */}
              <button
                type="button"
                disabled={disabled}
                onClick={(e) => handlePreview(e, v.id)}
                title={active ? "Stop preview" : "Preview voice"}
                className={`mt-1 flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium transition
                            disabled:pointer-events-none
                            ${
                              active
                                ? "bg-indigo-100 text-indigo-700"
                                : "bg-slate-100 text-slate-500 hover:bg-indigo-100 hover:text-indigo-600"
                            }`}
              >
                {isLoading ? (
                  <>
                    <svg
                      className="h-3 w-3 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Loading…
                  </>
                ) : isPlaying ? (
                  <>
                    {/* Stop icon */}
                    <svg
                      className="h-3 w-3"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <rect x="6" y="6" width="12" height="12" rx="2" />
                    </svg>
                    Stop
                  </>
                ) : (
                  <>
                    {/* Play icon */}
                    <svg
                      className="h-3 w-3 translate-x-px"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    Preview
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
