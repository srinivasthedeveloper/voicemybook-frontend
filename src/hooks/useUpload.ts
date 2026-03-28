import { useState } from "react";
import { uploadPDF } from "../api/client";
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
      const uploadRes = await uploadPDF(file, (pct) => setUploadProgress(pct));

      setJob(uploadRes.jobId, {
        jobId: uploadRes.jobId,
        status: "pending",
        stage: "pending",
        progress: 0,
        message: "Uploaded successfully",
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
