import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DropZone } from "../components/DropZone";
import UploadProgress from "../components/UploadProgress";
import ProcessingProgress from "../components/ProcessingProgress";
import VoiceSelector from "../components/VoiceSelector";
import SpeedSlider from "../components/SpeedSlider";
import VoiceTestBox from "../components/VoiceTestBox";
import ChapterSelector from "../components/ChapterSelector";
import ErrorBanner from "../components/ErrorBanner";
import { useUpload } from "../hooks/useUpload";
import { useSSE } from "../hooks/useSSE";
import useJobStore from "../store/useJobStore";
import { getGeneratorState, startChapters } from "../api/client";
import logo from "/public/logo.png";
import ThemeToggle from "../components/ThemeToggle";

export default function HomePage() {
  const navigate = useNavigate();
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);
  const { upload, isUploading, error, setError } = useUpload();
  const {
    uploadProgress,
    selectedVoice,
    selectedSpeed,
    selectedChapterIndices,
    setVoice,
    setSpeed,
    setSelectedChapterIndices,
    currentJob,
  } = useJobStore();

  // SSE subscription for active job
  useSSE(activeJobId);

  const job = currentJob();

  async function handleFile(file: File) {
    const jobId = await upload(file);
    if (jobId) setActiveJobId(jobId);
  }

  async function handleConvert(indices: number[]) {
    if (!activeJobId) return;
    setConverting(true);
    setSelectedChapterIndices(indices);
    try {
      // Cached book: chapters that already have audio open as-is (regenerate from the player)
      const { chapters } = await getGeneratorState(activeJobId);
      const todo = indices.filter((i) => !chapters.some((c) => c.chapterIndex === i && c.hasAudio));
      if (todo.length) await startChapters(activeJobId, todo, selectedVoice, selectedSpeed);
      void navigate(`/player/${activeJobId}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to start conversion";
      setError(msg);
      setConverting(false);
    }
  }

  const stage = job?.stage || "";
  const isUploaded = !!activeJobId;
  const isAnalyzing = stage === "analyzing";
  const isAnalyzed = stage === "analyzed";
  const isProcessing = ["extracting", "tts", "stitching"].includes(stage) || converting;

  const settings = (
    <section aria-label="Voice and speed" className="flex flex-col gap-5 rounded-2xl border border-slate-200 p-4 sm:p-5">
      <h2 className="text-base font-semibold text-slate-900">Voice &amp; speed</h2>
      <SpeedSlider value={selectedSpeed} onChange={setSpeed} disabled={isUploading} />
      <VoiceSelector value={selectedVoice} onChange={setVoice} disabled={isUploading} />
      <VoiceTestBox />
    </section>
  );

  return (
    <div className="min-h-svh bg-bg text-slate-700">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
        {/* Header */}
        <header className="mb-8 flex items-center gap-4 sm:mb-10">
          <img src={logo} alt="" className="h-12 w-12 shrink-0 rounded-xl sm:h-14 sm:w-14" />
          <div className="min-w-0 flex-1">
            <h1 className="font-read text-3xl font-semibold leading-tight text-slate-900 sm:text-4xl">
              Voice My Book
            </h1>
            <p className="mt-1 text-sm text-slate-500 sm:text-base">
              Turn a PDF into an audiobook. Start listening while the rest is still being read aloud.
            </p>
          </div>
          <ThemeToggle />
        </header>

        <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-start lg:gap-8">
          <div className="flex min-w-0 flex-col gap-5">
            {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
            {job?.error && (
              <ErrorBanner
                message={job.error}
                onDismiss={() => {
                  setActiveJobId(null);
                  useJobStore.setState({ currentJobId: null });
                }}
              />
            )}

            {/* Upload */}
            {!isUploading && !isUploaded && (
              <>
                <DropZone onFile={(file) => { void handleFile(file); }} disabled={isUploading} />
                <ol className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                  {[
                    "Upload a PDF (up to 50 MB). A book you've uploaded before opens instantly.",
                    "Pick the chapters you want.",
                    "Choose a voice and reading speed, and test them on any text.",
                    "Listen while chapters are still being generated.",
                  ].map((step, i) => (
                    <li key={i} className="flex gap-3 rounded-xl border border-slate-200 p-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-700">
                        {i + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </>
            )}

            {isUploading && <UploadProgress percent={uploadProgress} filename={job?.filename} />}

            {isUploaded && (isAnalyzing || (stage === "pending" && !job?.analyzedChapters)) && (
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 p-5" role="status">
                <svg className="h-5 w-5 animate-spin text-indigo-500" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-sm text-slate-600">Finding chapters…</p>
              </div>
            )}

            {isUploaded && isAnalyzed && !converting && job?.analyzedChapters && (
              <ChapterSelector chapters={job.analyzedChapters} onConvert={(i) => { void handleConvert(i); }} />
            )}

            {isUploaded && isProcessing && job && (
              <ProcessingProgress
                stage={job.stage}
                progress={job.progress}
                message={job.message}
                chunksTotal={job.chunksTotal}
                chunksDone={job.chunksDone}
                chapters={job.analyzedChapters}
                chapterAudios={job.chapterAudios}
                selectedChapterIndices={selectedChapterIndices}
              />
            )}
          </div>

          <aside className="lg:sticky lg:top-6">{settings}</aside>
        </div>
      </div>
    </div>
  );
}
