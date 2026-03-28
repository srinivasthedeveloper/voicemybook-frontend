import { create } from "zustand";

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
}

interface Store {
  currentJobId: string | null;
  jobs: Record<string, JobState>;
  selectedVoice: string;
  selectedSpeed: number;
  selectedChapterIndices: number[];
  uploadProgress: number;

  setJob: (jobId: string, data: Partial<JobState>) => void;
  updateJob: (jobId: string, patch: Partial<JobState>) => void;
  setCurrentJob: (jobId: string) => void;
  setVoice: (voice: string) => void;
  setSpeed: (speed: number) => void;
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
