import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import AudioPlayer from "../components/AudioPlayer";
import TranscriptViewer from "../components/TranscriptViewer";
import ErrorBanner from "../components/ErrorBanner";
import { getJob, chapterAudioUrl } from "../api/client";
import useJobStore from "../store/useJobStore";
import { useAudioPlayer } from "../hooks/useAudioPlayer";
import { useSSE } from "../hooks/useSSE";
import logo from "/public/logo.png";

export default function PlayerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { jobs, setJob, selectedSpeed, setSpeed } = useJobStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTranscript, setShowTranscript] = useState(true);
  const { seekToChapter, currentTime } = useAudioPlayer();

  const job = id ? jobs[id] : null;

  // Keep SSE open while chapters are still processing
  const isStillProcessing = !!(
    job && !["complete", "error", "analyzed"].includes(job.stage)
  );
  useSSE(isStillProcessing ? (id ?? null) : null);
  const stillProcessing = isStillProcessing; // alias for JSX

  // Active chapter index: from ?ch= param, then first ready chapter
  const initialChIdx = parseInt(searchParams.get("ch") || "", 10);
  const [activeChapterIndex, setActiveChapterIndex] = useState<number>(() => {
    if (!isNaN(initialChIdx)) return initialChIdx;
    return 0;
  });

  // Initialize from URL param when audios become available
  useEffect(() => {
    if (!job?.chapterAudios) return;
    const keys = Object.keys(job.chapterAudios)
      .map(Number)
      .sort((a, b) => a - b);
    if (keys.length === 0) return;
    if (!isNaN(initialChIdx) && job.chapterAudios[initialChIdx]) {
      setActiveChapterIndex(initialChIdx);
    } else if (job.chapterAudios[activeChapterIndex] == null) {
      setActiveChapterIndex(keys[0]);
    }
  }, [job?.chapterAudios]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch job from API if navigated directly (and not in store yet)
  useEffect(() => {
    if (!id) return;
    const stored = jobs[id];
    if (
      stored &&
      (stored.stage === "complete" ||
        (stored.chapterAudios && Object.keys(stored.chapterAudios).length > 0))
    )
      return;

    setLoading(true);
    getJob(id)
      .then((data) => {
        if (!data || (data.status !== "complete" && !data.chapter_audios)) {
          navigate("/");
          return;
        }
        // Build chapterAudios from API response
        const chapterAudios: Record<number, string> = {};
        if (data.chapter_audios) {
          Object.entries(data.chapter_audios).forEach(([k, v]) => {
            chapterAudios[Number(k)] = v as string;
          });
        }
        setJob(id, {
          jobId: id,
          stage: data.status,
          status: data.status,
          progress: 100,
          message: "Audio ready!",
          audioUrl: data.audio_url || null,
          chapters: data.chapters || null,
          analyzedChapters: data.chapters || null,
          chapterAudios,
          transcript: data.transcript || null,
          filename: data.pdf_filename,
          chunksTotal: data.chunks_total,
          chunksDone: data.chunks_done,
          error: null,
        });

        // Set active chapter
        const keys = Object.keys(chapterAudios)
          .map(Number)
          .sort((a, b) => a - b);
        if (keys.length > 0) {
          setActiveChapterIndex(
            !isNaN(initialChIdx) && chapterAudios[initialChIdx]
              ? initialChIdx
              : keys[0],
          );
        }
      })
      .catch(() => setError("Could not load audiobook. Please try again."))
      .finally(() => setLoading(false));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-advance: when chapter audio ends, switch to next ready chapter
  const handleChapterEnded = useCallback(() => {
    if (!job?.chapterAudios) return;
    const readyKeys = Object.keys(job.chapterAudios)
      .map(Number)
      .sort((a, b) => a - b);
    const currentPos = readyKeys.indexOf(activeChapterIndex);
    if (currentPos >= 0 && currentPos < readyKeys.length - 1) {
      const next = readyKeys[currentPos + 1];
      setActiveChapterIndex(next);
    }
  }, [job?.chapterAudios, activeChapterIndex]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 to-white">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <svg
            className="h-8 w-8 animate-spin text-indigo-500"
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
          <p>Loading audiobook...</p>
        </div>
      </div>
    );
  }

  const handleClose = () => {
    navigate("/");
    if (job) {
      setJob(job.jobId, {
        stage: "reset",
        status: "reset",
        progress: 0,
        message: "Conversion Reset.",
      });
    }
  };

  // Need at least one ready chapter to show player
  const chapterAudios = job?.chapterAudios || {};
  const hasAudio = Object.keys(chapterAudios).length > 0;

  if (error || !job || (!hasAudio && job.stage !== "tts")) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 to-white px-4">
        <div className="max-w-md w-full">
          <ErrorBanner
            message={error || "Audiobook not found or still processing."}
            onDismiss={handleClose}
          />
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

  const activeAudioUrl = chapterAudios[activeChapterIndex]
    ? chapterAudioUrl(id!, activeChapterIndex)
    : Object.values(chapterAudios)[0];

  // Build chapter list with status badges
  const analyzedChapters = job.analyzedChapters || job.chapters || [];
  const chapterListItems = analyzedChapters.map((ch, i) => ({
    title: ch.title,
    startSec: 0, // not used in per-chapter mode
    isReady: !!chapterAudios[i],
    isActive: i === activeChapterIndex,
    index: i,
  }));

  const transcript = job.transcript || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="mx-auto max-w-2xl px-4 py-10">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <button
            onClick={handleClose}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600 transition"
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
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            New conversion
          </button>
          <img src={logo} alt="VoiceMyBook" className="h-8 w-8 rounded-lg" />
        </div>

        {/* Book title */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">
            {job.filename?.replace(/\.pdf$/i, "") || "Audiobook"}
          </h1>
          <div className="mt-1 flex items-center gap-2">
            {chapterListItems.length > 0 && (
              <p className="text-sm text-slate-400">
                {Object.keys(chapterAudios).length} / {chapterListItems.length}{" "}
                chapters ready
              </p>
            )}
            {stillProcessing && (
              <span className="flex items-center gap-1 text-xs text-amber-600">
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
                Still processing…
              </span>
            )}
          </div>
        </div>

        {/* Player */}
        {activeAudioUrl && (
          <div className="mb-5">
            <AudioPlayer
              audioUrl={activeAudioUrl}
              filename={
                analyzedChapters[activeChapterIndex]?.title || job.filename
              }
              speed={selectedSpeed}
              onSpeedChange={setSpeed}
              onEnded={handleChapterEnded}
            />
          </div>
        )}

        {/* Transcript toggle + viewer */}
        {transcript.length > 0 && (
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
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
              {showTranscript ? "Hide" : "Show"} Transcript
            </button>
            {showTranscript && (
              <TranscriptViewer
                transcript={transcript}
                currentTime={currentTime}
                activeChapterIndex={activeChapterIndex}
                onSeek={seekToChapter}
              />
            )}
          </div>
        )}

        {/* Chapter list with status badges */}
        {chapterListItems.length > 1 && (
          <div className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Chapters
            </h3>
            <ul className="divide-y divide-slate-100">
              {chapterListItems.map((ch) => {
                const isActive = ch.isActive;
                const isReady = ch.isReady;
                return (
                  <li key={ch.index}>
                    <button
                      onClick={() => {
                        if (isReady) setActiveChapterIndex(ch.index);
                      }}
                      disabled={!isReady}
                      className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5
                        text-left text-sm transition
                        ${isActive ? "bg-indigo-50 font-medium text-indigo-700" : "text-slate-700"}
                        ${isReady ? "hover:bg-indigo-50 cursor-pointer" : "cursor-default opacity-60"}
                      `}
                    >
                      <span className="flex items-center gap-2.5 max-w-[70%]">
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs
                            ${isActive ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"}`}
                        >
                          {ch.index + 1}
                        </span>
                        <span className="truncate">{ch.title}</span>
                      </span>
                      <span className="shrink-0">
                        {isReady ? (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                            ▶ Ready
                          </span>
                        ) : stillProcessing ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                            ⟳ Processing
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                            ○ Pending
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
