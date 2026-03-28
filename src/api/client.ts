import axios from "axios";

const BASE = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");

const api = axios.create({ baseURL: BASE });

export interface UploadResponse {
  jobId: string;
  filename: string;
  sizeBytes: number;
  pageCount: number | null;
}

export interface ConvertResponse {
  jobId: string;
  status: string;
  voice: string;
  speed: number;
}

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

export async function startConversion(
  jobId: string,
  voice: string,
  speed: number,
  selectedChapterIndices?: number[],
): Promise<ConvertResponse> {
  const { data } = await api.post<ConvertResponse>("/convert", {
    jobId,
    voice,
    speed,
    selectedChapterIndices,
  });
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

export function voicePreviewUrl(voiceId: string) {
  return `${BASE}/voices/preview?voice=${encodeURIComponent(voiceId)}`;
}

export function audioUrl(jobId: string) {
  return `${BASE}/audio/${jobId}`;
}

export function chapterAudioUrl(jobId: string, chapterIndex: number) {
  return `${BASE}/audio/${jobId}/ch/${chapterIndex}`;
}

export default api;
