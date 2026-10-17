import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import AudioPlayer from "../components/AudioPlayer";
import TranscriptViewer from "../components/TranscriptViewer";
import ErrorBanner from "../components/ErrorBanner";
import GeneratorControls from "../components/GeneratorControls";
import { formatEta } from "../utils/formatEta";
import SettingsApplyBar from "../components/SettingsApplyBar";
import SpeedSlider from "../components/SpeedSlider";
import VoiceSelector from "../components/VoiceSelector";
import {
  getJob,
  getGeneratorState,
  chapterAudioUrl,
  startChapters,
  pauseJob,
  resumeJob,
  stopJob,
  stopAll,
  pauseChapter,
  stopChapter,
  applySettings,
  zipUrl,
  type ApplyMode,
  type ChapterGen,
} from "../api/client";
import useJobStore, { type AnalyzedChapter } from "../store/useJobStore";
import { useChunkPlaylist } from "../hooks/useChunkPlaylist";
import { useSSE } from "../hooks/useSSE";
import logo from "/public/logo.png";

const BADGES: Record<ChapterGen["state"], [string, string]> = {
  not_started: ["○ Not started", "bg-slate-100 text-slate-500"],
  queued: ["… Queued", "bg-sky-100 text-sky-700"],
  generating: ["⟳ Generating", "bg-amber-100 text-amber-700"],
  paused: ["❚❚ Paused", "bg-orange-100 text-orange-700"],
  ready: ["▶ Ready", "bg-green-100 text-green-700"],
  stopped: ["■ Stopped", "bg-red-50 text-red-600"],
};

const miniBtn = "rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-200 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-30";

