import { useEffect, useRef } from "react";
import useJobStore from "../store/useJobStore";
import type { GenEvent } from "../store/useJobStore";
import type { GeneratorState } from "../api/client";

const GEN_STAGES = new Set(["chunk_ready", "chapter_state", "chapter_ready", "generator_state"]);

export function useSSE(jobId: string | null) {
  const updateJob = useJobStore((s) => s.updateJob);
  const applyGenEvent = useJobStore((s) => s.applyGenEvent);
  const setGenState = useJobStore((s) => s.setGenState);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!jobId) return;

    const base = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");
    const es = new EventSource(`${base}/progress/${jobId}`);
    esRef.current = es;

    es.addEventListener("status", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);

        if (GEN_STAGES.has(data.stage)) {
          applyGenEvent(jobId, data as GenEvent);
          return;
        }
        if (data.generator) setGenState(jobId, data.generator as GeneratorState);

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

          if (data.stage === "error") es.close();
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
