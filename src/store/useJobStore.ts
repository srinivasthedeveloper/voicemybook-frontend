import { create } from "zustand";
import type { ChapterGen, GeneratorState, QueueItem } from "../api/client";

export interface Chapter {
  title: string;
  startSec: number;
}

export interface AnalyzedChapter {
  title: string;
  charOffset: number;
  isSkippable: boolean;
  charCount?: number;
}

export interface TranscriptChunk {
  startSec: number;
  endSec: number;
  text: string;
  chapterIndex: number;
}

export interface JobState {
  jobId: string;
  status: string;
  stage: string;
  progress: number;
  message: string;
  chunksTotal: number;
  chunksDone: number;
  audioUrl: string | null;
  chapters: Chapter[] | null;
  analyzedChapters: AnalyzedChapter[] | null;
  chapterAudios: Record<number, string>;
  transcript: TranscriptChunk[] | null;
  activeChapterIndex: number;
  error: string | null;
  filename?: string;
  pageCount?: number | null;
  gen?: Record<number, ChapterGen>;
  queue?: QueueItem[];
  parallel?: number;
  msPerChar?: number;
  live?: boolean;
}

export interface SpeedRange {
  min: number;
  max: number;
}

// SSE payloads from the backend generator
export type GenEvent =
  | ({ stage: "chunk_ready"; chapterIndex: number; runId: number; totalChunks?: number; etaSec?: number } & ChapterGen["chunks"][number])
  | { stage: "chapter_state"; chapterIndex: number; state: ChapterGen["state"]; runId: number; hasAudio: boolean; totalChunks?: number; error?: string; note?: string }
  | { stage: "chapter_ready"; chapterIndex: number; audioUrl: string; transcript: TranscriptChunk[] }
  | { stage: "generator_state"; queue: QueueItem[]; parallel?: number; msPerChar?: number };

const SPEED_RANGE_KEY = "vmb.speedRange";
const DEFAULT_RANGE: SpeedRange = { min: 0.5, max: 2 };

export function isValidRange(r: SpeedRange) {
  return Number.isFinite(r.min) && Number.isFinite(r.max) && r.min >= 0.5 && r.max <= 2 && r.min < r.max;
}

function loadSpeedRange(): SpeedRange {
  try {
    const r = JSON.parse(localStorage.getItem(SPEED_RANGE_KEY) || "null") as SpeedRange | null;
    return r && isValidRange(r) ? r : DEFAULT_RANGE;
  } catch {
    return DEFAULT_RANGE;
  }
}

const emptyGen = (chapterIndex: number): ChapterGen => ({
  chapterIndex,
  state: "not_started",
  runId: 0,
  hasAudio: false,
  chunks: [],
});

function reduceGen(job: JobState, e: GenEvent): Partial<JobState> {
  if (e.stage === "generator_state") {
    return { queue: e.queue, parallel: e.parallel ?? job.parallel, msPerChar: e.msPerChar || job.msPerChar };
  }
  const gen = { ...(job.gen || {}) };
  const cur = gen[e.chapterIndex] || emptyGen(e.chapterIndex);
  if (e.stage === "chunk_ready") {
    const base = e.runId > cur.runId ? { ...cur, runId: e.runId, chunks: [] } : cur;
    if (e.runId < cur.runId || base.chunks.some((c) => c.chunkIndex === e.chunkIndex)) return {};
    const { chunkIndex, url, text, durationSec, voice, speed } = e;
    gen[e.chapterIndex] = {
      ...base,
      totalChunks: e.totalChunks ?? base.totalChunks,
      etaSec: e.etaSec ?? base.etaSec,
      note: undefined,
      chunks: [...base.chunks, { chunkIndex, url, text, durationSec, voice, speed }],
    };
    return { gen };
  }
  if (e.stage === "chapter_state") {
    gen[e.chapterIndex] = {
      ...cur,
      state: e.state,
      runId: e.runId,
      hasAudio: e.hasAudio,
      totalChunks: e.totalChunks ?? cur.totalChunks,
      error: e.error,
      note: e.note,
      chunks: e.runId === cur.runId ? cur.chunks : [],
    };
    return { gen };
  }
  const transcript = (job.transcript || [])
    .filter((t) => t.chapterIndex !== e.chapterIndex)
    .concat(e.transcript)
    .sort((a, b) => a.chapterIndex - b.chapterIndex);
  return { chapterAudios: { ...(job.chapterAudios || {}), [e.chapterIndex]: e.audioUrl }, transcript };
}