export default function PlayerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    jobs, setJob, setGenState,
    selectedVoice, selectedSpeed, setVoice, setSpeed,
    playbackRate, setPlaybackRate, selectedChapterIndices,
  } = useJobStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTranscript, setShowTranscript] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [seekReq, setSeekReq] = useState<{ sec: number; play: boolean; n: number } | null>(null);
  const seekTo = (sec: number, play = true) => setSeekReq((r) => ({ sec, play, n: (r?.n ?? 0) + 1 }));
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showParts, setShowParts] = useState(false);

  // Edited voice/speed held locally until applied (null = no pending edit)
  const [draft, setDraft] = useState<{ voice: string; speed: number; chapterIndex?: number } | null>(null);
  const [applying, setApplying] = useState(false);
  const [playToken, setPlayToken] = useState(0);

  const job = id ? jobs[id] : null;
  useSSE(id ?? null);

  const initialChIdx = parseInt(searchParams.get("ch") || "", 10);
  const [activeChapterIndex, setActiveChapterIndex] = useState<number>(() =>
    !isNaN(initialChIdx) ? initialChIdx : (selectedChapterIndices[0] ?? 0),
  );

  // Load job + generator state (direct navigation or fresh start)
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(!jobs[id]?.analyzedChapters);
    Promise.all([getJob(id), getGeneratorState(id)])
      .then(([data, gen]) => {
        if (cancelled) return;
        if (!data?.chapters) {
          navigate("/");
          return;
        }
        const chapterAudios: Record<number, string> = {};
        Object.entries(data.chapter_audios || {}).forEach(([k, v]) => {
          chapterAudios[Number(k)] = v as string;
        });
        setJob(id, {
          jobId: id,
          stage: data.stage || data.status,
          status: data.status,
          progress: data.progress || 0,
          message: "",
          audioUrl: data.audio_url || null,
          chapters: data.chapters,
          analyzedChapters: data.chapters,
          chapterAudios,
          transcript: data.transcript || null,
          filename: data.pdf_filename,
          chunksTotal: data.chunks_total,
          chunksDone: data.chunks_done,
          error: null,
        });
        setGenState(id, gen);
        if (gen.voice) setVoice(gen.voice);
        if (gen.speed) setSpeed(gen.speed);
      })
      .catch(() => { if (!cancelled) setError("Could not load audiobook. Please try again."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // The API's chapters_json carries the analyzed fields (charCount, isSkippable)
  const analyzedChapters = (job?.analyzedChapters || job?.chapters || []) as AnalyzedChapter[];
  const titles = analyzedChapters.map((c) => c.title);
  const gen = job?.gen || {};
  const genList = analyzedChapters.map((_, i) => gen[i] || { chapterIndex: i, state: "not_started" as const, runId: 0, hasAudio: false, chunks: [] });
  const activeGen = genList[activeChapterIndex];
  const chapterAudios = job?.chapterAudios || {};

  // Chunk playlist while a run is live (or partial); stitched MP3 once a chapter is ready
  // manual = user picked a part to play, so don't auto-switch to the merged file
  const [mode, setMode] = useState<{ key: string; playlist: boolean; manual?: boolean } | null>(null);
  const modeKey = `${activeChapterIndex}:${activeGen?.runId ?? 0}`;
  const wantsPlaylist = !!activeGen && activeGen.chunks.length > 0 && !(activeGen.state === "ready" && activeGen.hasAudio);
  if (activeGen && (mode?.key !== modeKey || (!mode.playlist && wantsPlaylist))) {
    setMode({ key: modeKey, playlist: wantsPlaylist || (!activeGen.hasAudio && !chapterAudios[activeChapterIndex]) });
  }
  const playlistMode = mode?.playlist ?? false;

  // Continue into the next chapter that has audio or is being generated (waits for its first part)
  const handleChapterEnded = useCallback(() => {
    const next = genList.find((c) => c.chapterIndex > activeChapterIndex &&
      (c.hasAudio || c.chunks.length > 0 || c.state === "generating" || c.state === "queued"));
    if (next) {
      setActiveChapterIndex(next.chapterIndex);
      setPlayToken((t) => t + 1);
    }
  }, [genList, activeChapterIndex]);

  const playlist = useChunkPlaylist(
    activeGen?.chunks || [],
    modeKey,
    activeGen?.state === "ready",
    handleChapterEnded,
  );

  // Once the chapter is merged, move from parts to the merged file at the same point in the chapter
  const mergedReady = !!activeGen && activeGen.state === "ready" && activeGen.hasAudio;
  const offsetOf = (k: number) =>
    (activeGen?.chunks || []).filter((c) => c.chunkIndex < k).reduce((n, c) => n + c.durationSec, 0);
  const autoSwitch = playlistMode && mergedReady && !mode?.manual;
  if (autoSwitch && !isPlaying && (activeGen?.chunks.length ?? 0) > 0) {
    setMode({ key: modeKey, playlist: false });
    seekTo(offsetOf(playlist.position) + currentTime, false);
  }
  const onPlaylistEnded = () => {
    const hasNext = activeGen?.chunks.some((c) => c.chunkIndex === playlist.position + 1);
    if (autoSwitch && hasNext) {
      setMode({ key: modeKey, playlist: false });
      seekTo(offsetOf(playlist.position + 1), true);
    } else {
      playlist.onEnded();
    }
  };

  // Merged chapters play the merged file from the start; others play their parts
  function playChapter(c: ChapterGen) {
    setActiveChapterIndex(c.chapterIndex);
    if (c.hasAudio && c.state !== "generating") {
      setMode({ key: `${c.chapterIndex}:${c.runId}`, playlist: false });
      seekTo(0, true);
    } else {
      setPlayToken((t) => t + 1);
    }
  }

  function playPart(chunkIndex: number) {
    setMode({ key: modeKey, playlist: true, manual: true });
    playlist.jumpTo(chunkIndex);
    setPlayToken((t) => t + 1);
  }

  const queueable = (c: ChapterGen) => c.state !== "queued" && c.state !== "generating";
  function startMany(indices: number[]) {
    if (!id || indices.length === 0) return;
    run(startChapters(id, [...indices].sort((a, b) => a - b), selectedVoice, selectedSpeed));
  }

  const run = (p: Promise<unknown>) => {
    p.catch((e: unknown) => setError(e instanceof Error ? e.message : "Request failed"));
  };

  // Editing voice/speed pauses a running generator and asks how to apply
  function editSettings(patch: { voice?: string; speed?: number }) {
    if (!id) return;
    const running = genList.find((c) => c.state === "generating");
    const active = running || genList.some((c) => c.state === "queued" || c.state === "paused");
    if (!draft && !active) {
      if (patch.voice) setVoice(patch.voice);
      if (patch.speed != null) setSpeed(patch.speed);
      return;
    }
    if (!draft) run(pauseJob(id));
    setDraft((d) => ({
      voice: patch.voice ?? d?.voice ?? selectedVoice,
      speed: patch.speed ?? d?.speed ?? selectedSpeed,
      chapterIndex: d ? d.chapterIndex : (running?.chapterIndex ?? activeChapterIndex),
    }));
  }

  async function apply(applyMode: ApplyMode) {
    if (!id || !draft) return;
    setApplying(true);
    try {
      await applySettings(id, { voice: draft.voice, speed: draft.speed, mode: applyMode, chapterIndex: draft.chapterIndex });
      setVoice(draft.voice);
      setSpeed(draft.speed);
      setDraft(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to apply settings");
    } finally {
      setApplying(false);
    }
  }

  function cancelEdit() {
    if (!id) return;
    setDraft(null);
    run(resumeJob(id));
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 to-white">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <svg className="h-8 w-8 animate-spin text-indigo-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p>Loading audiobook...</p>
        </div>
      </div>
    );
  }

  const handleClose = () => { void navigate("/"); };

  if (!job || !id || analyzedChapters.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 to-white px-4">
        <div className="max-w-md w-full">
          <ErrorBanner message={error || "Audiobook not found."} onDismiss={handleClose} />
          <button
            onClick={handleClose}
            className="mt-4 w-full rounded-xl bg-indigo-600 py-3 text-white font-medium hover:bg-indigo-700 transition"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const activeAudioUrl = playlistMode
    ? playlist.src
    : chapterAudios[activeChapterIndex] || activeGen?.hasAudio
      ? chapterAudioUrl(id, activeChapterIndex)
      : null;
  const readyCount = genList.filter((c) => c.hasAudio).length;
  const transcript = job.transcript || [];
  const shownVoice = draft?.voice ?? selectedVoice;
  const shownSpeed = draft?.speed ?? selectedSpeed;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="mx-auto max-w-2xl px-4 py-10">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <button
            onClick={handleClose}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600 transition"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            New conversion
          </button>
          <img src={logo} alt="VoiceMyBook" className="h-8 w-8 rounded-lg" />
        </div>

        {error && (
          <div className="mb-5">
            <ErrorBanner message={error} onDismiss={() => setError(null)} />
          </div>
        )}

        {/* Book title + download all */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {job.filename?.replace(/\.pdf$/i, "") || "Audiobook"}
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              {readyCount} / {genList.length} chapters ready
            </p>
          </div>
          <a
            href={readyCount > 0 ? zipUrl(id) : undefined}
            download
            aria-disabled={readyCount === 0}
            className={`shrink-0 rounded-lg border px-3 py-2 text-sm transition
              ${readyCount > 0 ? "border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-indigo-600" : "pointer-events-none border-slate-100 text-slate-300"}`}
          >
            Download all (.zip)
          </a>
        </div>

        {/* Player */}
        {activeAudioUrl ? (
          <div className="mb-5">
            <AudioPlayer
              audioUrl={activeAudioUrl}
              filename={titles[activeChapterIndex] || job.filename}
              speed={playbackRate}
              onSpeedChange={setPlaybackRate}
              onEnded={playlistMode ? onPlaylistEnded : handleChapterEnded}
              autoPlayOnSrcChange
              playToken={playToken}
              seekRequest={seekReq}
              onTime={setCurrentTime}
              onPlayingChange={setIsPlaying}
              waiting={playlistMode && playlist.waiting}
            />
          </div>
        ) : (
          <div className="mb-5 rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            {activeGen?.state === "generating" || activeGen?.state === "queued"
              ? "Generating the first part…"
              : `No audio yet for "${titles[activeChapterIndex]}". Press Start to generate it.`}
          </div>
        )}

        {/* Generator + settings */}
        <div className="mb-5 flex flex-col gap-3">
          <GeneratorControls
            chapters={genList}
            queue={job.queue || []}
            jobId={id}
            titles={titles}
            charCounts={analyzedChapters.map((c) => c.charCount)}
            parallel={job.parallel ?? 1}
            msPerChar={job.msPerChar ?? 0}
            onStart={() => run(startChapters(id, [activeChapterIndex], selectedVoice, selectedSpeed))}
            onPause={() => run(pauseJob(id))}
            onResume={() => run(resumeJob(id))}
            onStop={() => run(stopJob(id))}
            onStopAll={() => {
              if (window.confirm("Stop the current chapter and clear the whole queue (all books)? Unfinished chapters lose their generated parts.")) run(stopAll());
            }}
          />
          {draft && (
            <SettingsApplyBar
              busy={applying}
              onStartOver={() => { void apply("restart-chapter"); }}
              onResume={() => { void apply("resume"); }}
              onCancel={cancelEdit}
            />
          )}
          <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row">
            <div className="flex-1">
              <VoiceSelector value={shownVoice} onChange={(voice) => editSettings({ voice })} previewSpeed={shownSpeed} />
            </div>
            <div className="md:w-56">
              <SpeedSlider value={shownSpeed} onChange={(speed) => editSettings({ speed })} />
            </div>
          </div>
        </div>

        {/* Generated parts of the active chapter: browse and play any one */}
        {activeGen && activeGen.chunks.length > 0 && (
          <div className="mb-5 rounded-xl border border-slate-200 bg-white shadow-sm">
            <button
              onClick={() => setShowParts((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-600 hover:text-indigo-600"
            >
              <span>
                Generated parts ({activeGen.chunks.length}{activeGen.totalChunks ? `/${activeGen.totalChunks}` : ""})
              </span>
              <span>{showParts ? "Hide" : "Show"}</span>
            </button>
            {showParts && (
              <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto border-t border-slate-100">
                {activeGen.chunks.map((c) => {
                  const current = playlistMode && playlist.position === c.chunkIndex;
                  return (
                    <li key={c.chunkIndex}>
                      <button
                        onClick={() => playPart(c.chunkIndex)}
                        className={`flex w-full items-start gap-3 px-4 py-2 text-left text-sm transition hover:bg-indigo-50
                          ${current ? "bg-indigo-50 text-indigo-800" : "text-slate-700"}`}
                      >
                        <span className="w-8 shrink-0 text-xs text-slate-400">{current ? "▶" : c.chunkIndex + 1}</span>
                        <span className="line-clamp-2 flex-1">{c.text}</span>
                        <span className="shrink-0 text-xs text-slate-400">
                          {Math.round(c.durationSec)}s · {c.speed}x
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {/* Transcript (stitched chapter playback only) */}
        {!playlistMode && transcript.length > 0 && (
          <div className="mb-5">
            <button
              onClick={() => setShowTranscript((v) => !v)}
              className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 transition"
            >
              <svg
                className={`h-4 w-4 transition-transform ${showTranscript ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              {showTranscript ? "Hide" : "Show"} Transcript
            </button>
            {showTranscript && (
              <TranscriptViewer
                transcript={transcript}
                currentTime={currentTime}
                activeChapterIndex={activeChapterIndex}
                onSeek={(sec) => seekTo(sec)}
              />
            )}
          </div>
        )}
        {playlistMode && playlist.text && (
          <p className="mb-5 rounded-xl bg-white p-4 text-sm leading-relaxed text-slate-600 shadow-sm">
            {playlist.text}
          </p>
        )}

        {/* Chapter list with state + per-chapter controls */}
        <div className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Chapters</h3>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <button
                className="text-slate-500 underline hover:text-slate-800"
                onClick={() => setSelected(selected.size ? new Set() : new Set(genList.map((c) => c.chapterIndex)))}
              >
                {selected.size ? "Clear selection" : "Select all"}
              </button>
              <button
                disabled={selected.size === 0}
                onClick={() => { startMany([...selected].filter((i) => queueable(genList[i]))); setSelected(new Set()); }}
                className="rounded-lg bg-indigo-600 px-2.5 py-1 font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
              >
                Start selected ({selected.size})
              </button>
              <button
                onClick={() => startMany(genList
                  .filter((c) => ["not_started", "paused", "stopped"].includes(c.state) && !analyzedChapters[c.chapterIndex]?.isSkippable)
                  .map((c) => c.chapterIndex))}
                className="rounded-lg border border-indigo-300 px-2.5 py-1 font-medium text-indigo-700 hover:bg-indigo-50"
                title="Queue every chapter that isn't ready, queued or generating"
              >
                Start all
              </button>
            </div>
          </div>
          <ul className="divide-y divide-slate-100">
            {genList.map((c) => {
              const i = c.chapterIndex;
              const isActive = i === activeChapterIndex;
              const [baseLabel, badgeClass] = BADGES[c.state];
              const showCount = (c.state === "generating" || c.state === "paused") && c.totalChunks;
              const eta = c.state === "generating" && c.etaSec != null ? ` · ${formatEta(c.etaSec)}` : "";
              const label = showCount ? `${baseLabel} ${c.chunks.length}/${c.totalChunks}${eta}` : baseLabel;
              const playable = c.chunks.length > 0 || c.hasAudio;
              const busy = c.state === "generating" || c.state === "queued";
              return (
                <li key={i} className="flex items-center justify-between gap-2 py-1">
                  <input
                    type="checkbox"
                    aria-label={`Select ${titles[i]}`}
                    checked={selected.has(i)}
                    onChange={() => setSelected((s) => {
                      const n = new Set(s);
                      if (n.has(i)) n.delete(i);
                      else n.add(i);
                      return n;
                    })}
                    className="h-4 w-4 shrink-0 accent-indigo-600"
                  />
                  <button
                    onClick={() => setActiveChapterIndex(i)}
                    className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-indigo-50
                      ${isActive ? "bg-indigo-50 font-medium text-indigo-700" : "text-slate-700"}`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs
                        ${isActive ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"}`}
                    >
                      {i + 1}
                    </span>
                    <span className="truncate">{titles[i]}</span>
                  </button>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${badgeClass}`} title={c.error}>
                    {label}
                  </span>
                  <span className="flex shrink-0 items-center gap-0.5">
                    <button
                      className={`${miniBtn} text-indigo-600`}
                      disabled={!playable}
                      onClick={() => playChapter(c)}
                      title="Play this chapter"
                    >▶ Play</button>
                    <span className="mx-0.5 h-4 w-px bg-slate-200" />
                    {busy ? (
                      <button className={miniBtn} onClick={() => run(pauseChapter(id, i))} title="Pause generating">❚❚ Pause</button>
                    ) : (
                      <button className={miniBtn} onClick={() => run(startChapters(id, [i], selectedVoice, selectedSpeed))}
                        title="Generate audio for this chapter">
                        ⚙ {c.state === "paused" ? "Resume" : c.hasAudio ? "Regenerate" : "Generate"}
                      </button>
                    )}
                    <button
                      className={miniBtn}
                      disabled={!["generating", "queued", "paused"].includes(c.state)}
                      onClick={() => run(stopChapter(id, i))}
                      title="Stop generating"
                    >■</button>
                    <a
                      href={c.hasAudio ? chapterAudioUrl(id, i) : undefined}
                      download={`${String(i + 1).padStart(2, "0")} - ${titles[i]}.mp3`}
                      aria-disabled={!c.hasAudio}
                      title={c.hasAudio ? "Download this chapter (MP3)" : "Not merged yet"}
                      className={`${miniBtn} ${c.hasAudio ? "" : "pointer-events-none opacity-30"}`}
                    >⬇</a>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
