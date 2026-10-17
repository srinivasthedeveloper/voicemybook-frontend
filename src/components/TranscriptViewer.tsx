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
  const boxRef = useRef<HTMLDivElement | null>(null);

  // Scroll only the transcript box (scrollIntoView would also move the page)
  useEffect(() => {
    const box = boxRef.current;
    const el = activeRef.current;
    if (!box || !el) return;
    const top = el.offsetTop;
    if (top < box.scrollTop || top > box.scrollTop + box.clientHeight - 40) {
      box.scrollTo({ top: Math.max(0, top - box.clientHeight / 3), behavior: "smooth" });
    }
  }, [active]);

  if (paragraphs.length === 0) return null;

  return (
    <div ref={boxRef} className="relative max-h-[60svh] overflow-y-auto px-4 py-4 sm:px-6 lg:max-h-[28rem]">
      <div className="mx-auto max-w-prose">
        {paragraphs.map((lines, pi) => (
          <p key={pi} className="mb-4 font-read text-[1.05rem] leading-8 text-slate-800">
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
                    ${key === active ? "bg-indigo-100 text-slate-900 underline decoration-indigo-500 decoration-2 underline-offset-4" : "hover:bg-slate-100"}`}
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
