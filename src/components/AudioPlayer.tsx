import { useEffect, useRef } from "react";
import { useAudioPlayer } from "../hooks/useAudioPlayer";

interface Props {
  audioUrl: string;
  filename?: string;
  speed: number;
  onSpeedChange: (s: number) => void;
  onEnded?: () => void;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

function formatTime(secs: number) {
  if (!isFinite(secs)) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function AudioPlayer({
  audioUrl,
  filename,
  speed,
  onSpeedChange,
  onEnded,
}: Props) {
  const {
    audioRef,
    isPlaying,
    currentTime,
    duration,
    isLoading,
    togglePlay,
    seek,
    setPlaybackRate,
    handleTimeUpdate,
    handleLoadedMetadata,
    handleWaiting,
    handleCanPlay,
    setIsPlaying,
  } = useAudioPlayer();

  const prevUrlRef = useRef<string>("");

  useEffect(() => {
    setPlaybackRate(speed);
  }, [speed, setPlaybackRate]);

  // Reload audio element when URL changes (chapter switch)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || audioUrl === prevUrlRef.current) return;
    prevUrlRef.current = audioUrl;
    const wasPlaying = !audio.paused;
    audio.src = audioUrl;
    audio.load();
    if (wasPlaying) audio.play().catch(() => {});
  }, [audioUrl, audioRef]);

  return (
    <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-md">
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onWaiting={handleWaiting}
        onCanPlay={handleCanPlay}
        onEnded={() => { setIsPlaying(false); onEnded?.(); }}
        crossOrigin="anonymous"
      />

      {/* Track info */}
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-100">
          <svg
            className="h-6 w-6 text-indigo-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
            />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-800">
            {filename?.replace(/\.pdf$/i, "") || "Audiobook"}
          </p>
          <p className="text-xs text-slate-400">
            {formatTime(currentTime)} / {formatTime(duration)}
          </p>
        </div>
      </div>

      {/* Seek bar */}
      <div className="mb-5">
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={currentTime}
          step={1}
          onChange={(e) => seek(Number(e.target.value))}
          className="w-full h-2 cursor-pointer appearance-none rounded-full bg-slate-200
                     [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4
                     [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full
                     [&::-webkit-slider-thumb]:bg-indigo-600 [&::-webkit-slider-thumb]:shadow-sm
                     accent-indigo-600"
          style={{
            background: `linear-gradient(to right, var(--accent) ${(currentTime / (duration || 1)) * 100}%, var(--border) ${(currentTime / (duration || 1)) * 100}%)`,
          }}
        />
        <div className="mt-1 flex justify-between text-xs text-slate-400">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-4">
        {/* Play/Pause */}
        <button
          onClick={togglePlay}
          disabled={isLoading}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600
                     text-white shadow-md transition hover:bg-indigo-700 active:scale-95
                     disabled:opacity-50"
        >
          {isLoading ? (
            <svg
              className="h-5 w-5 animate-spin"
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
          ) : isPlaying ? (
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          ) : (
            <svg
              className="h-5 w-5 translate-x-0.5"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Speed selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Speed</span>
          <div className="flex gap-1">
            {SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => onSpeedChange(s)}
                className={`rounded-md px-2 py-1 text-xs font-medium transition
                  ${
                    speed === s
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Download */}
        <a
          href={audioUrl}
          download
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2
                     text-sm text-slate-600 transition hover:bg-slate-50 hover:text-indigo-600"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          MP3
        </a>
      </div>
    </div>
  );
}
