import { useEffect, useRef } from "react";
import type { TranscriptChunk } from "../store/useJobStore";

interface Props {
  transcript: TranscriptChunk[];
  currentTime: number;
  activeChapterIndex: number;
  onSeek: (startSec: number) => void;
}

export default function TranscriptViewer({
  transcript,
  currentTime,
  activeChapterIndex,
  onSeek,
}: Props) {
  // Filter to current chapter's chunks
  const chunks = transcript.filter((c) => c.chapterIndex === activeChapterIndex);

  // Find active chunk (last one where startSec <= currentTime)
  let activeIdx = -1;
  for (let i = 0; i < chunks.length; i++) {
    if (chunks[i].startSec <= currentTime) activeIdx = i;
    else break;
  }

  const activeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [activeIdx]);

  if (chunks.length === 0) return null;

  return (
    <div className="w-full rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Transcript
        </h3>
      </div>
      <div className="max-h-64 overflow-y-auto px-2 py-2">
        {chunks.map((chunk, i) => (
          <button
            key={i}
            ref={i === activeIdx ? activeRef : null}
            onClick={() => onSeek(chunk.startSec)}
            className={`block w-full rounded-lg px-3 py-2 text-left text-sm leading-relaxed transition
              ${i === activeIdx
                ? "bg-indigo-100 font-medium text-indigo-900"
                : "text-slate-700 hover:bg-slate-50"
              }`}
          >
            {chunk.text}
          </button>
        ))}
      </div>
    </div>
  );
}
