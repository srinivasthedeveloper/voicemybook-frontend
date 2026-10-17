import { useState } from "react";
import { lookupUpload, uploadPDF } from "../api/client";
import useJobStore from "../store/useJobStore";

export function useUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setJob, setUploadProgress } = useJobStore();

  async function upload(file: File): Promise<string | null> {
    setError(null);
    setIsUploading(true);
    setUploadProgress(0);

    try {
      // crypto.subtle only exists on secure origins (e.g. not http://<LAN IP>); server dedupes anyway
      let cached = null;
      if (globalThis.crypto?.subtle) {
        const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
        const sha256 = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
        cached = await lookupUpload(sha256);
      }
      const uploadRes = cached ?? (await uploadPDF(file, (pct) => setUploadProgress(pct)));

      setJob(uploadRes.jobId, {
        jobId: uploadRes.jobId,
        status: "pending",
        stage: "pending",
        progress: 0,
        message: cached ? "Loaded from cache" : "Uploaded successfully",
        chunksTotal: 0,
        chunksDone: 0,
        audioUrl: null,
        chapters: null,
        analyzedChapters: null,
        chapterAudios: {},
        transcript: null,
        activeChapterIndex: 0,
        error: null,
        filename: uploadRes.filename,
        pageCount: uploadRes.pageCount,
      });

      return uploadRes.jobId;
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Upload failed. Please try again.";
      setError(msg);
      return null;
    } finally {
      setIsUploading(false);
    }
  }

  return { upload, isUploading, error, setError };
}
