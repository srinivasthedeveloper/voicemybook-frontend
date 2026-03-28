import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DropZone } from "../components/DropZone";
import UploadProgress from "../components/UploadProgress";
import ProcessingProgress from "../components/ProcessingProgress";
import VoiceSelector from "../components/VoiceSelector";
import ChapterSelector from "../components/ChapterSelector";
import ErrorBanner from "../components/ErrorBanner";
import { useUpload } from "../hooks/useUpload";
import { useSSE } from "../hooks/useSSE";
import useJobStore from "../store/useJobStore";
import { startConversion } from "../api/client";
import logo from "/public/logo.png";

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

  // Navigate to player as soon as the first chapter_ready fires
  useEffect(() => {
    if (!job || !activeJobId) return;
    if (job.stage === "chapter_ready" || (job.stage === "complete" && Object.keys(job.chapterAudios || {}).length > 0)) {
      navigate(`/player/${activeJobId}`);
    }
  }, [job?.stage, activeJobId, navigate]);

  async function handleFile(file: File) {
    const jobId = await upload(file);
    if (jobId) setActiveJobId(jobId);
  }

  async function handleConvert(indices: number[]) {
    if (!activeJobId) return;
    setConverting(true);
    setSelectedChapterIndices(indices);
    try {
      await startConversion(activeJobId, selectedVoice, selectedSpeed, indices);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="mx-auto max-w-2xl px-4 py-12">
        {/* Header */}
        <div className="mb-10 flex flex-col items-center text-center">
          <img
            src={logo}
            alt="VoiceMyBook"
            className="mb-4 h-16 w-16 rounded-2xl shadow-md"
          />
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">
            Voice My Book
          </h1>
          <p className="mt-2 text-lg text-slate-500">
            Turn any PDF textbook into an audiobook — free, no signup required
          </p>
        </div>

        {/* Errors */}
        {error && (
          <div className="mb-5">
            <ErrorBanner message={error} onDismiss={() => setError(null)} />
          </div>
        )}
        {job?.error && (
          <div className="mb-5">
            <ErrorBanner
              message={job.error}
              onDismiss={() => {
                setActiveJobId(null);
                useJobStore.setState({ currentJobId: null });
              }}
            />
          </div>
        )}

        <div className="flex flex-col gap-5">
          {/* Stage 1: Drop zone (before upload) */}
          {!isUploading && !isUploaded && (
            <>
              <DropZone
                onFile={(file) => { void handleFile(file); }}
                disabled={isUploading}
              />
              {/* Voice + Speed (shown before upload) */}
              <div className="flex gap-4 flex-col md:flex-row">
                <div className="flex-1">
                  <VoiceSelector value={selectedVoice} onChange={setVoice} disabled={isUploading} />
                </div>
                <div className="flex flex-row gap-1.5 justify-center items-center md:flex-col md:justify-start">
                  <label className="text-sm font-medium text-slate-700">Speed</label>
                  <select
                    value={selectedSpeed}
                    onChange={(e) => setSpeed(Number(e.target.value))}
                    disabled={isUploading}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm
                               text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none
                               focus:ring-2 focus:ring-indigo-200 disabled:opacity-50"
                  >
                    {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((s) => (
                      <option key={s} value={s}>{s}x</option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          {/* Stage 2: Upload progress */}
          {isUploading && (
            <UploadProgress percent={uploadProgress} filename={job?.filename} />
          )}

          {/* Stage 3: Analyzing spinner */}
          {isUploaded && (isAnalyzing || (stage === "pending" && !job?.analyzedChapters)) && (
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <svg className="h-5 w-5 animate-spin text-indigo-500" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-sm text-slate-600">Detecting chapters…</p>
            </div>
          )}

          {/* Stage 4: Chapter selector (after analysis, before conversion) */}
          {isUploaded && isAnalyzed && !converting && job?.analyzedChapters && (
            <>
              {/* Voice + Speed (shown here too) */}
              <div className="flex gap-4 flex-col md:flex-row">
                <div className="flex-1">
                  <VoiceSelector value={selectedVoice} onChange={setVoice} />
                </div>
                <div className="flex flex-row gap-1.5 justify-center items-center md:flex-col md:justify-start">
                  <label className="text-sm font-medium text-slate-700">Speed</label>
                  <select
                    value={selectedSpeed}
                    onChange={(e) => setSpeed(Number(e.target.value))}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm
                               text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none
                               focus:ring-2 focus:ring-indigo-200"
                  >
                    {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((s) => (
                      <option key={s} value={s}>{s}x</option>
                    ))}
                  </select>
                </div>
              </div>

              <ChapterSelector
                chapters={job.analyzedChapters}
                onConvert={handleConvert}
              />
            </>
          )}

          {/* Stage 5: TTS processing + chapter tiles */}
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

          {/* Info card (idle state only) */}
          {!isUploading && !isUploaded && (
            <div className="rounded-xl bg-indigo-50 p-4">
              <h3 className="mb-2 text-sm font-semibold text-indigo-800">How it works</h3>
              <ol className="space-y-1.5 text-sm text-indigo-700">
                <li>1. Upload your PDF textbook (up to 50 MB)</li>
                <li>2. Choose which chapters to convert</li>
                <li>3. Pick a voice and reading speed</li>
                <li>4. Listen while chapters are still processing</li>
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
