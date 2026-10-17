import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import AudioPlayer from "../components/AudioPlayer";
import TranscriptViewer from "../components/TranscriptViewer";
import ErrorBanner from "../components/ErrorBanner";
import GeneratorControls from "../components/GeneratorControls";
import ChapterPanel from "../components/ChapterPanel";
import ThemeToggle from "../components/ThemeToggle";
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

type Tab = "chapters" | "read" | "voice";

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
  const [tab, setTab] = useState<Tab>("chapters");
  const [readView, setReadView] = useState<"text" | "parts">("text");
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [seekReq, setSeekReq] = useState<{ sec: number; play: boolean; n: number } | null>(null);
  const seekTo = (sec: number, play = true) => setSeekReq((r) => ({ sec, play, n: (r?.n ?? 0) + 1 }));
  const [selected, setSelected] = useState<Set<number>>(new Set());

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
      <div className="flex min-h-svh items-center justify-center bg-bg">
        <div className="flex flex-col items-center gap-3 text-slate-500" role="status">
          <svg className="h-8 w-8 animate-spin text-indigo-500" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p>Loading audiobook…</p>
        </div>
      </div>
    );
  }

  const handleClose = () => { void navigate("/"); };

  if (!job || !id || analyzedChapters.length === 0) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-bg px-4">
        <div className="w-full max-w-md">
          <ErrorBanner message={error || "This audiobook isn't available. Upload the PDF again to reopen it."} onDismiss={handleClose} />
          <button
            onClick={handleClose}
            className="mt-4 min-h-11 w-full rounded-xl bg-indigo-600 font-medium text-bg transition hover:opacity-90"
          >
            Back to home
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
  const hasTranscript = !playlistMode && transcript.some((t) => t.chapterIndex === activeChapterIndex);
  const hasParts = !!activeGen && activeGen.chunks.length > 0;
  const view = readView === "parts" && hasParts ? "parts" : hasTranscript ? "text" : hasParts ? "parts" : "text";
  const live = job.live !== false;

  const chapterPanel = (
    <ChapterPanel
      chapters={genList}
      titles={titles}
      skippable={analyzedChapters.map((c) => !!c.isSkippable)}
      activeIndex={activeChapterIndex}
      selected={selected}
      onSelectedChange={setSelected}
      onOpen={setActiveChapterIndex}
      onPlay={playChapter}
      onGenerate={(i) => run(startChapters(id, [i], selectedVoice, selectedSpeed))}
      onPause={(i) => run(pauseChapter(id, i))}
      onStop={(i) => run(stopChapter(id, i))}
      onStartMany={startMany}
      downloadUrl={(i) => chapterAudioUrl(id, i)}
    />
  );

  const tabs: { key: Tab; label: string }[] = [
    { key: "chapters", label: "Chapters" },
    { key: "read", label: "Read along" },
    { key: "voice", label: "Voice & speed" },
  ];

  return (
    <div className="min-h-svh bg-bg text-slate-700">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <button
            onClick={handleClose}
            aria-label="Back to home"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <img src={logo} alt="" className="hidden h-8 w-8 rounded-lg sm:block" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-read text-lg font-semibold leading-tight text-slate-900 sm:text-xl">
              {job.filename?.replace(/\.pdf$/i, "").replace(/_/g, " ") || "Audiobook"}
            </h1>
            <p className="flex items-center gap-2 text-xs text-slate-500">
              <span className="sm:hidden">{readyCount}/{genList.length} ready</span>
              <span className="hidden sm:inline">{readyCount} of {genList.length} chapters ready</span>
              <span className={`inline-flex items-center gap-1 ${live ? "text-ok" : "text-warn"}`} role="status">
                <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-ok" : "animate-pulse bg-warn"}`} />
                {live ? "Live" : "Reconnecting…"}
              </span>
            </p>
          </div>
          <a
            href={readyCount > 0 ? zipUrl(id) : undefined}
            download
            aria-disabled={readyCount === 0}
            className={`flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm transition
              ${readyCount > 0 ? "border-slate-200 text-slate-800 hover:bg-slate-100" : "pointer-events-none border-slate-200 text-slate-400 opacity-50"}`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v11m0 0-4-4m4 4 4-4M5 19h14" />
            </svg>
            <span className="hidden sm:inline">Download all</span>
            <span className="sm:hidden">.zip</span>
          </a>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-4 lg:grid lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-6 lg:py-6">
        <div className="flex min-w-0 flex-col gap-4">
          {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

          {/* Player */}
          {activeAudioUrl ? (
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
          ) : (
            <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-slate-300 p-5">
              <p className="font-read text-lg font-semibold text-slate-900">{titles[activeChapterIndex]}</p>
              <p className="text-sm text-slate-500">
                {activeGen?.state === "generating" || activeGen?.state === "queued"
                  ? "Generating the first part. Playback starts as soon as it's ready."
                  : "No audio yet for this chapter."}
              </p>
              {!(activeGen?.state === "generating" || activeGen?.state === "queued") && (
                <button
                  onClick={() => run(startChapters(id, [activeChapterIndex], selectedVoice, selectedSpeed))}
                  className="min-h-10 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-bg hover:opacity-90"
                >
                  Generate this chapter
                </button>
              )}
            </div>
          )}

          <GeneratorControls
            chapters={genList}
            queue={job.queue || []}
            jobId={id}
            titles={titles}
            charCounts={analyzedChapters.map((c) => c.charCount)}
            parallel={job.parallel ?? 1}
            msPerChar={job.msPerChar ?? 0}
            activeChapter={activeGen}
            onStart={() => run(startChapters(id, [activeChapterIndex], selectedVoice, selectedSpeed))}
            onPause={() => run(pauseJob(id))}
            onResume={() => run(resumeJob(id))}
            onStop={() => run(stopJob(id))}
            onStopAll={() => {
              if (window.confirm("Stop every running chapter and clear the queue for all books? Unfinished chapters lose their generated parts.")) run(stopAll());
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

          {/* Mobile / tablet tabs; on desktop every panel is visible */}
          <div role="tablist" aria-label="Sections" className="sticky top-[65px] z-20 -mx-4 flex gap-1 border-b border-slate-200 bg-bg/95 px-4 backdrop-blur lg:hidden">
            {tabs.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={`min-h-11 flex-1 border-b-2 text-sm font-medium transition
                  ${tab === t.key ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className={`${tab === "chapters" ? "" : "hidden"} -mx-2 lg:hidden`}>{chapterPanel}</div>

          {/* Read along: transcript text, or the generated parts */}
          <section aria-label="Read along" className={`${tab === "read" ? "" : "hidden"} rounded-2xl border border-slate-200 lg:block`}>
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-2">
              <h2 className="text-base font-semibold text-slate-900">Read along</h2>
              <div role="tablist" aria-label="Read along view" className="flex rounded-lg bg-slate-100 p-0.5 text-sm">
                {(["text", "parts"] as const).map((v) => (
                  <button
                    key={v}
                    role="tab"
                    aria-selected={view === v}
                    disabled={v === "parts" ? !hasParts : !hasTranscript && !(playlistMode && playlist.text)}
                    onClick={() => setReadView(v)}
                    className={`min-h-8 rounded-md px-3 transition disabled:opacity-40
                      ${view === v ? "bg-bg font-medium text-slate-900 shadow-sm" : "text-slate-500"}`}
                  >
                    {v === "text" ? "Text" : `Parts${hasParts ? ` (${activeGen.chunks.length}${activeGen.totalChunks ? `/${activeGen.totalChunks}` : ""})` : ""}`}
                  </button>
                ))}
              </div>
            </div>
            {view === "parts" && hasParts ? (
              <ul className="max-h-[60svh] divide-y divide-slate-200 overflow-y-auto lg:max-h-[28rem]">
                {activeGen.chunks.map((c) => {
                  const current = playlistMode && playlist.position === c.chunkIndex;
                  return (
                    <li key={c.chunkIndex}>
                      <button
                        onClick={() => playPart(c.chunkIndex)}
                        aria-current={current ? "true" : undefined}
                        className={`flex w-full items-start gap-3 px-4 py-2.5 text-left text-sm transition hover:bg-slate-100
                          ${current ? "bg-indigo-50 text-slate-900" : "text-slate-700"}`}
                      >
                        <span className={`w-7 shrink-0 text-xs ${current ? "text-indigo-700" : "text-slate-400"}`}>
                          {current ? "▶" : c.chunkIndex + 1}
                        </span>
                        <span className="line-clamp-2 flex-1 font-read">{c.text}</span>
                        <span className="shrink-0 text-xs text-slate-400">{Math.round(c.durationSec)}s</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : hasTranscript ? (
              <TranscriptViewer
                transcript={transcript}
                currentTime={currentTime}
                activeChapterIndex={activeChapterIndex}
                onSeek={(sec) => seekTo(sec)}
              />
            ) : playlistMode && playlist.text ? (
              <p className="mx-auto max-w-prose px-4 py-4 font-read text-[1.05rem] leading-8 text-slate-800 sm:px-6">{playlist.text}</p>
            ) : (
              <p className="px-4 py-6 text-sm text-slate-500">The text appears here once this chapter has audio.</p>
            )}
          </section>

          {/* Voice & speed, stacked */}
          <section aria-label="Voice and speed" className={`${tab === "voice" ? "" : "hidden"} flex flex-col gap-5 rounded-2xl border border-slate-200 p-4 lg:flex`}>
            <h2 className="text-base font-semibold text-slate-900">Voice &amp; speed</h2>
            <SpeedSlider value={shownSpeed} onChange={(speed) => editSettings({ speed })} />
            <VoiceSelector value={shownVoice} onChange={(voice) => editSettings({ voice })} previewSpeed={shownSpeed} />
            <p className="text-xs text-slate-500">
              Changes apply to newly generated audio. While a chapter is generating you&apos;ll be asked whether to start it over or continue.
            </p>
          </section>
        </div>

        {/* Desktop: chapters in their own scrolling column */}
        <aside className="hidden lg:block">
          <div className="sticky top-[4.75rem] max-h-[calc(100svh-6rem)] overflow-y-auto rounded-2xl border border-slate-200">
            {chapterPanel}
          </div>
        </aside>
      </main>
    </div>
  );
}
