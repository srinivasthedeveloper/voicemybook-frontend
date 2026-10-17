import { useEffect, useRef } from "react";
import type { TranscriptChunk } from "../store/useJobStore";

interface Props {
  transcript: TranscriptChunk[];
  currentTime: number;
  activeChapterIndex: number;
  onSeek: (startSec: number) => void;
}

interface Line {
  text: string;
  startSec: number;
}

const SENTENCE = /[^.!?]+(?:[.!?]+["'”’)\]]*|$)\s*/g;

// Sentence start times are estimated by character position inside the chunk's measured duration
function splitLines(chunk: TranscriptChunk): Line[] {
  const parts = chunk.text.match(SENTENCE)?.filter((p) => p.trim()) ?? [chunk.text];
  const total = parts.reduce((n, p) => n + p.length, 0) || 1;
  const span = chunk.endSec - chunk.startSec;
  let before = 0;
  return parts.map((p) => {
    const line = { text: p.replace(/\s+/g, " ").trim(), startSec: chunk.startSec + (before / total) * span };
    before += p.length;
    return line;
  });
}

export default function TranscriptViewer({
  transcript,
  currentTime,
  activeChapterIndex,
  onSeek,
}: Props) {
  const paragraphs = transcript
    .filter((c) => c.chapterIndex === activeChapterIndex)
    .map(splitLines);

  // Active line = last line whose start is at or before the playhead
  let active = "";
  for (const [pi, lines] of paragraphs.entries()) {
    for (const [li, line] of lines.entries()) {
      if (line.startSec <= currentTime) active = `${pi}:${li}`;
    }
  }

  const activeRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [active]);

  if (paragraphs.length === 0) return null;

  return (
    <div className="w-full rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Transcript
        </h3>
      </div>
      <div className="max-h-64 overflow-y-auto px-4 py-3">
        {paragraphs.map((lines, pi) => (
          <p key={pi} className="mb-3 text-sm leading-relaxed text-slate-700">
            {lines.map((line, li) => {
              const key = `${pi}:${li}`;
              return (
                <span
                  key={key}
                  ref={key === active ? activeRef : null}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSeek(line.startSec)}
                  onKeyDown={(e) => { if (e.key === "Enter") onSeek(line.startSec); }}
                  className={`cursor-pointer rounded px-0.5 transition
                    ${key === active ? "bg-indigo-100 font-medium text-indigo-900" : "hover:bg-slate-100"}`}
                >
                  {line.text}{" "}
                </span>
              );
            })}
          </p>
        ))}
      </div>
    </div>
  );
}