interface Store {
  currentJobId: string | null;
  jobs: Record<string, JobState>;
  selectedVoice: string;
  selectedSpeed: number;
  playbackRate: number;
  speedRange: SpeedRange;
  selectedChapterIndices: number[];
  uploadProgress: number;

  setJob: (jobId: string, data: Partial<JobState>) => void;
  updateJob: (jobId: string, patch: Partial<JobState>) => void;
  setCurrentJob: (jobId: string) => void;
  setVoice: (voice: string) => void;
  setSpeed: (speed: number) => void;
  setPlaybackRate: (rate: number) => void;
  setSpeedRange: (range: SpeedRange) => void;
  setGenState: (jobId: string, state: GeneratorState) => void;
  applyGenEvent: (jobId: string, event: GenEvent) => void;
  setSelectedChapterIndices: (indices: number[]) => void;
  setUploadProgress: (pct: number) => void;
  reset: () => void;
  currentJob: () => JobState | null;
}

const useJobStore = create<Store>((set, get) => ({
  currentJobId: null,
  jobs: {},
  selectedVoice: "af_heart",
  selectedSpeed: 1.0,
  playbackRate: 1.0,
  speedRange: loadSpeedRange(),
  selectedChapterIndices: [],
  uploadProgress: 0,

  setJob: (jobId, data) =>
    set((s) => ({
      jobs: { ...s.jobs, [jobId]: { ...s.jobs[jobId], ...data } as JobState },
      currentJobId: jobId,
    })),

  updateJob: (jobId, patch) =>
    set((s) => ({
      jobs: {
        ...s.jobs,
        [jobId]: { ...(s.jobs[jobId] || {}), ...patch } as JobState,
      },
    })),

  setCurrentJob: (jobId) => set({ currentJobId: jobId }),
  setVoice: (voice) => set({ selectedVoice: voice }),
  setSpeed: (speed) => set({ selectedSpeed: speed }),
  setPlaybackRate: (rate) => set({ playbackRate: rate }),
  setSpeedRange: (range) => {
    if (!isValidRange(range)) return;
    try {
      localStorage.setItem(SPEED_RANGE_KEY, JSON.stringify(range));
    } catch {
      // storage unavailable: keep in memory only
    }
    set({ speedRange: range });
  },
  setGenState: (jobId, state) =>
    set((s) => {
      const gen: Record<number, ChapterGen> = {};
      for (const c of state.chapters) gen[c.chapterIndex] = c;
      return {
        jobs: {
          ...s.jobs,
          [jobId]: { ...s.jobs[jobId], gen, queue: state.queue, parallel: state.parallel, msPerChar: state.msPerChar },
        },
      };
    }),
  applyGenEvent: (jobId, event) =>
    set((s) => {
      const job = s.jobs[jobId];
      if (!job) return {};
      const patch = reduceGen(job, event);
      return Object.keys(patch).length ? { jobs: { ...s.jobs, [jobId]: { ...job, ...patch } } } : {};
    }),
  setSelectedChapterIndices: (indices) => set({ selectedChapterIndices: indices }),
  setUploadProgress: (pct) => set({ uploadProgress: pct }),

  reset: () =>
    set({
      currentJobId: null,
      jobs: {},
      uploadProgress: 0,
      selectedChapterIndices: [],
    }),

  currentJob: () => {
    const { jobs, currentJobId } = get();
    return currentJobId ? jobs[currentJobId] || null : null;
  },
}));

export default useJobStore;
