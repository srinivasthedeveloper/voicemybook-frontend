import { useEffect, useRef } from "react";
import useJobStore from "../store/useJobStore";
import type { TranscriptChunk } from "../store/useJobStore";

export function useSSE(jobId: string | null) {
  const updateJob = useJobStore((s) => s.updateJob);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!jobId) return;

    const base = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");
    const es = new EventSource(`${base}/progress/${jobId}`);
    esRef.current = es;

    es.addEventListener("status", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);

        if (data.stage === "analyzing") {
          updateJob(jobId, {
            stage: data.stage,
            status: data.status || data.stage,
            progress: data.progress ?? 0,
            message: data.message || "",
          });
        } else if (data.stage === "analyzed") {
          updateJob(jobId, {
            stage: data.stage,
            status: data.status || data.stage,
            progress: data.progress ?? 5,
            message: data.message || "",
            analyzedChapters: data.chapters || null,
            pageCount: data.pageCount ?? null,
          });
        } else if (data.stage === "tts" || data.stage === "extracting") {
          const patch: Partial<import("../store/useJobStore").JobState> = {
            stage: data.stage,
            status: data.status || data.stage,
            progress: data.progress ?? 0,
            message: data.message || "",
            chunksTotal: data.chunksTotal ?? 0,
            chunksDone: data.chunksDone ?? 0,
          };
          // Initial snapshot may include already-ready chapters
          if (data.chapterAudios) {
            const audios: Record<number, string> = {};
            Object.entries(data.chapterAudios).forEach(([k, v]) => { audios[Number(k)] = v as string; });
            patch.chapterAudios = audios;
          }
          if (data.transcript) patch.transcript = data.transcript;
          updateJob(jobId, patch);
        } else if (data.stage === "chapter_ready") {
          // Merge new chapter audio + transcript into existing state
          // Use getState() to avoid stale closure over `jobs`
          const currentJob = useJobStore.getState().jobs[jobId];
          const existingAudios = currentJob?.chapterAudios || {};
          const existingTranscript: TranscriptChunk[] = currentJob?.transcript || [];
          const newTranscript: TranscriptChunk[] = data.transcript || [];

          // If data.chapterAudios is present (initial snapshot), use full map
          const mergedAudios = data.chapterAudios
            ? (() => {
                const a: Record<number, string> = { ...existingAudios };
                Object.entries(data.chapterAudios).forEach(([k, v]) => { a[Number(k)] = v as string; });
                return a;
              })()
            : { ...existingAudios, [data.chapterIndex]: data.audioUrl };

          updateJob(jobId, {
            stage: data.stage,
            status: data.status || "tts",
            chapterAudios: mergedAudios,
            transcript: data.chapterAudios
              ? (data.transcript || existingTranscript)  // full transcript from snapshot
              : [...existingTranscript, ...newTranscript],
            // Set first ready chapter as audioUrl for backward compat
            audioUrl: currentJob?.audioUrl || data.audioUrl || null,
          });
        } else if (data.stage === "complete") {
          const existingAudios = useJobStore.getState().jobs[jobId]?.chapterAudios || {};
          updateJob(jobId, {
            stage: data.stage,
            status: "complete",
            progress: 100,
            message: data.message || "All chapters ready!",
            chapterAudios: data.chapterAudios
              ? { ...existingAudios, ...data.chapterAudios }
              : existingAudios,
          });
          es.close();
        } else if (data.stage === "error") {
          updateJob(jobId, {
            stage: data.stage,
            status: "error",
            error: data.message || data.errorMessage || "Unknown error",
          });
          es.close();
        } else {
          // Fallback / initial snapshot: generic update
          const patch: Partial<import("../store/useJobStore").JobState> = {
            stage: data.stage,
            status: data.status || data.stage,
            progress: data.progress ?? 0,
            message: data.message || "",
            chunksTotal: data.chunksTotal ?? 0,
            chunksDone: data.chunksDone ?? 0,
            audioUrl: data.audioUrl || null,
            error: data.error || null,
          };
          if (data.chapters) patch.analyzedChapters = data.chapters;
          if (data.chapterAudios) {
            // Convert string keys to numbers
            const audios: Record<number, string> = {};
            Object.entries(data.chapterAudios).forEach(([k, v]) => {
              audios[Number(k)] = v as string;
            });
            patch.chapterAudios = audios;
          }
          if (data.transcript) patch.transcript = data.transcript;

          updateJob(jobId, patch);

          if (data.stage === "complete" || data.stage === "error") {
            es.close();
          }
        }
      } catch {
        // ignore parse errors
      }
    });

    es.addEventListener("close", () => {
      es.close();
    });

    es.onerror = () => {
      // EventSource auto-reconnects on network errors
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [jobId]); // eslint-disable-line react-hooks/exhaustive-deps
}
