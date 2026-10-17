import axios from "axios";

const BASE = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");

const api = axios.create({ baseURL: BASE });

export interface UploadResponse {
  jobId: string;
  filename: string;
  sizeBytes: number;
  pageCount: number | null;
  cached?: boolean;
}

export interface ChunkInfo {
  chunkIndex: number;
  url: string;
  text: string;
  durationSec: number;
  voice: string;
  speed: number;
}

export type ChapterGenState = "not_started" | "queued" | "generating" | "paused" | "ready" | "stopped";

export interface ChapterGen {
  chapterIndex: number;
  state: ChapterGenState;
  runId: number;
  hasAudio: boolean;
  totalChunks?: number | null;
  etaSec?: number | null;
  chunks: ChunkInfo[];
  error?: string;
}

export interface QueueItem {
  jobId: string;
  chapterIndex: number;
}

export interface GeneratorState {
  voice: string;
  speed: number;
  queue: QueueItem[];
  parallel: number;
  msPerChar: number;
  chapters: ChapterGen[];
}

export type ApplyMode = "restart-chapter" | "resume";

export interface Voice {
  id: string;
  label: string;
}

export async function uploadPDF(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post<UploadResponse>("/upload", form, {
    onUploadProgress: (e) => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    },
  });
  return data;
}

export async function lookupUpload(sha256: string): Promise<UploadResponse | null> {
  try {
    const { data } = await api.get<UploadResponse>("/upload/lookup", { params: { sha256 } });
    return data;
  } catch (e: unknown) {
    if (axios.isAxiosError(e) && e.response?.status === 404) return null;
    throw e;
  }
}

export async function getGeneratorState(jobId: string): Promise<GeneratorState> {
  const { data } = await api.get<GeneratorState>(`/generate/${jobId}`);
  return data;
}

export async function startChapters(jobId: string, chapters: number[], voice?: string, speed?: number) {
  await api.post(`/generate/${jobId}/start`, { chapters, voice, speed });
}

export async function pauseJob(jobId: string) {
  await api.post(`/generate/${jobId}/pause`);
}

export async function resumeJob(jobId: string) {
  await api.post(`/generate/${jobId}/resume`);
}

export async function stopJob(jobId: string) {
  await api.post(`/generate/${jobId}/stop`);
}

export async function stopAll() {
  await api.post("/generate/stop-all");
}

export async function pauseChapter(jobId: string, chapterIndex: number) {
  await api.post(`/generate/${jobId}/chapters/${chapterIndex}/pause`);
}

export async function stopChapter(jobId: string, chapterIndex: number) {
  await api.post(`/generate/${jobId}/chapters/${chapterIndex}/stop`);
}

export async function applySettings(
  jobId: string,
  settings: { voice: string; speed: number; mode: ApplyMode; chapterIndex?: number },
) {
  await api.post(`/generate/${jobId}/settings`, settings);
}

export async function previewVoice(voice: string, speed: number, text: string): Promise<Blob> {
  const { data } = await api.post<Blob>("/voices/preview", { voice, speed, text }, { responseType: "blob" });
  return data;
}

export async function getJob(jobId: string) {
  const { data } = await api.get(`/job/${jobId}`);
  return data;
}

export async function getVoices(): Promise<Voice[]> {
  const { data } = await api.get<{ voices: Voice[] }>("/voices");
  return data.voices;
}

export function voicePreviewUrl(voiceId: string, speed?: number) {
  const q = speed == null ? "" : `&speed=${speed.toFixed(2)}`;
  return `${BASE}/voices/preview?voice=${encodeURIComponent(voiceId)}${q}`;
}

// Server-relative chunk/chapter URLs ("/api/...") resolved against the API base
export function resolveApiUrl(url: string) {
  return url.startsWith("/api/") ? `${BASE}${url.slice(4)}` : url;
}

export function zipUrl(jobId: string) {
  return `${BASE}/audio/${jobId}/zip`;
}

export function audioUrl(jobId: string) {
  return `${BASE}/audio/${jobId}`;
}

export function chapterAudioUrl(jobId: string, chapterIndex: number) {
  return `${BASE}/audio/${jobId}/ch/${chapterIndex}`;
}

export default api;
